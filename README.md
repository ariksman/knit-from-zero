# Knit From Zero

**A complete beginner's knitting course whose graduation project is a sweater that actually fits a Basenji.**

Ten lessons take you from "I have never held a knitting needle" to a finished, seamless, correctly-sized dog sweater. Every diagram is hand-authored SVG generated in the browser from real stitch geometry, and the pattern is produced by a sizing engine that recalculates every stitch count from your dog's measurements and your own knitting gauge.

No build step, no dependencies, no tracking. Open `index.html` and it works.

---

## What's in it

### The course
| # | Lesson | What it covers |
|---|--------|----------------|
| 01 | What knitting actually is | Stitch anatomy, why fabric stretches, the vocabulary |
| 02 | Yarn, needles & tools | Weights, fibres, ball bands, the shopping list |
| 03 | Slip knot & casting on | Long-tail and knitted cast ons, step by step |
| 04 | Knit, purl & bind off | The only two stitches that exist |
| 05 | Fabric & gauge | Garter/stockinette/rib/seed, and the swatch that decides the fit |
| 06 | Increases & decreases | M1L, M1R, k2tog, ssk, and which way each leans |
| 07 | Knitting in the round | Circulars, magic loop, joining without twisting |
| 08 | Fixing mistakes | Dropped stitches, lifelines, tinking, frogging |
| 09 | Finishing & blocking | Weaving in, picking up, blocking, care |
| 10 | Reading patterns & charts | Decoding the shorthand |

### The project — the Basenji Sweater
Knitted in one piece from the collar down, in the round, with no seams: a 2×2 rib collar, shaped chest increases, two proper leg openings worked from held stitches, waist decreases that follow the breed's tuck-up, and a stretchy ribbed hem. Sized for a ~10 kg dog by default and resized to any dog by the generator.

- **Measure your dog** — where the tape goes, with breed reference figures
- **The pattern** — the generator, with a live schematic, road map and yarn estimate
- **Knit-along** — the same pattern walked through one evening at a time
- **Variations** — snood, leg warmers, boy-dog belly notch, hi-vis stripe

### Reference
Gauge calculator, needle size converter, yarn weight table, wraps-per-inch identifier, yarn quantity estimator, persistent row counters, a filterable glossary, and a symptom-first troubleshooting index.

---

## How the technical bits work

Everything is static HTML, CSS and vanilla JavaScript. There is no framework and nothing to install.

```
index.html
lessons/          10 lesson pages
project/          measure · pattern · knit-along · variations
reference/        tools · glossary · troubleshooting
assets/
  css/site.css    design tokens, layout, print styles, light + dark
  js/site.js      nav, sidebar, theme, progress tracking, steppers, counters
  js/knitgraph.js procedural SVG: knitted fabric, charts, gauge swatches, schematics
  js/stitchsteps.js the two-needle "what your hands do" diagrams
  js/dogsvg.js    the Basenji, with measurement overlays and an optional sweater
  js/pattern.js   the sizing engine
  js/tools.js     the calculators
```

### `knitgraph.js` — drawing knitting
Knitted fabric is drawn from stitch geometry rather than from images. `knitV()` renders one knit stitch as two curved legs meeting at a point; `purlBump()` renders the reverse face. `fabric()` tiles them according to a stitch pattern (stockinette, garter, 1×1 and 2×2 rib, seed), narrowing the purl columns in ribbing so it draws at its real relaxed width. Because it is all SVG with CSS custom properties for colour, it stays sharp at any zoom and re-themes automatically.

`chart()` renders knitting charts with correct row-number placement (right side for RS rows, left for WS) and builds its legend from the symbols actually used.

### `pattern.js` — the sizing engine
`compute(input)` takes neck, chest, back length, stitch gauge, row gauge and a few options, and derives every number in the garment:

- collar cast-on at ~8% negative ease, rounded to a multiple of 4 for 2×2 rib
- chest stitch count from girth + ease, and the number of increase rounds to get there at 4 stitches per round
- leg opening width, depth and belly-bridge width as proportions of the chest girth
- waist stitch count and the decrease schedule
- section lengths from the back length, with the plain section absorbing the remainder
- a yarn estimate from garment surface area and a mass-per-area term derived from the gauge (`0.0887 · rows_per_cm / sts_per_cm²`), calibrated against real DK garments

`render()` turns that into a round-numbered pattern with running round counts, and `toText()` produces a plain-text version for the download button.

The construction deliberately uses **held stitches** rather than a mid-round bind-off for the leg openings. A bind-off partway through a round consumes a stitch from the preceding section, which is a genuine source of off-by-one confusion for beginners; slipping the stitches to scrap yarn avoids it entirely and leaves live stitches for the cuffs.

---

## Running it

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Or just open `index.html` directly — everything works from `file://` too, except that the browser will not remember progress across the two protocols.

## Deploying to GitHub Pages

Settings → Pages → Deploy from branch → `main` / root. The `.nojekyll` file is already there so directories are served as-is.

---

## Accuracy notes

The knitting technique, the construction and the arithmetic have been worked through carefully — stitch counts balance, the divide round's stitches add up, and the shaping matches the breed's proportions. It has not, however, been test-knitted. If you make it and something does not add up, that is worth an issue.

Breed measurements come from the FCI/AKC standard ranges for Basenjis (40–43 cm at the withers, 9.5–11 kg, deep chest, short level back, pronounced tuck-up) plus the usual allowances real dogs require.

## Licence

MIT — see [LICENSE](LICENSE). Use the pattern, sell what you knit from it, fork the site.
