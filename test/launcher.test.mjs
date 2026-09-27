import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortApps, inTab, rowsHtml, tabsHtml, thumb, dialogHtml, launchUrl, bitmapPath, iconSvg, BATTERY_FULL, WIFI, clockText, VISIBLE_ROWS } from '../src/lib/launcher.mjs';

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

test('the scrollbar follows launcher.c: only when the list overflows, integer maths', () => {
  assert.equal(VISIBLE_ROWS, 8);
  assert.equal(thumb(8, 0), null);
  assert.deepEqual(thumb(16, 8), { height: 128, top: 128 });
  assert.deepEqual(thumb(23, 3), { height: 89, top: 33 });
  assert.deepEqual(thumb(1000, 0), { height: 4, top: 0 });
});

test('the launch dialog asks about the app, like the System Menu', () => {
  const html = dialogHtml({ ...app('<Snake>'), dir: 'snake' }, 0);
  assert.match(html, /<div class="lcd-dialog-title">Launch &lt;Snake&gt;\?<\/div>/);
  assert.match(html, /<button type="button" class="sel" data-choice="launch" tabindex="-1">&gt;Launch<\/button>/);
  assert.match(html, /data-choice="cancel" tabindex="-1"> Cancel<\/button>/);
  assert.match(dialogHtml(app('x'), 1), /class="sel" data-choice="cancel" tabindex="-1">&gt;Cancel/);
});

test('launching opens /try/ with the app folder', () => {
  assert.equal(launchUrl({ dir: 'snake' }), '/try/?app=snake');
  assert.equal(launchUrl({ dir: 'a b&c' }), '/try/?app=a%20b%26c');
});

test('bitmaps become one crisp SVG rect per horizontal run', () => {
  assert.equal(bitmapPath(['##.', '.#.']), 'M0 0h2v1H0zM1 1h1v1H1z');
  const svg = iconSvg(['#..', '..#'], 'x');
  assert.match(svg, /^<svg class="x" viewBox="0 0 3 2" shape-rendering="crispEdges" aria-hidden="true">/);
  assert.match(svg, /<path fill="currentColor" d="M0 0h1v1H0zM2 1h1v1H2z"\/><\/svg>$/);
});

test('the header icons match the device bitmaps (ui.c)', () => {
  assert.deepEqual([BATTERY_FULL.length, BATTERY_FULL[0].length], [9, 17]);
  assert.deepEqual([WIFI.length, WIFI[0].length], [8, 11]);
  assert.equal(BATTERY_FULL[3], '#.###########.###');
});

test('the clock reads like the device, 24-hour', () => {
  assert.equal(clockText(new Date(2026, 8, 27, 9, 5)), '09:05');
  assert.equal(clockText(new Date(2026, 8, 27, 23, 59)), '23:59');
});

test('rows show the app icon when there is one, else the cartridge', () => {
  const html = rowsHtml([{ ...app('A'), icon: 'data:image/png;base64,AAA=' }, app('B')], 0);
  assert.match(html, /<span class="lcd-icon"><img src="data:image\/png;base64,AAA=" alt=""><\/span>/);
  assert.match(html, /<span class="lcd-icon"><span class="pd-cart pd-c-games">B<\/span><\/span>/);
  assert.match(rowsHtml([app(' snake')], 0), /pd-c-games">S</);
});
