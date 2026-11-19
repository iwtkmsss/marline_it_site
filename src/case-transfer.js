(() => {
  'use strict';

  const portrait = document.getElementById('marilyn-portrait');
  const media = document.getElementById('portrait-media');
  const corner = document.getElementById('case-corner');
  const pixels = Array.from(corner?.children || []);
  // Opaque 24px crops along the shoulder of the original 1254px portrait.
  const size = 24;
  const crops = [[1032, 1008], [1008, 1032], [1008, 1056], [992, 1080],
    [960, 1104], [936, 1128], [936, 1152]];
  if (!portrait || !media || pixels.length !== crops.length) return;

  const root = document.documentElement;
  const nativeTimeline = CSS.supports('animation-timeline: scroll(root block)')
    && CSS.supports('animation-range: 0px 100px');
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => systemMotion.matches || root.dataset.reducedMotion === 'true';
  let ranges = [];
  let measureFrame = 0;
  let scrollFrame = 0;

  function syncScroll() {
    scrollFrame = 0;
    const moving = !reduced() && ranges.length > 0;
    const departed = moving && scrollY > ranges[0].start;
    if (departed !== root.classList.contains('case-departed')) {
      root.classList.toggle('case-departed', departed);
      if (departed) document.dispatchEvent(new Event('marline:transferstart'));
    }
    if (!moving || nativeTimeline) return;
    // Sample the same paused CSS keyframes on engines without scroll timelines.
    ranges.forEach(({ start, end }, index) => {
      const phase = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
      pixels[index].style.setProperty('--transfer-delay', `${-phase}s`);
    });
  }

  function measure() {
    measureFrame = 0;
    const { naturalWidth: width, naturalHeight: height } = portrait;
    if (!width || !height) return;
    const source = media.getBoundingClientRect();
    const target = corner.getBoundingClientRect();
    if (!source.width || !target.width) return;
    const fit = Math.min(source.width / width, source.height / height);
    const originX = source.left + (source.width - width * fit) / 2;
    const originY = source.top + (source.height - height * fit) / 2;
    const departure = Math.max(0, scrollY + originY + crops[0][1] * fit - innerHeight * .72);
    const arrival = Math.max(departure + 140, scrollY + target.top - innerHeight * .48);
    const span = arrival - departure;
    const mobile = innerWidth <= 700;
    const bow = mobile ? 5 : root.dataset.version === 'b' ? 76 : 28;
    ranges = pixels.map((pixel, index) => {
      const [x, y] = crops[index];
      const order = index / (pixels.length - 1);
      const start = departure + span * order * .2;
      const end = arrival - span * (1 - order) * .15;
      const slot = getComputedStyle(pixel);
      pixel.style.setProperty('--dx', `${originX + x * fit - target.left - pixel.offsetLeft}px`);
      pixel.style.setProperty('--dy', `${originY + y * fit - target.top - pixel.offsetTop}px`);
      pixel.style.setProperty('--source-scale', size * fit / parseFloat(slot.width));
      pixel.style.setProperty('--bow', `${bow * (.25 + order)}px`);
      pixel.style.setProperty('--leave', `${start}px`);
      pixel.style.setProperty('--land', `${end}px`);
      return { start, end };
    });
    syncScroll();
    root.classList.add('transfer-ready');
  }

  function queueMeasure() {
    if (!measureFrame) measureFrame = requestAnimationFrame(measure);
  }

  function prepare() {
    if (!portrait.naturalWidth) return;
    const w = portrait.naturalWidth;
    const h = portrait.naturalHeight;
    const holes = crops.map(([x, y]) => `M${x} ${y}h${size}v${size}h-${size}z`).join('');
    const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path fill-rule="evenodd" d="M0 0H${w}V${h}H0z${holes}"/></svg>`;
    media.style.setProperty('--cutouts', `url("data:image/svg+xml,${encodeURIComponent(mask)}")`);
    corner.style.setProperty('--crop-image', `url("${portrait.currentSrc}")`);
    corner.style.setProperty('--crop-size', `${100 * w / size}% ${100 * h / size}%`);
    pixels.forEach((pixel, index) => {
      const [x, y] = crops[index];
      pixel.style.setProperty('--crop-position', `${100 * x / (w - size)}% ${100 * y / (h - size)}%`);
    });
    root.dataset.caseTransfer = nativeTimeline ? 'native' : 'sampled';
    measure();
  }

  addEventListener('scroll', () => {
    if (!scrollFrame && !reduced()) scrollFrame = requestAnimationFrame(syncScroll);
  }, { passive: true });
  addEventListener('resize', queueMeasure);
  addEventListener('pageshow', queueMeasure);
  document.addEventListener('marline:versionchange', queueMeasure);
  document.addEventListener('marline:motionchange', syncScroll);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(queueMeasure);
    observer.observe(media);
    observer.observe(corner);
    observer.observe(document.body);
  }
  document.fonts?.ready.then(queueMeasure);
  if (portrait.complete) prepare();
  else portrait.addEventListener('load', prepare, { once: true });
})();
