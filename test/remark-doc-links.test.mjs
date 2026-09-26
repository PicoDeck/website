import { test } from 'node:test';
import assert from 'node:assert/strict';
import remarkDocLinks, { rewriteDocLink } from '../src/plugins/remark-doc-links.mjs';

test('relative .md link with an anchor', () =>
  assert.equal(rewriteDocLink('API-UI.md#toast'), '/docs/api-ui/#toast'));
test('./ prefix', () => assert.equal(rewriteDocLink('./Native-Loading.md'), '/docs/native-loading/'));
test('external, absolute, anchor-only and nested links are untouched', () => {
  for (const u of ['https://example.com/a.md', '/docs/api-ui/', '#section', 'mailto:x@y.z', '../other/API-UI.md']) {
    assert.equal(rewriteDocLink(u), u);
  }
});
test('the plugin rewrites nested link nodes', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'link', url: 'index.md', children: [] }] }] };
  remarkDocLinks()(tree);
  assert.equal(tree.children[0].children[0].url, '/docs/');
});
