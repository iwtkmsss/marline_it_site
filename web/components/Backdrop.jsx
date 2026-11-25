'use client';

import { useEffect, useRef } from 'react';

// CSS view timelines drive the day → night layers. Browsers without them get
// the section in the middle of the viewport from an IntersectionObserver.
export default function Backdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const native = CSS.supports('animation-timeline', 'view()')
      && CSS.supports('animation-range', '0% 100%')
      && CSS.supports('timeline-scope', '--a');
    if (native || !('IntersectionObserver' in window)) return undefined;

    const layers = [...ref.current.children];
    document.documentElement.classList.add('backdrop-fallback');
    const layerOf = section => section.classList.contains('hero-field') ? 0
      : section.classList.contains('act-process') ? 1 : layers.length - 1;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const current = layerOf(entry.target);
        layers.forEach((layer, index) => layer.classList.toggle('is-shown', index <= current));
      }
    }, { rootMargin: '-50% 0px -50% 0px' });
    document.querySelectorAll('.act').forEach(section => observer.observe(section));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('backdrop-fallback');
    };
  }, []);

  return (
    <div className="backdrop" aria-hidden="true" ref={ref}>
      <i className="backdrop-layer layer-dressing" />
      <i className="backdrop-layer layer-reading" />
      <i className="backdrop-layer layer-premiere" />
    </div>
  );
}
