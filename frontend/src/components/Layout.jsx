import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ReviewRestrictionModal } from "./ReviewRestrictionModal";

const STORAGE_KEY = "review_restriction_modal";

export function Layout() {
  const [restrictionModal, setRestrictionModal] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.active) setRestrictionModal(parsed);
    } catch {
      /* */
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <div className="container">
          <div className="page-transition" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
      <ReviewRestrictionModal
        open={!!restrictionModal}
        data={restrictionModal}
        onClose={() => setRestrictionModal(null)}
      />
    </div>
  );
}
