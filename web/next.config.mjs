import path from 'node:path';

/** @type {import('next').NextConfig} */
export default {
  // A plain static site in out/: any hosting works, and the HTML is complete
  // before any JavaScript runs.
  output: 'export',
  images: { unoptimized: true },
  turbopack: { root: path.resolve(import.meta.dirname) },
};
