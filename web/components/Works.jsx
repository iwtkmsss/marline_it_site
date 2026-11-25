'use client';

import { useRef, useState } from 'react';

const mockup = '/assets/works/first-mockup.png';

export default function Works() {
  const viewer = useRef(null);
  const [opened, setOpened] = useState(false);

  // Without JS, or with a modifier key, the link simply opens the picture.
  function openViewer(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof viewer.current?.showModal !== 'function') return;
    event.preventDefault();
    setOpened(true);
    viewer.current.showModal();
    viewer.current.scrollTop = 0;
  }

  return (
    <>
      <section className="act act-night section-works shell" id="works" aria-labelledby="works-title">
        <div className="section-intro">
          <h2 id="works-title">Цей сайт: від макета до сторінки</h2>
          <p>Реальних кейсів ми тут поки не показуємо. Зате можна побачити, як змінювався цей сайт: від першого макета до сторінки, яку ви зараз гортаєте.</p>
        </div>
        <div className="board">
          <a className="case-link board-frame" href={mockup} aria-haspopup="dialog" onClick={openViewer}>
            <img src={mockup} alt="Перший макет головної сторінки Marline" width="1440" height="3000" loading="lazy" decoding="async" />
            <span className="frame-caption">Перший макет <span aria-hidden="true">↗</span></span>
          </a>
          <figure className="board-frame">
            <img src="/assets/works/site-hero.webp" alt="Перший екран теперішнього сайту на комп’ютері" width="1200" height="750" loading="lazy" decoding="async" />
            <figcaption className="frame-caption">Готова сторінка</figcaption>
          </figure>
          <figure className="board-frame board-frame-phone">
            <img src="/assets/works/site-mobile.webp" alt="Перший екран теперішнього сайту на телефоні" width="500" height="960" loading="lazy" decoding="async" />
            <figcaption className="frame-caption">Мобільна версія</figcaption>
          </figure>
        </div>
      </section>

      <dialog className="case-viewer" ref={viewer} aria-labelledby="viewer-title" closedby="any">
        <header>
          <h2 id="viewer-title">Дизайн-концепція Marline</h2>
          <form method="dialog"><button>Закрити</button></form>
        </header>
        {opened && <img src={mockup} alt="Повний макет головної сторінки Marline" width="1440" height="3000" />}
      </dialog>
    </>
  );
}
