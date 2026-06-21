#!/usr/bin/env python3
"""Render sample words from the built OTF to verify shaping & spacing."""
import os, unicodedata
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

DIST = os.path.join(os.path.dirname(__file__), "dist")
f = TTFont(os.path.join(DIST, "MichalHandwriting-Regular.otf"))
gs = f.getGlyphSet(); cmap = f.getBestCmap()
hmtx = f["hmtx"]

def is_rtl(ch):
    return unicodedata.bidirectional(ch) in ("R", "AL")

def order_visual(s):
    # naive bidi: reverse runs of RTL; keep LTR runs; good enough for samples
    out = []; buf = []; buf_rtl = None
    def flush():
        nonlocal buf, buf_rtl
        if buf:
            out.extend(reversed(buf) if buf_rtl else buf)
        buf = []
    for ch in s:
        r = is_rtl(ch)
        if ch == " ": r = buf_rtl if buf_rtl is not None else False
        if buf_rtl is None: buf_rtl = r
        if r != buf_rtl:
            flush(); buf_rtl = r
        buf.append(ch)
    if buf: out.extend(reversed(buf) if buf_rtl else buf)
    # for a predominantly-RTL line, reverse whole thing
    if any(is_rtl(c) for c in s):
        out = list(reversed(out))
    return out

def glyph_path(name, ox, oy):
    rp = RecordingPen(); gs[name].draw(rp)
    verts = []; codes = []
    for op, pts in rp.value:
        if op == "moveTo": verts.append(pts[0]); codes.append(Path.MOVETO)
        elif op == "lineTo": verts.append(pts[0]); codes.append(Path.LINETO)
        elif op == "curveTo":
            verts += list(pts); codes += [Path.CURVE4]*3
        elif op == "closePath": verts.append((0,0)); codes.append(Path.CLOSEPOLY)
        elif op == "qCurveTo":
            verts += list(pts); codes += [Path.CURVE3]*len(pts)
    if not verts: return None
    return Path([(x+ox, y+oy) for x,y in verts], codes)

lines = ["מיכל", "שלום עולם!", "אבא הלך הביתה", "0123456789",
         "המחיר 1,250 ₪", "כתב יד (יפה) #2026", "$50 = €46 £39", "זוהר זז"]
fig, ax = plt.subplots(figsize=(11, 11))
y = 0
for line in lines:
    x = 0
    for ch in order_visual(line):
        if ch == " ": x += 320; continue
        nm = cmap.get(ord(ch))
        if not nm: x += 300; continue
        p = glyph_path(nm, x, y)
        if p is not None: ax.add_patch(PathPatch(p, facecolor="black", edgecolor="none"))
        x += hmtx[nm][0]
    y -= 1150
ax.set_xlim(-50, 6500); ax.set_ylim(y, 900)
ax.set_aspect("equal"); ax.axis("off")
fig.savefig(os.path.join(DIST, "words.png"), dpi=90, bbox_inches="tight")
print("wrote words.png")
