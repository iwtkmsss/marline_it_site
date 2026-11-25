// Brightness order does not matter: the shader matches glyphs by shape.
export const GLYPHS = [...' .:;-~^"!/()<>[]{}?+=*rvjtfcxznuaeosLJCTYFVXSZ247356AKUEHDPR089QBNMW&%$#@'];

// The 5x5 grid of poses around the centre. Corners that were never drawn
// borrow the nearest pose and add up the displacements of their neighbours.
const GRID = `
struct Node { vec2 d; vec2 t; float tile; }; // displacement, texture offset, tile
Node node(ivec2 n, vec2 pose, vec4 a[6]) {
  bool left = pose.x < 0., up = pose.y < 0.;
  vec2 x2 = left ? a[0].xy : a[0].zw, y2 = up ? a[1].xy : a[1].zw;
  vec2 x1 = left ? a[2].xy : a[2].zw, y1 = up ? a[3].xy : a[3].zw;
  vec2 xy = up ? (left ? a[4].xy : a[4].zw) : (left ? a[5].xy : a[5].zw);
  float ix2 = left ? 1. : 2., iy2 = up ? 3. : 4., ix1 = left ? 5. : 6., iy1 = up ? 7. : 8.;
  float ixy = (up ? 9. : 11.) + (left ? 0. : 1.);
  if (n == ivec2(0)) return Node(vec2(0), vec2(0), 0.);
  if (n == ivec2(1, 0)) return Node(x1, x1, ix1);
  if (n == ivec2(2, 0)) return Node(x2, x2, ix2);
  if (n == ivec2(0, 1)) return Node(y1, y1, iy1);
  if (n == ivec2(0, 2)) return Node(y2, y2, iy2);
  if (n == ivec2(1)) return Node(xy, xy, ixy);
  if (n == ivec2(2, 1)) return Node(x2 + xy - x1, x2, ix2);
  if (n == ivec2(1, 2)) return Node(y2 + xy - y1, y2, iy2);
  return Node(x2 + y2 + xy - x1 - y1, xy, ixy);
}`;

