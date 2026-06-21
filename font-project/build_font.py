#!/usr/bin/env python3
"""Build a handwriting OTF from two scanned sheets (Hebrew + digits/punctuation).

Pipeline per glyph: crop ink mask -> upscale -> potrace (cubic bezier SVG)
-> parse -> map source pixels into font units (unified baseline + scale)
-> draw into a CFF charstring. Missing glyphs are synthesised in-style.
"""
import os, re, json, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw

WORK = os.path.join(os.path.dirname(__file__), "work")
DIST = os.path.join(os.path.dirname(__file__), "dist")
os.makedirs(DIST, exist_ok=True)

# ---- unified metrics -------------------------------------------------------
UPM   = 1000
SCALE = 9.0      # font units per source pixel (shared by both sheets)
PAD   = 6        # white padding (px) added around each glyph before tracing
SB    = 35       # side bearing in font units
UP    = 4        # potrace upscaling factor

# baselines (source pixels) per sheet/band
BASE = {
    ("s1", 0): 204, ("s1", 1): 357,   # Hebrew sheet: letters / final-forms row
    ("s2", 0): 95,  ("s2", 1): 249,   # digits row / punctuation row
}

# ---- load ink masks --------------------------------------------------------
def load_ink1():
    a = np.array(Image.open(os.path.join(WORK, "source.jpeg")).convert("L"))
    return a < 128
def load_ink2():
    return np.load(os.path.join(WORK, "ink2.npy")).astype(bool)

INK1 = load_ink1()
INK2 = load_ink2()
CROPS1 = json.load(open(os.path.join(WORK, "crops.json")))
CROPS2 = json.load(open(os.path.join(WORK, "crops2.json")))

# ---- SVG path parsing ------------------------------------------------------
TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?")

def parse_path(d):
    """Return list of contours; each contour is (start, segs) where segs are
    ('l', x, y) or ('c', x1,y1,x2,y2,x,y) in absolute path coordinates."""
    toks = TOKEN.findall(d)
    i = 0; cx = cy = 0.0; start = None
    contours = []; cur = None
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    cmd = None
    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t; i += 1
        # implicit repeat keeps previous cmd
        if cmd in ("M", "m"):
            x = num(); y = num()
            if cmd == "m": x += cx; y += cy
            cx, cy = x, y; start = (x, y)
            if cur: contours.append(cur)
            cur = [(x, y), []]
            cmd = "l" if cmd == "m" else "L"
        elif cmd in ("L", "l"):
            x = num(); y = num()
            if cmd == "l": x += cx; y += cy
            cur[1].append(("l", x, y)); cx, cy = x, y
        elif cmd in ("H", "h"):
            x = num()
            if cmd == "h": x += cx
            cur[1].append(("l", x, cy)); cx = x
        elif cmd in ("V", "v"):
            y = num()
            if cmd == "v": y += cy
            cur[1].append(("l", cx, y)); cy = y
        elif cmd in ("C", "c"):
            x1 = num(); y1 = num(); x2 = num(); y2 = num(); x = num(); y = num()
            if cmd == "c":
                x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy
            cur[1].append(("c", x1, y1, x2, y2, x, y)); cx, cy = x, y
        elif cmd in ("Z", "z"):
            if cur: contours.append(cur); cur = None
            cx, cy = start
        else:
            i += 1  # skip unsupported
    if cur: contours.append(cur)
    return contours

# ---- vectorise a boolean ink mask -> contours in crop-pixel coords ---------
def vectorize(mask):
    h, w = mask.shape
    padded = np.zeros((h + 2 * PAD, w + 2 * PAD), bool)
    padded[PAD:PAD + h, PAD:PAD + w] = mask
    ph, pw = padded.shape
    img = Image.fromarray(np.where(padded, 0, 255).astype(np.uint8))  # ink black
    img = img.resize((pw * UP, ph * UP), Image.LANCZOS)
    arr = np.array(img)
    bw = np.where(arr < 128, 0, 255).astype(np.uint8)  # ink black again
    with tempfile.TemporaryDirectory() as td:
        pgm = os.path.join(td, "g.pgm"); svg = os.path.join(td, "g.svg")
        Image.fromarray(bw).save(pgm)
        subprocess.run(["potrace", "-s", "-o", svg, "--turdsize", "2",
                        "--alphamax", "1.0", "--opttolerance", "0.2", pgm],
                       check=True)
        txt = open(svg).read()
    H = (ph * UP)
    contours = []
    for d in re.findall(r'<path d="([^"]+)"', txt):
        for start, segs in parse_path(d):
            def tx(px, py):
                xi = 0.1 * px / UP            # crop-pixel x (top-left origin)
                yi = (H - 0.1 * py) / UP      # crop-pixel y (y-down)
                return xi, yi
            ns = (tx(*start), [])
            for s in segs:
                if s[0] == "l":
                    ns[1].append(("l", tx(s[1], s[2])))
                else:
                    ns[1].append(("c", tx(s[1], s[2]), tx(s[3], s[4]), tx(s[5], s[6])))
            contours.append(ns)
    return contours

