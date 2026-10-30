// Merges scripts/i18n-parts/*.json ({ "English": ["Tagalog", "Cebuano"] }) into
// src/i18n/locales/tl.json and ceb.json. Run after editing a part:
//   node scripts/merge-i18n.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PARTS = join(ROOT, 'scripts', 'i18n-parts');
const OUT = join(ROOT, 'src', 'i18n', 'locales');

const tl = {};
const ceb = {};
for (const file of readdirSync(PARTS).filter((f) => f.endsWith('.json')).sort()) {
  const part = JSON.parse(readFileSync(join(PARTS, file), 'utf8'));
  for (const [key, [t, c]] of Object.entries(part)) {
    if (key in tl) console.warn('duplicate key (later part wins):', key);
    tl[key] = t;
    ceb[key] = c;
  }
}
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(OUT, 'tl.json'), JSON.stringify(sortKeys(tl), null, 2) + '\n');
writeFileSync(join(OUT, 'ceb.json'), JSON.stringify(sortKeys(ceb), null, 2) + '\n');
console.log(Object.keys(tl).length, 'entries written for each language');
