// Lists every English key passed to t('...') in src/, so translation files can be checked.
// Usage: node scripts/extract-i18n.mjs                  -> prints keys as JSON
//        node scripts/extract-i18n.mjs --check          -> verifies tl.json / ceb.json cover every key
//        node scripts/extract-i18n.mjs --write-template -> writes scripts/i18n-template.json
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'i18n' || name === 'data') continue;
      walk(p, out);
    } else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const keys = new Map();
const re = /\bt\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g;
// i18n/labels.ts holds the enum labels; include it explicitly.
const files = [...walk(SRC), join(SRC, 'i18n', 'labels.ts')];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1] ?? m[2];
    const key = raw.replace(/\\(['"\\])/g, '$1');
    if (!keys.has(key)) keys.set(key, file.replace(ROOT, ''));
  }
}

const sorted = [...keys.keys()].sort((a, b) => a.localeCompare(b));
const placeholders = (s) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const lang of ['tl', 'ceb']) {
    const dict = JSON.parse(readFileSync(join(SRC, 'i18n', 'locales', `${lang}.json`), 'utf8'));
    const missing = sorted.filter((k) => !(k in dict) || !String(dict[k]).trim());
    const mismatched = sorted.filter((k) => k in dict && placeholders(k) !== placeholders(String(dict[k])));
    const unused = Object.keys(dict).filter((k) => !keys.has(k));
    console.log(
      `${lang}: ${sorted.length - missing.length}/${sorted.length} translated, ${mismatched.length} placeholder mismatches, ${unused.length} unused`,
    );
    for (const k of missing.slice(0, 40)) console.log('  missing:', k);
    for (const k of mismatched) console.log('  placeholders differ:', k, '=>', dict[k]);
    bad += missing.length + mismatched.length;
  }
  process.exit(bad ? 1 : 0);
} else if (process.argv.includes('--write-template')) {
  const out = Object.fromEntries(sorted.map((k) => [k, '']));
  writeFileSync(join(ROOT, 'scripts', 'i18n-template.json'), JSON.stringify(out, null, 2));
  console.log(sorted.length, 'keys written to scripts/i18n-template.json');
} else {
  console.log(JSON.stringify(sorted, null, 2));
}
