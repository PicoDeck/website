#!/usr/bin/env node
// Prebuild: pull the latest PicoDeck release's docs, web simulator and
// download metadata into the site. Design: PicoDeck/picodeck
// specs/2026-09-26-picodeck-rename-design.md, section 7.
import { mkdir, rm, writeFile } from 'node:fs/promises';
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

export async function extractZip(bytes, dest, required = []) {
  const files = Object.entries(unzipSync(new Uint8Array(bytes))).filter(([name]) => !name.endsWith('/'));
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
  const release = await (await get(`https://api.github.com/repos/${REPO}/releases/latest`, token)).json();
  const info = summarize(release);
  const zipOf = async (name) => (await get(info.assets[name])).arrayBuffer();
  const docs = await extractZip(await zipOf('picodeck-docs.zip'), join(root, 'src/content/docs/docs'), ['index.md', '_sidebar.json']);
  const sim = await extractZip(await zipOf('picodeck-web-sim.zip'), join(root, 'public/try'), ['index.html']);
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/release.json'), `${JSON.stringify(info, null, 2)}\n`);
  console.log(`release ${info.tag}: ${docs} doc files, ${sim} simulator files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`fetch-release: ${err.message}`);
    process.exit(1);
  });
}
