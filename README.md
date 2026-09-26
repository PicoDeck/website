# picodeck.net

The PicoDeck website: landing page, docs, the browser simulator (`/try/`) and downloads. Astro + Starlight, deployed on Cloudflare Pages.

Everything release-specific comes from the latest [PicoDeck/picodeck](https://github.com/PicoDeck/picodeck) release. `npm run build` first runs `scripts/fetch-release.mjs`, which:

- unzips `picodeck-docs.zip` into `src/content/docs/docs/` (the Markdown in the picodeck repo's `docs/`, plus `_sidebar.json`)
- unzips `picodeck-web-sim.zip` into `public/try/`
- writes `src/data/release.json` for the download page

The build fails if the release lacks either zip. The picodeck release workflow calls a Pages deploy hook, so every release rebuilds the site; pushes here rebuild it too.

```
npm install
npm test              # node:test unit tests
npm run fetch-release # once, before `npm run dev`
npm run dev
npm run build         # fetch + static build into dist/
```

Set `GITHUB_TOKEN` to avoid the anonymous GitHub API rate limit.
