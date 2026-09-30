#!/usr/bin/env node
// Prebuild: pull the latest PicoDeck release's docs and download metadata, and
// the latest PicoDeck/web-sim release's browser demo, into the site. Designs:
// PicoDeck/picodeck specs/2026-09-26-picodeck-rename-design.md, section 7, and
// specs/2026-09-30-web-sim-split-design.md.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

export const REPO = 'PicoDeck/picodeck';
export const REQUIRED = ['picodeck-docs.zip', 'picodeck.uf2'];
export const OPTIONAL = ['picodeck.sha256', 'picodeck-simulator-linux'];
// The browser demo releases on its own schedule from its own repo.
export const WEB_SIM_REPO = 'PicoDeck/web-sim';
export const WEB_SIM = { repo: WEB_SIM_REPO, required: ['picodeck-web-sim.zip'], optional: [] };

export function summarize(release, { repo = REPO, required = REQUIRED, optional = OPTIONAL } = {}) {
  const byName = new Map((release.assets ?? []).map((a) => [a.name, a.browser_download_url]));
  const missing = required.filter((n) => !byName.has(n));
  if (missing.length) throw new Error(`${repo} release ${release.tag_name ?? '?'} is missing ${missing.join(', ')}`);
  const assets = {};
  for (const n of [...required, ...optional]) if (byName.has(n)) assets[n] = byName.get(n);
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    published: release.published_at ?? null,
    notes: release.body ?? '',
    url: release.html_url ?? `https://github.com/${repo}/releases`,
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

async function get(url, token) {
  const headers = { 'User-Agent': 'picodeck-website', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res;
}

export async function main({ root = process.cwd(), token = process.env.GITHUB_TOKEN } = {}) {
  const latest = async (repo) => (await get(`https://api.github.com/repos/${repo}/releases/latest`, token)).json();
  const info = summarize(await latest(REPO));
  const demo = summarize(await latest(WEB_SIM_REPO), WEB_SIM);
  const zipOf = async (url) => (await get(url)).arrayBuffer();
  const docs = await extractZip(await zipOf(info.assets['picodeck-docs.zip']), join(root, 'src/content/docs/docs'),
    ['index.md', '_sidebar.json']);
  // The simulator, its page glue (shell.js) and a screenshot of its launcher (the home
  // page's screen), from PicoDeck/web-sim. The page around them is the site's own
  // (src/pages/try/index.astro), so /try/ changes with a website deploy.
  const sim = await extractZip(await zipOf(demo.assets['picodeck-web-sim.zip']), join(root, 'public/try'),
    ['picodeck_simulator.js', 'picodeck_simulator.wasm', 'picodeck_simulator.data', 'shell.js', 'launcher.png'],
    { skip: ['index.html', 'version.json'] });
  await mkdir(join(root, 'src/data'), { recursive: true });
  info.web_sim = { tag: demo.tag, url: demo.url };
  await writeFile(join(root, 'src/data/release.json'), `${JSON.stringify(info, null, 2)}\n`);
  console.log(`release ${info.tag}: ${docs} doc files; web-sim ${demo.tag}: ${sim} simulator files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`fetch-release: ${err.message}`);
    process.exit(1);
  });
}
