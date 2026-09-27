#!/usr/bin/env node
// Prebuild: pull the latest PicoDeck release's docs, web simulator and
// download metadata into the site. Design: PicoDeck/picodeck
// specs/2026-09-26-picodeck-rename-design.md, section 7.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

export const REPO = 'PicoDeck/picodeck';
export const REQUIRED = ['picodeck-docs.zip', 'picodeck-web-sim.zip', 'picodeck.uf2'];
export const OPTIONAL = ['picodeck.sha256', 'picodeck-simulator-linux'];

export function summarize(release) {
  const byName = new Map((release.assets ?? []).map((a) => [a.name, a.browser_download_url]));
  const missing = REQUIRED.filter((n) => !byName.has(n));
  if (missing.length) throw new Error(`release ${release.tag_name ?? '?'} is missing ${missing.join(', ')}`);
  const assets = {};
  for (const n of [...REQUIRED, ...OPTIONAL]) if (byName.has(n)) assets[n] = byName.get(n);
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    published: release.published_at ?? null,
    notes: release.body ?? '',
    url: release.html_url ?? `https://github.com/${REPO}/releases`,
    assets,
  };
}

export function safeEntryPath(dest, entry) {
  const rel = normalize(entry);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`unsafe path in zip: ${entry}`);
  return join(dest, rel);
}

export async function extractZip(bytes, dest, required = [], { skip = [] } = {}) {
  const files = Object.entries(unzipSync(new Uint8Array(bytes))).filter(([name]) => !name.endsWith('/') && !skip.includes(name));
  const missing = required.filter((n) => !files.some(([name]) => name === n));
  if (missing.length) throw new Error(`zip for ${dest} is missing ${missing.join(', ')}`);
  await rm(dest, { recursive: true, force: true });
  for (const [name, data] of files) {
    const out = safeEntryPath(dest, name);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, data);
  }
  return files.length;
}

// The launcher's categories; anything else, or none, is filed under demos (launcher.c parse_category).
const CATEGORIES = ['games', 'tools', 'system', 'demos', 'emulators', 'network'];
const str = (v) => (typeof v === 'string' ? v : '');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The apps bundled into the web simulator, read from its build output so the
 * home page's launcher shows exactly what /try/ runs. Emscripten's file packager
 * lists each preloaded file in the JS as {filename, start, end} (keys quoted or
 * not) with its bytes at that range of the .data file. Throws rather than
 * returning nothing if that format ever changes.
 */
export function simApps(js, data) {
  const entry = /"?filename"?\s*:\s*"\/sd\/apps\/([^"/]+)\/(app\.json|icon\.png)"\s*,\s*"?start"?\s*:\s*(\d+)\s*,\s*"?end"?\s*:\s*(\d+)/g;
  const files = new Map();
  for (const [, dir, name, start, end] of js.matchAll(entry)) files.set(`${dir}/${name}`, Buffer.from(data.subarray(Number(start), Number(end))));
  const apps = [...files.keys()].filter((k) => k.endsWith('/app.json')).map((k) => {
    const dir = k.slice(0, -'/app.json'.length);
    let m;
    try {
      m = JSON.parse(files.get(k).toString('utf8'));
    } catch (err) {
      throw new Error(`web simulator: /sd/apps/${dir}/app.json is not valid JSON (${err.message})`);
    }
    const cat = str(m.category).trim().toLowerCase();
    // The launcher draws apps/<dir>/icon.png (24x24) when there is one, else a cartridge.
    const icon = files.get(`${dir}/icon.png`);
    return {
      id: str(m.id), dir, name: str(m.name) || dir,
      cat: CATEGORIES.includes(cat) ? cat : 'demos', ver: str(m.version), desc: str(m.description),
      icon: icon && PNG.equals(icon.subarray(0, 8)) ? `data:image/png;base64,${icon.toString('base64')}` : '',
    };
  });
  if (!apps.length) throw new Error('web simulator: no apps found in the file packager metadata (Emscripten output changed?)');
  return apps;
}

async function get(url, token) {
  const headers = { 'User-Agent': 'picodeck-website', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res;
}

export async function main({ root = process.cwd(), token = process.env.GITHUB_TOKEN } = {}) {
  const release = await (await get(`https://api.github.com/repos/${REPO}/releases/latest`, token)).json();
  const info = summarize(release);
  const zipOf = async (name) => (await get(info.assets[name])).arrayBuffer();
  const docs = await extractZip(await zipOf('picodeck-docs.zip'), join(root, 'src/content/docs/docs'), ['index.md', '_sidebar.json']);
  // The simulator itself; the page around it is the site's own (src/pages/try/index.astro),
  // so /try/ changes with a website deploy rather than a PicoDeck release.
  const sim = await extractZip(await zipOf('picodeck-web-sim.zip'), join(root, 'public/try'),
    ['picodeck_simulator.js', 'picodeck_simulator.wasm', 'picodeck_simulator.data'], { skip: ['index.html'] });
  const apps = simApps(await readFile(join(root, 'public/try/picodeck_simulator.js'), 'utf8'),
    await readFile(join(root, 'public/try/picodeck_simulator.data')));
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/release.json'), `${JSON.stringify(info, null, 2)}\n`);
  await writeFile(join(root, 'src/data/sim-apps.json'), `${JSON.stringify(apps, null, 2)}\n`);
  console.log(`release ${info.tag}: ${docs} doc files, ${sim} simulator files, ${apps.length} apps in the simulator`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`fetch-release: ${err.message}`);
    process.exit(1);
  });
}
