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
Interactive 3D models, gauge calculator, needle size converter, yarn weight table, wraps-per-inch identifier, yarn quantity estimator, persistent row counters, a filterable glossary, and a symptom-first troubleshooting index.

### The 3D models
Knitting is a three-dimensional structure that flat diagrams have to lie about. Three things genuinely cannot be drawn flat, so they are real WebGL geometry instead — generated in the browser, not downloaded:

- **One stitch and its neighbours** (lesson 1) — turn it edge-on and you can see the two legs travelling towards you while the loop they were pulled through sits behind them.
- **Every fabric in the course** (lesson 5) — with two sliders that demonstrate mechanisms rather than illustrate them. *Relax the rib* folds the fabric without changing a single stitch, which is exactly why ribbing grips. *Let the swatch go* rolls the edges of stockinette, which is why every edge in the pattern is ribbing or garter.
- **The dog, and the sweater on it** (the project pages) — lofted from breed-standard cross-sections, with the leg openings actually cut out of the garment surface and each pattern section colour-coded.

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
  js/dogsvg.js    the Basenji in SVG, with measurement overlays and a sweater
  js/pattern.js   the sizing engine
  js/tools.js     the calculators
  js/gl.js        a small hand-rolled WebGL renderer + geometry builders
  js/knit3d.js    knitted fabric as real 3D geometry
  js/dog3d.js     the Basenji as real 3D geometry, and the garment over it
```

### `gl.js` — the renderer
About 450 lines of WebGL, no three.js and no libraries at all. The scenes here need exactly one material, so vendoring 1.3 MB of engine to draw a few tens of thousands of lit triangles would have cost more than writing it.

WebGL2 with a WebGL1 fallback; hemisphere ambient plus one directional light and a rim term, with every colour read from the same CSS custom properties as the page, so the models re-light themselves when you switch theme. `touch-action: pan-y` on the canvas means a one-finger vertical drag still scrolls the article while multi-touch reaches the camera. Nothing renders unless something changed, nothing renders while the model is off screen, and `webglcontextlost` is handled properly rather than leaving a dead canvas. There are keyboard controls and real buttons beside the pointer ones, because a canvas exposes nothing to a screen reader.

Geometry builders: `tube()` sweeps a circular cross-section along a polyline using parallel-transport frames so the yarn never spins as the curve turns; `loft()` runs an elliptical cross-section along a spine and can omit faces to cut a hole in the result.

### `knit3d.js` — fabric as geometry
One continuous polyline snakes through every course of the swatch — because a piece of knitting *is* one continuous strand — and is then thickened into a tube.

The loop is a harmonic curve fitted to the classical textile models — Peirce's 1947 geometry of the plain knitted loop, and Munden's 1959 dimensional relations — rather than something invented to look about right. Everything is expressed in units of the yarn's own diameter: wale spacing 4.5 diameters, course spacing 3.46 (a stitch really is wider than it is tall; the loop shape factor for relaxed plain jersey is 1.27–1.35), loop height 1.5 course spacings so consecutive courses overlap by the 0.3 they need to interlock at all, and the two legs pinching to exactly one diameter apart.

The property that makes it read as fabric is that **depth crosses the mid-plane four times per stitch** — head at the back, leg at the front, foot, sinker loop at the back. A single oscillation per stitch is the tempting simplification and it is wrong: the loops stack instead of threading through one another, and the result looks like corduroy. The tube is swept at half a diameter, which is a hard ceiling rather than a taste call — adjacent needle-loop heads sit 1.1 diameters apart, so anything fatter passes through itself.

Two details that are easy to miss: the parameter is not arc length (`dx/dt` reverses four times per stitch), so the curve is resampled at constant arc length before sweeping or the cross-sections bunch at the head and foot; and rib is contracted by squeezing the knit-to-purl gaps and pushing the purl wales back in depth, not by scaling the fabric — which is why relaxing it changes the width without changing a single stitch. Rib and garter are also exempted from the curl, because their alternating faces genuinely cancel the bending moments.

### `dog3d.js` — the dog
Lofted through nine measured cross-sections taken from the FCI and AKC breed standards. Body length exactly equals height at the withers (the Basenji is a square breed), depth of body 0.47 H, forearm 0.415 H — the number that makes the dog look leggy — and a ribcage whose cross-section is an upright oval nearly twice as deep as it is wide. Waist girth is 65% of chest girth, and that drop is the entire reason the pattern has waist shaping.

The sweater is a second surface lofted over the same stations and offset outwards, with the leg openings omitted from the face list rather than painted on.

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
