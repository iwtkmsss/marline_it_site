(() => {
  'use strict';

  const portrait = document.getElementById('marilyn-portrait');
  const media = document.getElementById('portrait-media');
  const canvas = document.getElementById('portrait-canvas');
  const corner = document.getElementById('case-corner');
  const replay = document.getElementById('replay-intro');
  const reduce = document.getElementById('reduce-motion');
  const status = document.getElementById('motion-status');

  if (!portrait || !media || !canvas || !replay || !reduce || !status) return;

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
  let dimensions = null;
  let tiles = [];
  let departure = Infinity;
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
    document.documentElement.classList.remove('intro-playing');
  }

  function tick(time) {
    entryFrame = 0;
    if (!playing || document.hidden || reduced()) return;
    if (window.scrollY > departure) {
      settle();
      return;
    }
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
    document.documentElement.classList.add('intro-playing');
    measureCanvas();
    drawEntry(0);
    media.classList.add('is-assembling');
    queueEntryFrame();
  }

  // Seven opaque, 24px crops follow the outside of the right shoulder in the 1254px artwork.
  // Both the cutouts and the moving surfaces use this same source grid.
  const cropSize = 24;
  const crops = [[1032, 1008], [1008, 1032], [1008, 1056], [992, 1080],
    [960, 1104], [936, 1128], [936, 1152]];
  const pixels = corner ? Array.from(corner.children) : [];
  const nativeTransfer = pixels.length === crops.length &&
    CSS.supports('animation-timeline: scroll(root block)') &&
    CSS.supports('animation-range: 0px 100px') && CSS.supports('mask-image: linear-gradient(black,black)');

  function prepareTransfer() {
    if (!nativeTransfer) return;
    const { naturalWidth: width, naturalHeight: height } = portrait;
    const holes = crops.map(([x, y]) => `M${x} ${y}h${cropSize}v${cropSize}h-${cropSize}z`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill-rule="evenodd" d="M0 0H${width}V${height}H0z${holes}"/></svg>`;
    portrait.style.setProperty('--cutouts', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    pixels.forEach((pixel, index) => {
      const [x, y] = crops[index];
      // CSS percentages for background-position refer to the unused image space.
      pixel.style.setProperty('--crop-position', `${100*x/(width-cropSize)}% ${100*y/(height-cropSize)}%`);
      pixel.style.setProperty('--crop-size', `${100*width/cropSize}% ${100*height/cropSize}%`);
      pixel.style.setProperty('--crop-image', `url("${portrait.currentSrc}")`);
    });
    measureTransfer();
  }

  function measureTransfer() {
    if (!nativeTransfer || !dimensions || !ready) return;
    const bounds = media.getBoundingClientRect();
    const landing = corner.getBoundingClientRect();
    const { x: insetX, y: insetY, fit } = dimensions;
    const originTop = bounds.top + insetY + crops[0][1] * fit + window.scrollY;
    departure = Math.max(0, originTop - window.innerHeight * .73);
    const arrival = Math.max(departure + 120, landing.top + window.scrollY - window.innerHeight * .49);
    const span = arrival - departure;
    const compact = window.innerWidth <= 700;
    const theatrical = document.documentElement.dataset.version === 'b';
    pixels.forEach((pixel, index) => {
      const [cx, cy] = crops[index];
      const x = bounds.left + insetX + cx * fit - landing.left - pixel.offsetLeft;
      const y = bounds.top + insetY + cy * fit - landing.top - pixel.offsetTop;
      const stagger = index / (pixels.length - 1);
      pixel.style.setProperty('--dx', `${x}px`);
      pixel.style.setProperty('--dy', `${y}px`);
      pixel.style.setProperty('--source-scale', String(cropSize * fit / parseFloat(getComputedStyle(pixel).width)));
      // A slight bow separates the silhouettes in flight. On narrow screens keep it in the gutter.
      const bow = compact ? 7 : theatrical ? 70 : 24;
      pixel.style.setProperty('--bow', `${bow * (.35 + stagger)}px`);
      pixel.style.setProperty('--leave', `${departure + span * stagger * .15}px`);
      pixel.style.setProperty('--land', `${arrival - span * (1 - stagger) * .16}px`);
    });
    document.documentElement.classList.add('transfer-ready');
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
  }

  function imageReady() {
    if (ready || !portrait.naturalWidth || !portrait.naturalHeight) return;
    ready = true;
    createTiles();
    measureCanvas();
    prepareTransfer();
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
  });
  systemMotion.addEventListener('change', updateControls);
  window.addEventListener('resize', () => {
    measureCanvas();
    measureTransfer();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelEntryFrame();
    } else {
      measureTransfer();
      queueEntryFrame();
    }
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => {
      measureCanvas();
      measureTransfer();
    });
    observer.observe(media);
    if (corner) observer.observe(corner);
    observer.observe(document.body);
  }
  if (document.fonts?.ready) {
    document.fonts.ready.then(measureTransfer).catch(() => {});
  }
  updateControls();
  if (portrait.complete && portrait.naturalWidth) imageReady();
  else if (portrait.complete && !portrait.naturalWidth) {
    failed = true;
    updateControls();
  }
})();
