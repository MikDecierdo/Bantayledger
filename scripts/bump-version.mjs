#!/usr/bin/env node
/**
 * Sets one version number everywhere: `npm run version:set -- 1.0.2`
 *
 * - package.json            → version (the website and the in-app "Version")
 * - desktop/package.json    → version (the Windows app and its installer)
 * - android/app/build.gradle → versionName, and versionCode + 1 (Android
 *   needs a higher versionCode to install the update over the old app)
 * - src/data/downloads.ts   → the version shown on the website's download cards
 *
 * File sizes on the download cards are updated by hand after building.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: npm run version:set -- 1.0.2');
  process.exit(1);
}

function edit(rel, fn) {
  const path = join(root, rel);
  const before = readFileSync(path, 'utf-8');
  const after = fn(before);
  if (after === before) throw new Error(`Nothing changed in ${rel}`);
  writeFileSync(path, after);
  console.log(`updated ${rel}`);
}

const setJsonVersion = (text) => text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
edit('package.json', setJsonVersion);
edit('desktop/package.json', setJsonVersion);

edit('android/app/build.gradle', (text) =>
  text
    .replace(/versionName "[^"]+"/, `versionName "${version}"`)
    .replace(/versionCode (\d+)/, (_, n) => `versionCode ${Number(n) + 1}`),
);

edit('src/data/downloads.ts', (text) => text.replace(/version: '[^']+'/g, `version: '${version}'`));

console.log(`Version is now ${version}. Rebuild the apps and publish the release (docs/DESKTOP_BUILD.md).`);
