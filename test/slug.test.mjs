import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docHref } from '../src/lib/slug.mjs';

test('index is the docs root', () => assert.equal(docHref('index.md'), '/docs/'));
test('pages map to lower-case slugs', () =>
  assert.equal(docHref('API-Display-and-Graphics.md'), '/docs/api-display-and-graphics/'));
