/**
 * Build script to minify all JavaScript files.
 * Uses esbuild to bundle entry points, preserving ES module imports.
 *
 * Run with: node scripts/build-js.js
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src', 'js');
const OUT_DIR = path.join(__dirname, '..', '_site', 'js');

// Entry points that should be bundled (page-level scripts)
const ENTRY_POINTS = [
  'index.js',
  'login.js',
  'header.js',
  'settings.js',
  'books/index.js',
  'books/add.js',
  'books/view.js',
  'books/edit.js'
];

// Files to copy without bundling (loaded separately via script tag)
const STANDALONE_FILES = [
  'firebase-config.js'
];

// Vendor files to copy as-is (already minified)
const VENDOR_FILES = [
  'vendor/zod.js',
  'vendor/lucide.min.js'
];

async function build() {
  // Ensure output directory exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Copy vendor files as-is (already minified)
  for (const file of VENDOR_FILES) {
    const srcPath = path.join(SRC_DIR, file);
    const outPath = path.join(OUT_DIR, file);
    const outDir = path.dirname(outPath);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.copyFileSync(srcPath, outPath);
    const size = fs.statSync(outPath).size;
    console.log(`  ${file}: ${(size / 1024).toFixed(1)}KB`);
  }

  // Copy standalone files (just minify, don't bundle)
  for (const file of STANDALONE_FILES) {
    const srcPath = path.join(SRC_DIR, file);
    const outPath = path.join(OUT_DIR, file);

    await esbuild.build({
      entryPoints: [srcPath],
      outfile: outPath,
      minify: true,
      format: 'esm',
      target: ['es2020'],
      platform: 'browser'
    });

    const size = fs.statSync(outPath).size;
    console.log(`  ${file}: ${(size / 1024).toFixed(1)}KB`);
  }

  // Bundle and minify entry points
  for (const entry of ENTRY_POINTS) {
    const srcPath = path.join(SRC_DIR, entry);
    const outPath = path.join(OUT_DIR, entry);
    const outDir = path.dirname(outPath);

    // Ensure subdirectory exists
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    await esbuild.build({
      entryPoints: [srcPath],
      outfile: outPath,
      bundle: true,
      minify: true,
      format: 'esm',
      target: ['es2020'],
      platform: 'browser',
      // External packages that are loaded separately
      external: [
        './firebase-config.js',
        '../firebase-config.js',
        '/js/firebase-config.js',
        './vendor/zod.js',
        '../vendor/zod.js',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore'
      ]
    });

    const size = fs.statSync(outPath).size;
    console.log(`  ${entry}: ${(size / 1024).toFixed(1)}KB`);
  }

  // Calculate total
  let total = 0;
  const walk = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.js')) {
        total += stat.size;
      }
    }
  };
  walk(OUT_DIR);

  console.log(`\nTotal JS: ${(total / 1024).toFixed(1)}KB`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