# ---- place contours into font units & draw into a pen ----------------------
def draw_glyph(pen, contours, y0, baseline):
    def fx(xcp): return (xcp - PAD) * SCALE + SB
    def fy(ycp): return (baseline - (y0 + ycp - PAD)) * SCALE
    for start, segs in contours:
        pen.moveTo((fx(start[0]), fy(start[1])))
        for s in segs:
            if s[0] == "l":
                pen.lineTo((fx(s[1][0]), fy(s[1][1])))
            else:
                pen.curveTo((fx(s[1][0]), fy(s[1][1])),
                            (fx(s[2][0]), fy(s[2][1])),
                            (fx(s[3][0]), fy(s[3][1])))
        pen.closePath()

def advance_for(w):
    return int(round(w * SCALE + 2 * SB))

# ---- per-glyph source extraction ------------------------------------------
def mask_from_crop(ink, crops, idx, xclip=None):
    bi, x0, y0, x1, y1 = crops[idx]
    if xclip:
        x0, x1 = xclip
    m = ink[y0:y1 + 1, x0:x1 + 1]
    # tighten vertical to actual ink within the (possibly clipped) columns
    ys = np.where(m.any(axis=1))[0]
    y0t = y0 + ys.min(); y1t = y0 + ys.max()
    m = ink[y0t:y1t + 1, x0:x1 + 1]
    return m, y0t, x1 - x0 + 1

