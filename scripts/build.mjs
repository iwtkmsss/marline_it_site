import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(projectRoot, 'dist');

// A fixed public manifest keeps design sources, prompts, docs, and environment files private.
const publicFiles = [
  'index.html',
  'src/site.css',
  'src/site.js',
  'src/marline.css',
  'design/wow-study/wow.css',
  'design/wow-study/wow.js',
  'design/previews/a-desktop.png',
  ...['viewer', 'half', 'closed'].map(state => `assets/mascot/hero-frames/eyes-${state}.webp`),
  ...['01', '02', '03', '04', 'w01', 'w02', 'w03', 'w04', 'w05', 'w06']
    .map(frame => `assets/mascot/hero-frames/anim/${frame}.webp`),
  'assets/favicon.svg',
  'assets/backgrounds/film-light.webp',
  'assets/mascot/marilyn-pixel-v1.png',
  'assets/mascot/marilyn-scenes.webp',
  'assets/fonts/fonts.css',
  'assets/fonts/golos-text-cyrillic-ext-variable.woff2',
  'assets/fonts/golos-text-cyrillic-variable.woff2',
  'assets/fonts/golos-text-latin-ext-variable.woff2',
  'assets/fonts/golos-text-latin-variable.woff2',
  'assets/fonts/unbounded-cyrillic-ext-variable.woff2',
  'assets/fonts/unbounded-cyrillic-variable.woff2',
  'assets/fonts/unbounded-latin-ext-variable.woff2',
  'assets/fonts/unbounded-latin-variable.woff2',
  'assets/fonts/Unbounded-OFL.txt',
  'assets/fonts/GolosText-OFL.txt',
  'assets/fonts/README.md',
];

async function inspectOutputTree(directory) {
  const info = await lstat(directory);
  if (info.isSymbolicLink()) throw new Error(`Refusing to clean a symlink or junction: ${directory}`);
  if (!info.isDirectory()) throw new Error(`Build output must be a directory: ${directory}`);

  for (const entry of await readdir(directory)) {
    const entryPath = path.join(directory, entry);
    const entryInfo = await lstat(entryPath);
    if (entryInfo.isSymbolicLink()) throw new Error(`Refusing to clean a symlink or junction: ${entryPath}`);
    if (entryInfo.isDirectory()) await inspectOutputTree(entryPath);
    else if (!entryInfo.isFile()) throw new Error(`Unsupported entry in build output: ${entryPath}`);
  }
}

async function cleanOutput() {
  const expectedOutput = path.resolve(projectRoot, 'dist');
  if (output !== expectedOutput || path.dirname(output) !== projectRoot) {
    throw new Error(`Refusing to clean an unexpected output path: ${output}`);
  }

  try {
    await lstat(output);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  // Check the root and every descendant before recursive deletion; never follow junctions.
  await inspectOutputTree(output);
  await rm(output, { recursive: true, force: true });
}

async function build() {
  console.log(`Build output: ${output}`);

  // Validate and read everything before removing a previous successful build.
  const sources = await Promise.all(publicFiles.map(async relative => {
    const sourcePath = path.resolve(projectRoot, relative);
    if (!sourcePath.startsWith(`${projectRoot}${path.sep}`)) {
      throw new Error(`Source is outside the project: ${relative}`);
    }

    let info;
    try {
      info = await lstat(sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Missing build source: ${relative}`);
      throw error;
    }
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Build source must be a regular file: ${relative}`);
    const bytes = await readFile(sourcePath);
    if (!bytes.length) throw new Error(`Build source is empty: ${relative}`);
    return { relative, bytes };
  }));

  await cleanOutput();
  await mkdir(output, { recursive: true });

  for (const { relative, bytes } of sources) {
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    console.log(`  ${relative} (${bytes.length.toLocaleString('en-US')} bytes)`);
  }

  const totalBytes = sources.reduce((total, source) => total + source.bytes.length, 0);
  console.log(`Built ${sources.length} public files: ${totalBytes.toLocaleString('en-US')} bytes.`);
}

build().catch(error => {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
});
