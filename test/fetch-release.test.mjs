import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { summarize, extractZip, safeEntryPath, simApps } from '../scripts/fetch-release.mjs';

const asset = (name) => ({ name, browser_download_url: `https://example.test/${name}` });

test('summarize keeps the known assets', () => {
  const info = summarize({
    tag_name: 'v0.3.0', name: '', published_at: '2026-09-27T00:00:00Z', body: 'notes', html_url: 'u',
    assets: ['picodeck-docs.zip', 'picodeck-web-sim.zip', 'picodeck.uf2', 'picodeck.sha256', 'other.txt'].map(asset),
  });
  assert.equal(info.tag, 'v0.3.0');
  assert.equal(info.name, 'v0.3.0');
  assert.deepEqual(Object.keys(info.assets).sort(),
    ['picodeck-docs.zip', 'picodeck-web-sim.zip', 'picodeck.sha256', 'picodeck.uf2']);
});

test('summarize fails loudly when docs or the simulator are missing', () => {
  assert.throws(() => summarize({ tag_name: 'v0.3.0', assets: [asset('picodeck.uf2')] }),
    /missing picodeck-docs.zip, picodeck-web-sim.zip/);
});

test('extractZip writes the files and requires the named entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'site-'));
  const zip = zipSync({ 'index.md': strToU8('# hi'), 'sub/a.md': strToU8('a') });
  assert.equal(await extractZip(zip, join(dir, 'out'), ['index.md']), 2);
  assert.equal(await readFile(join(dir, 'out/sub/a.md'), 'utf8'), 'a');
  await assert.rejects(extractZip(zip, join(dir, 'out2'), ['_sidebar.json']), /missing _sidebar.json/);
});

test('extractZip removes files left by a previous release', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'site-'));
  await mkdir(join(dir, 'out'), { recursive: true });
  await writeFile(join(dir, 'out/stale.md'), 'old');
  await extractZip(zipSync({ 'index.md': strToU8('new') }), join(dir, 'out'));
  assert.equal(existsSync(join(dir, 'out/stale.md')), false);
});

test('safeEntryPath rejects traversal and absolute paths', () => {
  assert.throws(() => safeEntryPath('/d', '../etc/passwd'), /unsafe/);
  assert.throws(() => safeEntryPath('/d', '/abs'), /unsafe/);
  assert.equal(safeEntryPath('/d', 'a/b.md'), '/d/a/b.md');
});

// Emscripten's file packager lists the preloaded files, minified, in the
// simulator's JS; the bytes are concatenated in its .data file.
function simBundle(files, { quoted = false } = {}) {
  let offset = 0;
  const parts = [];
  const meta = files.map(([filename, text]) => {
    const bytes = Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8');
    parts.push(bytes);
    const entry = { filename, start: offset, end: offset + bytes.length };
    offset += bytes.length;
    return entry;
  });
  const list = quoted
    ? JSON.stringify(meta)
    : `[${meta.map((f) => `{filename:"${f.filename}",start:${f.start},end:${f.end}}`).join(',')}]`;
  return { js: `x();loadPackage({files:${list},remote_package_size:${offset}})`, data: Buffer.concat(parts) };
}
const manifest = (fields) => JSON.stringify(fields);

test('simApps reads each bundled app.json out of the simulator data', () => {
  const { js, data } = simBundle([
    ['/sd/apps/snake/app.json', manifest({ id: 'net.picodeck.snake', name: 'Snake', category: 'games', version: '1.0', description: 'Classic snake game' })],
    ['/sd/apps/snake/main.lua', 'print(1)'],
    ['/sd/system/lib/widgets.lua', '--'],
    ['/sd/apps/editor/app.json', manifest({ id: 'net.picodeck.editor', name: 'Text Editor', category: 'Tools', version: '1.0.0', description: 'Nano-like' })],
  ]);
  assert.deepEqual(simApps(js, data), [
    { id: 'net.picodeck.snake', dir: 'snake', name: 'Snake', cat: 'games', ver: '1.0', desc: 'Classic snake game', icon: '' },
    { id: 'net.picodeck.editor', dir: 'editor', name: 'Text Editor', cat: 'tools', ver: '1.0.0', desc: 'Nano-like', icon: '' },
  ]);
});

test('simApps files a missing or unknown category under demos, like the launcher', () => {
  const { js, data } = simBundle([
    ['/sd/apps/a/app.json', manifest({ name: 'A', version: '1.0' })],
    ['/sd/apps/b/app.json', manifest({ name: 'B', category: 'toys' })],
  ], { quoted: true });
  assert.deepEqual(simApps(js, data).map((a) => [a.dir, a.cat, a.id, a.ver, a.desc]),
    [['a', 'demos', '', '1.0', ''], ['b', 'demos', '', '', '']]);
});

test('simApps ignores app.json files nested inside an app', () => {
  const { js, data } = simBundle([
    ['/sd/apps/a/app.json', manifest({ name: 'A' })],
    ['/sd/apps/a/levels/app.json', manifest({ name: 'Nested' })],
  ]);
  assert.deepEqual(simApps(js, data).map((a) => a.name), ['A']);
});

test('simApps fails loudly when the packager format is not recognised', () => {
  assert.throws(() => simApps('loadPackage({})', Buffer.alloc(0)), /no apps found/);
  const { js, data } = simBundle([['/sd/apps/a/app.json', '{nope']]);
  assert.throws(() => simApps(js, data), /apps\/a\/app\.json/);
});

test('simApps carries each app icon.png as a data URI, and skips anything that is not a PNG', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const { js, data } = simBundle([
    ['/sd/apps/a/app.json', manifest({ name: 'A' })],
    ['/sd/apps/a/icon.png', png],
    ['/sd/apps/b/app.json', manifest({ name: 'B' })],
    ['/sd/apps/b/icon.png', 'not a png'],
    ['/sd/apps/c/app.json', manifest({ name: 'C' })],
  ]);
  assert.deepEqual(simApps(js, data).map((a) => [a.dir, a.icon]),
    [['a', `data:image/png;base64,${png.toString('base64')}`], ['b', ''], ['c', '']]);
});