# ---- zayin synthesis (missing on the sheet) --------------------------------
import math
def _stadium(p0, p1, w, n=12):
    """Closed outline of a thick stroke with rounded caps (font units)."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    phi = math.atan2(dy, dx) + math.pi / 2   # normal angle
    r = w / 2.0
    pts = []
    pts.append((x0 + r * math.cos(phi), y0 + r * math.sin(phi)))
    pts.append((x1 + r * math.cos(phi), y1 + r * math.sin(phi)))
    for k in range(1, n):                     # cap at p1, bulges forward
        a = phi - math.pi * k / n
        pts.append((x1 + r * math.cos(a), y1 + r * math.sin(a)))
    pts.append((x1 - r * math.cos(phi), y1 - r * math.sin(phi)))
    pts.append((x0 - r * math.cos(phi), y0 - r * math.sin(phi)))
    for k in range(1, n):                     # cap at p0, bulges backward
        a = phi + math.pi - math.pi * k / n
        pts.append((x0 + r * math.cos(a), y0 + r * math.sin(a)))
    return pts

def synth_zayin():
    """Build zayin directly in font units: top head + centred descending stem,
    monoline weight matching the rest of the alphabet."""
    T = 104.0                       # pen weight  (~12 src px * SCALE)
    top = (BASE[("s1", 0)] - 146) * SCALE    # cap height of the body (~522)
    head_y = top - T / 2            # short horizontal head at the very top
    contours = []
    # head: short horizontal stroke
    contours.append(_stadium((26, head_y), (150, head_y), T))
    # stem: hangs from head centre down to baseline, slight handwritten lean
    contours.append(_stadium((92, head_y), (78, 6), T))
    return contours

# ---- glyph table -----------------------------------------------------------
# (glyphname, [unicodes], builder)
def s1(idx):
    bi = CROPS1[idx][0]
    base = BASE[("s1", bi)]
    def b():
        m, y0, w = mask_from_crop(INK1, CROPS1, idx)
        return ("mask", m, y0, w, base)
    return b
def s2(idx, xclip=None):
    bi = CROPS2[idx][0]
    base = BASE[("s2", bi)]
    def b():
        m, y0, w = mask_from_crop(INK2, CROPS2, idx, xclip)
        return ("mask", m, y0, w, base)
    return b
def zay():
    def b():
        return ("contours", synth_zayin())
    return b

GLYPHS = [
    ("space",        [0x0020], None),
    # Hebrew
    ("alef",   [0x05D0], s1(22)), ("bet",    [0x05D1], s1(4)),
    ("gimel",  [0x05D2], s1(9)),  ("dalet",  [0x05D3], s1(8)),
    ("he",     [0x05D4], s1(3)),  ("vav",    [0x05D5], s1(21)),
    ("zayin",  [0x05D6], zay()),  ("het",    [0x05D7], s1(13)),
    ("tet",    [0x05D8], s1(20)), ("yod",    [0x05D9], s1(12)),
    ("kaf",    [0x05DB], s1(10)), ("lamed",  [0x05DC], s1(14)),
    ("mem",    [0x05DE], s1(1)),  ("nun",    [0x05E0], s1(2)),
    ("samekh", [0x05E1], s1(5)),  ("ayin",   [0x05E2], s1(11)),
    ("pe",     [0x05E4], s1(17)), ("tsadi",  [0x05E6], s1(0)),
    ("qof",    [0x05E7], s1(24)), ("resh",   [0x05E8], s1(23)),
    ("shin",   [0x05E9], s1(7)),  ("tav",    [0x05EA], s1(30)),
    ("finalkaf",  [0x05DA], s1(15)), ("finalmem", [0x05DD], s1(28)),
    ("finalnun",  [0x05DF], s1(27)), ("finalpe",  [0x05E3], s1(25)),
    ("finaltsadi",[0x05E5], s1(26)),
    # digits
    ("one",[0x0031],s2(0)), ("two",[0x0032],s2(1)), ("three",[0x0033],s2(2)),
    ("four",[0x0034],s2(3)), ("five",[0x0035],s2(4)), ("six",[0x0036],s2(5)),
    ("seven",[0x0037],s2(6)), ("eight",[0x0038],s2(7)), ("nine",[0x0039],s2(8)),
    ("zero",[0x0030],s2(9)),
    # punctuation
    ("quotesingle",[0x0027,0x2018,0x2019],s2(10)),
    ("exclam",[0x0021],s2(11)), ("question",[0x003F],s2(12)),
    ("comma",[0x002C],s2(13)), ("period",[0x002E],s2(14)),
    ("hyphen",[0x002D,0x2010],s2(15)),
    ("slash",[0x002F],s2(16,(607,635))),
    ("colon",[0x003A],s2(16,(636,644))),
    ("semicolon",[0x003B],s2(17)),
    ("parenleft",[0x0028],s2(18)), ("parenright",[0x0029],s2(19)),
    ("sheqel",[0x20AA],s2(20)), ("ampersand",[0x0026],s2(21)),
    ("at",[0x0040],s2(22)),
    ("quotedblleft",[0x201C],s2(23)),
    ("quotedblright",[0x201D,0x0022],s2(24)),
    ("bracketright",[0x005D],s2(25)), ("bracketleft",[0x005B],s2(26)),
    ("braceright",[0x007D],s2(27)), ("braceleft",[0x007B],s2(28)),
    ("numbersign",[0x0023],s2(29)), ("percent",[0x0025],s2(30)),
    ("asciicircum",[0x005E],s2(31)), ("asterisk",[0x002A],s2(32)),
    ("plus",[0x002B],s2(33)), ("equal",[0x003D],s2(34)),
    ("periodcentered",[0x00B7],s2(35)),
    ("sterling",[0x00A3],s2(36)), ("Euro",[0x20AC],s2(37)),
    ("dollar",[0x0024],s2(38)),
    ("less",[0x003C],s2(39)), ("greater",[0x003E],s2(40)),
    ("asciitilde",[0x007E],s2(41)), ("bar",[0x007C],s2(42)),
    ("backslash",[0x005C],s2(43)), ("underscore",[0x005F],s2(44)),
]

if __name__ == "__main__":
    from build_assemble import assemble
    assemble(GLYPHS, vectorize, draw_glyph, advance_for)
