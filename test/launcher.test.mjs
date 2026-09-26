import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortApps, inTab, rowsHtml, tabsHtml, thumb } from '../src/lib/launcher.mjs';

const app = (name, cat = 'games') => ({ name, cat, ver: '1.0', desc: 'd' });

test('sorts like strcasecmp, as the launcher does', () => {
  const names = sortApps([app('C64 Emulator'), app('block.exe'), app('C-Dogs'), app('App Store')]).map((a) => a.name);
  assert.deepEqual(names, ['App Store', 'block.exe', 'C-Dogs', 'C64 Emulator']);
});

test('tab 0 is everything, the rest filter by category', () => {
  const apps = [app('a', 'games'), app('b', 'tools')];
  assert.equal(inTab(apps, 0).length, 2);
  assert.deepEqual(inTab(apps, 2).map((a) => a.name), ['b']);
});

test('the selected tab shows its name, the others a dot', () => {
  const html = tabsHtml(1);
  assert.match(html, /<span class="lcd-tab pd-c-games">Games<\/span>/);
  assert.equal(html.match(/pd-dot/g).length, 6);
});

test('rows escape text and mark the selection', () => {
  const html = rowsHtml([app('<b>'), app('x')], 1);
  assert.match(html, /&lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /<li class="lcd-row sel" data-i="1">/);
});

test('the scrollbar thumb fills the track until the list scrolls', () => {
  assert.deepEqual(thumb(5, 0), { height: 252, top: 0 });
  assert.deepEqual(thumb(18, 9), { height: 126, top: 126 });
});
