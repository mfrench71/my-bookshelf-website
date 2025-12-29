#!/usr/bin/env node
// Lighthouse Audit Script
// Runs Lighthouse audits on the built site

const { execSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const projectRoot = join(__dirname, '..');
const outputDir = join(projectRoot, 'reports');

// Pages to audit
const pages = [
  { path: '/', name: 'home' },
  { path: '/login/', name: 'login' },
  { path: '/books/', name: 'books' },
  { path: '/books/add/', name: 'books-add' },
  { path: '/settings/', name: 'settings' },
  { path: '/privacy/', name: 'privacy' }
];

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Check if site is running
function checkServer(port) {
  try {
    execSync(`lsof -i:${port} -t`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

async function runAudit(url, name) {
  const outputPath = join(outputDir, `lighthouse-${name}.html`);

  console.log(`\n📊 Auditing: ${url}`);

  try {
    execSync(
      `npx lighthouse ${url} ` +
      `--output=html ` +
      `--output-path="${outputPath}" ` +
      `--chrome-flags="--headless --no-sandbox" ` +
      `--only-categories=performance,accessibility,best-practices,seo ` +
      `--quiet`,
      { stdio: 'inherit', cwd: projectRoot }
    );
    console.log(`   ✓ Report saved: reports/lighthouse-${name}.html`);
    return true;
  } catch (error) {
    console.error(`   ✗ Failed to audit ${url}`);
    return false;
  }
}

async function main() {
  const port = process.argv[2] || 8080;
  const baseUrl = `http://localhost:${port}`;

  console.log('🔍 Lighthouse Audit');
  console.log('==================');
  console.log(`Base URL: ${baseUrl}`);

  // Check if server is running
  if (!checkServer(port)) {
    console.error(`\n❌ No server detected on port ${port}`);
    console.log('   Start the server first: npm run start');
    console.log('   Or use: npx serve _site -l 8080');
    process.exit(1);
  }

  console.log(`\n✓ Server detected on port ${port}`);
  console.log(`  Output: ${outputDir}/`);

  let passed = 0;
  let failed = 0;

  for (const page of pages) {
    const success = await runAudit(`${baseUrl}${page.path}`, page.name);
    if (success) passed++;
    else failed++;
  }

  console.log('\n==================');
  console.log(`Complete: ${passed} passed, ${failed} failed`);
  console.log(`Reports: ${outputDir}/`);
}

main();
