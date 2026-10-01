import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const publicDir = path.join(webRoot, 'public');
const distDir = path.join(webRoot, 'dist');

console.log('[build:web] Preparing production web distribution...');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
  console.log('[build:web] Copied public assets to dist successfully.');
} else {
  console.error('[build:web] Error: public directory not found at', publicDir);
  process.exit(1);
}

// Verify critical PWA App Shell files are in dist
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'favicon.ico',
  'icons/icon.svg',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/icon-512x512-maskable.png'
];

for (const file of requiredFiles) {
  const target = path.join(distDir, file);
  if (!fs.existsSync(target)) {
    console.error(`[build:web] Critical PWA file missing in dist: ${file}`);
    process.exit(1);
  }
}

console.log('[build:web] Production web bundle verified cleanly.');
