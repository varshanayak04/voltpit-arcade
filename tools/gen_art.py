#!/usr/bin/env python3
"""
Generates every image the site needs, locally.

The site must work with no network (it is a PWA with offline support), so
nothing is hot-linked. This script writes:

  assets/art/cab-01.svg .. cab-21.svg   marquee panels for the scrolling rows
  assets/icons/icon-192.png             PWA icon
  assets/icons/icon-512.png             PWA icon
  assets/icons/maskable-512.png         PWA maskable icon
  assets/icons/apple-touch-icon.png     iOS home screen
  assets/icons/favicon.svg              crisp favicon
  assets/art/og-cover.png               social share card

Run:  python3 tools/gen_art.py
"""

import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ART = os.path.join(ROOT, "assets", "art")
ICONS = os.path.join(ROOT, "assets", "icons")

W, H = 420, 270

PIT = "#0C0C0C"
ION = "#FF2FD0"
PLASMA = "#7621B0"
EMBER = "#FF6A1F"
VAPOR = "#D7E2EA"
DIM = "#646973"

# Panel titles. These read as cabinet marquees on an arcade floor.
TITLES = [
    "NEON SNAKE", "RELAY BREAKER", "MATRIX RECALL", "REFLEX GATE", "VOLT 2048",
    "ION DRIFT", "STARFALL", "GRID LOCK", "PULSE WIDTH", "DEEP CUT",
    "OVERCLOCK", "HALFTONE", "NIGHT BUS", "SOLAR FLARE", "COLD BOOT",
    "TAPE HEAD", "SIGNAL LOSS", "HARD SYNC", "BLACK ICE", "LOW ORBIT",
    "LAST QUARTER",
]

ACCENTS = [ION, PLASMA, EMBER]


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ---------------------------------------------------------------- motifs

def motif_grid(r, a, b):
    out = []
    rows, cols = 7, 11
    for y in range(rows):
        for x in range(cols):
            if r.random() < 0.42:
                continue
            cx = 30 + x * 36
            cy = 40 + y * 30
            s = r.choice([4, 6, 9])
            o = round(r.uniform(0.25, 1.0), 2)
            col = a if r.random() < 0.7 else b
            out.append(
                f'<rect x="{cx - s}" y="{cy - s}" width="{s * 2}" height="{s * 2}" '
                f'fill="{col}" opacity="{o}"/>'
            )
    return "".join(out)


def motif_rays(r, a, b):
    out = []
    ox, oy = 210, 300
    for i in range(22):
        ang = math.radians(-172 + i * 8.2 + r.uniform(-2, 2))
        x2 = ox + math.cos(ang) * 460
        y2 = oy + math.sin(ang) * 460
        wdt = round(r.uniform(1, 7), 1)
        col = a if i % 3 else b
        out.append(
            f'<line x1="{ox}" y1="{oy}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{col}" stroke-width="{wdt}" opacity="{round(r.uniform(0.15, 0.6), 2)}"/>'
        )
    return "".join(out)


def motif_orbit(r, a, b):
    out = []
    cx, cy = 210, 135
    for i in range(6):
        rx = 40 + i * 32
        ry = rx * r.uniform(0.28, 0.5)
        rot = r.uniform(-32, 32)
        out.append(
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx:.0f}" ry="{ry:.0f}" fill="none" '
            f'stroke="{a if i % 2 else b}" stroke-width="1.6" opacity="0.55" '
            f'transform="rotate({rot:.1f} {cx} {cy})"/>'
        )
    out.append(f'<circle cx="{cx}" cy="{cy}" r="17" fill="{b}" opacity="0.95"/>')
    for i in range(4):
        ang = r.uniform(0, math.tau)
        rr = r.uniform(60, 170)
        out.append(
            f'<circle cx="{cx + math.cos(ang) * rr:.0f}" cy="{cy + math.sin(ang) * rr * 0.42:.0f}" '
            f'r="{r.choice([3, 5, 7])}" fill="{a}"/>'
        )
    return "".join(out)


def motif_wave(r, a, b):
    out = []
    for band in range(5):
        amp = r.uniform(12, 34)
        freq = r.uniform(0.012, 0.032)
        ph = r.uniform(0, 6.28)
        base = 40 + band * 46
        pts = []
        for x in range(-10, 431, 10):
            y = base + math.sin(x * freq + ph) * amp
            pts.append(f"{x},{y:.1f}")
        out.append(
            f'<polyline points="{" ".join(pts)}" fill="none" stroke="{a if band % 2 else b}" '
            f'stroke-width="{round(r.uniform(1.4, 3.4), 1)}" opacity="{round(r.uniform(0.35, 0.85), 2)}"/>'
        )
    return "".join(out)


