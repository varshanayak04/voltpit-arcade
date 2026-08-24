#!/usr/bin/env python3
"""
tools/verify.py — static integrity checks for the VOLTPIT build.

There is no browser in this sandbox, so nothing here proves the site *looks*
right. What it does prove:

  1. every asset path referenced from HTML/CSS/JS resolves to a real file
  2. no duplicate element ids in index.html
  3. every id/selector the JS reaches for actually exists in index.html
  4. every named import resolves to a real export in the target module
  5. the service worker precache list matches the files on disk
  6. manifest.webmanifest is valid JSON with the required PWA keys
  7. all SVGs parse as well-formed XML

Run: python3 tools/verify.py
Exit code is non-zero if any check fails.
"""

import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
notes = []


def rel(p):
    return os.path.relpath(p, ROOT)


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as fh:
        return fh.read()


def check(cond, msg):
    if not cond:
        fails.append(msg)
    return cond


# --------------------------------------------------------------- 1. assets

HTML = read("index.html")
CSS = read("assets/css/style.css")
JS_FILES = []
for dirpath, _dirs, files in os.walk(os.path.join(ROOT, "assets/js")):
    for f in sorted(files):
        if f.endswith(".js"):
            JS_FILES.append(rel(os.path.join(dirpath, f)))
JS_FILES.sort()
SW = read("sw.js")

on_disk = set()
for dirpath, _dirs, files in os.walk(ROOT):
    for f in files:
        on_disk.add(rel(os.path.join(dirpath, f)).replace(os.sep, "/"))

# href/src in HTML, url() in CSS
refs = set()
for m in re.finditer(r'(?:href|src)="([^"#:]+?)"', HTML):
    refs.add(m.group(1))
for m in re.finditer(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)', CSS):
    u = m.group(1).strip()
    if not u.startswith(("data:", "http", "#")):
        # CSS lives in assets/css/, so its urls are relative to there
        refs.add(os.path.normpath(os.path.join("assets/css", u)).replace(os.sep, "/"))

# asset paths built in JS as string literals
for jf in JS_FILES:
    body = read(jf)
    for m in re.finditer(r'["\'`](assets/[A-Za-z0-9_\-./${}()+ :,]*?)["\'`]', body):
        p = m.group(1)
        if "${" in p:  # template — expand the two patterns we actually use
            continue
        refs.add(p)

# the two templated families, expanded by hand to match the generators
for i in range(1, 22):
    refs.add(f"assets/art/cab-{i:02d}.svg")

missing = sorted(r for r in refs if r not in on_disk and not r.startswith(("mailto", "tel")))
check(not missing, f"unresolved asset references: {missing}")
notes.append(f"asset references checked: {len(refs)}")

# ------------------------------------------------------------ 2. duplicate ids

ids = re.findall(r'\sid="([^"]+)"', HTML)
dupes = [i for i, n in Counter(ids).items() if n > 1]
check(not dupes, f"duplicate element ids in index.html: {dupes}")
notes.append(f"unique element ids: {len(set(ids))}")

# --------------------------------------------- 3. JS selectors exist in HTML

wanted_ids = set()
wanted_sel = set()
for jf in JS_FILES:
    body = read(jf)
    for m in re.finditer(r'getElementById\(\s*["\']([^"\']+)["\']', body):
        wanted_ids.add(m.group(1))
    for m in re.finditer(r'\bq\(\s*["\']([^"\']+)["\']\s*\)', body):
        wanted_ids.add(m.group(1))
    for m in re.finditer(r'\$\(\s*["\']#([A-Za-z0-9_\-]+)["\']', body):
        wanted_ids.add(m.group(1))
    for m in re.finditer(r'\$\$?\(\s*["\'](\.[A-Za-z0-9_\-]+)["\']', body):
        wanted_sel.add(m.group(1))
    for m in re.finditer(r'querySelector(?:All)?\(\s*["\'](\.[A-Za-z0-9_\-]+)["\']', body):
        wanted_sel.add(m.group(1))

id_set = set(ids)
ghost_ids = sorted(wanted_ids - id_set)
check(not ghost_ids, f"JS looks up ids that are not in index.html: {ghost_ids}")

classes = set()
for m in re.finditer(r'class="([^"]+)"', HTML):
    classes.update(m.group(1).split())
# classes injected by JS at runtime are legitimately absent from the HTML
JS_INJECTED = {
    ".marquee__tile", ".cab-card", ".cab-card__actions", ".cab-card__best",
    ".board", ".board__list", ".floor__item",
}
ghost_sel = sorted(
    s for s in wanted_sel
    if s.lstrip(".") not in classes and s not in JS_INJECTED
)
check(not ghost_sel, f"JS looks up classes that appear nowhere: {ghost_sel}")
notes.append(f"JS id lookups verified: {len(wanted_ids)}; class lookups: {len(wanted_sel)}")

