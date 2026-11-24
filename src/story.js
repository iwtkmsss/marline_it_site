// Story enhancements for the main page.
// - Gives the fixed header a solid background once the hero is scrolled past.
// - Browsers without CSS view timelines get the day → night backdrop from here.
(() => {
  'use strict';

  const root = document.documentElement;

  trackHeader(document.getElementById('site-header'));

  const nativeBackdrop = CSS.supports('animation-timeline', 'view()')
    && CSS.supports('animation-range', '0% 100%')
    && CSS.supports('timeline-scope', '--a');
  const layers = [...document.querySelectorAll('.backdrop-layer')];
  if (!nativeBackdrop && layers.length && 'IntersectionObserver' in window) {
    root.classList.add('backdrop-fallback');
    // Hero = morning, process = day, every night section = the last layer.
    const layerOf = section => section.classList.contains('hero-field') ? 0
      : section.classList.contains('act-process') ? 1 : layers.length - 1;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = layerOf(entry.target);
        layers.forEach((layer, layerIndex) => layer.classList.toggle('is-shown', layerIndex <= index));
      }
    }, { rootMargin: '-50% 0px -50% 0px' });
    document.querySelectorAll('.act').forEach(section => observer.observe(section));
  }

  function trackHeader(header) {
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      header.toggleAttribute('data-solid', window.scrollY > 24);
    };
    window.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    update();
  }
})();
