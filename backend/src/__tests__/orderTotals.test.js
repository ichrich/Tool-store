describe("order totals", () => {
  function orderTotal(items, discount) {
    const subtotal = items.reduce(
      (s, it) => s + Number(it.unit_price) * Number(it.quantity),
      0,
    );
    const d = Number(discount || 0);
    return Math.max(0, Math.round((subtotal - d) * 100) / 100);
  }

  test("subtotal minus discount", () => {
    expect(orderTotal([{ unit_price: 100, quantity: 2 }], 50)).toBe(150);
  });

  test("discount cannot make total negative", () => {
    expect(orderTotal([{ unit_price: 10, quantity: 1 }], 999)).toBe(0);
  });
});
