import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchCart,
  upsertCartItem,
  removeCartItem,
  clearCart,
  fetchProductStock,
} from "../api/publicApi";

const CART_KEY = "telega_cart";

const CartContext = createContext(null);

function loadLocal() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function clampQty(q, stock) {
  const maxStock = stock != null ? Math.min(999, Number(stock)) : 999;
  return Math.min(maxStock, Math.max(1, Math.floor(Number(q) || 1)));
}

export function CartProvider({ children, isAuthenticated }) {
  const [items, setItems] = useState(loadLocal);
  const synced = useRef(false);
  const validationKey = useRef("");

  useEffect(() => {
    if (isAuthenticated && !synced.current) {
      synced.current = true;
      fetchCart()
        .then((serverItems) => {
          if (serverItems.length > 0) {
            setItems(
              serverItems.map((si) => ({
                product_id: si.product_id,
                slug: si.slug,
                name: si.name,
                price: Number(si.price),
                image_path: si.image_path,
                quantity: clampQty(si.quantity, si.stock),
                stock: si.stock,
              })),
            );
          }
        })
        .catch(() => {});
    }
    if (!isAuthenticated) {
      synced.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    saveLocal(items);
  }, [items]);

  useEffect(() => {
    if (isAuthenticated || items.length === 0) return;
    const key = items.map((x) => `${x.product_id}:${x.quantity}`).join("|");
    if (validationKey.current === key) return;
    validationKey.current = key;
    let alive = true;

    Promise.allSettled(
      items.map(async (line) => ({
        ...line,
        stock: await fetchProductStock(line.product_id),
      })),
    ).then((results) => {
      if (!alive) return;
      const next = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => ({
          ...r.value,
          quantity: clampQty(r.value.quantity, r.value.stock),
        }));
      if (
        next.length !== items.length ||
        next.some(
          (line, idx) =>
            line.stock !== items[idx]?.stock ||
            line.quantity !== items[idx]?.quantity,
        )
      ) {
        setItems(next);
      }
    });

    return () => {
      alive = false;
    };
  }, [isAuthenticated, items]);

  const syncLine = useCallback(
    async (productId, quantity) => {
      if (!isAuthenticated) return;
      try {
        await upsertCartItem(productId, quantity);
      } catch {
        /* ignore */
      }
    },
    [isAuthenticated],
  );

  const addItem = useCallback(
    (product, qty = 1) => {
      const id = product.id;
      const stock = product.stock ?? 9999;
      const addQ = clampQty(qty, stock);
      const existing = items.find((x) => x.product_id === id);
      const currentQty = existing?.quantity || 0;
      const mergedQty = clampQty(currentQty + addQ, stock);
      const maxReached = existing && mergedQty <= currentQty;

      setItems((prev) => {
        const current = prev.find((x) => x.product_id === id);
        const nextQty = current
          ? clampQty(current.quantity + addQ, stock)
          : addQ;
        const next =
          current != null
            ? prev.map((x) =>
                x.product_id === id ? { ...x, quantity: nextQty, stock } : x,
              )
            : [
                ...prev,
                {
                  product_id: id,
                  slug: product.slug,
                  name: product.name,
                  price: Number(product.price),
                  image_path: product.image_path || null,
                  quantity: nextQty,
                  stock,
                },
              ];
        const line = next.find((x) => x.product_id === id);
        if (line) syncLine(line.product_id, line.quantity);
        return next;
      });
      return {
        ok: !maxReached,
        reason: maxReached ? "max_quantity" : null,
        quantity: mergedQty,
        max: Math.min(999, Number(stock) || 999),
      };
    },
    [items, syncLine],
  );

  const setQty = useCallback(
    (productId, quantity, stockHint) => {
      setItems((prev) => {
        const line = prev.find((x) => x.product_id === productId);
        const stock = stockHint ?? line?.stock ?? 9999;
        const q = clampQty(quantity, stock);
        const next = prev.map((x) =>
          x.product_id === productId ? { ...x, quantity: q, stock } : x,
        );
        if (line) syncLine(productId, q);
        return next;
      });
    },
    [syncLine],
  );

  const removeItem = useCallback(
    async (productId) => {
      setItems((prev) => prev.filter((x) => x.product_id !== productId));
      if (isAuthenticated) {
        try {
          await removeCartItem(productId);
        } catch {
          /* ignore */
        }
      }
    },
    [isAuthenticated],
  );

  const clear = useCallback(async () => {
    setItems([]);
    if (isAuthenticated) {
      try {
        await clearCart();
      } catch {
        /* ignore */
      }
    }
  }, [isAuthenticated]);

  const total = useMemo(
    () => items.reduce((s, x) => s + x.price * x.quantity, 0),
    [items],
  );

  const itemCount = useMemo(
    () => items.reduce((s, x) => s + x.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({ items, addItem, setQty, removeItem, clear, total, itemCount }),
    [items, addItem, setQty, removeItem, clear, total, itemCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