def motif_blocks(r, a, b):
    out = []
    x = 0
    while x < W:
        wdt = r.choice([18, 26, 40, 58])
        hgt = r.choice([40, 70, 110, 160])
        y = r.choice([0, 30, 60, H - hgt])
        col = r.choice([a, b, VAPOR])
        out.append(
            f'<rect x="{x}" y="{y}" width="{wdt - 4}" height="{hgt}" fill="{col}" '
            f'opacity="{round(r.uniform(0.18, 0.7), 2)}"/>'
        )
        x += wdt
    return "".join(out)


def motif_maze(r, a, b):
    out = []
    step = 30
    for gy in range(H // step + 1):
        for gx in range(W // step + 1):
            x, y = gx * step, gy * step
            if r.random() < 0.5:
                out.append(
                    f'<path d="M{x} {y + step} L{x} {y} L{x + step} {y}" fill="none" '
                    f'stroke="{a if r.random() < 0.6 else b}" stroke-width="2.2" '
                    f'opacity="{round(r.uniform(0.2, 0.7), 2)}"/>'
                )
            else:
                out.append(
                    f'<path d="M{x} {y} A{step} {step} 0 0 1 {x + step} {y + step}" fill="none" '
                    f'stroke="{b if r.random() < 0.6 else a}" stroke-width="2.2" '
                    f'opacity="{round(r.uniform(0.2, 0.7), 2)}"/>'
                )
    return "".join(out)


def motif_stars(r, a, b):
    out = []
    for _ in range(150):
        x = r.uniform(0, W)
        y = r.uniform(0, H)
        rad = r.choice([0.8, 1.2, 1.8, 2.6])
        out.append(
            f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rad}" fill="{VAPOR}" '
            f'opacity="{round(r.uniform(0.15, 0.9), 2)}"/>'
        )
    for _ in range(3):
        x = r.uniform(40, 380)
        y = r.uniform(30, 240)
        rad = r.uniform(18, 46)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rad:.0f}" fill="{r.choice([a, b])}" opacity="0.28"/>')
    return "".join(out)


def motif_chevrons(r, a, b):
    out = []
    for i in range(14):
        y = -40 + i * 26
        col = a if i % 2 else b
        out.append(
            f'<path d="M-20 {y} L210 {y + 62} L440 {y}" fill="none" stroke="{col}" '
            f'stroke-width="{round(r.uniform(2, 6), 1)}" opacity="{round(r.uniform(0.18, 0.6), 2)}"/>'
        )
    return "".join(out)


def motif_circuit(r, a, b):
    out = []
    for _ in range(16):
        x, y = r.randrange(10, 410, 10), r.randrange(10, 260, 10)
        d = [f"M{x} {y}"]
        for _ in range(r.randint(2, 5)):
            if r.random() < 0.5:
                x += r.choice([-60, -40, 40, 60])
            else:
                y += r.choice([-40, -20, 20, 40])
            x = max(6, min(414, x))
            y = max(6, min(264, y))
            d.append(f"L{x} {y}")
        out.append(
            f'<path d="{" ".join(d)}" fill="none" stroke="{a if r.random() < 0.6 else b}" '
            f'stroke-width="2" opacity="{round(r.uniform(0.3, 0.8), 2)}" stroke-linecap="square"/>'
        )
        out.append(f'<circle cx="{x}" cy="{y}" r="3.4" fill="{b}"/>')
    return "".join(out)


MOTIFS = [motif_grid, motif_rays, motif_orbit, motif_wave, motif_blocks,
          motif_maze, motif_stars, motif_chevrons, motif_circuit]


def panel(i, title):
    r = random.Random(i * 9173 + 17)
    a = ACCENTS[i % 3]
    b = ACCENTS[(i + r.randint(1, 2)) % 3]
    motif = MOTIFS[i % len(MOTIFS)]
    gid = f"g{i}"
    inner = motif(r, a, b)
    num = f"{i + 1:02d}"
    # An SVG loaded through <img> cannot reach the page's webfonts, so the panel
    # renders in whatever fallback the browser picks. textLength pins the width
    # so the title always fits the panel no matter which font that turns out to
    # be; short names simply end up widely tracked, which suits a marquee.
    fs = 30 if len(title) > 12 else 34
    tl = min(368, max(150, len(title) * 23))
    sub = f"CAB.{num} / VOLTPIT"
    sl = min(300, len(sub) * 9)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{esc(title)} cabinet marquee">
<defs>
<linearGradient id="{gid}f" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="{PIT}" stop-opacity="0"/>
<stop offset="0.55" stop-color="{PIT}" stop-opacity="0.72"/>
<stop offset="1" stop-color="{PIT}" stop-opacity="0.98"/>
</linearGradient>
<linearGradient id="{gid}t" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="{VAPOR}"/>
<stop offset="1" stop-color="{a}"/>
</linearGradient>
<clipPath id="{gid}c"><rect width="{W}" height="{H}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#{gid}c)">
<rect width="{W}" height="{H}" fill="{PIT}"/>
<rect width="{W}" height="{H}" fill="{b}" opacity="0.09"/>
{inner}
<rect width="{W}" height="{H}" fill="url(#{gid}f)"/>
<text x="26" y="228" font-family="Kanit, Impact, 'Arial Black', sans-serif" font-weight="900"
      font-size="{fs}" textLength="{tl}" lengthAdjust="spacingAndGlyphs" fill="url(#{gid}t)">{esc(title)}</text>
