// Markup for the launcher replica on the home page (src/components/Launcher.astro).
// Shared by the server render and the client script, so the first frame and every
// redraw come from the same template. Geometry lives in the component's CSS.

export const CATS = ['all', 'games', 'tools', 'system', 'demos', 'emulators', 'network'];
export const CAT_NAMES = { all: 'All', games: 'Games', tools: 'Tools', system: 'System', demos: 'Demos', emulators: 'Emulators', network: 'Network' };
export const VISIBLE_ROWS = 8; // LIST_VISIBLE
const ITEM_H = 32;
const LIST_H = VISIBLE_ROWS * ITEM_H; // 256 device pixels

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

/** No icon.png: the launcher's cartridge placeholder, from brand.css (.pd-cart). */
const cart = (a) => `<span class="pd-cart pd-c-${a.cat}">${esc((a.name.trim()[0] ?? '?').toUpperCase())}</span>`;

export function rowsHtml(items, sel) {
  return items.map((a, i) => `<li class="lcd-row${i === sel ? ' sel' : ''}" data-i="${i}">`
    + `<span class="lcd-icon">${a.icon ? `<img src="${esc(a.icon)}" alt="">` : cart(a)}</span><span class="lcd-name">${esc(a.name)}</span>`
    + `<span class="lcd-ver">${esc(a.ver)}</span><span class="lcd-desc"><span>${esc(a.desc)}</span></span></li>`).join('');
}

/** The "Launch app?" prompt, drawn like the device's System Menu: ">" marks the choice. */
export function dialogHtml(app, sel) {
  const item = (i, choice, label) => `<button type="button"${i === sel ? ' class="sel"' : ''} data-choice="${choice}" tabindex="-1">`
    + `${i === sel ? '&gt;' : ' '}${label}</button>`;
  return `<div class="lcd-dialog-title">Launch ${esc(app.name)}?</div>${item(0, 'launch', 'Launch')}${item(1, 'cancel', 'Cancel')}`
    + '<div class="lcd-dialog-foot">Enter:select  Esc:close</div>';
}

/** /try/ passes ?app= to the simulator as --launch, which starts it by id, name or folder. */
export function launchUrl(app) {
  return `/try/?app=${encodeURIComponent(app.dir)}`;
}

// Header status icons, bit for bit from the firmware (src/os/ui.c): online WiFi
// and the battery in fill mode at 100% (the 11x5 fill at 2,2).
export const BATTERY_FULL = [
  '###############..',
  '#.............#..',
  '#.###########.#..',
  '#.###########.###',
  '#.###########.###',
  '#.###########.###',
  '#.###########.#..',
  '#.............#..',
  '###############..',
];
export const WIFI = [
  '..#######..',
  '.#.......#.',
  '#..#####..#',
  '..#.....#..',
  '.#..###..#.',
  '...#...#...',
  '.....#.....',
  '....###....',
];

/** An SVG path with one rect per horizontal run of '#'. */
export function bitmapPath(rows) {
  let d = '';
  rows.forEach((row, y) => {
    for (const m of row.matchAll(/#+/g)) d += `M${m.index} ${y}h${m[0].length}v1H${m.index}z`;
  });
  return d;
}

export function iconSvg(rows, cls) {
  return `<svg class="${cls}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">`
    + `<path fill="currentColor" d="${bitmapPath(rows)}"/></svg>`;
}

/** The header clock: 24-hour HH:MM. */
export function clockText(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Scrollbar thumb height and offset in device pixels, as launcher.c draws it:
 *  only when the list overflows, with C integer division and a 4px minimum. */
export function thumb(count, scroll) {
  if (count <= VISIBLE_ROWS) return null;
  return { height: Math.max(4, Math.floor(LIST_H * VISIBLE_ROWS / count)), top: Math.floor(LIST_H * scroll / count) };
}
