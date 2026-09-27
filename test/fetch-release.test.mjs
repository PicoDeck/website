import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { summarize, extractZip, safeEntryPath } from '../scripts/fetch-release.mjs';

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

test('extractZip can leave out named entries (the site renders /try/ itself)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'site-'));
  const zip = zipSync({ 'index.html': strToU8('<p>release page</p>'), 'sim.js': strToU8('x') });
  assert.equal(await extractZip(zip, join(dir, 'out'), ['sim.js'], { skip: ['index.html'] }), 1);
  assert.equal(existsSync(join(dir, 'out/index.html')), false);
  assert.equal(await readFile(join(dir, 'out/sim.js'), 'utf8'), 'x');
});
