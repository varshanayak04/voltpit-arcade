# VOLTPIT Arcade

A single-page neon arcade with five playable browser cabinets, built as plain
HTML, CSS and ES modules. No npm, no bundler, no framework, no build step. Open
`index.html` over http and it runs.

Every image is generated locally by a Python script, so the whole thing works
offline once the service worker has installed. The only external request the page
makes is to Google Fonts, and the CSS carries a full fallback stack for when that
request fails.

## Running it locally

Service workers, ES modules and the PWA manifest all require a real origin.
`file://` will not do — modules will be blocked by CORS and the service worker
will never register. Serve the folder instead:

```bash
cd voltpit-arcade
python3 -m http.server 8000
# then open http://localhost:8000
```

The registration code already checks the protocol and silently skips the service
worker on anything that is not http or https, so opening the file directly still
renders the page and plays the games; it just has no offline cache.

## What is in here

`index.html` holds the real markup for every section. JavaScript only injects the
marquee tiles, the five floor cards and the score boards, so the page is fully
crawlable and readable with scripting off.

`assets/css/style.css` is the whole design system in sixteen numbered sections,
driven by CSS custom properties. Colour, type and spacing are tokens at the top;
`[data-shift="day"]` on the `<html>` element re-points the semantic tokens for
the light theme rather than restating any component rules.

`assets/js/` is one module per concern. `main.js` is the orchestrator and the only
file that touches more than one area. `motion.js` owns reveals, the magnetic
hover, the scroll-linked marquee and card stack, and the custom cursor.
`audio.js` synthesises every sound through the Web Audio API — there is not a
single audio file in the project. `store.js` wraps `localStorage` behind a probe
so that a browser with storage disabled degrades to an in-memory `Map` instead of
throwing. `arcade.js` owns the play overlay, and `attract.js` drives the
self-playing demo snake on the hero cabinet.

`assets/js/games/` holds `base.js` plus the five cabinets. `base.js` provides the
harness: a device-pixel-ratio-correct canvas, a pause-aware requestAnimationFrame
loop, and one input abstraction that folds keyboard, mouse, touch swipes and the
on-screen pad into four directions plus an action. A cabinet is a plain object
with `reset`, `update(dt)`, `draw(ctx, w, h)`, `input(action, pressed)` and
optionally `point(phase, x, y)`, and it reports back through the `api` it is
handed.

`tools/gen_art.py` regenerates all 21 marquee panels and every PWA icon.
`tools/verify.py` runs the static integrity checks described below.

## The five cabinets

Neon Snake is a wrapping-grid snake with a decaying surge pellet worth twenty
points on every fifth spawn and a two-deep turn queue so fast diagonal inputs are
not dropped. Relay Breaker is a brick game that substeps its collision three
times per frame to stop the ball tunnelling through the wall at speed. Matrix
Recall is a nine-node Simon with a flash duration that tightens as the rounds go
up. Reflex Gate measures reaction time over five rounds, adds a fifty
millisecond penalty per early fire, and is the one board where lower is better.
Volt 2048 is a 4×4 merge game with one undo per run.

## Regenerating the art

```bash
python3 tools/gen_art.py          # needs Pillow for the raster icons
```

The marquee panels are SVG, and an SVG loaded through an `<img>` tag cannot reach
the page's webfonts. The generator therefore pins each title's width with
`textLength` and `lengthAdjust="spacingAndGlyphs"` so the text fits the panel no
matter which fallback font the browser picks. If you add titles, keep that in
mind — plain `letter-spacing` overflows.

If you change any shipped file, bump `CACHE` in `sw.js`. Returning visitors are
served from the old cache until the version string changes.

## Deploying to Render

The included `render.yaml` describes a static site with an empty build command
and `.` as the publish path, which matches the no-build constraint. Point Render
at the repository and it will pick the file up. The one thing worth keeping is
the `Cache-Control: no-cache, no-store, must-revalidate` header on `/sw.js`; a
cached service worker cannot update itself and users get stuck on an old build.

Before going live, replace the sitemap placeholder in `robots.txt` and the
`og:url` value in `index.html` with the real domain.

## Accessibility and motion

There is a skip link, visible `:focus-visible` rings throughout, and the play
overlay is a proper dialog with a focus trap, an Escape handler and focus
restored to whatever opened it. Toggles report state through `aria-pressed`.
Touch devices get an on-screen D-pad shaped to whatever the loaded cabinet needs.

`prefers-reduced-motion` is honoured everywhere it matters: the cursor, magnetic
hover and scroll-linked transforms are not initialised at all, and the attract
demo draws a single static frame instead of animating.

## What was verified, and what was not

`tools/verify.py` passes. It checks that every asset path referenced from HTML,
CSS and JS resolves to a real file; that `index.html` has no duplicate element
ids; that every id and class the JavaScript looks up exists in the markup; that
all 68 named imports resolve to a real export in the target module; that the
service worker precache list matches the files on disk in both directions; that
the manifest is valid JSON with the required PWA keys and real icon paths; and
that all 22 SVGs parse as well-formed XML. `node --check` passes on all
thirteen JavaScript files.

**None of that is a substitute for running it.** This project was written in a
sandbox with no browser and no network access, so the site has never been
rendered, the games have never been played, no sound has ever been produced, and
the service worker has never installed. Layout, animation timing, game feel,
audio balance and offline behaviour are all unverified. Treat the first run in a
real browser as the actual test, and expect to tune numbers — particularly game
speeds and audio gain, which were chosen by reasoning rather than by listening.

The likeliest places for a first-run problem, in rough order: canvas sizing
inside the overlay on very short viewports, the scroll-linked marquee offset at
extreme window widths, and audio gain being louder or quieter than intended.
