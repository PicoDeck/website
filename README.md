# picodeck.net

The PicoDeck website: landing page, docs, the browser simulator (`/try/`) and downloads. Astro + Starlight, deployed on Cloudflare Workers (static assets; `wrangler.jsonc`).

Everything release-specific comes from the latest [PicoDeck/picodeck](https://github.com/PicoDeck/picodeck) release. `npm run build` first runs `scripts/fetch-release.mjs`, which:

- unzips `picodeck-docs.zip` into `src/content/docs/docs/` (the Markdown in the picodeck repo's `docs/`, plus `_sidebar.json`)
- unzips `picodeck-web-sim.zip` into `public/try/`: the simulator (`.js`, `.wasm`, `.data`), its page glue `shell.js`, and `launcher.png`, the launcher captured from the simulator in PicoDeck's release CI, which the home page shows and boots on a click. The page around the simulator is `src/pages/try/index.astro`, so `/try/` changes with a site deploy; `/try/?app=<folder>` starts that app
- writes `src/data/release.json` for the download page

The build fails if the release lacks either zip, or the web simulator zip lacks any of those files. The picodeck release workflow calls a Pages deploy hook, so every release rebuilds the site; pushes here rebuild it too.

```
npm install
npm test              # node:test unit tests
npm run fetch-release # once, before `npm run dev`
npm run dev
npm run build         # fetch + static build into dist/
```

Set `GITHUB_TOKEN` to avoid the anonymous GitHub API rate limit.

## The shared look

`public/brand/v1/` holds the PicoDeck look: `brand.css` (colours taken from the firmware's launcher, the `pd-` components) and its fonts, including the device's own 6x8 font (rebuilt from `picodeck/src/fonts/font_6x8.c` by `scripts/build-pixel-font.py`). This site, the docs theme (`src/styles/docs.css`) and store.picodeck.net all use it; the store links `https://picodeck.net/brand/v1/brand.css` live, which `public/_headers` allows cross-origin.

v1 is additive-only: add tokens and classes, never rename or remove them. `test/brand.test.mjs` fails if one disappears. A breaking change goes in `public/brand/v2/`, then the store moves over, then v1 can go. The site is dark only, like the device.