# ----------------------------------------------- 4. imports resolve to exports

def exports_of(path):
    body = read(path)
    out = set()
    for m in re.finditer(r'export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)', body):
        out.add(m.group(1))
    for m in re.finditer(r'export\s+class\s+([A-Za-z0-9_$]+)', body):
        out.add(m.group(1))
    for m in re.finditer(r'export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)', body):
        out.add(m.group(1))
    for m in re.finditer(r'export\s*\{([^}]+)\}', body):
        for part in m.group(1).split(","):
            part = part.strip()
            if not part:
                continue
            name = part.split(" as ")[-1].strip() if " as " in part else part
            out.add(name)
    return out


export_cache = {}
import_count = 0
for jf in JS_FILES:
    body = read(jf)
    base = os.path.dirname(jf)
    for m in re.finditer(r'import\s+([^;]+?)\s+from\s+["\']([^"\']+)["\']', body, re.S):
        clause, spec = m.group(1).strip(), m.group(2)
        if not spec.startswith("."):
            continue
        target = os.path.normpath(os.path.join(base, spec)).replace(os.sep, "/")
        if not check(target in on_disk, f"{jf} imports missing module {spec}"):
            continue
        if target not in export_cache:
            export_cache[target] = exports_of(target)
        avail = export_cache[target]
        if clause.startswith("*"):
            continue  # namespace import
        inner = re.search(r'\{([^}]*)\}', clause, re.S)
        if not inner:
            continue
        for part in inner.group(1).split(","):
            part = part.strip()
            if not part:
                continue
            name = part.split(" as ")[0].strip()
            import_count += 1
            check(
                name in avail,
                f"{jf} imports {{{name}}} from {spec} but that module does not export it "
                f"(exports: {sorted(avail)})",
            )
notes.append(f"named imports resolved: {import_count}")

# --------------------------------------------- 5. SW precache vs real files

pre = set(re.findall(r'"((?:\./|index|manifest|assets/)[^"]*)"', SW.split("];")[0]))
pre.discard("./")
for i in range(1, 22):
    pre.add(f"assets/art/cab-{i:02d}.svg")
pre = {p for p in pre if "${" not in p}
sw_missing = sorted(p for p in pre if p not in on_disk)
check(not sw_missing, f"sw.js precaches files that do not exist: {sw_missing}")

# every JS module and every art file should be precached, or offline breaks
should = set(JS_FILES) | {"index.html", "assets/css/style.css", "manifest.webmanifest"}
should |= {f"assets/art/cab-{i:02d}.svg" for i in range(1, 22)}
uncached = sorted(should - pre)
check(not uncached, f"shipped files absent from the sw.js precache list: {uncached}")
notes.append(f"precache entries: {len(pre)} (all present on disk)")

# ------------------------------------------------------- 6. manifest / json

try:
    man = json.loads(read("manifest.webmanifest"))
    for key in ("name", "short_name", "start_url", "display", "icons", "background_color", "theme_color"):
        check(key in man, f"manifest is missing required key: {key}")
    check(len(man.get("icons", [])) >= 2, "manifest needs at least a 192 and a 512 icon")
    for icon in man.get("icons", []):
        src = icon["src"].lstrip("./")
        check(src in on_disk, f"manifest icon not on disk: {icon['src']}")
    check(
        any("maskable" in i.get("purpose", "") for i in man.get("icons", [])),
        "manifest has no maskable icon (Android will letterbox it)",
    )
    notes.append(f"manifest ok: {len(man['icons'])} icons, display={man['display']}")
except Exception as exc:  # noqa: BLE001
    fails.append(f"manifest.webmanifest is not valid JSON: {exc}")

# ------------------------------------------------------------- 7. svg parses

bad_svg = []
for name in sorted(on_disk):
    if name.endswith(".svg"):
        try:
            ET.parse(os.path.join(ROOT, name))
        except ET.ParseError as exc:
            bad_svg.append(f"{name}: {exc}")
check(not bad_svg, f"malformed SVG: {bad_svg}")
notes.append(f"SVGs parsed clean: {sum(1 for n in on_disk if n.endswith('.svg'))}")

# ------------------------------------------------------------------ report

print("VOLTPIT static verification")
print("=" * 60)
for n in notes:
    print(f"  .. {n}")
print("-" * 60)
if fails:
    print(f"FAILED ({len(fails)})")
    for f in fails:
        print(f"  !! {f}")
    sys.exit(1)
print("All static checks passed.")
print("NOT verified here: rendering, gameplay, audio, service-worker runtime")
print("behaviour. This sandbox has no browser.")
