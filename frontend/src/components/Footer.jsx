export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <div className="site-logo">
            <span className="site-logo__mark">T</span>
            <span>Телега</span>
          </div>
          <p>Профессиональный инструмент для точной работы.</p>
        </div>
        <div className="footer-meta">
          © {new Date().getFullYear()} Телега · Каталог · Сервис · Доставка
        </div>
      </div>
    </footer>
  );
}