export const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 p;
layout(location=1) in vec4 d0; // left, right
layout(location=2) in vec4 d1; // up, down
layout(location=3) in vec4 d2; // half left, half right
layout(location=4) in vec4 d3; // half up, half down
layout(location=5) in vec4 d4; // left-up, right-up
layout(location=6) in vec4 d5; // left-down, right-down
uniform vec2 face, hair;
uniform float blink, layer; // 0 back hair, 1 body, 2 hair, 3 face
out vec2 uv, pose;
out vec4 v0, v1, v2, v3, v4, v5;
${GRID}
float lid(vec2 c, float w) {
  float across = clamp(1. - pow((p.x - c.x) / w, 2.), 0., 1.);
  return across * smoothstep(c.y - .034, c.y - .005, p.y) * (1. - smoothstep(c.y - .004, c.y + .022, p.y));
}
void main() {
  vec2 q = (p - vec2(.5, .40)) / vec2(.20, .26);
  pose = layer == 0. || layer == 2. ? mix(face, hair, smoothstep(.75, 1.5, length(q))) : face;
  float m = layer == 1. ? 0. : 1.;
  v0 = d0 * m; v1 = d1 * m; v2 = d2 * m; v3 = d3 * m; v4 = d4 * m; v5 = d5 * m;
  vec4 a[6] = vec4[6](v0, v1, v2, v3, v4, v5);
  vec2 g = abs(pose) * 2., c = min(floor(g), 1.), f = g - c;
  ivec2 n = ivec2(c);
  vec2 at = p
    + mix(mix(node(n, pose, a).d, node(n + ivec2(1, 0), pose, a).d, f.x),
          mix(node(n + ivec2(0, 1), pose, a).d, node(n + ivec2(1), pose, a).d, f.x), f.y);
  if (layer == 3.) at.y += blink * .019 * (lid(vec2(.402, .351), .064) + lid(vec2(.588, .347), .064));
  uv = p;
  gl_Position = vec4(at * 2. - 1., 0, 1); // row 0 of the target is the top
}`;

export const MORPH = `#version 300 es
precision highp float;
in vec2 uv, pose;
in vec4 v0, v1, v2, v3, v4, v5;
uniform sampler2D poses;
uniform float layer;
out vec4 o;
${GRID}
// Alpha holds a signed distance to the layer outline, so a blend of two poses
// has one clean outline in between; colours continue past the outline.
vec3 colour;
float edge, total;
void add(Node n, float w) {
  if (w < .001) return;
  float tile = layer * 13. + n.tile;
  vec2 at = vec2(mod(tile, 8.), floor(tile / 8.)) + clamp(uv + n.t, .003, .997);
  vec4 c = textureLod(poses, at / vec2(8, 7), 0.);
  float g = w * (smoothstep(.48, .52, c.a) + .02);
  colour += c.rgb * g;
  total += g;
  edge += c.a * w;
}
void main() {
  vec4 a[6] = vec4[6](v0, v1, v2, v3, v4, v5);
  vec2 g = abs(pose) * 2., c = min(floor(g), 1.), f = smoothstep(.15, .85, g - c);
  ivec2 n = ivec2(c);
  add(node(n, pose, a), (1. - f.x) * (1. - f.y));
  add(node(n + ivec2(1, 0), pose, a), f.x * (1. - f.y));
  add(node(n + ivec2(0, 1), pose, a), (1. - f.x) * f.y);
  add(node(n + ivec2(1), pose, a), f.x * f.y);
  o = vec4(colour / total, 1) * smoothstep(.485, .515, edge);
}`;

export const QUAD = `#version 300 es
void main() { gl_Position = vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4. - 1., 0, 1); }`;

// Cool platinum grade shared by both glyph passes.
const GRADE = `
float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
vec3 grade(vec3 c) {
  float l = luma(c);
  float s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float hair = 1. - smoothstep(.10, .34, s);
  c *= mix(vec3(.955, .985, 1.13), vec3(.98, .92, 1.1), smoothstep(.45, .7, s));
  c = mix(c, vec3(l) * vec3(1.0, .985, 1.04), (.10 + .4 * hair) * step(c.b, c.r * 1.25));
  return clamp((c - .5) * 1.14 + .515, 0., 1.);
}`;

export const PICK = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform vec2 grid;
uniform vec4 upper[${GLYPHS.length}];
uniform vec4 lower[${GLYPHS.length}];
out vec4 o;
${GRADE}
float ink(vec2 at) {
  vec4 c = texture(image, at / grid);
  if (c.a < .02) return 0.;
  return pow(1. - luma(grade(c.rgb / c.a)), .82) * 1.08 * smoothstep(.2, .8, c.a);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec4 a, b;
  for (int i = 0; i < 4; i++) {
    vec2 s = vec2(.25 + .5 * float(i & 1), .125 + .25 * float(i >> 1));
    a[i] = ink(cell + s);
    b[i] = ink(cell + s + vec2(0, .5));
  }
  // Exaggerate structure inside the cell, so strokes follow curls and lashes.
  float mean = (dot(a, vec4(1)) + dot(b, vec4(1))) / 8.;
  a = clamp(mean + (a - mean) * 1.6, 0., 1.);
  b = clamp(mean + (b - mean) * 1.6, 0., 1.);
  float best = 1e9;
  int pick = 0;
  for (int i = 0; i < ${GLYPHS.length}; i++) {
    vec4 da = a - upper[i], db = b - lower[i];
    float g = (dot(upper[i], vec4(1)) + dot(lower[i], vec4(1))) / 8.;
    float d = dot(da, da) + dot(db, db) + 6. * (g - mean) * (g - mean) + .45 * hash(cell + float(i) * 7.13);
    if (d < best) { best = d; pick = i; }
  }
  o = vec4(float(pick) / 255., 0, 0, 1);
}`;

export const PRINT = `#version 300 es
precision highp float;
uniform sampler2D image, picks, glyphs;
uniform vec2 grid, cell;
uniform float height;
out vec4 o;
${GRADE}
void main() {
  vec2 px = vec2(gl_FragCoord.x, height - gl_FragCoord.y);
  vec2 at = px / cell;
  vec2 id = floor(at);
  vec4 fine = texture(image, (floor(at * vec2(4, 6)) + .5) / vec2(4, 6) / grid);
  if (fine.a < .5) { o = vec4(0); return; }
  vec4 broad = texture(image, (id + .5) / grid);
  vec3 c = grade(fine.rgb / fine.a);
  vec3 t = broad.a > .3 ? grade(broad.rgb / broad.a) : c;
  // Dark strokes sit on a lighter sheet of the same colour; bright hair stays clean.
  float blue = smoothstep(.03, .14, min(c.b - c.r, t.b - t.r + .15));
  vec3 paper = mix(c, vec3(1), (.20 + .26 * luma(c)) * (1. - blue));
  paper = mix(paper, min(paper * vec3(.97, 1.04, 1.08) + .03, 1.), blue);
  vec3 ink = mix(t * t * .56, vec3(.13, .045, .13), .34);
  int pick = int(texelFetch(picks, ivec2(id), 0).r * 255. + .5);
  float m = texelFetch(glyphs, ivec2(px - id * cell) + ivec2(pick * int(cell.x), 0), 0).r;
  o = vec4(mix(paper, ink, m * mix(.3, .86, smoothstep(.1, .5, luma(c))) * (1. - .8 * blue)), 1);
}`;
