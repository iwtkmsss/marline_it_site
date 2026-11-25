import { navigation } from '../lib/content';

// #motion-toggle and #motion-note are driven by lib/hero-scene.js.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner shell">
        <a className="footer-wordmark" href="#site-header" aria-label="Marline — на початок">marline</a>
        <nav className="footer-nav" aria-label="Навігація у футері">
          {navigation.map(item => <a href={item.href} key={item.href}>{item.label}</a>)}
          <a href="#contact">Контакти</a>
        </nav>
        <a className="back-top" href="#site-header">Догори <span aria-hidden="true">↑</span></a>
        <div className="footer-bottom">
          <p className="copyright">© 2026 Marline</p>
          <div className="motion-preference">
            <button className="motion-toggle" id="motion-toggle" type="button" aria-pressed="false" aria-describedby="motion-note" hidden><span className="motion-toggle-mark" aria-hidden="true" />Менше руху</button>
            <span className="motion-note" id="motion-note" role="status" />
          </div>
        </div>
      </div>
    </footer>
  );
}