<text x="26" y="250" font-family="'Share Tech Mono', ui-monospace, monospace"
      font-size="12" textLength="{sl}" lengthAdjust="spacingAndGlyphs" fill="{DIM}">{sub}</text>
<rect x="0" y="0" width="{W}" height="4" fill="{a}" opacity="0.85"/>
<rect width="{W}" height="{H}" rx="18" fill="none" stroke="{VAPOR}" stroke-opacity="0.14" stroke-width="2"/>
</g>
</svg>
"""


# ---------------------------------------------------------------- icons

def make_icons():
    from PIL import Image, ImageDraw

    def hexrgb(h):
        h = h.lstrip("#")
        return tuple(int(h[j:j + 2], 16) for j in (0, 2, 4))

    def bolt(size, pad_ratio, bg):
        img = Image.new("RGB", (size, size), hexrgb(bg))
        d = ImageDraw.Draw(img)
        # plasma wash behind the bolt
        for k in range(size // 2, 0, -6):
            t = k / (size / 2)
            col = tuple(
                int(hexrgb(bg)[c] + (hexrgb(PLASMA)[c] - hexrgb(bg)[c]) * (1 - t) * 0.55)
                for c in range(3)
            )
            d.ellipse([size / 2 - k, size / 2 - k, size / 2 + k, size / 2 + k], fill=col)
        s = size * (1 - pad_ratio * 2)
        ox = oy = size * pad_ratio
        # lightning bolt, drawn on a 0..1 grid
        pts = [(0.60, 0.03), (0.20, 0.55), (0.45, 0.55), (0.36, 0.97),
               (0.80, 0.42), (0.53, 0.42), (0.66, 0.03)]
        poly = [(ox + px * s, oy + py * s) for px, py in pts]
        d.polygon([(x + s * 0.02, y + s * 0.02) for x, y in poly], fill=hexrgb(ION))
        d.polygon(poly, fill=hexrgb(VAPOR))
        return img

    os.makedirs(ICONS, exist_ok=True)
    bolt(192, 0.16, PIT).save(os.path.join(ICONS, "icon-192.png"))
    bolt(512, 0.16, PIT).save(os.path.join(ICONS, "icon-512.png"))
    # maskable needs a much bigger safe zone (icon inside the inner 80% circle)
    bolt(512, 0.28, PIT).save(os.path.join(ICONS, "maskable-512.png"))
    bolt(180, 0.16, PIT).save(os.path.join(ICONS, "apple-touch-icon.png"))

    fav = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="{PIT}"/>
<circle cx="32" cy="32" r="22" fill="{PLASMA}" opacity="0.55"/>
<path d="M38 4 L13 36 H29 L23 60 L51 26 H34 Z" fill="{ION}" transform="translate(1.6,1.6)"/>
<path d="M38 4 L13 36 H29 L23 60 L51 26 H34 Z" fill="{VAPOR}"/>
</svg>
"""
    with open(os.path.join(ICONS, "favicon.svg"), "w", encoding="utf-8") as f:
        f.write(fav)

    # social share card
    og = Image.new("RGB", (1200, 630), hexrgb(PIT))
    d = ImageDraw.Draw(og)
    for k in range(700, 0, -8):
        t = k / 700
        col = tuple(
            int(hexrgb(PIT)[c] + (hexrgb(PLASMA)[c] - hexrgb(PIT)[c]) * (1 - t) * 0.5)
            for c in range(3)
        )
        d.ellipse([950 - k, 315 - k, 950 + k, 315 + k], fill=col)
    b = bolt(360, 0.06, PIT).convert("RGB")
    og.paste(b, (760, 135))
    d.rectangle([0, 0, 1200, 10], fill=hexrgb(ION))
    try:
        d.text((80, 250), "VOLTPIT", fill=hexrgb(VAPOR))
        d.text((80, 300), "five machines. no download.", fill=hexrgb(DIM))
    except Exception:
        pass
    og.save(os.path.join(ART, "og-cover.png"))


def main():
    os.makedirs(ART, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)
    for i, title in enumerate(TITLES):
        path = os.path.join(ART, f"cab-{i + 1:02d}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(panel(i, title))
    make_icons()
    print(f"wrote {len(TITLES)} marquee panels to assets/art/")
    print("wrote icons to assets/icons/")


if __name__ == "__main__":
    main()
