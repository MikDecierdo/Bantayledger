/**
 * Copies the built web app (../dist) into ./app for packaging. Run after
 * `npm run build` in the project folder (that build reads .env.production,
 * so the Windows app talks to the online server).
 */
const fs = require('node:fs');
const path = require('node:path');

const from = path.join(__dirname, '..', 'dist');
const to = path.join(__dirname, 'app');

if (!fs.existsSync(path.join(from, 'index.html'))) {
  console.error('No ../dist/index.html — run "npm run build" in the project folder first.');
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
// The website's download files never belong inside the app itself.
fs.rmSync(path.join(to, 'downloads'), { recursive: true, force: true });
console.log('Copied the web app into desktop/app');
