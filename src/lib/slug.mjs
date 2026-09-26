// One slug rule for doc pages, shared by the link rewriter and the sidebar.
// Starlight serves src/content/docs/docs/<File>.md at /docs/<file>/ (lower-cased).
export function docHref(page) {
  const stem = page.replace(/\.md$/i, '').toLowerCase();
  return stem === 'index' ? '/docs/' : `/docs/${stem}/`;
}
