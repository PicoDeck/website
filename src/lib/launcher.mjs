// Markup for the launcher replica on the home page (src/components/Launcher.astro).
// Shared by the server render and the client script, so the first frame and every
// redraw come from the same template. Geometry lives in the component's CSS.

export const CATS = ['all', 'games', 'tools', 'system', 'demos', 'emulators', 'network'];
export const CAT_NAMES = { all: 'All', games: 'Games', tools: 'Tools', system: 'System', demos: 'Demos', emulators: 'Emulators', network: 'Network' };
export const VISIBLE_ROWS = 9;
const LIST_H = 252; // device pixels: 9 rows of 28

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Case-insensitive byte order, like the launcher's strcasecmp. */
export function sortApps(apps) {
  const key = (a) => a.name.toLowerCase();
  return [...apps].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export function inTab(apps, tab) {
  return tab === 0 ? apps : apps.filter((a) => a.cat === CATS[tab]);
}

export function tabsHtml(tab) {
  return CATS.map((c, i) => (i === tab
    ? `<span class="lcd-tab pd-c-${c}">${CAT_NAMES[c]}</span>`
    : `<span class="lcd-dot"><span class="pd-dot pd-c-${c}"></span></span>`)).join('');
}

export function rowsHtml(items, sel) {
  return items.map((a, i) => `<li class="lcd-row${i === sel ? ' sel' : ''}" data-i="${i}">`
    + `<span class="lcd-icon pd-c-${a.cat}">${esc(a.name[0])}</span><span class="lcd-name">${esc(a.name)}</span>`
    + `<span class="lcd-ver">${esc(a.ver)}</span><span class="lcd-desc"><span>${esc(a.desc)}</span></span></li>`).join('');
}

/** Scrollbar thumb height and offset in device pixels. */
export function thumb(count, scroll) {
  const height = Math.max(8, Math.round(LIST_H * Math.min(1, VISIBLE_ROWS / Math.max(count, 1))));
  const top = count > VISIBLE_ROWS ? Math.round((LIST_H - height) * scroll / (count - VISIBLE_ROWS)) : 0;
  return { height, top };
}
