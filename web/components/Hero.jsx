'use client';

import { useEffect } from 'react';

// The portrait scene is a canvas engine that works on the nodes below by id.
// This component has no state, so React never re-renders them.
export default function Hero({ portrait }) {
  useEffect(() => {
    if (!portrait) {
      import('../lib/hero-scene').then(({ startHeroScene }) => startHeroScene('/assets/mascot/hero-frames/'));
    }
  }, [portrait]);

  return (
    <div className="act act-dressing hero-field" id="dressing">
      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" tabIndex={-1}>Спочатку бізнес.<br />Потім — код.</h1>
          <p className="hero-description">Marline розробляє сайти, цифрові продукти й внутрішні системи. Спершу розбираємося, як працює ваш бізнес, а потім створюємо рішення, які допомагають йому працювати краще.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#process">Як ми працюємо</a>
            <a className="text-link" href="#solutions">Що ми робимо<span aria-hidden="true">↓</span></a>
          </div>
        </div>

        {portrait ?? <div className="portrait-stage" id="portrait-stage">
          <div className="pixel-stage" aria-hidden="true" />
          <span className="stage-pixel stage-pixel-one" aria-hidden="true" />
          <span className="stage-pixel stage-pixel-two" aria-hidden="true" />
          <span className="stage-pixel stage-pixel-three" aria-hidden="true" />
          <span className="stage-pixel stage-pixel-four" aria-hidden="true" />
          <div className="portrait-media" id="portrait-media" suppressHydrationWarning>
            <img id="marilyn-portrait" src="/assets/mascot/marilyn-pixel-v1.png" alt="Піксельна Мерилін Монро — персонаж Marline" width="1254" height="1254" fetchPriority="high" decoding="async" />
            <canvas id="portrait-canvas" aria-hidden="true" />
          </div>
        </div>}
        {!portrait && <svg className="wind-ribbon" id="wind-ribbon" aria-hidden="true" focusable="false" />}
      </section>
    </div>
  );
}
