import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// store.picodeck.net links /brand/v1/brand.css live, so v1 is additive-only:
// these lists may grow, but nothing in them may disappear. A breaking change
// goes in /brand/v2/ (and the store moves over) instead.
const V1_CLASSES = `pd-actions pd-brand pd-btn pd-btn-primary pd-btn-small pd-c-all pd-c-demos
  pd-c-emulators pd-c-games pd-c-network pd-c-system pd-c-tools pd-count pd-dim pd-dot pd-field
  pd-footer pd-footer-note pd-heading pd-hints pd-icon pd-icon-lg pd-label pd-list pd-main pd-nav
  pd-note pd-page pd-panel pd-panel-body pd-panel-title pd-pre pd-px pd-row pd-row-aside pd-row-desc
  pd-row-meta pd-row-name pd-small pd-sr-only pd-status pd-subheading pd-tab pd-tab-label pd-tabbar
  pd-tabs pd-tabs-collapse pd-title pd-titlebar pd-wrap`.split(/\s+/);
const V1_TOKENS = `--pd-all --pd-btn --pd-btn-hover --pd-demos --pd-dim --pd-dim-on-select --pd-emulators
  --pd-error --pd-field --pd-field-edge --pd-focus --pd-games --pd-gutter --pd-mono --pd-navy
  --pd-navy-deep --pd-network --pd-ok --pd-pixel --pd-rule --pd-sans --pd-select --pd-select-hover
  --pd-system --pd-tab --pd-text --pd-titlebar-h --pd-tools --pd-warn --pd-status`.split(/\s+/);

const DIR = new URL('../public/brand/v1/', import.meta.url);
const css = readFileSync(new URL('brand.css', DIR), 'utf8');

test('brand v1 still defines every class', () => {
  const missing = V1_CLASSES.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css));
  assert.deepEqual(missing, []);
});

test('brand v1 still defines every token', () => {
  const missing = V1_TOKENS.filter((t) => !new RegExp(`${t}\\s*:`).test(css));
  assert.deepEqual(missing, []);
});

test('every file brand.css loads is published beside it', () => {
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
  assert.ok(urls.length >= 6);
  assert.deepEqual(urls.filter((u) => !existsSync(new URL(u, DIR))), []);
});

test('brand files are served with CORS, so the store can load the fonts', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /^\/brand\/\*\n(?:[ \t]+.*\n)*?[ \t]+Access-Control-Allow-Origin: \*$/m);
});
