// The docs are plain Markdown in the picodeck repo, linked page-to-page with
// relative `Page.md` links (so they read on GitHub too). Rewrite those to the
// site's /docs/<slug>/ routes.
import { docHref } from '../lib/slug.mjs';

const RELATIVE_MD = /^(?:\.\/)?([A-Za-z0-9_.-]+\.md)(#\S*)?$/i;

export function rewriteDocLink(url) {
  const m = RELATIVE_MD.exec(url);
  return m ? docHref(m[1]) + (m[2] ?? '') : url;
}

function walk(node, fn) {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
}

export default function remarkDocLinks() {
  return (tree) => walk(tree, (node) => {
    if (node.type === 'link') node.url = rewriteDocLink(node.url);
  });
}
