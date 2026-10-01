# picodeck.net

The PicoDeck website: landing page, docs, the browser simulator (`/try/`) and downloads. Astro + Starlight, deployed on Cloudflare Workers (static assets; `wrangler.jsonc`).

Everything release-specific comes from the latest [PicoDeck/picodeck](https://github.com/PicoDeck/picodeck) release, except the browser demo, which comes from the latest [PicoDeck/web-sim](https://github.com/PicoDeck/web-sim) release. `npm run build` first runs `scripts/fetch-release.mjs`, which:

- unzips `picodeck-docs.zip` into `src/content/docs/docs/` (the Markdown in the picodeck repo's `docs/`, plus `_sidebar.json`)
- unzips web-sim's `picodeck-web-sim.zip` into `public/try/`: the simulator (`.js`, `.wasm`, `.data`), its page glue `shell.js`, and `launcher.png`, the launcher captured from the simulator by web-sim's browser tests, which the home page shows and boots on a click. The page around the simulator is `src/pages/try/index.astro`, so `/try/` changes with a site deploy; `/try/?app=<folder>` starts that app
- writes `src/data/release.json`, recording under `web_sim` which web-sim release the demo came from, so the build shows which demo it took

The build fails if the PicoDeck release lacks its docs zip or firmware, the web-sim release lacks its zip, or that zip lacks any of those files. Both repos' release workflows call a Pages deploy hook, so every release of either rebuilds the site; pushes here rebuild it too.

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
