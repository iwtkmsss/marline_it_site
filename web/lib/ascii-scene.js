// Live ASCII portrait. Thirteen key poses, split into back hair, body, hair and face,
// are warped (positions, not just colours) and stacked, then redrawn as glyphs.
import { GLYPHS, MORPH, PICK, PRINT, QUAD, VERTEX } from './ascii-shaders';

const POSES = '/assets/mascot/marilyn-poses.webp';
const WARP = '/assets/mascot/marilyn-poses.bin';
const NODES = 65;
const POSE_COUNT = 12; // besides the centre
const MESH = 144;
const FONT = 'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace';

async function load(url, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response[type]();
}

// Draws the glyphs large and reduces them, so small sizes keep an even weight.
// Also measures the ink of every glyph in a 2×4 grid for shape matching.
function glyphSheet(w, h) {
  const k = 4;
  const sheet = document.createElement('canvas');
  sheet.width = w * GLYPHS.length * k;
  sheet.height = h * k;
  const context = sheet.getContext('2d', { willReadFrequently: true });
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${h * k * .98}px ${FONT}`;
  GLYPHS.forEach((glyph, i) => {
    context.save();
    context.beginPath();
    context.rect(i * w * k, 0, w * k, h * k);
    context.clip();
    context.fillText(glyph, (i + .5) * w * k, h * k * .53);
    context.restore();
  });
  const source = context.getImageData(0, 0, sheet.width, sheet.height).data;
  const sums = new Float32Array(w * GLYPHS.length * h);
  const shapes = GLYPHS.map(() => new Float32Array(8));
  for (let y = 0; y < h * k; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const value = source[(y * sheet.width + x) * 4 + 3];
      sums[Math.floor(y / k) * w * GLYPHS.length + Math.floor(x / k)] += value / (k * k);
      const g = Math.floor(x / (w * k));
      shapes[g][Math.floor(y / (h * k) * 4) * 2 + Math.floor((x - g * w * k) / (w * k) * 2)] += value;
    }
  }
  const peak = Math.max(...shapes.map(shape => shape.reduce((a, b) => a + b, 0) / 8));
  const unit = shapes.map(shape => Array.from(shape, value => value / peak));
  return {
    pixels: Uint8Array.from(sums),
    upper: unit.flatMap(shape => shape.slice(0, 4)),
    lower: unit.flatMap(shape => shape.slice(4)),
  };
}

// Rest position of every vertex plus its displacement towards each pose.
function buildMesh(warp, first) {
  const at = (pose, x, y, axis) => {
    const fx = x * (NODES - 1);
    const fy = y * (NODES - 1);
    const ix = Math.min(NODES - 2, Math.floor(fx));
    const iy = Math.min(NODES - 2, Math.floor(fy));
    const tx = fx - ix;
    const ty = fy - iy;
    const node = (a, b) => warp[(((first + pose) * NODES + iy + b) * NODES + ix + a) * 2 + axis] / 8192;
    return (node(0, 0) * (1 - tx) + node(1, 0) * tx) * (1 - ty) + (node(0, 1) * (1 - tx) + node(1, 1) * tx) * ty;
  };
  const vertices = [];
  const indices = [];
  for (let j = 0; j <= MESH; j++) {
    for (let i = 0; i <= MESH; i++) {
      const x = i / MESH;
      const y = j / MESH;
      vertices.push(x, y);
      for (let pose = 0; pose < POSE_COUNT; pose++) vertices.push(at(pose, x, y, 0), at(pose, x, y, 1));
      if (i < MESH && j < MESH) {
        const a = j * (MESH + 1) + i;
        const b = a + MESH + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export async function startAsciiScene({ stage, canvas, getReduced, isCancelled, onReady, onLost }) {
  const [blob, warp] = await Promise.all([load(POSES, 'blob'), load(WARP, 'arrayBuffer')]);
  const atlas = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  if (isCancelled()) return null;
  const gl = canvas.getContext('webgl2', { antialias: false });
  if (!gl) return null;

  function program(vertexSource, fragmentSource) {
    const handle = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader');
      gl.attachShader(handle, shader);
    }
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle) || 'program');
    const locations = {};
    return { handle, at: name => (locations[name] ??= gl.getUniformLocation(handle, name)) };
  }
  function texture(filter) {
    const handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return handle;
  }

  const morph = program(VERTEX, MORPH);
  const picker = program(QUAD, PICK);
  const printer = program(QUAD, PRINT);
  let count = 0;
  const [hairMesh, faceMesh] = [0, POSE_COUNT].map(first => {
    const { vertices, indices } = buildMesh(new Int16Array(warp), first);
    count = indices.length;
    const mesh = gl.createVertexArray();
    gl.bindVertexArray(mesh);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    [[2, 0], ...Array.from({ length: 6 }, (_, k) => [4, 8 + k * 16])].forEach(([size, offset], i) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, 104, offset);
    });
    return mesh;
  });
  const empty = gl.createVertexArray();

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const posesTexture = texture(gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  atlas.close();
  const imageTexture = texture(gl.LINEAR);
  const pickTexture = texture(gl.NEAREST);
  const glyphTexture = texture(gl.NEAREST);
  const imageTarget = gl.createFramebuffer();
  const pickTarget = gl.createFramebuffer();

  const face = { x: 0, y: 0, vx: 0, vy: 0 };
  const hair = { x: 0, y: 0, vx: 0, vy: 0 };
  const target = { x: 0, y: 0 };
  let layout = null;
  let frame = 0;
  let last = 0;
  let blinkStart = 0;
  let blinkTimer = 0;
  let returnTimer = 0;
  let visible = true;
  let disposed = false;
  let gone = 0;
  let calm = false; // slow turns while nobody moves the pointer
  let idleTimer = 0;
  let glance = 0;

  function resize() {
    const size = stage.clientWidth;
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(4, Math.round(Math.min(5, Math.max(3.6, size / 118)) * dpr));
    const h = Math.round(w * 1.6);
    const cols = Math.floor(size * dpr / w);
    const rows = Math.floor(size * dpr / h);
    if (layout?.w === w && layout.cols === cols && layout.dpr === dpr) return;
    if (layout?.w !== w) {
      const sheet = glyphSheet(w, h);
      gl.bindTexture(gl.TEXTURE_2D, glyphTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w * GLYPHS.length, h, 0, gl.RED, gl.UNSIGNED_BYTE, sheet.pixels);
      gl.useProgram(picker.handle);
      gl.uniform4fv(picker.at('upper[0]'), sheet.upper);
      gl.uniform4fv(picker.at('lower[0]'), sheet.lower);
    }
    layout = { w, h, cols, rows, dpr, imageWidth: cols * 4, imageHeight: rows * 6 };
    canvas.width = cols * w;
    canvas.height = rows * h;
    canvas.style.inlineSize = `${canvas.width / dpr}px`;
    canvas.style.blockSize = `${canvas.height / dpr}px`;
    for (const [buffer, handle, width, height] of [
      [imageTarget, imageTexture, layout.imageWidth, layout.imageHeight],
      [pickTarget, pickTexture, cols, rows],
    ]) {
      gl.bindTexture(gl.TEXTURE_2D, handle);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle, 0);
    }
    draw(0); // a resized canvas is blank, so repaint before the browser does
    request();
  }

  function bind(prog, unit, name, handle) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.uniform1i(prog.at(name), unit);
  }

  function draw(blink) {
    const { w, h, cols, rows, imageWidth, imageHeight } = layout;
    gl.bindFramebuffer(gl.FRAMEBUFFER, imageTarget);
    gl.viewport(0, 0, imageWidth, imageHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(morph.handle);
    bind(morph, 0, 'poses', posesTexture);
    gl.uniform2f(morph.at('face'), face.x, face.y);
    gl.uniform2f(morph.at('hair'), hair.x, hair.y);
    gl.uniform1f(morph.at('blink'), blink);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    [hairMesh, hairMesh, hairMesh, faceMesh].forEach((mesh, layer) => {
      gl.uniform1f(morph.at('layer'), layer);
      gl.bindVertexArray(mesh);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    });
    gl.disable(gl.BLEND);

    gl.bindVertexArray(empty);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickTarget);
    gl.viewport(0, 0, cols, rows);
    gl.useProgram(picker.handle);
    bind(picker, 0, 'image', imageTexture);
    gl.uniform2f(picker.at('grid'), cols, rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(printer.handle);
    bind(printer, 0, 'image', imageTexture);
    bind(printer, 1, 'picks', pickTexture);
    bind(printer, 2, 'glyphs', glyphTexture);
    gl.uniform2f(printer.at('grid'), cols, rows);
    gl.uniform2f(printer.at('cell'), w, h);
    gl.uniform1f(printer.at('height'), canvas.height);
    gl.uniform1f(printer.at('gone'), gone);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  function spring(body, goal, stiffness, damping, dt) {
    for (const axis of ['x', 'y']) {
      const speed = `v${axis}`;
      body[speed] += ((goal[axis] - body[axis]) * stiffness - body[speed] * damping) * dt;
      body[axis] = Math.max(-1, Math.min(1, body[axis] + body[speed] * dt));
    }
  }
  function settled(body) {
    return Math.hypot(body.x - target.x, body.y - target.y) < .002 && Math.hypot(body.vx, body.vy) < .006;
  }

  function tick(now) {
    frame = 0;
    if (disposed || !layout) return;
    let moving = false;
    if (getReduced()) {
      target.x = target.y = 0;
      blinkStart = 0;
    } else {
      const elapsed = Math.min(last ? now - last : 16, 50) / 1000;
      const steps = Math.max(1, Math.ceil(elapsed * 240));
      for (let i = 0; i < steps; i++) {
        spring(face, target, calm ? 16 : 62, calm ? 7.6 : 14.5, elapsed / steps);
        // Curls follow the head a little late and settle with a soft overshoot.
        spring(hair, face, 190, 19, elapsed / steps);
      }
      moving = !settled(face) || !settled(hair);
    }
    if (!moving) {
      for (const body of [face, hair]) Object.assign(body, target, { vx: 0, vy: 0 });
    }
    last = now;
    let blink = 0;
    if (blinkStart) {
      const t = Math.max(0, now - blinkStart) / 230;
      if (t >= 1) blinkStart = 0;
      else blink = t < .38 ? Math.sin(t / .38 * Math.PI / 2) : Math.cos((t - .38) / .62 * Math.PI / 2);
    }
    draw(blink);
    if (moving || blinkStart) request();
    else last = 0;
  }
  function request() {
    if (!frame && !disposed && visible) frame = requestAnimationFrame(tick);
  }
  function scheduleBlink() {
    blinkTimer = setTimeout(() => {
      if (visible && !document.hidden && !getReduced()) {
        blinkStart = performance.now();
        request();
      }
      scheduleBlink();
    }, 3200 + Math.random() * 3800);
  }

  // Turns the head towards a point of the viewport.
  function aim(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const x = (clientX - (rect.left + rect.width * .5)) / (rect.width * .75);
    const y = (clientY - (rect.top + rect.height * .38)) / (rect.height * .62);
    // Soft limit: the head slows towards its extreme instead of hitting a wall.
    const length = Math.hypot(x, y);
    const eased = length ? Math.tanh(length * 1.15) / length : 0;
    target.x = x * eased;
    target.y = y * eased * (y > 0 ? .78 : .92);
    request();
  }
  function aimAt(element) {
    const rect = element?.getBoundingClientRect();
    if (!rect?.width || rect.bottom < 0 || rect.top > window.innerHeight) return false;
    aim(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return true;
  }
  const awake = () => visible && !gone && !document.hidden && !getReduced();

  function look(event) {
    if (!awake()) return;
    calm = false;
    clearTimeout(returnTimer);
    aim(event.clientX, event.clientY);
    if (event.pointerType === 'touch') returnTimer = setTimeout(center, 1400);
    scheduleIdle(event.pointerType === 'touch' ? 5000 : 7000);
  }
  function center() {
    if (gone) return;
    target.x = target.y = 0;
    request();
  }
  function pose(x, y) {
    target.x = x;
    target.y = y;
    request();
    return true;
  }

  // With no pointer to follow she looks around the page: the heading, the
  // visitor, the buttons. "Менше руху" in the footer switches this off.
  const glances = [
    () => aimAt(document.getElementById('hero-title')),
    () => pose(0, 0),
    () => aimAt(document.querySelector('.hero .button-primary')),
    () => pose(.3, -.22),
    () => pose(0, 0),
    () => aimAt(document.querySelector('.hero .text-link')),
    () => pose(-.38, .1),
    () => pose(0, 0),
  ];
  function idle() {
    if (awake()) {
      calm = true;
      for (let i = 0; i < glances.length; i++) {
        glance = (glance + 1) % glances.length;
        if (glances[glance]()) break;
      }
    }
    scheduleIdle(2600 + Math.random() * 2600);
  }
  function scheduleIdle(delay) {
    clearTimeout(idleTimer);
    if (!disposed) idleTimer = setTimeout(idle, delay);
  }
  // Keyboard users get her attention too.
  function focused(event) {
    if (!awake() || !event.target.matches?.(':focus-visible')) return;
    calm = true;
    if (aimAt(event.target)) scheduleIdle(5000);
  }
  // Without a mouse a scroll makes her follow the page.
  const touchOnly = window.matchMedia('(hover: none)');
  let scrolled = window.scrollY;
  function scrolling() {
    const step = window.scrollY - scrolled;
    scrolled = window.scrollY;
    if (!awake() || !touchOnly.matches || Math.abs(step) < 2) return;
    calm = true;
    pose(target.x * .6, step > 0 ? .5 : -.35);
    scheduleIdle(1100);
  }

  // ---- used by the dissolve ------------------------------------------------
  function setGone(value) {
    if (value === gone) return;
    if (!gone) Object.assign(target, { x: face.x, y: face.y });
    gone = value;
    if (!gone) scheduleIdle(1200);
    request();
  }
  // One record per character: cell x, y, colour (4), glyph, spare.
  function snapshot() {
    if (!layout) return new Float32Array(0);
    const { cols, rows, imageWidth, imageHeight } = layout;
    const picks = new Uint8Array(cols * rows * 4);
    const image = new Uint8Array(imageWidth * imageHeight * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickTarget);
    gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, picks);
    gl.bindFramebuffer(gl.FRAMEBUFFER, imageTarget);
    gl.readPixels(0, 0, imageWidth, imageHeight, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const records = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const at = ((y * 6 + 3) * imageWidth + x * 4 + 2) * 4;
        const alpha = image[at + 3];
        if (alpha < 128) continue;
        records.push(x, y, image[at] / alpha, image[at + 1] / alpha, image[at + 2] / alpha, 1, picks[(y * cols + x) * 4], 0);
      }
    }
    return new Float32Array(records);
  }

  function leave(event) {
    if (!event.relatedTarget && event.pointerType !== 'touch') center();
  }
  function lost() {
    dispose();
    onLost();
  }

  const listeners = new AbortController();
  const options = { passive: true, signal: listeners.signal };
  const resizer = new ResizeObserver(resize);
  const viewer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    request();
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    clearTimeout(blinkTimer);
    clearTimeout(returnTimer);
    clearTimeout(idleTimer);
    listeners.abort();
    resizer.disconnect();
    viewer.disconnect();
  }

  resize();
  resizer.observe(stage);
  viewer.observe(stage);
  window.addEventListener('pointermove', look, options);
  window.addEventListener('pointerdown', look, options);
  document.addEventListener('pointerout', leave, options);
  window.addEventListener('blur', center, options);
  window.addEventListener('scroll', scrolling, options);
  document.addEventListener('focusin', focused, options);
  document.addEventListener('marline:motionchange', request, options);
  canvas.addEventListener('webglcontextlost', lost, options);
  onReady();
  scheduleBlink();
  scheduleIdle(3500);
  return { dispose, setGone, snapshot, glyphSheet, grid: () => ({ cols: layout.cols, rows: layout.rows }) };
}
