#!/usr/bin/env python3
"""Assemble glyphs into an OTF (CFF) and render a proof sheet."""
import os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.recordingPen import RecordingPen

DIST = os.path.join(os.path.dirname(__file__), "dist")
UPM = 1000
FAMILY = "Michal Handwriting"
STYLE = "Regular"
VERSION = "1.000"

def assemble(glyphs, vectorize, draw_glyph, advance_for):
    order = [".notdef"] + [g[0] for g in glyphs]
    charstrings = {}
    advances = {}
    records = {}   # glyphname -> recording pen value (for proof)

    # .notdef : simple box
    pen = T2CharStringPen(600, {})
    for (x, y) in [(60, 0), (60, 700), (540, 700), (540, 0)]:
        (pen.moveTo if (x, y) == (60, 0) else pen.lineTo)((x, y))
    pen.closePath()
    charstrings[".notdef"] = pen.getCharString()
    advances[".notdef"] = 600

    widths_dbg = []
    for name, unis, builder in glyphs:
        if builder is None:  # space
            w = 320
            pen = T2CharStringPen(w, {})
            charstrings[name] = pen.getCharString(); advances[name] = w
            widths_dbg.append((name, w)); continue
        kind, *rest = builder()
        if kind == "mask":
            mask, y0, srcw, baseline = rest
            contours = vectorize(mask)
            w = advance_for(srcw)
            def emit(pen): draw_glyph(pen, contours, y0, baseline)
        else:  # pre-built contours in font units (list of point lists)
            raw = rest[0]
            from build_font import SB
            minx = min(p[0] for c in raw for p in c)
            maxx = max(p[0] for c in raw for p in c)
            shift = SB - minx
            w = int(round((maxx - minx) + 2 * SB))
            def emit(pen, raw=raw, shift=shift):
                for c in raw:
                    pen.moveTo((c[0][0] + shift, c[0][1]))
                    for p in c[1:]:
                        pen.lineTo((p[0] + shift, p[1]))
                    pen.closePath()
        pen = T2CharStringPen(w, {})
        emit(pen)
        charstrings[name] = pen.getCharString()
        advances[name] = w
        rp = RecordingPen(); emit(rp); records[name] = rp.value
        widths_dbg.append((name, w))

    fb = FontBuilder(UPM, isTTF=False)
    fb.setupGlyphOrder(order)
    cmap = {}
    for name, unis, _ in glyphs:
        for u in unis:
            cmap[u] = name
    fb.setupCharacterMap(cmap)
    metrics = {g: (advances[g], 0) for g in order}
    fb.setupCFF(f"{FAMILY} {STYLE}", {"FullName": f"{FAMILY} {STYLE}",
                "FamilyName": FAMILY, "Weight": STYLE}, charstrings, {})
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=-250, lineGap=90)
    fb.setupNameTable({
        "familyName": FAMILY, "styleName": STYLE,
        "uniqueFontIdentifier": f"{FAMILY}-{STYLE};{VERSION}",
        "fullName": f"{FAMILY} {STYLE}",
        "psName": f"{FAMILY.replace(' ', '')}-{STYLE}",
        "version": f"Version {VERSION}",
    })
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-250, sTypoLineGap=90,
                usWinAscent=1000, usWinDescent=300,
                sxHeight=480, sCapHeight=620,
                fsSelection=0x0040, achVendID="MHND")
    fb.setupPost(isFixedPitch=0, underlinePosition=-120, underlineThickness=60)
    out = os.path.join(DIST, "MichalHandwriting-Regular.otf")
    fb.save(out)
    print("wrote", out, "with", len(charstrings), "glyphs")
    name_by_char = {chr(u): n for u, n in cmap.items()}
    proof(records, advances, name_by_char)
    return out

def proof(records, advances, name_by_char):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.path import Path
    from matplotlib.patches import PathPatch

    rows = [
        list("אבגדהוזחטיכל"), list("מנסעפצקרשת"),
        list("ךםןףץ"),
        list("0123456789"),
        list("!?.,:;()[]{}"), list("-+=<>~|/\\_^*"),
        list("&@#%$"), list("₪£€·\"'"),
    ]
    fig, ax = plt.subplots(figsize=(14, 9))
    y = 0
    for row in rows:
        x = 0
        for ch in row:
            nm = name_by_char.get(ch)
            if not nm or nm not in records:
                x += 700; continue
            verts = []; codes = []
            for cmd in records[nm]:
                op, pts = cmd
                if op == "moveTo":
                    verts.append(pts[0]); codes.append(Path.MOVETO)
                elif op == "lineTo":
                    verts.append(pts[0]); codes.append(Path.LINETO)
                elif op == "curveTo":
                    for p in pts: verts.append(p)
                    codes += [Path.CURVE4, Path.CURVE4, Path.CURVE4]
                elif op == "closePath":
                    verts.append((0, 0)); codes.append(Path.CLOSEPOLY)
            if verts:
                pth = Path([(vx + x, vy + y) for vx, vy in verts], codes)
                ax.add_patch(PathPatch(pth, facecolor="black", edgecolor="none"))
            x += advances.get(nm, 600) + 40
        y -= 1100
    ax.set_xlim(-50, 12000); ax.set_ylim(y, 900)
    ax.set_aspect("equal"); ax.axis("off")
    p = os.path.join(DIST, "proof.png")
    fig.savefig(p, dpi=80, bbox_inches="tight"); print("wrote", p)
