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

// The launcher's 24x24 placeholder for apps without an icon.png (launcher.c
// draw_fallback_icon): a cartridge in the category colour. '.' background,
// c colour, h highlight, l shade, d dark, w label.
export const CART = [
  '........................',
  '...hhhhhhhhhhhhhhh......',
  '...hcccccccccccccccc....',
  '...hcclllllllllllccc....',
  '...hccccccccccccccccc...',
  ...Array(17).fill('...hcwwwwwwwwwwwwwwwl...'),
  '...llllllllllllllllll...',
  '........ddddddddd.......',
];
const CART_BG = '#081031';    // RGB565(12,16,48) as the LCD shows it
const CART_LABEL = '#efebd6'; // RGB565(239,232,212)
// Category colours as launcher.c passes them to RGB565() (s_cat_colors).
const CAT_RGB = { games: [255, 100, 50], tools: [100, 180, 255], system: [160, 160, 160], demos: [255, 200, 50], emulators: [150, 100, 255], network: [50, 200, 150] };
const hex565 = ([r, g, b]) => `#${[(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Cartridge tints, per RGB565 channel with C integer division, clamped to the channel. */
export function cartTints(cat) {
  const [R, G, B] = CAT_RGB[cat] ?? CAT_RGB.demos;
  const c = [R >> 3, G >> 2, B >> 3];
  const scale = (n, d) => c.map((v, i) => Math.min(i === 1 ? 63 : 31, Math.floor((v * n) / d)));
  return { c: hex565(c), h: hex565(scale(6, 5)), l: hex565(scale(7, 10)), d: hex565(scale(9, 20)) };
}

/** The cartridge, with the app's upper-cased initial in the 6x8 font at 2x, cell origin (7,6). */
export function cartridgeSvg(app) {
  const t = cartTints(app.cat);
  const fills = { '.': CART_BG, h: t.h, c: t.c, l: t.l, d: t.d, w: CART_LABEL };
  const paths = Object.entries(fills).map(([sym, fill]) =>
    `<path fill="${fill}" d="${bitmapPath(CART.map((row) => row.replace(/./g, (ch) => (ch === sym ? '#' : '.'))))}"/>`).join('');
  return '<svg class="lcd-cart" viewBox="0 0 24 24" shape-rendering="crispEdges" aria-hidden="true">'
    + `${paths}<text x="7" y="20" fill="${t.d}">${esc((app.name.trim()[0] ?? '?').toUpperCase())}</text></svg>`;
}

export function rowsHtml(items, sel) {
  return items.map((a, i) => `<li class="lcd-row${i === sel ? ' sel' : ''}" data-i="${i}">`
    + `<span class="lcd-icon">${a.icon ? `<img src="${esc(a.icon)}" alt="">` : cartridgeSvg(a)}</span><span class="lcd-name">${esc(a.name)}</span>`
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
