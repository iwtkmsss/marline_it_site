// On the way from the hero to "Як ми працюємо" the portrait comes apart into its
// own characters, and they settle as the first picture of the diorama.
// Scroll position is the only clock: nothing runs while the page stands still.
import { CELL_DELAY, GLYPHS, GRADE } from './ascii-shaders';

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 cell;
layout(location=1) in vec4 colour;
layout(location=2) in vec2 extra; // glyph, slot
uniform vec2 view, grid, slots, portrait, size, frame, frameSize;
uniform float gone, lod;
uniform sampler2D picture;
out vec3 paper, ink;
out vec2 at;
flat out float glyph;
flat out float mask;
${GRADE}
${CELL_DELAY}
float noise(float n) { return fract(sin(dot(cell + n, vec2(39.346, 11.135))) * 24634.6345); }
void main() {
  float t = cellTime(cell, grid, gone);
  float e = t * t * (3. - 2. * t);
  vec2 slot = vec2(mod(extra.y, slots.x), floor(extra.y / slots.x));
  vec2 from = portrait + (cell + .5) * size;
  vec2 to = frame + (slot + .5) * frameSize / slots;
  float air = sin(e * 3.14159);
  vec2 drift = vec2(noise(3.) - .5, noise(7.) - .5) * vec2(260, 170) + vec2(-70, 0) * noise(11.);
  vec2 centre = mix(from, to, e) + drift * air;
  vec2 box = mix(size, frameSize / slots + .6, e) * (1. + (view.x < 900. ? -.45 : .35) * air);
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  float turn = air * (noise(17.) - .5) * 2.4;
  vec2 o = (corner - .5) * box;
  o = vec2(o.x * cos(turn) - o.y * sin(turn), o.x * sin(turn) + o.y * cos(turn));
  vec2 px = (centre + o) / view * 2. - 1.;
  gl_Position = t > 0. ? vec4(px.x, -px.y, 0, 1) : vec4(2, 2, 2, 1);

  vec3 c = grade(colour.rgb);
  vec3 target = textureLod(picture, (slot + .5) / slots, lod).rgb;
  float arrive = smoothstep(.45, .95, e);
  paper = mix(mix(c, vec3(1), .20 + .26 * luma(c)), target, arrive);
  ink = mix(c * c * .56, vec3(.13, .045, .13), .34);
  mask = .86 * (1. - smoothstep(.55, .98, e));
  at = corner;
  glyph = extra.x;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 paper, ink;
in vec2 at;
flat in float glyph;
flat in float mask;
uniform sampler2D glyphs;
out vec4 o;
void main() {
  float m = texture(glyphs, vec2((glyph + clamp(at.x, .02, .98)) / ${GLYPHS.length}., at.y)).r;
  o = vec4(mix(paper, ink, m * mask), 1);
}`;

// Anchor links stop this far above the section, under the fixed header.
const ANCHOR_GAP = 80;

const clamp01 = value => Math.max(0, Math.min(1, value));

export function startDissolve({ scene, stage, portraitCanvas, getReduced }) {
  const process = document.querySelector('.process-pin');
  const frame = document.querySelector('.diorama-frame');
  const first = frame?.querySelector('.dio-1');
  if (!process || !first) return null;

  const root = document.documentElement;
  const overlay = document.createElement('canvas');
  overlay.className = 'ascii-dissolve';
  overlay.setAttribute('aria-hidden', 'true');
  const gl = overlay.getContext('webgl2', { antialias: true });
  if (!gl) return null;

  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Dissolve is off:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);
  const locations = {};
  const at = name => (locations[name] ??= gl.getUniformLocation(program, name));
  function texture(unit, filter) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const sheet = scene.glyphSheet(10, 16);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  texture(0, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 10 * GLYPHS.length, 16, 0, gl.RED, gl.UNSIGNED_BYTE, sheet.pixels);
  gl.uniform1i(at('glyphs'), 0);
  texture(1, gl.LINEAR_MIPMAP_LINEAR);
  gl.uniform1i(at('picture'), 1);

  gl.bindVertexArray(gl.createVertexArray());
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  [[2, 0], [4, 8], [2, 24]].forEach(([size, offset], index) => {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, size, gl.FLOAT, false, 32, offset);
    gl.vertexAttribDivisor(index, 1);
  });

  let pictureReady = false;
  let shot = null;
  let request = 0;
  let disposed = false;
  let shown = false;

  function usePicture() {
    if (disposed || !first.naturalWidth) return;
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, first);
    gl.generateMipmap(gl.TEXTURE_2D);
    pictureReady = true;
    schedule();
  }

  // Freezes the portrait's characters; their number decides the target grid.
  function capture() {
    const cells = scene.snapshot();
    const count = cells.length / 8;
    if (!count) return;
    const across = Math.ceil(Math.sqrt(count * (4 / 3) * 1.6));
    const down = Math.ceil(count / across);
    const total = across * down;
    // Every slot is filled: the spare ones are second copies of some characters.
    const data = new Float32Array(total * 8);
    for (let slot = 0; slot < total; slot++) {
      const source = Math.floor(slot * count / total) * 8;
      data.set(cells.subarray(source, source + 8), slot * 8);
      data[slot * 8 + 7] = slot;
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    shot = { total, across, down, ...scene.grid() };
  }

  function stop() {
    if (shown) {
      overlay.remove();
      shown = false;
    }
    shot = null;
    delete root.dataset.dissolve;
    frame.style.removeProperty('--assembled');
    scene.setGone(0);
  }

  function update() {
    request = 0;
    if (disposed) return;
    const pinned = getComputedStyle(frame).position === 'relative';
    const height = window.innerHeight;
    const top = process.getBoundingClientRect().top;
    const progress = (height - top) / (height - ANCHOR_GAP);
    if (!pictureReady || !pinned || getReduced() || progress <= 0) {
      stop();
      return;
    }
    root.dataset.dissolve = '';
    const gone = clamp01((progress - .03) / .86);
    // The mosaic covers the real picture, then fades to hand over.
    frame.style.setProperty('--assembled', progress >= .92 ? 1 : 0);
    overlay.style.opacity = (1 - clamp01((progress - .93) / .07)).toFixed(3);
    if (progress >= 1 || gone === 0) {
      scene.setGone(gone);
      if (shown) {
        overlay.remove();
        shown = false;
      }
      if (gone === 0) shot = null;
      return;
    }
    if (!shot) capture();
    if (!shot) return;
    scene.setGone(gone);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = root.clientWidth;
    if (overlay.width !== Math.round(width * dpr) || overlay.height !== Math.round(height * dpr)) {
      overlay.width = Math.round(width * dpr);
      overlay.height = Math.round(height * dpr);
      gl.viewport(0, 0, overlay.width, overlay.height);
    }
    if (!shown) {
      document.body.append(overlay);
      shown = true;
    }
    const from = portraitCanvas.getBoundingClientRect();
    const to = frame.getBoundingClientRect();
    gl.uniform2f(at('view'), width, height);
    gl.uniform2f(at('grid'), shot.cols, shot.rows);
    gl.uniform2f(at('slots'), shot.across, shot.down);
    gl.uniform2f(at('portrait'), from.left, from.top);
    gl.uniform2f(at('size'), from.width / shot.cols, from.height / shot.rows);
    gl.uniform2f(at('frame'), to.left, to.top);
    gl.uniform2f(at('frameSize'), to.width, to.height);
    gl.uniform1f(at('gone'), gone);
    gl.uniform1f(at('lod'), Math.max(0, Math.log2(first.naturalWidth / shot.across) - 1));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, shot.total);
  }
  function schedule() {
    if (!request && !disposed) request = requestAnimationFrame(update);
  }
  function remeasure() {
    shot = null;
    schedule();
  }

  const listeners = new AbortController();
  const options = { passive: true, signal: listeners.signal };
  const resizer = new ResizeObserver(remeasure);
  window.addEventListener('scroll', schedule, options);
  window.addEventListener('resize', remeasure, options);
  document.addEventListener('marline:motionchange', schedule, options);
  resizer.observe(stage);
  if (first.complete) usePicture();
  else first.addEventListener('load', usePicture, options);
  overlay.addEventListener('webglcontextlost', () => dispose(), options);

  function dispose() {
    if (disposed) return;
    stop();
    disposed = true;
    cancelAnimationFrame(request);
    listeners.abort();
    resizer.disconnect();
  }
  return dispose;
}
