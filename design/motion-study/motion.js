(() => {
  'use strict';

  const portrait = document.getElementById('marilyn-portrait');
  const media = document.getElementById('portrait-media');
  const canvas = document.getElementById('portrait-canvas');
  const stage = document.getElementById('portrait-stage');
  const trail = document.getElementById('motion-trail');
  const nodes = [...document.querySelectorAll('.process-node')];
  const replay = document.getElementById('replay-intro');
  const reduce = document.getElementById('reduce-motion');
  const status = document.getElementById('motion-status');

  if (!portrait || !media || !canvas || !stage || !trail || !replay || !reduce || !status) return;

  const context = canvas.getContext('2d');
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 1550;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const easeOut = value => 1 - Math.pow(1 - value, 4);
  const smooth = value => value * value * (3 - 2 * value);

  let manualReduction = false;
  let ready = false;
  let failed = false;
  let playing = false;
  let elapsed = 0;
  let previousTime = null;
  let entryFrame = 0;
  let scrollFrame = 0;
  let dimensions = null;
  let tiles = [];
  let geometry = null;
  let dpr = 1;

  const reduced = () => manualReduction || systemMotion.matches;

  // Every tile has one deterministic source rectangle of this same image.
  // The settled state uses the original img, eliminating crop seams entirely.
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

  function measureCanvas() {
    if (!context || !ready) return;
    const bounds = media.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
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

  function drawEntry(progress) {
    if (!context || !dimensions) return;
    const { width, height, fit, x, y } = dimensions;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    const driftScale = Math.min(width / 560, 1);
    for (const tile of tiles) {
      const local = clamp((progress - tile.delay) / (1 - tile.delay));
      const settled = easeOut(local);
      const scale = .62 + .38 * settled;
      const tileWidth = tile.sw * fit;
      const tileHeight = tile.sh * fit;
      context.globalAlpha = smooth(clamp(local * 2.6));
      context.drawImage(
        portrait,
        tile.sx, tile.sy, tile.sw, tile.sh,
        x + tile.sx * fit + tile.dx * driftScale * (1 - settled) + tileWidth * (1 - scale) / 2,
        y + tile.sy * fit + tile.dy * driftScale * (1 - settled) + tileHeight * (1 - scale) / 2,
        tileWidth * scale,
        tileHeight * scale,
      );
    }
    context.globalAlpha = 1;
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
    media.classList.remove('is-assembling');
    media.dataset.entryState = 'settled';
  }

  function tick(time) {
    entryFrame = 0;
    if (!playing || document.hidden || reduced()) return;
    if (previousTime !== null) elapsed += Math.min(time - previousTime, 100);
    previousTime = time;
    const progress = clamp(elapsed / DURATION);
    drawEntry(progress);
    if (progress >= 1) {
      settle();
      return;
    }
    entryFrame = requestAnimationFrame(tick);
  }

  function queueEntryFrame() {
    if (playing && !entryFrame && !document.hidden && !reduced()) {
      entryFrame = requestAnimationFrame(tick);
    }
  }

  function startEntry() {
    if (!ready || !context || reduced()) {
      settle();
      return;
    }
    cancelEntryFrame();
    playing = true;
    elapsed = 0;
    media.dataset.entryState = 'playing';
    measureCanvas();
    drawEntry(0);
    media.classList.add('is-assembling');
    queueEntryFrame();
  }

  const particles = Array.from({ length: 12 }, (_, index) => {
    const element = document.createElement('span');
    element.className = 'travel-pixel';
    trail.append(element);
    return { element, target: index % Math.max(nodes.length, 1), index };
  });

  function measureTrail() {
    const stageBounds = stage.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const targets = nodes.map(node => {
      const bounds = node.getBoundingClientRect();
      return { x: bounds.left + bounds.width / 2 + scrollX, y: bounds.top + bounds.height / 2 + scrollY };
    });
    const source = {
      x: stageBounds.left + stageBounds.width * .62 + scrollX,
      y: stageBounds.top + stageBounds.height * .87 + scrollY,
    };
    const firstTarget = targets[0];
    const approachBounds = document.getElementById('approach')?.getBoundingClientRect();
    const routeX = Math.min(document.documentElement.clientWidth - 18, (approachBounds?.right ?? stageBounds.right) + 18) + scrollX;
    geometry = firstTarget ? {
      source,
      targets,
      routeX,
      start: Math.max(0, source.y - window.innerHeight * .92),
      end: Math.max(source.y - window.innerHeight * .92 + 140, firstTarget.y - window.innerHeight * .48),
    } : null;
    updateTrail();
  }

  function updateTrail() {
    scrollFrame = 0;
    if (!geometry || reduced() || document.hidden) {
      for (const { element } of particles) element.style.opacity = '0';
      return;
    }
    const progress = clamp((window.scrollY - geometry.start) / (geometry.end - geometry.start));
    for (const { element, target, index } of particles) {
      const destination = geometry.targets[target];
      const delay = (index % 3) * .07;
      const phase = clamp((progress - delay) / (1 - delay));
      const spread = (Math.floor(index / 4) - 1) * 3;
      const gutterX = geometry.routeX + spread;
      const turnY = geometry.source.y + 38 + spread;
      const railY = destination.y - 26 + spread;
      let x;
      let y;
      // Route through the outside gutter, then above the process rail.
      // The pixels never sweep across the hero CTA or section copy.
      if (phase < .22) {
        const segment = smooth(phase / .22);
        x = geometry.source.x + (gutterX - geometry.source.x) * segment;
        y = geometry.source.y + (turnY - geometry.source.y) * segment;
      } else if (phase < .6) {
        const segment = smooth((phase - .22) / .38);
        x = gutterX;
        y = turnY + (railY - turnY) * segment;
      } else {
        const segment = smooth((phase - .6) / .4);
        x = gutterX + (destination.x - gutterX) * segment;
        y = railY + (destination.y - railY) * smooth(clamp((segment - .83) / .17));
      }
      const alpha = smooth(clamp(phase / .14)) * smooth(clamp((1 - phase) / .13));
      element.style.transform = `translate3d(${x - 5}px, ${y - 5}px, 0)`;
      element.style.opacity = String(alpha * .78);
    }
  }

  function queueTrailUpdate() {
    if (scrollFrame || document.hidden || reduced()) return;
    scrollFrame = requestAnimationFrame(updateTrail);
  }

  function updateControls() {
    const limited = reduced();
    document.documentElement.dataset.reducedMotion = String(limited);
    reduce.setAttribute('aria-pressed', String(limited));
    reduce.disabled = systemMotion.matches;
    reduce.title = systemMotion.matches ? 'Менше руху ввімкнено у системних налаштуваннях' : '';
    replay.disabled = limited || !ready || !context;
    status.textContent = failed ? 'Зображення не завантажено' : limited || !context ? 'Статичний перегляд' : ready ? 'Рух увімкнено' : 'Завантаження персонажа';
    if (limited) settle();
    updateTrail();
  }

  function imageReady() {
    if (ready || !portrait.naturalWidth || !portrait.naturalHeight) return;
    ready = true;
    createTiles();
    measureCanvas();
    measureTrail();
    updateControls();
    startEntry();
  }

  portrait.addEventListener('load', imageReady, { once: true });
  portrait.addEventListener('error', () => {
    failed = true;
    ready = false;
    settle();
    updateControls();
  }, { once: true });

  replay.addEventListener('click', startEntry);
  reduce.addEventListener('click', () => {
    manualReduction = !manualReduction;
    updateControls();
    if (!reduced()) measureTrail();
  });
  systemMotion.addEventListener('change', updateControls);
  window.addEventListener('scroll', queueTrailUpdate, { passive: true });
  window.addEventListener('resize', () => {
    measureCanvas();
    measureTrail();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelEntryFrame();
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
    } else {
      measureTrail();
      queueEntryFrame();
    }
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => {
      measureCanvas();
      measureTrail();
    });
    observer.observe(media);
    const process = document.getElementById('process');
    if (process) observer.observe(process);
  }
  if (document.fonts?.ready) {
    document.fonts.ready.then(measureTrail).catch(() => {});
  }
  updateControls();
  if (portrait.complete && portrait.naturalWidth) imageReady();
  else if (portrait.complete && !portrait.naturalWidth) {
    failed = true;
    updateControls();
  }
})();
