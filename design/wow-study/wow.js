// Wow-scene study. A fork of ../../src/motion.js extended with:
//   0. assembly "from one pixel": a violet pixel splits 1 → 4 → 16 → 64 …,
//      then refines where the portrait has detail (quadtree), then resolves;
//   1. one "naughty" tile that misses its slot during the assembly;
//   2. eyes: optional generated frames (look at the visitor, half, closed)
//      with a procedural blink fallback built from the original PNG;
//   3. the tile hops into place once she looks at it;
//   4. "digital wind": a hand-drawn flipbook (frames/anim/) plays the gust,
//      a silk ribbon turns into a pixel route to "Наш підхід";
//   5. a relay pixel she holds and releases on the first scroll.
// The static <img> stays the source of truth and the final state.
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
  const hero = document.querySelector('.hero');
  const ribbonSvg = document.getElementById('wind-ribbon');
  const arrowLink = document.querySelector('.hero .text-link');
  const replayButton = document.getElementById('study-replay');
  const gustButton = document.getElementById('study-gust');
  const studyStatus = document.getElementById('study-status');
  const nodes = [...document.querySelectorAll('.process-node')];
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nativeScrollTimeline = CSS.supports('animation-timeline', 'scroll(root block)') && CSS.supports('animation-range', '0% 100%');
  root.dataset.scrollMotion = nativeScrollTimeline ? 'native' : 'static';

  // ---- Tunables (source-image pixels, milliseconds) ------------------------
  const DURATION = 1400;            // assembly
  // Assembly timeline inside DURATION (ms). Depth 7 = 128×128 cells ≈ 10 source px.
  const QUAD = {
    depth: 7,
    base: 3,           // first visible grid: 8×8 cells (≈70 px on a 560 px portrait)
    origin: { x: 578, y: 470 }, // the first pixel appears on her face
    pop: 150,          // the violet pixel appears
    ripple: [170, 560], // base cells spread from the pixel, nearest first
    appear: 140,       // one cell grows from violet into its colour
    uniform: 620,      // every base cell splits in four
    detail: [690, 1010],      // then splits where the detail is, faster and faster (done before resolve)
    blend: 105,        // children ease from the parent colour to their own
    resolve: [1070, 1380],     // cells turn into real pixels one by one, no fading
  };
  const accent = getComputedStyle(root).getPropertyValue('--assembly-rgb').trim();
  const assemblyColor = accent ? accent.split(/\s+/).map(Number) : [103, 80, 234];
  const COLUMNS = 24;
  const STRAY = { column: 6, row: 17 };   // the shoulder highlight (viewer's left)
  const WANDER = { dx: -200, dy: -80 };   // where the stray tile waits, relative to its slot
  const HOLD = { x: 120, y: 800 };        // relay pixel position near the shoulder
  const CELL = 4;                    // procedural blink cell
  // Hand-drawn flipbook (frames/anim/, see frames/anim/CODEX_PROMPT.md).
  // Full frames shown one after another, like a sprite animation; null = the
  // original PNG. Every frame is auto-aligned to the original face on load.
  const frameDirectory = document.currentScript.dataset.frameDir;
  const FRAME_DIR = frameDirectory ? new URL(frameDirectory, document.baseURI) : new URL('./frames/', document.currentScript.src);
  const FRAME_EXTENSION = frameDirectory ? 'webp' : 'png';
  // Scene start: eye contact, a blink, then the original sideways look.
  const EYE_CONTACT = 520;
  const ANIM_INTRO = [[0, '01'], [EYE_CONTACT, '02'], [590, '03'], [690, '04'], [760, null]];
  // Gust (ms after it starts). The hair settles back along the same frames it
  // rose through (w03 → w02 → w01), because w01 is the frame closest to the
  // original; Codex's own settle frames (w07–w13) never got back to the
  // original curls and made the last cut jump. The second blink is drawn with
  // the eye patches on top: the face is unchanged on w01–w06.
  const ANIM_GUST = [
    [0, 'w01'], [80, 'w02'], [160, 'w03'], [250, 'w04'], [400, 'w05'], [550, 'w06'], [700, 'w04'],
    [850, 'w03'], [1000, 'w02'], [1140, 'w01'], [1280, null],
  ];
  const GUST_LENGTH = 1280;
  const ALIGN_RANGE = 10;            // auto-alignment search, source px
  // The original is drawn on a ~8 px pixel grid; image models draw smoother.
  // Changed blocks outside the face are re-pixelated onto that grid, unchanged
  // blocks are copied from the original exactly, so the style never switches.
  const PIXEL_GRID = { size: 8, offset: 1, changed: 24 };
  const FACE = { x: 578, y: 500, rx: 188, ry: 248 };
  const SCENE = {
    blink: EYE_CONTACT, // eye contact holds, then she blinks and turns to the tile
    hops: [770],       // one hop before the tile jumps into its slot
    jump: 990,
    jumpLength: 300,
    handoff: 1290,     // relay pixel appears
    gust: 1360,        // wind + ribbon
    blink2: 2260,
    end: 1360 + GUST_LENGTH,
  };
  // Eye boxes in source pixels: [viewer-left eye, viewer-right eye].
  const EYES = [
    { x: 378, y: 398, w: 130, h: 60 },
    { x: 590, y: 358, w: 146, h: 56 },
  ];
  // Optional generated frames. Full portrait renders; only the eye areas are used.
  // If an AI edit shifted the face, nudge it here (in source pixels).
  const FRAME_FILES = { viewer: 'eyes-viewer', half: 'eyes-half', closed: 'eyes-closed' };
  const FRAME_ALIGN = { dx: 0, dy: 0 };

  const clamp = value => Math.min(1, Math.max(0, value));
  const easeOut = value => 1 - Math.pow(1 - value, 4);
  const easeInOut = value => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
  const smooth = value => value * value * (3 - 2 * value);

  let manualReduction = false;
  let context = null;
  let imageReady = false;
  let entryStarted = false;
  let running = false;
  let frame = 0;
  let previousTime = null;
  let clock = 0;               // advances only while the tab is visible
  let activeUntil = 0;
  let sceneStart = null;
  let sceneFlags = {};
  let gustAt = -1e9;
  let blinkAt = -1e9;
  let trailFrame = 0;
  let dimensions = null;
  let tiles = [];
  let strayIndex = -1;
  let geometry = null;
  let pixelRatio = 1;
  let entryObserver = null;
  let entrySource = null;      // portrait with the "looking at you" eyes baked in
  let eyePatches = { viewer: null, half: null, closed: null };
  let eyeMode = 'procedural';
  let assembly = null;         // quadtree of entrySource, null if pixels are unreadable
  let animFrames = {};         // aligned flipbook frames by name
  let animIntro = false;       // all intro frames present
  let animGust = false;        // all gust frames present
  let resolveMask = null;      // per-cell reveal of the real pixels at the end of the assembly
  let lastHoverGust = -1e9;
  let handoffArrived = false;

  const reduced = () => manualReduction || systemMotion.matches;
  const available = Boolean(portrait && media && canvas && stage);
  if (canvas) {
    try { context = canvas.getContext('2d'); } catch (_) { context = null; }
  }

  function seed(index) {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function setStatus(text) {
    if (studyStatus) studyStatus.textContent = text;
  }

  // ---- Asset preparation ---------------------------------------------------
  function createTiles() {
    const rows = Math.max(1, Math.round(COLUMNS * portrait.naturalHeight / portrait.naturalWidth));
    tiles = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const index = row * COLUMNS + column;
        tiles.push({
          sx: column * portrait.naturalWidth / COLUMNS,
          sy: row * portrait.naturalHeight / rows,
          sw: portrait.naturalWidth / COLUMNS,
          sh: portrait.naturalHeight / rows,
          dx: (seed(index + 1) - .5) * 170,
          dy: (seed(index + 37) - .28) * 200,
          delay: seed(index + 91) * .19,
        });
      }
    }
    strayIndex = Math.min(tiles.length - 1, STRAY.row * COLUMNS + STRAY.column);
  }

  function makeCanvas(width, height) {
    const element = document.createElement('canvas');
    element.width = Math.max(1, Math.round(width));
    element.height = Math.max(1, Math.round(height));
    return element;
  }

  function readPixels(source, width, height) {
    const scratch = makeCanvas(width, height);
    const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
    scratchContext.drawImage(source, 0, 0, width, height);
    return scratchContext.getImageData(0, 0, width, height);
  }

  // Procedural blink: find the eye opening (dark liner/iris + whites) in
  // CELL-sized blocks and paint the lid down over it in the lid's own colour.
  function buildProceduralEyes(pixels) {
    const { width, data } = pixels;
    const sample = (x0, y0) => {
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y0; y < y0 + CELL; y += 1) {
        for (let x = x0; x < x0 + CELL; x += 1) {
          const i = (y * width + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count += 1;
        }
      }
      return [r / count, g / count, b / count];
    };
    const result = { half: [], closed: [] };
    for (const eye of EYES) {
      const columns = Math.floor(eye.w / CELL);
      const rows = Math.floor(eye.h / CELL);
      const half = makeCanvas(columns * CELL, rows * CELL);
      const closed = makeCanvas(columns * CELL, rows * CELL);
      const halfContext = half.getContext('2d');
      const closedContext = closed.getContext('2d');
      const spans = [];
      for (let column = 0; column < columns; column += 1) {
        let top = -1;
        let bottom = -1;
        for (let row = 0; row < rows; row += 1) {
          const [r, g, b] = sample(eye.x + column * CELL, eye.y + row * CELL);
          const light = r * .3 + g * .59 + b * .11;
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          // The opening starts at the dark upper liner; light lilac eyeshadow
          // above it must not be mistaken for the eye white.
          if (top < 0) {
            if (light < 95) top = bottom = row;
          } else if (light < 95 || (light > 190 && saturation < 55)) bottom = row;
        }
        if (top >= 2) spans.push({ column, top, bottom: Math.min(bottom, rows - 2) });
      }
      if (spans.length) {
        // One lid colour per eye (eyeshadow above the liner) fading to the
        // skin under the eye, so the closed lid reads as a single surface.
        const average = list => list.reduce((sum, [r, g, b]) => [sum[0] + r, sum[1] + g, sum[2] + b], [0, 0, 0]).map(value => value / list.length);
        const lid = average(spans.map(span => sample(eye.x + span.column * CELL, eye.y + (span.top - 2) * CELL)));
        const skin = average(spans.map(span => sample(eye.x + span.column * CELL, eye.y + (span.bottom + 1) * CELL)));
        const mix = amount => `rgb(${lid.map((value, index) => Math.round(value + (skin[index] - value) * amount)).join(' ')})`;
        spans.forEach((span, index) => {
          const around = spans.slice(Math.max(0, index - 2), index + 3);
          const bottom = Math.round(around.reduce((sum, item) => sum + item.bottom, 0) / around.length);
          const height = Math.max(1, bottom - span.top);
          for (let row = span.top; row <= bottom; row += 1) {
            closedContext.fillStyle = row === bottom ? 'rgb(46 26 36)' : mix(.12 + (row - span.top) / height * .5);
            closedContext.fillRect(span.column * CELL, row * CELL, CELL, CELL);
          }
          const middle = span.top + Math.max(1, Math.round(height / 2));
          for (let row = span.top; row <= middle; row += 1) {
            halfContext.fillStyle = row === middle ? 'rgb(46 26 36)' : mix((row - span.top) / height * .3);
            halfContext.fillRect(span.column * CELL, row * CELL, CELL, CELL);
          }
        });
      }
      result.half.push({ canvas: half, x: eye.x, y: eye.y });
      result.closed.push({ canvas: closed, x: eye.x, y: eye.y });
    }
    return result;
  }

  // Generated frames: cut the eye areas out with a feathered ellipse so a
  // slightly different AI render blends into the original face.
  function buildFramePatches(image) {
    const scaleX = image.naturalWidth / portrait.naturalWidth;
    const scaleY = image.naturalHeight / portrait.naturalHeight;
    return EYES.map(eye => {
      const margin = 14;
      const x = eye.x - margin;
      const y = eye.y - margin;
      const w = eye.w + margin * 2;
      const h = eye.h + margin * 2;
      const patch = makeCanvas(w, h);
      const patchContext = patch.getContext('2d');
      patchContext.drawImage(image, (x + FRAME_ALIGN.dx) * scaleX, (y + FRAME_ALIGN.dy) * scaleY, w * scaleX, h * scaleY, 0, 0, w, h);
      patchContext.globalCompositeOperation = 'destination-in';
      patchContext.translate(w / 2, h / 2);
      patchContext.scale(w / 2, h / 2);
      const mask = patchContext.createRadialGradient(0, 0, 0, 0, 0, 1);
      mask.addColorStop(0, '#000');
      mask.addColorStop(.62, '#000');
      mask.addColorStop(1, 'rgb(0 0 0 / 0)');
      patchContext.fillStyle = mask;
      patchContext.fillRect(-1, -1, 2, 2);
      return { canvas: patch, x, y };
    });
  }

  // Assembly "from one pixel": a quadtree over the portrait. Every node keeps
  // the average (premultiplied) colour of its square and its squared error,
  // so the split order can follow the detail: eyes, lips and curls first.
  function buildAssembly(pixels) {
    const { width, height, data } = pixels;
    const depth = QUAD.depth;
    const grid = 1 << depth;
    const size = Math.max(width, height);
    const cell = size / grid;
    const channels = 6; // r, g, b, a (premultiplied, 0..255), squares, count
    const leaf = new Float64Array(grid * grid * channels);
    for (let y = 0; y < height; y += 1) {
      const rowBase = Math.min(grid - 1, Math.floor(y / cell)) * grid;
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const k = (rowBase + Math.min(grid - 1, Math.floor(x / cell))) * channels;
        const alpha = data[i + 3];
        leaf[k + 5] += 1;
        if (!alpha) continue;
        const a = alpha / 255;
        const r = data[i] * a, g = data[i + 1] * a, b = data[i + 2] * a;
        leaf[k] += r; leaf[k + 1] += g; leaf[k + 2] += b; leaf[k + 3] += alpha;
        leaf[k + 4] += r * r + g * g + b * b + alpha * alpha;
      }
    }
    const sums = [];
    sums[depth] = leaf;
    for (let d = depth - 1; d >= 0; d -= 1) {
      const side = 1 << d;
      const child = sums[d + 1];
      const level = new Float64Array(side * side * channels);
      for (let iy = 0; iy < side; iy += 1) {
        for (let ix = 0; ix < side; ix += 1) {
          const k = (iy * side + ix) * channels;
          for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const c = ((iy * 2 + cy) * side * 2 + ix * 2 + cx) * channels;
            for (let ch = 0; ch < channels; ch += 1) level[k + ch] += child[c + ch];
          }
        }
      }
      sums[d] = level;
    }

    const levels = [];
    const candidates = [];
    for (let d = 0; d <= depth; d += 1) {
      const side = 1 << d;
      const count = side * side;
      const color = new Uint8ClampedArray(count * 3);
      const visible = new Uint8Array(count);
      const css = new Array(count);
      const splitAt = new Float32Array(count).fill(Infinity);
      for (let index = 0; index < count; index += 1) {
        const k = index * channels;
        const [r, g, b, a, squares, n] = sums[d].subarray(k, k + channels);
        if (!n || !a) continue;
        const scale = 255 / a;
        color[index * 3] = r * scale; color[index * 3 + 1] = g * scale; color[index * 3 + 2] = b * scale;
        visible[index] = a / (n * 255) > .48 ? 1 : 0;
        css[index] = `rgb(${color[index * 3]} ${color[index * 3 + 1]} ${color[index * 3 + 2]})`;
        const error = squares - (r * r + g * g + b * b + a * a) / n;
        const coverage = a / (n * 255);
        // Silhouette edges always split down to the smallest cell, so no
        // oversized square sticks out past her outline at the end. A child
        // scheduled before its parent simply splits together with it.
        const edge = coverage > .02 && coverage < .98;
        if (d > QUAD.base && d < depth && (error > n * 90 || edge)) candidates.push({ d, index, error });
      }
      levels.push({ side, color, visible, css, splitAt });
    }
    levels[QUAD.base].splitAt.fill(QUAD.uniform);
    candidates.sort((a, b) => b.error - a.error || a.d - b.d);
    const total = candidates.length;
    const curve = 400 / Math.max(1, total);
    const [from, to] = QUAD.detail;
    candidates.forEach(({ d, index }, order) => {
      levels[d].splitAt[index] = from + (to - from) * Math.log1p(order * curve) / Math.log1p(total * curve);
    });
    return { levels, depth, size };
  }

  // ---- Flipbook preparation ---------------------------------------------------
  // Frames from an image model drift a few pixels and are drawn smoother than
  // the original. Each frame is aligned to the original face and its changed
  // hair is re-pixelated onto the original grid. These three functions are
  // pure: the Web Worker below runs their source text as is.
  function alignPixels(frame, ref, w, range) {
    const score = (dx, dy) => {
      let sum = 0;
      for (let y = 330; y < 700; y += 6) {
        for (let x = 420; x < 760; x += 6) {
          const i = (y * w + x) * 4;
          const j = ((y + dy) * w + x + dx) * 4;
          sum += Math.abs(ref[i] - frame[j]) + Math.abs(ref[i + 1] - frame[j + 1]) + Math.abs(ref[i + 2] - frame[j + 2]);
        }
      }
      return sum;
    };
    let best = { dx: 0, dy: 0, value: score(0, 0) };
    for (let dy = -range; dy <= range; dy += 2) {
      for (let dx = -range; dx <= range; dx += 2) {
        const value = score(dx, dy);
        if (value < best.value) best = { dx, dy, value };
      }
    }
    const coarse = best;
    for (let dy = coarse.dy - 1; dy <= coarse.dy + 1; dy += 1) {
      for (let dx = coarse.dx - 1; dx <= coarse.dx + 1; dx += 1) {
        const value = score(dx, dy);
        if (value < best.value) best = { dx, dy, value };
      }
    }
    return { dx: best.dx, dy: best.dy };
  }

  function shiftPixels(frame, w, h, dx, dy) {
    if (!dx && !dy) return frame;
    const source = new Uint32Array(frame.buffer, frame.byteOffset, w * h);
    const target = new Uint32Array(w * h);
    const from = Math.max(0, dx);
    const to = Math.min(w, w + dx);
    for (let y = 0; y < h; y += 1) {
      const sy = y + dy;
      if (sy < 0 || sy >= h) continue;
      target.set(source.subarray(sy * w + from, sy * w + to), y * w + from - dx);
    }
    return new Uint8ClampedArray(target.buffer);
  }

  // Unchanged block → the original's own pixels; changed block in the face →
  // the frame as drawn (eyes are finer than the grid); changed hair → one flat
  // block on the original's ~8 px grid, with a crisp edge.
  function repixelatePixels(f, o, w, h, grid, face) {
    const d = new Uint8ClampedArray(w * h * 4);
    const { size, offset, changed } = grid;
    for (let by = offset - size; by < h; by += size) {
      for (let bx = offset - size; bx < w; bx += size) {
        const x0 = Math.max(0, bx), x1 = Math.min(w, bx + size);
        const y0 = Math.max(0, by), y1 = Math.min(h, by + size);
        const fx = (bx + size / 2 - face.x) / face.rx;
        const fy = (by + size / 2 - face.y) / face.ry;
        const inFace = fx * fx + fy * fy < 1;
        let diff = 0, n = 0, r = 0, g = 0, b = 0, a = 0;
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const i = (y * w + x) * 4;
            diff += Math.abs(f[i] - o[i]) + Math.abs(f[i + 1] - o[i + 1]) + Math.abs(f[i + 2] - o[i + 2]) + Math.abs(f[i + 3] - o[i + 3]);
            const alpha = f[i + 3];
            r += f[i] * alpha; g += f[i + 1] * alpha; b += f[i + 2] * alpha; a += alpha;
            n += 1;
          }
        }
        const mode = diff / n <= changed ? 0 : inFace ? 1 : 2;
        const opaque = a / n > 127;
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const i = (y * w + x) * 4;
            if (mode === 2) {
              if (opaque) { d[i] = r / a; d[i + 1] = g / a; d[i + 2] = b / a; d[i + 3] = 255; }
              continue;
            }
            const src = mode === 0 ? o : f;
            d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; d[i + 3] = src[i + 3];
          }
        }
      }
    }
    return d;
  }

  const workerSource = () => `${alignPixels}\n${shiftPixels}\n${repixelatePixels}
self.onmessage = async ({ data }) => {
  const { ref, w, h, range, grid, face, items } = data;
  const reference = new Uint8ClampedArray(ref);
  for (const { name, url } of items) {
    try {
      const response = await fetch(url);
      if (!response.ok) { self.postMessage({ name, missing: true }); continue; }
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(w, h);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const frame = context.getImageData(0, 0, w, h).data;
      const { dx, dy } = alignPixels(frame, reference, w, range);
      const pixels = repixelatePixels(shiftPixels(frame, w, h, dx, dy), reference, w, h, grid, face);
      context.putImageData(new ImageData(pixels, w, h), 0, 0);
      const result = canvas.transferToImageBitmap();
      self.postMessage({ name, bitmap: result, dx, dy }, [result]);
    } catch (error) {
      self.postMessage({ name, missing: true });
    }
  }
  self.postMessage({ done: true });
};`;

  // Prepares the frames in a worker (off the main thread, so the assembly
  // never stutters); without worker support, one frame per task here.
  // onFrame(name, drawable, dx, dy) for every ready frame, then onDone().
  function prepareFlipbook(names, reference, onFrame, onDone) {
    const w = reference.width;
    const h = reference.height;
    const items = names.map(name => ({ name, url: new URL(`anim/${name}.${FRAME_EXTENSION}`, FRAME_DIR).href }));
    const workerReady = 'Worker' in window && 'OffscreenCanvas' in window && 'createImageBitmap' in window;
    if (workerReady) {
      try {
        const url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
        const worker = new Worker(url);
        URL.revokeObjectURL(url);
        worker.onmessage = ({ data }) => {
          if (data.done) {
            worker.terminate();
            onDone();
          } else if (data.bitmap) onFrame(data.name, data.bitmap, data.dx, data.dy);
        };
        worker.onerror = () => {
          worker.terminate();
          onDone();
        };
        const ref = reference.data.slice().buffer;
        worker.postMessage({ ref, w, h, range: ALIGN_RANGE, grid: PIXEL_GRID, face: FACE, items }, [ref]);
        return;
      } catch (_) { /* fall back below */ }
    }
    (async () => {
      for (const { name, url } of items) {
        await new Promise(resolve => setTimeout(resolve, 0));
        const image = await loadImage(url);
        if (!image) continue;
        try {
          const frame = readPixels(image, w, h).data;
          const { dx, dy } = alignPixels(frame, reference.data, w, ALIGN_RANGE);
          const pixels = repixelatePixels(shiftPixels(frame, w, h, dx, dy), reference.data, w, h, PIXEL_GRID, FACE);
          const canvasFrame = makeCanvas(w, h);
          canvasFrame.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
          onFrame(name, canvasFrame, dx, dy);
        } catch (_) { /* skip the frame */ }
      }
      onDone();
    })();
  }

  // End of the assembly: one mask pixel per smallest cell. A cell is either a
  // square or the real portrait, never both, so nothing fades and no square
  // ever sits under the finished picture.
  function buildResolveMask() {
    const grid = 1 << QUAD.depth;
    const at = new Float32Array(grid * grid);
    const size = Math.max(portrait.naturalWidth, portrait.naturalHeight);
    const far = Math.hypot(size, size);
    for (let row = 0; row < grid; row += 1) {
      for (let column = 0; column < grid; column += 1) {
        const index = row * grid + column;
        const cx = (column + .5) * size / grid;
        const cy = (row + .5) * size / grid;
        const distance = Math.hypot(cx - QUAD.origin.x, cy - QUAD.origin.y) / far;
        // From her face outwards, with some noise, so it reads as pixels settling.
        at[index] = seed(index * 7 + 5) * .4 + Math.min(1, distance / .7) * .55;
      }
    }
    const mask = makeCanvas(grid, grid);
    resolveMask = { grid, at, mask, maskContext: mask.getContext("2d"), image: new ImageData(grid, grid), layer: null, amount: -1 };
  }

  function loadImage(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image.naturalWidth ? image : null);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  async function prepareAssets() {
    let pixels = null;
    try {
      pixels = readPixels(portrait, portrait.naturalWidth, portrait.naturalHeight);
    } catch (_) {
      pixels = null;
    }
    if (pixels) {
      const procedural = buildProceduralEyes(pixels);
      eyePatches = { viewer: null, half: procedural.half, closed: procedural.closed };
    }

    const animNames = [...new Set([...ANIM_INTRO, ...ANIM_GUST].map(([, name]) => name).filter(Boolean))];
    const first = ANIM_INTRO[0][1];
    animFrames = {};
    const shifts = [];
    let flipbookDone = false;
    let reportLater = () => {};
    // Resolves as soon as the frame she assembles into is ready (or known missing).
    const firstReady = new Promise(resolve => {
      if (!pixels) {
        resolve();
        return;
      }
      prepareFlipbook(animNames, pixels, (name, drawable, dx, dy) => {
        animFrames[name] = drawable;
        if (dx || dy) shifts.push(`${name}: ${dx},${dy}`);
        if (name === first) resolve();
      }, () => {
        const complete = list => list.every(([, name]) => !name || animFrames[name]);
        animIntro = complete(ANIM_INTRO);
        animGust = complete(ANIM_GUST);
        flipbookDone = true;
        resolve();
        reportLater();
      });
    });
    const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 2500));
    const [frames] = await Promise.race([
      Promise.all([
        Promise.all(Object.entries(FRAME_FILES).map(async ([key, file]) => [key, await loadImage(new URL(`${file}.${FRAME_EXTENSION}`, FRAME_DIR))])),
        firstReady,
      ]),
      timeout.then(() => [null]),
    ]);
    const found = [];
    if (Array.isArray(frames)) {
      for (const [key, image] of frames) {
        if (!image) continue;
        try {
          eyePatches[key] = buildFramePatches(image);
          found.push(key);
        } catch (_) { /* keep procedural */ }
      }
    }
    eyeMode = animFrames[first] ? 'flipbook' : found.length ? 'frames' : 'procedural';
    if (animFrames[first]) {
      // The flipbook's first frame is what she assembles into.
      entrySource = animFrames[first];
    } else if (eyePatches.viewer) {
      entrySource = makeCanvas(portrait.naturalWidth, portrait.naturalHeight);
      const entryContext = entrySource.getContext('2d');
      entryContext.drawImage(portrait, 0, 0);
      for (const patch of eyePatches.viewer) entryContext.drawImage(patch.canvas, patch.x, patch.y);
    } else entrySource = portrait;

    try {
      assembly = pixels ? buildAssembly(readPixels(entrySource, portrait.naturalWidth, portrait.naturalHeight)) : null;
    } catch (_) {
      assembly = null;
    }
    if (assembly) buildResolveMask();

    const names = { viewer: 'погляд на вас', half: 'напівзакриті', closed: 'закриті' };
    const report = () => {
      const animCount = Object.keys(animFrames).length;
      const intro = animIntro
        ? 'Початок: покадрова анімація.'
        : found.length
          ? `Очі: згенеровані кадри (${found.map(key => names[key]).join(', ')}).`
          : 'Очі: процедурне кліпання.';
      const gust = animGust ? ' Вітер: покадрова анімація.' : flipbookDone ? ' Вітер: кадрів немає, рухається лише стрічка.' : ' Кадри анімації готуються…';
      const partial = flipbookDone && animCount && (!animIntro || !animGust) ? ` Знайдено ${animCount} з ${animNames.length} кадрів у frames/anim/.` : '';
      setStatus(intro + gust + partial + (shifts.length ? ` Вирівняно: ${shifts.join('; ')}.` : ''));
    };
    report();
    reportLater = report;
  }

  // ---- Drawing -------------------------------------------------------------
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
    if (running) render();
  }

  const snap = value => Math.round(value * pixelRatio) / pixelRatio;
  const mixColor = (from, to, amount) => `rgb(${Math.round(from[0] + (to[0] - from[0]) * amount)} ${Math.round(from[1] + (to[1] - from[1]) * amount)} ${Math.round(from[2] + (to[2] - from[2]) * amount)})`;

  function drawAssembly(t, source) {
    const { fit, x, y } = dimensions;
    const { levels, depth, size } = assembly;
    const full = size * fit;
    const [rippleStart, rippleEnd] = QUAD.ripple;
    const base = levels[QUAD.base];
    const baseSize = full / base.side;
    const originX = x + QUAD.origin.x * fit;
    const originY = y + QUAD.origin.y * fit;

    // One violet pixel pops on her face; it hands over to the first cells.
    if (t < rippleStart + QUAD.appear) {
      const dot = 12;
      const pop = clamp(t / QUAD.pop);
      const popScale = pop < .7 ? easeOut(pop / .7) * 1.35 : 1.35 - .35 * smooth((pop - .7) / .3);
      const fade = 1 - clamp((t - rippleStart) / QUAD.appear);
      const side = dot * popScale;
      context.globalAlpha = fade;
      context.fillStyle = `rgb(${assemblyColor.join(' ')})`;
      context.fillRect(snap(originX - side / 2), snap(originY - side / 2), snap(side), snap(side));
      context.globalAlpha = 1;
    }
    if (t < rippleStart) return;

    const gapFade = 1 - smooth(clamp((t - QUAD.resolve[0]) / (QUAD.resolve[1] - QUAD.resolve[0]) * 1.4));
    const draw = (d, ix, iy, parent) => {
      const level = levels[d];
      const index = iy * level.side + ix;
      if (d < depth && t >= level.splitAt[index]) {
        const next = { d, index, at: level.splitAt[index] };
        draw(d + 1, ix * 2, iy * 2, next);
        draw(d + 1, ix * 2 + 1, iy * 2, next);
        draw(d + 1, ix * 2, iy * 2 + 1, next);
        draw(d + 1, ix * 2 + 1, iy * 2 + 1, next);
        return;
      }
      if (!level.visible[index]) return;
      const cellSize = full / level.side;
      const gap = Math.min(1.5, cellSize * .1) * gapFade;
      const blend = parent ? (t - parent.at) / QUAD.blend : 1;
      if (blend < 1) {
        const p = levels[parent.d].color;
        const c = level.color;
        context.fillStyle = mixColor([p[parent.index * 3], p[parent.index * 3 + 1], p[parent.index * 3 + 2]], [c[index * 3], c[index * 3 + 1], c[index * 3 + 2]], smooth(clamp(blend)));
      } else context.fillStyle = level.css[index];
      const left = snap(x + ix * cellSize + gap / 2);
      const top = snap(y + iy * cellSize + gap / 2);
      context.fillRect(left, top, snap(x + (ix + 1) * cellSize - gap / 2) - left, snap(y + (iy + 1) * cellSize - gap / 2) - top);
    };
    // Base cells spread from the pixel like a ripple, nearest first; each one
    // grows from a violet speck into its own colour, then the tree takes over.
    const maxDistance = Math.hypot(Math.max(QUAD.origin.x, size - QUAD.origin.x), Math.max(QUAD.origin.y, size - QUAD.origin.y));
    for (let iy = 0; iy < base.side; iy += 1) {
      for (let ix = 0; ix < base.side; ix += 1) {
        const index = iy * base.side + ix;
        if (!base.visible[index]) continue;
        const cx = (ix + .5) * size / base.side;
        const cy = (iy + .5) * size / base.side;
        const distance = Math.hypot(cx - QUAD.origin.x, cy - QUAD.origin.y) / maxDistance;
        const local = clamp((t - rippleStart - distance * (rippleEnd - rippleStart - QUAD.appear)) / QUAD.appear);
        if (local <= 0) continue;
        if (local >= 1) {
          draw(QUAD.base, ix, iy, null);
          continue;
        }
        const grow = easeOut(local);
        const side = baseSize * (.18 + .82 * grow);
        const gap = Math.min(1.5, side * .1) * gapFade;
        const c = base.color;
        context.fillStyle = mixColor(assemblyColor, [c[index * 3], c[index * 3 + 1], c[index * 3 + 2]], smooth(clamp(local * 1.4)));
        const left = snap(x + (ix + .5) * baseSize - side / 2 + gap / 2);
        const top = snap(y + (iy + .5) * baseSize - side / 2 + gap / 2);
        context.fillRect(left, top, snap(side - gap), snap(side - gap));
      }
    }

    // Resolve: smallest cells switch from square to real pixels one by one,
    // from her face outwards. Revealed cells are cut out of the squares and
    // filled with the portrait, so a square never shows under the picture.
    const [resolveStart, resolveEnd] = QUAD.resolve;
    const amount = (t - resolveStart) / (resolveEnd - resolveStart);
    if (amount > 0) switchCells(source, amount);
  }

  // Cuts the cells whose turn has come out of what is already on the canvas
  // and fills them with `target`. Every cell switches at once, nothing fades.
  // Used at the end of the assembly.
  function switchCells(target, amount) {
    if (!resolveMask || !dimensions) return;
    const { fit, x, y } = dimensions;
    const full = Math.max(portrait.naturalWidth, portrait.naturalHeight) * fit;
    const cells = resolveMask;
    if (cells.amount !== amount) {
      const { data } = cells.image;
      for (let index = 0; index < cells.at.length; index += 1) data[index * 4 + 3] = amount >= cells.at[index] ? 255 : 0;
      cells.maskContext.putImageData(cells.image, 0, 0);
      cells.amount = amount;
    }
    if (!cells.layer || cells.layer.width !== canvas.width || cells.layer.height !== canvas.height) {
      cells.layer = makeCanvas(canvas.width, canvas.height);
    }
    const layer = cells.layer.getContext('2d');
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.globalCompositeOperation = 'source-over';
    layer.clearRect(0, 0, cells.layer.width, cells.layer.height);
    layer.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    layer.imageSmoothingEnabled = true;
    layer.imageSmoothingQuality = 'high';
    layer.drawImage(target, x, y, portrait.naturalWidth * fit, portrait.naturalHeight * fit);
    layer.globalCompositeOperation = 'destination-in';
    layer.imageSmoothingEnabled = false;
    layer.drawImage(cells.mask, x, y, full, full);
    context.globalCompositeOperation = 'destination-out';
    context.imageSmoothingEnabled = false;
    context.drawImage(cells.mask, x, y, full, full);
    context.imageSmoothingEnabled = true;
    context.globalCompositeOperation = 'source-over';
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(cells.layer, 0, 0);
    context.restore();
  }

  // Flipbook: the frame on screen at a given time of a sequence; null = original.
  function flipbookFrame(sequence, elapsed) {
    let current = null;
    for (const [at, name] of sequence) {
      if (elapsed >= at) current = name;
    }
    return current ? animFrames[current] : null;
  }

  function strayPosition(sceneTime, entryProgress) {
    const tile = tiles[strayIndex];
    const wander = { x: tile.sx + WANDER.dx, y: tile.sy + WANDER.dy };
    if (entryProgress !== null && assembly) {
      // The naughty tile pops up beside her while the portrait resolves.
      const local = clamp((entryProgress - .7) / .22);
      const scale = local < .65 ? easeOut(local / .65) * 1.15 : 1.15 - .15 * smooth((local - .65) / .35);
      return { x: wander.x, y: wander.y, alpha: smooth(clamp(local * 2.5)), scaleX: Math.max(.01, scale), scaleY: Math.max(.01, scale) };
    }
    if (entryProgress !== null) {
      const settled = easeOut(clamp((entryProgress - .12) / .88));
      return {
        x: wander.x + (tile.dx * 1.4 - 120) * (1 - settled),
        y: wander.y + tile.dy * (1 - settled),
        alpha: smooth(clamp(entryProgress * 2.6)), scaleX: .62 + .38 * settled, scaleY: .62 + .38 * settled,
      };
    }
    if (sceneTime < SCENE.jump) {
      let lift = Math.sin(sceneTime / 170) * 3;
      let squash = 1;
      for (const hop of SCENE.hops) {
        const local = (sceneTime - hop) / 220;
        if (local > 0 && local < 1) {
          lift -= 4 * local * (1 - local) * 26;
          squash = 1 + Math.sin(local * Math.PI) * .08;
        }
      }
      return { x: wander.x, y: wander.y + lift, alpha: 1, scaleX: 1 / squash, scaleY: squash };
    }
    const local = clamp((sceneTime - SCENE.jump) / SCENE.jumpLength);
    if (local >= 1) return null;
    const eased = easeInOut(local);
    const arc = 4 * local * (1 - local) * 78;
    const squash = local > .86 ? 1 - (local - .86) / .14 * .14 : 1 + Math.sin(local * Math.PI) * .06;
    return {
      x: wander.x + (tile.sx - wander.x) * eased,
      y: wander.y + (tile.sy - wander.y) * eased - arc,
      alpha: 1, scaleX: 2 - squash, scaleY: squash,
    };
  }

  function eyeState(sceneTime) {
    const blink = from => {
      const local = sceneTime - from;
      if (local < 0 || local > 240) return null;
      if (local < 70) return 'half';
      if (local < 170) return 'closed';
      return 'half';
    };
    if (sceneTime !== null) {
      if (sceneTime < SCENE.blink && eyePatches.viewer) return 'viewer';
      const first = blink(SCENE.blink);
      if (first) return first;
      const second = blink(SCENE.blink2);
      if (second) return second;
    }
    const extra = clock - blinkAt;
    if (extra >= 0 && extra <= 240) return extra < 70 ? 'half' : extra < 170 ? 'closed' : 'half';
    return null;
  }

  function drawPatches(state, x, y, fit) {
    const patches = eyePatches[state] || (state === 'half' ? eyePatches.closed : null);
    if (!patches) return;
    for (const patch of patches) {
      context.drawImage(patch.canvas, x + patch.x * fit, y + patch.y * fit, patch.canvas.width * fit, patch.canvas.height * fit);
    }
  }

  function render() {
    if (!context || !dimensions) return false;
    try {
      const { width, height, fit, x, y } = dimensions;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      // Same resampling as the <img> underneath, so the hand-over is invisible.
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const t = sceneStart === null ? Infinity : clock - sceneStart;
      const inEntry = t < DURATION;
      const sceneTime = !inEntry && t - DURATION < SCENE.end ? t - DURATION : null;
      const source = inEntry || (sceneTime !== null && sceneTime < SCENE.blink) ? entrySource : portrait;

      const gustTime = clock - gustAt;
      const windy = !inEntry && animGust && gustTime >= 0 && gustTime < GUST_LENGTH;
      const introLength = ANIM_INTRO[ANIM_INTRO.length - 1][0];
      const intro = !inEntry && animIntro && sceneTime !== null && sceneTime < introLength;
      // Which full picture is on screen after the assembly.
      const picture = windy ? flipbookFrame(ANIM_GUST, gustTime) || portrait
        : intro ? flipbookFrame(ANIM_INTRO, sceneTime) || portrait
          : source;

      if (inEntry && assembly) {
        drawAssembly(t, source);
      } else if (inEntry) {
        // Fallback when the pixels cannot be read: the original tile drift.
        const progress = clamp(t / DURATION);
        const driftScale = Math.min(width / 560, 1);
        tiles.forEach((tile, index) => {
          if (index === strayIndex) return;
          const local = clamp((progress - tile.delay) / (1 - tile.delay));
          const settled = easeOut(local);
          const scale = .62 + .38 * settled;
          const w = tile.sw * fit;
          const h = tile.sh * fit;
          context.globalAlpha = smooth(clamp(local * 2.6));
          context.drawImage(source, tile.sx, tile.sy, tile.sw, tile.sh,
            x + tile.sx * fit + tile.dx * driftScale * (1 - settled) + w * (1 - scale) / 2,
            y + tile.sy * fit + tile.dy * driftScale * (1 - settled) + h * (1 - scale) / 2,
            w * scale, h * scale);
        });
        context.globalAlpha = 1;
      } else {
        context.drawImage(picture, x, y, portrait.naturalWidth * fit, portrait.naturalHeight * fit);
      }

      const stray = tiles[strayIndex];
      const strayState = inEntry ? strayPosition(null, clamp(t / DURATION)) : sceneTime !== null ? strayPosition(sceneTime, null) : null;
      if (strayState && (!inEntry || (assembly && t >= QUAD.detail[0]))) {
        // Leave the slot empty until the tile lands.
        context.clearRect(x + stray.sx * fit - .5, y + stray.sy * fit - .5, stray.sw * fit + 1, stray.sh * fit + 1);
      }

      // The intro frames contain their own blink; the gust frames do not.
      const state = inEntry || intro ? null : eyeState(sceneTime);
      if (state && state !== 'viewer') drawPatches(state, x, y, fit);

      if (strayState) {
        const w = stray.sw * fit;
        const h = stray.sh * fit;
        context.globalAlpha = strayState.alpha;
        context.drawImage(source, stray.sx, stray.sy, stray.sw, stray.sh,
          x + strayState.x * fit + w * (1 - strayState.scaleX) / 2,
          y + strayState.y * fit + h * (1 - strayState.scaleY),
          w * strayState.scaleX, h * strayState.scaleY);
        context.globalAlpha = 1;
      }

      if (sceneTime !== null) {
        const pulse = (sceneTime - SCENE.jump - SCENE.jumpLength) / 380;
        if (pulse > 0 && pulse < 1) {
          const grow = 6 + easeOut(pulse) * 16;
          context.strokeStyle = `rgb(103 80 234 / ${(1 - pulse) * .8})`;
          context.lineWidth = 2;
          context.strokeRect(x + stray.sx * fit - grow / 2, y + stray.sy * fit - grow / 2, stray.sw * fit + grow, stray.sh * fit + grow);
        }
      }
      return true;
    } catch (_) {
      context = null;
      stop();
      return false;
    }
  }

  // ---- Clock and scene events ----------------------------------------------
  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    media?.classList.remove('is-assembling');
    if (media) media.dataset.entryState = 'settled';
  }

  function sceneEvents() {
    if (sceneStart === null) return;
    const sceneTime = clock - sceneStart - DURATION;
    if (sceneTime >= SCENE.handoff && !sceneFlags.handoff) {
      sceneFlags.handoff = true;
      showHandoff();
    }
    if (sceneTime >= SCENE.gust && !sceneFlags.gust) {
      sceneFlags.gust = true;
      startGust(true, sceneStart + DURATION + SCENE.gust);
    }
    if (sceneTime >= SCENE.end) sceneStart = null;
  }

  function tick(time) {
    frame = 0;
    if (!running || document.hidden || reduced()) return;
    if (previousTime !== null) clock += Math.min(time - previousTime, 100);
    previousTime = time;
    sceneEvents();
    if (!render()) return;
    if (clock >= activeUntil && sceneStart === null) stop();
    else frame = requestAnimationFrame(tick);
  }

  function run(until) {
    if (!context || reduced() || !imageReady) return;
    activeUntil = Math.max(activeUntil, until);
    measureCanvas();
    if (!dimensions) return;
    running = true;
    media.classList.add('is-assembling');
    media.dataset.entryState = 'playing';
    render();
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function startScene(skipAssembly = root.classList.contains('case-departed')) {
    resetHandoff();
    sceneFlags = {};
    // An early scroll can reach the shoulder before its entrance finishes.
    // Start with the assembled picture if that part is already on its way.
    sceneStart = skipAssembly ? clock - DURATION : clock;
    gustAt = -1e9;
    run(sceneStart + DURATION + SCENE.end);
  }

  function startEntry() {
    if (entryStarted || !imageReady) return;
    entryStarted = true;
    entryObserver?.disconnect();
    if (!context || reduced()) {
      stop();
      showHandoff(true);
      return;
    }
    startScene();
  }

  function startWhenVisible() {
    if (entryStarted || !available) return;
    if (reduced() || !context) {
      startEntry();
      return;
    }
    const bounds = media.getBoundingClientRect();
    const visibleRatio = Math.min(.55, window.innerHeight * .55 / Math.max(1, bounds.height));
    const visibleHeight = Math.min(innerHeight, bounds.bottom) - Math.max(0, bounds.top);
    if (visibleHeight >= bounds.height * visibleRatio) startEntry();
    else if ('IntersectionObserver' in window) {
      entryObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.intersectionRatio >= visibleRatio)) startEntry();
      }, { threshold: visibleRatio });
      entryObserver.observe(media);
    } else {
      entryStarted = true;
      stop();
    }
  }

  // ---- Wind: hair (canvas), loose pixels and the ribbon (DOM) --------------
  function startGust(withRibbon, at = clock) {
    if (reduced() || !imageReady) return;
    gustAt = at;
    blinkAt = withRibbon ? blinkAt : at + 620;
    run(at + GUST_LENGTH);
    if (withRibbon) playRibbon();
  }

  function sourceToStage(point) {
    if (!dimensions) return null;
    const mediaBounds = media.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    return {
      x: mediaBounds.left - stageBounds.left + dimensions.x + point.x * dimensions.fit,
      y: mediaBounds.top - stageBounds.top + dimensions.y + point.y * dimensions.fit,
    };
  }

  function ribbonPath() {
    if (!hero || !arrowLink || !media) return null;
    const heroBounds = hero.getBoundingClientRect();
    const m = media.getBoundingClientRect();
    const arrow = (arrowLink.querySelector('span') || arrowLink).getBoundingClientRect();
    if (!m.width || !arrow.width) return null;
    const rel = (px, py) => `${(px - heroBounds.left).toFixed(1)} ${(py - heroBounds.top).toFixed(1)}`;
    const ax = arrow.left + arrow.width / 2 + 10;
    const ay = arrow.top + arrow.height / 2;
    if (arrow.bottom < m.top) {
      // Stacked layout: the link sits above the portrait.
      return `M ${rel(m.right - m.width * .02, m.top + m.height * .42)}`
        + ` C ${rel(m.right + m.width * .06, m.top + m.height * .12)} ${rel(m.right - m.width * .1, m.top - m.height * .08)} ${rel(m.left + m.width * .55, m.top - m.height * .02)}`
        + ` S ${rel(ax + 70, ay + 36)} ${rel(ax, ay)}`;
    }
    return `M ${rel(m.right - m.width * .12, m.top + m.height * .04)}`
      + ` C ${rel(m.right + m.width * .1, m.top + m.height * .3)} ${rel(m.right + m.width * .02, m.top + m.height * .8)} ${rel(m.left + m.width * .62, m.top + m.height * .9)}`
      + ` S ${rel(ax + 150, ay + 50)} ${rel(ax, ay)}`;
  }

  function playRibbon() {
    if (!ribbonSvg || !('animate' in Element.prototype)) return;
    const d = ribbonPath();
    if (!d) return;
    const ns = 'http://www.w3.org/2000/svg';
    ribbonSvg.replaceChildren();
    const layers = ['ribbon-shadow', 'ribbon-body', 'ribbon-shine'].map(name => {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('class', name);
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '1');
      ribbonSvg.append(path);
      return path;
    });
    const length = layers[1].getTotalLength();
    const DRAW = 1050;
    const piece = .3;
    layers.forEach((path, index) => {
      const size = index === 2 ? piece * .55 : piece;
      path.style.strokeDasharray = `${size} 2`;
      path.animate([
        { strokeDashoffset: size },
        { strokeDashoffset: -1 },
      ], { duration: DRAW, delay: index === 2 ? 60 : 0, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' })
        .finished.then(() => path.remove(), () => path.remove());
    });

    // Behind the ribbon's tail the silk becomes a stepped pixel route.
    const step = 15;
    const count = Math.max(6, Math.floor(length / step));
    for (let index = 1; index < count; index += 1) {
      const at = index / count;
      const point = layers[1].getPointAtLength(at * length);
      const size = index % 4 === 0 ? 8 : index % 3 === 0 ? 5 : 6;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'route-pixel');
      rect.setAttribute('x', String(Math.round(point.x / 3) * 3 - size / 2));
      rect.setAttribute('y', String(Math.round(point.y / 3) * 3 - size / 2));
      rect.setAttribute('width', String(size));
      rect.setAttribute('height', String(size));
      ribbonSvg.append(rect);
      const reach = DRAW * Math.pow(at, .9) * .82 + 140;
      rect.animate([
        { opacity: 0 },
        { opacity: .9, offset: .18 },
        { opacity: .9, offset: .6 },
        { opacity: 0 },
      ], { duration: 850, delay: reach, easing: 'ease-out', fill: 'both' })
        .finished.then(() => rect.remove(), () => rect.remove());
    }

    const arrow = arrowLink.querySelector('span');
    arrow?.animate([
      { transform: 'translateY(0)', color: 'inherit' },
      { transform: 'translateY(6px)', color: '#6750ea', offset: .35 },
      { transform: 'translateY(-2px)', color: '#6750ea', offset: .65 },
      { transform: 'translateY(0)', color: 'inherit' },
    ], { duration: 480, delay: DRAW - 100, easing: 'cubic-bezier(.3,.7,.3,1)' });
  }

  // ---- Scroll trail (from motion.js) + relay pixel ---------------------------
  const particles = trail && nodes.length ? Array.from({ length: 12 }, (_, index) => {
    const element = document.createElement('span');
    element.className = 'travel-pixel';
    trail.append(element);
    return { element, target: index % nodes.length, index };
  }) : [];
  const handoff = trail && nodes.length ? Object.assign(document.createElement('span'), { className: 'handoff-pixel' }) : null;
  if (handoff) trail.append(handoff);

  function resetHandoff() {
    if (trail) trail.dataset.handoff = 'waiting';
    handoffArrived = false;
  }

  function showHandoff(silent = false) {
    if (!handoff || !nativeScrollTimeline || reduced()) return;
    trail.dataset.handoff = 'ready';
    queueTrail();
    if (!silent && 'animate' in Element.prototype) {
      handoff.animate([{ scale: 0 }, { scale: 1.35, offset: .6 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1.2)' });
    }
  }

  function hideTrail() {
    if (trail) trail.dataset.timelineReady = 'false';
    for (const { element } of particles) element.style.opacity = '0';
  }

  function measureTrail() {
    if (!stage || !particles.length || !imageReady || !dimensions) {
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
    const hold = sourceToStage(HOLD);
    const section = document.getElementById('approach')?.getBoundingClientRect();
    const routeX = Math.min(root.clientWidth - 18, (section?.right ?? stageBounds.right) + 18) + scrollX;
    geometry = {
      source,
      hold: hold ? { x: stageBounds.left + hold.x + scrollX, y: stageBounds.top + hold.y + scrollY } : source,
      targets,
      routeX,
      start: Math.max(0, source.y - window.innerHeight * .92),
      end: Math.max(source.y - window.innerHeight * .92 + 140, targets[0].y - window.innerHeight * .48),
    };
  }

  function setRoute(element, from, destination, spread, start, end) {
    element.style.setProperty('--source-x', `${from.x - 5}px`);
    element.style.setProperty('--source-y', `${from.y - 5}px`);
    element.style.setProperty('--gutter-x', `${geometry.routeX + spread - 5}px`);
    element.style.setProperty('--turn-y', `${from.y + 38 + spread - 5}px`);
    element.style.setProperty('--rail-y', `${destination.y - 27 + spread - 5}px`);
    element.style.setProperty('--target-x', `${destination.x - 5}px`);
    element.style.setProperty('--target-y', `${destination.y - 5}px`);
    element.style.setProperty('--range-start', `${start}%`);
    element.style.setProperty('--range-end', `${end}%`);
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
      const delay = (index % 3) * .07;
      setRoute(element, geometry.source, geometry.targets[target], (Math.floor(index / 4) - 1) * 3, start + (end - start) * delay, end);
    }
    // The relay pixel leaves on the very first scroll and lands in step 01.
    if (handoff) setRoute(handoff, geometry.hold, geometry.targets[0], 0, 0, Math.max(.2, end * .96));
    trail.dataset.timelineReady = 'true';
  }

  function queueTrail() {
    if (!trailFrame && !document.hidden && !reduced() && nativeScrollTimeline) trailFrame = requestAnimationFrame(configureTrail);
  }

  function checkArrival() {
    if (handoffArrived || !geometry || trail?.dataset.handoff !== 'ready' || reduced()) return;
    const scrollDistance = root.scrollHeight - window.innerHeight;
    const end = Math.max(.2, clamp(geometry.end / scrollDistance) * 96) / 100 * scrollDistance;
    if (window.scrollY >= end - 2) {
      handoffArrived = true;
      const node = nodes[0];
      node.classList.remove('is-arrived');
      void node.offsetWidth;
      node.classList.add('is-arrived');
      setTimeout(() => node.classList.remove('is-arrived'), 950);
    }
  }

  // ---- Preferences and wiring -----------------------------------------------
  function updatePreference() {
    const limited = reduced();
    root.dataset.reducedMotion = String(limited);
    if (toggle) {
      toggle.hidden = false;
      toggle.setAttribute('aria-pressed', String(limited));
      toggle.disabled = systemMotion.matches;
    }
    if (note) note.textContent = systemMotion.matches ? 'Увімкнено в системі' : limited ? 'Рух зменшено' : '';
    if (replayButton) replayButton.disabled = limited || !imageReady || !context;
    if (gustButton) gustButton.disabled = limited || !imageReady || !context;
    if (limited) {
      entryStarted = true;
      entryObserver?.disconnect();
      sceneStart = null;
      gustAt = -1e9;
      stop();
      ribbonSvg?.replaceChildren();
      if (trailFrame) cancelAnimationFrame(trailFrame);
      trailFrame = 0;
      hideTrail();
      resetHandoff();
    } else queueTrail();
    document.dispatchEvent(new CustomEvent('marline:motionchange', { detail: { reduced: limited } }));
  }

  async function onImageReady() {
    if (imageReady || !portrait.naturalWidth || !portrait.naturalHeight) return;
    createTiles();
    await prepareAssets();
    imageReady = true;
    updatePreference();
    measureCanvas();
    queueTrail();
    startWhenVisible();
  }

  toggle?.addEventListener('click', () => {
    manualReduction = !manualReduction;
    updatePreference();
  });
  replayButton?.addEventListener('click', () => {
    if (reduced() || !imageReady) return;
    entryStarted = true;
    // Keep the whole portrait in the viewport on mobile, where the copy sits above it.
    const bounds = media.getBoundingClientRect();
    const centered = window.scrollY + bounds.top - (window.innerHeight - bounds.height) / 2;
    const pixel = document.querySelector('#case-corner > i');
    const departure = pixel ? parseFloat(pixel.style.getPropertyValue('--leave')) : Infinity;
    const beforeDeparture = Number.isFinite(departure) ? departure - 1 : centered;
    window.scrollTo({ top: Math.max(0, Math.min(centered, beforeDeparture)), behavior: 'instant' });
    startScene(false);
  });
  gustButton?.addEventListener('click', () => startGust(true));

  // Voluntary exploration: touching the portrait makes the wind blow again.
  media?.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    if (running || reduced() || clock - lastHoverGust < 4500) return;
    lastHoverGust = clock;
    startGust(false);
  });
  media?.addEventListener('click', () => {
    if (running || reduced()) return;
    lastHoverGust = clock;
    startGust(false);
  });

  systemMotion.addEventListener('change', updatePreference);
  document.addEventListener('marline:transferstart', () => {
    if (sceneStart !== null && clock - sceneStart < DURATION) {
      sceneStart = clock - DURATION;
      activeUntil = sceneStart + DURATION + SCENE.end;
      render();
    }
  });
  document.addEventListener('marline:versionchange', () => {
    // The ribbon path belongs to the old hero composition.
    ribbonSvg?.replaceChildren();
    measureCanvas();
  });
  window.addEventListener('resize', () => {
    measureCanvas();
    queueTrail();
  }, { passive: true });
  window.addEventListener('scroll', checkArrival, { passive: true });
  document.addEventListener('marline:layoutchange', queueTrail);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = null;
      if (trailFrame) cancelAnimationFrame(trailFrame);
      trailFrame = 0;
    } else {
      if (running && !frame) frame = requestAnimationFrame(tick);
      queueTrail();
    }
  });

  if (available) {
    portrait.addEventListener('load', onImageReady, { once: true });
    portrait.addEventListener('error', () => {
      imageReady = false;
      entryStarted = true;
      entryObserver?.disconnect();
      stop();
      hideTrail();
      setStatus('Портрет не завантажився.');
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
  // Study-only: ?debug exposes a frame-exact seek for visual review.
  if (new URLSearchParams(location.search).has('debug')) {
    window.wowDebug = {
      seek(ms) {
        if (!imageReady) return 'not ready';
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        running = false;
        sceneStart = 0;
        clock = ms;
        gustAt = ms >= DURATION + SCENE.gust ? DURATION + SCENE.gust : -1e9;
        measureCanvas();
        media.classList.add('is-assembling');
        render();
        return { scene: ms - DURATION, eyeMode, assembly: Boolean(assembly), animFrames: Object.keys(animFrames), animIntro, animGust };
      },
      handoff() {
        showHandoff(true);
        return trail?.dataset.handoff;
      },
    };
  }
  updatePreference();
  if (available && portrait.complete && portrait.naturalWidth) onImageReady();
})();
