(() => {
  'use strict';

  const root = document.documentElement;
  const toggle = document.getElementById('motion-toggle');
  const note = document.getElementById('motion-note');
  const portrait = document.getElementById('marilyn-portrait');
  const media = document.getElementById('portrait-media');
  const canvas = document.getElementById('portrait-canvas');
  const stage = document.getElementById('portrait-stage');
  const trail = document.getElementById('motion-trail');
  const nodes = [...document.querySelectorAll('.process-node')];
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nativeScrollTimeline = CSS.supports('animation-timeline', 'scroll(root block)') && CSS.supports('animation-range', '0% 100%');
  root.dataset.scrollMotion = nativeScrollTimeline ? 'native' : 'static';
  const DURATION = 1550;
  const clamp = value => Math.min(1, Math.max(0, value));
  const easeOut = value => 1 - Math.pow(1 - value, 4);
  const smooth = value => value * value * (3 - 2 * value);

  let manualReduction = false;
  let context = null;
  let imageReady = false;
  let entryStarted = false;
  let playing = false;
  let elapsed = 0;
  let previousTime = null;
  let entryFrame = 0;
  let trailFrame = 0;
  let dimensions = null;
  let tiles = [];
  let geometry = null;
  let pixelRatio = 1;
  let entryObserver = null;

  const reduced = () => manualReduction || systemMotion.matches;
  const available = Boolean(portrait && media && canvas && stage);
  if (canvas) {
    try { context = canvas.getContext('2d'); } catch (_) { context = null; }
  }

  function cancelEntryFrame() {
    if (entryFrame) cancelAnimationFrame(entryFrame);
    entryFrame = 0;
    previousTime = null;
  }

  function settle() {
    playing = false;
    elapsed = DURATION;
    cancelEntryFrame();
    media?.classList.remove('is-assembling');
    if (media) media.dataset.entryState = 'settled';
  }

  function seed(index) {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function createTiles() {
    const columns = 24;
    const rows = Math.max(1, Math.round(columns * portrait.naturalHeight / portrait.naturalWidth));
    tiles = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        tiles.push({
          sx: column * portrait.naturalWidth / columns,
          sy: row * portrait.naturalHeight / rows,
          sw: portrait.naturalWidth / columns,
          sh: portrait.naturalHeight / rows,
          dx: (seed(index + 1) - .5) * 170,
          dy: (seed(index + 37) - .28) * 200,
          delay: seed(index + 91) * .19,
        });
      }
    }
  }

  // The static img remains the source and the fallback. The canvas is visible
  // only during this bounded, one-time assembly of its actual source crops.
  function drawEntry(progress) {
    if (!context || !dimensions) return false;
    try {
      const { width, height, fit, x, y } = dimensions;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      const driftScale = Math.min(width / 560, 1);
      for (const tile of tiles) {
        const local = clamp((progress - tile.delay) / (1 - tile.delay));
        const settled = easeOut(local);
        const scale = .62 + .38 * settled;
        const width = tile.sw * fit;
        const height = tile.sh * fit;
        context.globalAlpha = smooth(clamp(local * 2.6));
        context.drawImage(
          portrait,
          tile.sx, tile.sy, tile.sw, tile.sh,
          x + tile.sx * fit + tile.dx * driftScale * (1 - settled) + width * (1 - scale) / 2,
          y + tile.sy * fit + tile.dy * driftScale * (1 - settled) + height * (1 - scale) / 2,
          width * scale,
          height * scale,
        );
      }
      context.globalAlpha = 1;
      return true;
    } catch (_) {
      context = null;
      settle();
      return false;
    }
  }

  function measureCanvas() {
    if (!context || !imageReady || !media) return;
    const bounds = media.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    const fit = Math.min(bounds.width / portrait.naturalWidth, bounds.height / portrait.naturalHeight);
    dimensions = {
      width: bounds.width,
      height: bounds.height,
      fit,
      x: (bounds.width - portrait.naturalWidth * fit) / 2,
      y: (bounds.height - portrait.naturalHeight * fit) / 2,
    };
    if (playing) drawEntry(clamp(elapsed / DURATION));
  }

  function tick(time) {
    entryFrame = 0;
    if (!playing || document.hidden || reduced()) return;
    if (previousTime !== null) elapsed += Math.min(time - previousTime, 100);
    previousTime = time;
    const progress = clamp(elapsed / DURATION);
    if (!drawEntry(progress)) return;
    if (progress >= 1) settle();
    else entryFrame = requestAnimationFrame(tick);
  }

  function queueEntry() {
    if (playing && !entryFrame && !document.hidden && !reduced()) entryFrame = requestAnimationFrame(tick);
  }

  function startEntry() {
    if (entryStarted || !imageReady) return;
    entryStarted = true;
    entryObserver?.disconnect();
    if (!context || reduced()) {
      settle();
      return;
    }
    cancelEntryFrame();
    elapsed = 0;
    playing = true;
    measureCanvas();
    if (!dimensions || !drawEntry(0)) {
      settle();
      return;
    }
    media.dataset.entryState = 'playing';
    media.classList.add('is-assembling');
    queueEntry();
  }

  function startWhenVisible() {
    if (entryStarted || !available) return;
    if (reduced() || !context) {
      startEntry();
      return;
    }
    const bounds = media.getBoundingClientRect();
    if (bounds.bottom > 0 && bounds.top < window.innerHeight * .98) {
      startEntry();
    } else if ('IntersectionObserver' in window) {
      entryObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) startEntry();
      }, { threshold: .08 });
      entryObserver.observe(media);
    } else {
      entryStarted = true;
      settle();
    }
  }

  const particles = trail && nodes.length ? Array.from({ length: 12 }, (_, index) => {
    const element = document.createElement('span');
    element.className = 'travel-pixel';
    trail.append(element);
    return { element, target: index % nodes.length, index };
  }) : [];

  function hideTrail() {
    if (trail) trail.dataset.timelineReady = 'false';
    for (const { element } of particles) element.style.opacity = '0';
  }

  function measureTrail() {
    if (!stage || !particles.length || !imageReady) {
      geometry = null;
      return;
    }
    const stageBounds = stage.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const targets = nodes.map(node => {
      const bounds = node.getBoundingClientRect();
      return { x: bounds.left + bounds.width / 2 + scrollX, y: bounds.top + bounds.height / 2 + scrollY, visible: Boolean(bounds.width && bounds.height) };
    });
    if (targets.some(target => !target.visible)) {
      geometry = null;
      return;
    }
    const source = {
      x: stageBounds.left + stageBounds.width * .62 + scrollX,
      y: stageBounds.top + stageBounds.height * .87 + scrollY,
    };
    const section = document.getElementById('approach')?.getBoundingClientRect();
    const routeX = Math.min(root.clientWidth - 18, (section?.right ?? stageBounds.right) + 18) + scrollX;
    geometry = {
      source,
      targets,
      routeX,
      start: Math.max(0, source.y - window.innerHeight * .92),
      end: Math.max(source.y - window.innerHeight * .92 + 140, targets[0].y - window.innerHeight * .48),
    };
  }

  function configureTrail() {
    trailFrame = 0;
    if (document.hidden || reduced() || !imageReady || !nativeScrollTimeline) {
      hideTrail();
      return;
    }
    measureTrail();
    if (!geometry) {
      hideTrail();
      return;
    }
    const scrollDistance = root.scrollHeight - window.innerHeight;
    if (scrollDistance <= 0) {
      trail.dataset.timelineReady = 'false';
      return;
    }
    const start = clamp(geometry.start / scrollDistance) * 100;
    const end = Math.max(start + .1, clamp(geometry.end / scrollDistance) * 100);
    for (const { element, target, index } of particles) {
      const destination = geometry.targets[target];
      const delay = (index % 3) * .07;
      const spread = (Math.floor(index / 4) - 1) * 3;
      element.style.setProperty('--source-x', `${geometry.source.x - 5}px`);
      element.style.setProperty('--source-y', `${geometry.source.y - 5}px`);
      element.style.setProperty('--gutter-x', `${geometry.routeX + spread - 5}px`);
      element.style.setProperty('--turn-y', `${geometry.source.y + 38 + spread - 5}px`);
      element.style.setProperty('--rail-y', `${destination.y - 27 + spread - 5}px`);
      element.style.setProperty('--target-x', `${destination.x - 5}px`);
      element.style.setProperty('--target-y', `${destination.y - 5}px`);
      element.style.setProperty('--range-start', `${start + (end - start) * delay}%`);
      element.style.setProperty('--range-end', `${end}%`);
    }
    trail.dataset.timelineReady = 'true';
  }

  function queueTrail() {
    if (!trailFrame && !document.hidden && !reduced() && nativeScrollTimeline) trailFrame = requestAnimationFrame(configureTrail);
  }

  function updatePreference() {
    const limited = reduced();
    root.dataset.reducedMotion = String(limited);
    if (toggle) {
      toggle.hidden = false;
      toggle.setAttribute('aria-pressed', String(limited));
      toggle.disabled = systemMotion.matches;
    }
    if (note) note.textContent = systemMotion.matches ? 'Увімкнено в системі' : limited ? 'Рух зменшено' : '';
    if (limited) {
      entryStarted = true;
      entryObserver?.disconnect();
      settle();
      if (trailFrame) cancelAnimationFrame(trailFrame);
      trailFrame = 0;
      hideTrail();
    } else queueTrail();
    document.dispatchEvent(new CustomEvent('marline:motionchange', { detail: { reduced: limited } }));
  }

  function onImageReady() {
    if (imageReady || !portrait.naturalWidth || !portrait.naturalHeight) return;
    imageReady = true;
    createTiles();
    measureCanvas();
    queueTrail();
    startWhenVisible();
  }

  toggle?.addEventListener('click', () => {
    manualReduction = !manualReduction;
    updatePreference();
  });
  systemMotion.addEventListener('change', updatePreference);
  window.addEventListener('resize', () => {
    measureCanvas();
    queueTrail();
  }, { passive: true });
  document.addEventListener('marline:layoutchange', queueTrail);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelEntryFrame();
      if (trailFrame) cancelAnimationFrame(trailFrame);
      trailFrame = 0;
    } else {
      queueEntry();
      queueTrail();
    }
  });

  if (available) {
    portrait.addEventListener('load', onImageReady, { once: true });
    portrait.addEventListener('error', () => {
      imageReady = false;
      entryStarted = true;
      entryObserver?.disconnect();
      settle();
      hideTrail();
    }, { once: true });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        measureCanvas();
        queueTrail();
      });
      observer.observe(media);
      const process = document.getElementById('process');
      if (process) observer.observe(process);
    }
  }
  document.fonts?.ready.then(() => {
    measureCanvas();
    queueTrail();
  }).catch(() => {});
  updatePreference();
  if (available && portrait.complete && portrait.naturalWidth) onImageReady();
})();
