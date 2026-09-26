import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { existsSync, readFileSync } from 'node:fs';
import remarkDocLinks from './src/plugins/remark-doc-links.mjs';
import { docHref } from './src/lib/slug.mjs';

const SIDEBAR = new URL('./src/content/docs/docs/_sidebar.json', import.meta.url);
if (!existsSync(SIDEBAR)) throw new Error('docs not fetched: run `npm run fetch-release` first');
const sidebar = JSON.parse(readFileSync(SIDEBAR, 'utf8')).map((group) => ({
  label: group.label,
  items: group.items.map((item) => ({ label: item.label, link: docHref(item.page) })),
}));

export default defineConfig({
  site: 'https://picodeck.net',
  markdown: { remarkPlugins: [remarkDocLinks] },
  integrations: [
    starlight({
      title: 'PicoDeck',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/PicoDeck/picodeck' }],
      sidebar,
    }),
  ],
});
