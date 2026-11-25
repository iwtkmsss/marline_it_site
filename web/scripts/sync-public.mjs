// Copies a fixed list of public assets from ../assets into public/assets.
// Raw frames, prompts and design sources never leave the repository.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '..');
const root = path.resolve(web, '..');

const fonts = ['golos-text', 'unbounded'].flatMap(family =>
  ['cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'].map(set => `fonts/${family}-${set}-variable.woff2`));
const heroFrames = [
  ...['viewer', 'half', 'closed'].map(state => `mascot/hero-frames/eyes-${state}.webp`),
  ...['01', '02', '03', '04', 'w01', 'w02', 'w03', 'w04', 'w05', 'w06'].map(frame => `mascot/hero-frames/anim/${frame}.webp`),
];
const files = [
  'favicon.svg',
  'backgrounds/film-light.webp',
  'mascot/marilyn-pixel-v1.png',
  'mascot/marilyn-ascii-preview.webp',
  'mascot/marilyn-poses.webp',
  'mascot/marilyn-poses.bin',
  ...heroFrames,
  ...[1, 2, 3, 4].flatMap(n => [`story/diorama/d${n}.webp`, `story/diorama/d${n}-800.webp`]),
  'works/site-hero.webp',
  'works/site-mobile.webp',
  ...fonts,
  'fonts/GolosText-OFL.txt',
  'fonts/Unbounded-OFL.txt',
];

const jobs = [
  ...files.map(file => [path.join(root, 'assets', file), path.join(web, 'public/assets', file)]),
  [path.join(root, 'design/previews/a-desktop.png'), path.join(web, 'public/assets/works/first-mockup.png')],
];
for (const [from, to] of jobs) {
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
}
console.log(`Synced ${jobs.length} public files.`);
