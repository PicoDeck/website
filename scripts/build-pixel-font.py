"""Usage: python3 scripts/build-pixel-font.py ../picodeck/src/fonts/font_6x8.c public/brand/v1/picodeck-6x8.woff2

Convert PicoDeck's built-in font_6x8.c bitmap font into a WOFF2 web font.

One font pixel = 128 units, 8 px per em (UPM 1024), baseline under row 6,
so at font-size 16px each device pixel is exactly 2 CSS px.
"""
import re
import sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

SRC, OUT = sys.argv[1], sys.argv[2]
PX, UPM, ADV, ROWS = 128, 1024, 6 * 128, 8

glyphs = {}
for m in re.finditer(r"\{(0x[^{}]*)\},\s*//.*\(0x([0-9A-F]{2})\)", open(SRC).read()):
    rows = [int(b, 16) for b in m.group(1).split(",")]
    glyphs[int(m.group(2), 16)] = rows

# A few extras for key hints, drawn in the same 5x7 style.
glyphs[0x2191] = [0x20, 0x70, 0xA8, 0x20, 0x20, 0x20, 0x20, 0x00]  # up
glyphs[0x2193] = [0x20, 0x20, 0x20, 0x20, 0xA8, 0x70, 0x20, 0x00]  # down
glyphs[0x2192] = [0x00, 0x20, 0x10, 0xF8, 0x10, 0x20, 0x00, 0x00]  # right
glyphs[0x2190] = [0x00, 0x20, 0x40, 0xF8, 0x40, 0x20, 0x00, 0x00]  # left
glyphs[0x2026] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA8, 0x00]  # ellipsis
glyphs[0x00D7] = [0x00, 0x88, 0x50, 0x20, 0x50, 0x88, 0x00, 0x00]  # times


def outline(rows):
    """Trace the union of lit pixels into closed clockwise loops (y up)."""
    lit = {(c, r) for r, bits in enumerate(rows) for c in range(8) if bits & (0x80 >> c)}
    edges = {}
    for c, r in lit:
        x0, x1 = c * PX, (c + 1) * PX
        y1, y0 = (7 - r) * PX, (6 - r) * PX
        # clockwise in y-up space: top-left -> top-right -> bottom-right -> bottom-left
        for a, b in (((x0, y1), (x1, y1)), ((x1, y1), (x1, y0)),
                     ((x1, y0), (x0, y0)), ((x0, y0), (x0, y1))):
            if (b, a) in edges:
                del edges[(b, a)]
            else:
                edges[(a, b)] = True
    nxt = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b)
    loops = []
    while nxt:
        start = next(iter(nxt))
        loop, p = [start], start
        while True:
            q = nxt[p].pop()
            if not nxt[p]:
                del nxt[p]
            if q == start:
                break
            loop.append(q)
            p = q
        # drop collinear points
        pts = [loop[i] for i in range(len(loop))
               if not ((loop[i - 1][0] == loop[i][0] == loop[(i + 1) % len(loop)][0]) or
                       (loop[i - 1][1] == loop[i][1] == loop[(i + 1) % len(loop)][1]))]
        loops.append(pts)
    return loops


names = [".notdef"] + [f"u{cp:04X}" for cp in sorted(glyphs)]
cmap = {cp: f"u{cp:04X}" for cp in glyphs}
fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(names)
fb.setupCharacterMap(cmap)

tt = {}
pen = TTGlyphPen(None)
tt[".notdef"] = pen.glyph()
for cp, rows in glyphs.items():
    pen = TTGlyphPen(None)
    for loop in outline(rows):
        pen.moveTo(loop[0])
        for pt in loop[1:]:
            pen.lineTo(pt)
        pen.closePath()
    tt[f"u{cp:04X}"] = pen.glyph()
fb.setupGlyf(tt)
fb.setupHorizontalMetrics({n: (ADV, tt[n].xMin if hasattr(tt[n], "xMin") else 0) for n in names})
fb.setupHorizontalHeader(ascent=7 * PX, descent=-PX)
fb.setupNameTable({"familyName": "PicoDeck 6x8", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=7 * PX, sTypoDescender=-PX, sTypoLineGap=0,
            usWinAscent=7 * PX, usWinDescent=PX, fsSelection=0x40)
fb.setupPost(isFixedPitch=1)
fb.font.flavor = "woff2"
fb.save(OUT)
print(f"{len(glyphs)} glyphs -> {OUT}")
