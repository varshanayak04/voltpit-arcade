# Notes for agents working in this repository

Read this before changing anything.

## Hard constraints

No build step. This project is plain HTML, CSS and native ES modules, and it must
stay that way. Do not add npm, a bundler, a framework, TypeScript, a CSS
preprocessor, or a `package.json`. If a change seems to need tooling, it needs a
different design instead. The deploy target is Render as a static site with an
empty build command, and `render.yaml` encodes that.

No external assets at runtime. Every image is generated locally by
`tools/gen_art.py` so the service worker can cache the whole app. Do not hotlink
images, icons or scripts from a CDN. Google Fonts is the single exception already
in place, and the CSS carries a fallback stack so a blocked font request degrades
rather than breaks.

No claims about behaviour you have not observed. The usual sandbox for this
project has no browser, so you cannot verify rendering, gameplay, audio or
service-worker behaviour. Say so plainly rather than implying a run happened. If
you add a feature you could not exercise, mark it as unverified in the README's
final section, which exists for exactly that purpose.

## Conventions

Colour, type and spacing live as custom properties at the top of
`assets/css/style.css`. Add a token rather than a hardcoded hex. The light theme
works by re-pointing semantic tokens under `[data-shift="day"]`, so a new
component should consume semantic tokens (`--fg`, `--bg`, `--accent`) and get
theming for free. Two colours are deliberately fixed in both themes: the
instruction placard's `--card` and `--card-ink`, because it represents a printed
card bolted to a physical cabinet.

One module per concern in `assets/js/`. `main.js` is the only file allowed to
wire multiple areas together. Modules should not reach into each other's DOM.

`prefers-reduced-motion` is not optional. Anything that moves needs a path where
it does not. Follow the existing pattern: the cursor, magnetic hover and
scroll-linked transforms are never initialised under reduced motion rather than
being animated and then disabled.

Bump `CACHE` in `sw.js` whenever you change a shipped file, and add new files to
`PRECACHE`. `tools/verify.py` checks the precache list against the filesystem in
both directions and will fail if you forget.

## Adding a cabinet

Create `assets/js/games/<name>.js` exporting a `meta` object and a
`create(api)` function, then add it to the `GAMES` array in `arcade.js`. The
`meta` needs `id`, `cab`, `name`, `tag`, `desc`, `accent`, `scoreLabel`, `pad`
(one of `dirs`, `lr`, `action`, `none`), an `art` array of three existing panel
filenames, and `lowerIsBetter` if a smaller score wins. Read dimensions from the
`w, h` arguments passed to `resize` and `draw`, not from the canvas.

Add a matching instruction card to the placard section of `index.html`, and keep
its copy truthful — if the code applies a penalty or a cap, the card says so.

## Before finishing

```bash
python3 tools/verify.py
for f in $(find . -name "*.js"); do node --check "$f"; done
```

Both must pass. Neither proves the site works.
