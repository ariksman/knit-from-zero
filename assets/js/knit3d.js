/* =========================================================
   Knit From Zero — knit3d.js
   Real 3D knitted fabric, generated from the geometry of a
   single loop and swept as one continuous strand of yarn.

   Coordinate convention used throughout:
     +x  along a course (left to right)
     +y  up the wales (course 0 at the bottom)
     +z  towards the viewer — the technical face, the knit side

   The loop is a harmonic curve fitted to the classical textile
   models (Peirce 1947, Munden 1959) rather than anything invented
   here. The important property is that DEPTH crosses the mid-plane
   four times per stitch — head at the back, leg at the front, foot,
   sinker loop at the back — because that is what makes courses
   actually pass through one another. A single depth oscillation per
   stitch reads as corduroy, not knitting.

   The loop is 1.50 course spacings tall against a 1.00 spacing, so
   consecutive courses overlap by the 0.30 needed to interlock, and
   the two legs pinch to exactly one yarn diameter apart.

   Flip that face per course and you have garter; per wale, rib;
   per checkerboard, seed. One generator, every fabric on the site.
   ========================================================= */
(function () {
  "use strict";

  const G = window.KFZGeom;
  const TAU = Math.PI * 2;

  /* The loop geometry below is Peirce/Munden-consistent and was checked
     against the textile literature: wale spacing 4.5 yarn diameters,
     course spacing W/1.30 (a stitch is wider than it is tall — the loop
     shape factor Kc/Kw is 1.27–1.35 for relaxed plain jersey), loop
     height 1.50 H against a 1.00 H course spacing so consecutive
     courses overlap by the 0.30 H needed to interlock at all, and the
     two legs exactly one yarn diameter apart where they pinch.

     EVERYTHING IS IN UNITS OF THE YARN DIAMETER. */
  const D = 1;                 // yarn diameter — the unit of this file
  const W = 4.5 * D;           // wale spacing
  const H = W / 1.30;          // course spacing
  const AMP = 0.75 * D;        // depth amplitude → fabric ≈ 2.6 D thick

  /* One stitch, t in [0,1]. x advances exactly W per unit t and every
     added term is 1-periodic, so a whole course is this same function
     evaluated over t in [0, wales] — no per-stitch pieces, no seams.

     The depth term crosses the mid-plane FOUR times per stitch, which
     is what actually makes the fabric interlock:
       t=0     head apex .............. top, back
       t=0.25  right leg .............. mid, FRONT-most
       t=0.40  foot / point of the V .. bottom, forward
       t=0.50  sinker loop ............ lowest, back-most
     Anything with one crossing per stitch reads as corduroy. */
  const CX = [0.063, 0.244, -0.059, 0.063];   // sin(2πt), sin(4πt), sin(6πt), sin(8πt)
  const CY = [0.550, 0.699, 0.051];           // const, cos(2πt), cos(6πt)
  const CZ = [0.42, -1.000, -0.420];          // const, cos(4πt), cos(8πt)

  function stitchX(t) {
    return W * (t + CX[0] * Math.sin(TAU * t) + CX[1] * Math.sin(2 * TAU * t)
      + CX[2] * Math.sin(3 * TAU * t) + CX[3] * Math.sin(4 * TAU * t));
  }
  function stitchY(t) {
    return H * (CY[0] + CY[1] * Math.cos(TAU * t) + CY[2] * Math.cos(3 * TAU * t));
  }
  function stitchZ(t) {
    return AMP * (CZ[0] + CZ[1] * Math.cos(2 * TAU * t) + CZ[2] * Math.cos(4 * TAU * t));
  }

  const DEF = {
    wales: 11, courses: 9,
    r: 0.47 * D,   // tube radius. The hard limit is 0.5 D — adjacent needle-loop
                   // heads sit 1.10 D apart, so anything thicker interpenetrates.
    seg: 0.75 * D, // target segment length after arc-length resampling
    radial: 8,
    variant: "stockinette",
    fold: 0,       // 0 = rib held stretched open, 1 = rib relaxed
    curl: 0,       // 0 = swatch pinned flat, 1 = let go
    highlight: null, // [wale, course] to pick out in a second colour
  };

  /* which face of the fabric points at the viewer for stitch (i, j) */
  function faceOf(variant, i, j) {
    switch (variant) {
      case "reverse": return -1;
      case "garter": return j % 2 === 0 ? 1 : -1;
      case "rib1x1": return i % 2 === 0 ? 1 : -1;
      case "rib2x2": return i % 4 < 2 ? 1 : -1;
      case "seed": return (i + j) % 2 === 0 ? 1 : -1;
      default: return 1;
    }
  }

  /* ---------------------------------------------------------
     Curl. Stockinette rolls because the loop is not symmetric
     front to back. Rather than fake it with a bulge, we wrap
     the edge regions around a cylinder, which is what the
     fabric actually does — arc length is preserved, so the
     swatch visibly gets smaller as it rolls.
        top and bottom edges roll towards the knit side (+z)
        the two side edges roll towards the purl side (-z)
     --------------------------------------------------------- */
  function roll(p, axis, edgeStart, R, dir, beyond) {
    /* axis 0 = roll the x edges (bend about a vertical line)
       axis 1 = roll the y edges (bend about a horizontal line) */
    const a = p[axis];
    const s = beyond > 0 ? a - edgeStart : edgeStart - a;
    if (s <= 0) return p;
    const th = Math.min(Math.PI * 1.15, s / R);
    const rr = R - p[2] * dir;                     // keep the loop's own depth
    const na = edgeStart + beyond * rr * Math.sin(th);
    const nz = dir * (R - rr * Math.cos(th));
    const out = p.slice();
    out[axis] = na;
    out[2] = nz;
    return out;
  }

  /* ---------------------------------------------------------
     Build the yarn as ONE continuous polyline snaking through
     every course — because that is what a piece of knitting is.
     --------------------------------------------------------- */
  function buildYarn(opts) {
    const o = Object.assign({}, DEF, opts || {});
    const pts = [], own = [];

    /* --- per-fabric adjustments, from the textile-science reading ---
       A purl-facing stitch is a knit stitch seen from the back, so its
       depth is simply negated. Rib additionally pushes the purl wales
       away from the viewer and pulls the transitions closer together —
       that, not any change of stitch size, is why rib is narrower.
       Garter relaxes much shorter course-wise and ridges on both faces. */
    const isRib = o.variant === "rib1x1" || o.variant === "rib2x2";
    const period = o.variant === "rib1x1" ? 2 : 4;
    const ribBack = (o.variant === "rib1x1" ? 1.55 : 1.4) * D * o.fold;
    const gapMin = o.variant === "rib1x1" ? 0.45 : 0.45;
    const isGarter = o.variant === "garter";
    const courseH = isGarter ? H * 0.65 : H;
    const waleW = isGarter ? W * 1.05 : W;

    function purlAt(i, j) {
      switch (o.variant) {
        case "reverse": return true;
        case "garter": return j % 2 === 1;
        case "rib1x1": return i % 2 === 1;
        case "rib2x2": return i % 4 >= 2;
        case "seed": return (i + j) % 2 === 1;
        default: return false;
      }
    }

    /* Rib contracts by squeezing the knit-to-purl gaps, so wale centres
       are no longer evenly spaced. Build the map once. */
    const waleX = [];
    {
      let acc = 0;
      for (let i = 0; i <= o.wales; i++) {
        waleX.push(acc);
        const gap = isRib && purlAt(i, 0) !== purlAt(i + 1, 0)
          ? 1 - o.fold * (1 - gapMin) : 1;
        acc += gap;
      }
    }
    const remapU = (u) => {
      const i = Math.max(0, Math.min(o.wales - 1, Math.floor(u)));
      return waleX[i] + (u - i) * (waleX[i + 1] - waleX[i]);
    };

    const smooth = (a) => a * a * (3 - 2 * a);

    /* One course as a single fine polyline, then resampled by arc length
       — t is not arc length (dx/dt reverses four times a stitch), so
       sweeping it raw bunches cross-sections at the head and the foot. */
    function courseCurve(j) {
      const fine = [];
      const N = Math.max(64, Math.round(o.wales * 160));
      for (let k = 0; k <= N; k++) {
        const t = (k / N) * o.wales;
        const u = stitchX(t) / W;
        /* which wale this sample belongs to, and how far through the
           changeover it is — the sinker at t=0.5 is the crossing point */
        const centre = Math.round(u);
        const wale = Math.max(0, Math.min(o.wales - 1, centre));
        const frac = u - (centre - 0.5);            // 0..1 across the cell
        const blend = smooth(Math.max(0, Math.min(1, (frac - 0.4) / 0.2)));
        const here = purlAt(wale, j) ? -1 : 1;
        const next = purlAt(Math.min(o.wales - 1, wale + 1), j) ? -1 : 1;
        const face = here * (1 - blend) + next * blend;

        let z = stitchZ(t) * face;
        if (isRib) {
          const backHere = purlAt(wale, j) ? -ribBack : 0;
          const backNext = purlAt(Math.min(o.wales - 1, wale + 1), j) ? -ribBack : 0;
          z += backHere * (1 - blend) + backNext * blend;
        }
        if (isGarter) z += (j % 2 === 1 ? 0.6 : -0.6) * D;

        fine.push([remapU(u) * waleW, stitchY(t) + courseH * j, z, wale]);
      }
      /* resample at a constant arc length */
      const out = [];
      let carry = 0;
      out.push(fine[0]);
      for (let k = 1; k < fine.length; k++) {
        const a = out[out.length - 1], b = fine[k];
        let dist = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        carry += dist;
        if (carry >= o.seg) { out.push(b); carry = 0; }
      }
      if (out[out.length - 1] !== fine[fine.length - 1]) out.push(fine[fine.length - 1]);
      return out;
    }

    const rows = [];
    for (let j = 0; j < o.courses; j++) {
      const row = courseCurve(j);
      rows.push({ row, rtl: j % 2 === 1 });
    }

    /* one continuous strand, turning at alternate selvedges */
    rows.forEach((r, j) => {
      const seq = r.rtl ? r.row.slice().reverse() : r.row;
      seq.forEach((q) => { pts.push([q[0], q[1], q[2]]); own.push([q[3], j]); });
      if (j < rows.length - 1) {
        const nextSeq = rows[j + 1].rtl ? rows[j + 1].row.slice().reverse() : rows[j + 1].row;
        const a = seq[seq.length - 1], b = nextSeq[0];
        const out = r.rtl ? -1 : 1;
        for (let k = 1; k <= 6; k++) {
          const t = k / 7;
          const bulge = Math.sin(t * Math.PI) * 0.55 * D * out;
          pts.push([
            a[0] + (b[0] - a[0]) * t + bulge,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * 0.35 * D,
          ]);
          own.push([-1, j]);
        }
      }
    });

    /* Let the swatch go. Rib and garter genuinely do not curl — the
       alternating faces cancel the bending moments — so this only ever
       runs for plain fabric. */
    if (o.curl > 0 && (o.variant === "stockinette" || o.variant === "reverse")) {
      const sgn = o.variant === "reverse" ? -1 : 1;
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      pts.forEach((p) => {
        if (p[0] < xMin) xMin = p[0]; if (p[0] > xMax) xMax = p[0];
        if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1];
      });
      const R = Math.max(3.0, 7.5 - o.curl * 4.5) * D;
      const inset = 6.0 * D;
      for (let k = 0; k < pts.length; k++) {
        let p = pts[k];
        p = roll(p, 1, yMax - inset, R, sgn, +1);       // bind-off edge → knit side
        p = roll(p, 1, yMin + inset, R, sgn, -1);       // cast-on edge → knit side
        p = roll(p, 0, xMax - inset, R, -sgn, +1);      // right selvedge → purl side
        p = roll(p, 0, xMin + inset, R, -sgn, -1);      // left selvedge → purl side
        pts[k] = p;
      }
    }

    /* centre it on the origin so the camera behaves */
    let cx = 0, cy = 0, cz = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; cz += p[2]; });
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    pts.forEach((p) => { p[0] -= cx; p[1] -= cy; p[2] -= cz; });

    return { pts, own, W: waleW, H: courseH, d: AMP, opts: o };
  }

  /* ---------------------------------------------------------
     Mesh
     --------------------------------------------------------- */
  function build(opts) {
    const y = buildYarn(opts);
    const o = y.opts;
    const base = window.KFZGL.cssColour("--yarn-a", [0.66, 0.25, 0.16]);
    const hot = window.KFZGL.cssColour("--ochre", [0.71, 0.49, 0.07]);
    const cool = window.KFZGL.cssColour("--indigo", [0.18, 0.31, 0.42]);
    const hl = o.highlight;

    const mesh = G.tube(y.pts, o.r, o.radial, {
      colorAt: (i) => {
        const q = y.own[i];
        if (hl && q[0] === hl[0] && q[1] === hl[1]) return hot;
        if (hl && q[0] === hl[0] && q[1] === hl[1] - 1) return cool;
        return base;
      },
    });
    mesh.stats = {
      points: y.pts.length,
      triangles: mesh.indices.length / 3,
      stitches: o.wales * o.courses,
      W: y.W, H: y.H,
    };
    mesh.yarn = y;
    return mesh;
  }

  /* ---------------------------------------------------------
     Mount a ready-made interactive block.
     --------------------------------------------------------- */
  const VARIANTS = [
    ["stockinette", "Stockinette"],
    ["garter", "Garter"],
    ["rib2x2", "2×2 rib"],
    ["rib1x1", "1×1 rib"],
    ["seed", "Seed"],
    ["reverse", "Purl side"],
  ];

  const NOTES = {
    stockinette: "Every stitch shows its V to the front. Turn the model over: the back is nothing but horizontal bumps — the heads and sinker loops. Same fabric, two completely different faces.",
    garter: "The face alternates course by course. Two knitted rows make one visible ridge, and because the fabric is the same on both sides it lies perfectly flat.",
    rib2x2: "Two wales facing forward, two facing back. Drag the relax slider and watch the back-facing pairs physically fold away from you — the fabric gets narrower without a single stitch changing size.",
    rib1x1: "The tightest rib. Alternating single wales fold the fabric into the finest concertina, which is why 1×1 grips harder than 2×2 on a small tube like a leg cuff.",
    seed: "Knit and purl alternating in both directions, so no two neighbouring stitches face the same way. Nothing can line up to fold or curl, which is why seed stitch lies dead flat and uses more yarn per centimetre.",
    reverse: "The same stockinette fabric, seen from behind. The bumps are the tops of the loops and the strands running between them.",
  };

  function mount(host, opts) {
    const o = Object.assign({
      variant: "stockinette", wales: 11, courses: 9, controls: true,
      curl: 0, fold: 0, highlight: null, distance: 7.6, autoRotate: false,
      showStats: true, label: "Interactive 3D model of knitted fabric",
    }, opts || {});

    const scene = window.KFZGL.create(host, {
      distance: o.distance, phi: 0.18, theta: 0.5, minDist: 2.2, maxDist: 26,
      autoRotate: o.autoRotate, label: o.label,
    });
    if (!scene) return null;

    const state = { variant: o.variant, curl: o.curl, fold: o.fold };
    let readout, first = true;

    function rebuild() {
      scene.clear();
      const m = build({
        variant: state.variant, wales: o.wales, courses: o.courses,
        curl: state.curl, fold: state.fold, highlight: o.highlight,
      });
      scene.add({ positions: m.positions, normals: m.normals, colors: m.colors, indices: m.indices });
      if (readout) {
        readout.innerHTML = `<b>${NOTES[state.variant]}</b><br>` +
          `<span style="opacity:.7">${m.stats.stitches} stitches · ${m.stats.triangles.toLocaleString()} triangles · one continuous strand of yarn</span>`;
      }
      if (first) { scene.frame(1.08); first = false; }
      if (o.onBuild) o.onBuild(m, scene);
      scene.invalidate();
    }

    if (o.controls) {
      const bar = document.createElement("div");
      bar.className = "gl-controls";

      const grp = document.createElement("div");
      grp.className = "grp";
      VARIANTS.forEach(([key, name]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = name;
        b.className = key === state.variant ? "on" : "";
        b.setAttribute("aria-pressed", String(key === state.variant));
        b.addEventListener("click", () => {
          state.variant = key;
          grp.querySelectorAll("button").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
          b.classList.add("on");
          b.setAttribute("aria-pressed", "true");
          syncSliders();
          rebuild();
        });
        grp.appendChild(b);
      });
      bar.appendChild(grp);

      const foldWrap = document.createElement("label");
      foldWrap.innerHTML = 'relax the rib <input type="range" min="0" max="100" value="0">';
      const foldIn = foldWrap.querySelector("input");
      foldIn.addEventListener("input", () => { state.fold = +foldIn.value / 100; rebuild(); });

      const curlWrap = document.createElement("label");
      curlWrap.innerHTML = 'let the swatch go <input type="range" min="0" max="100" value="0">';
      const curlIn = curlWrap.querySelector("input");
      curlIn.addEventListener("input", () => { state.curl = +curlIn.value / 100; rebuild(); });

      const reset = document.createElement("button");
      reset.textContent = "Reset view";
      reset.style.borderColor = "var(--line-2)";
      reset.addEventListener("click", () => scene.home());

      bar.append(foldWrap, curlWrap, reset);
      host.appendChild(bar);

      function syncSliders() {
        const rib = state.variant.startsWith("rib");
        const flat = state.variant === "stockinette" || state.variant === "reverse";
        foldWrap.style.display = rib ? "" : "none";
        curlWrap.style.display = flat ? "" : "none";
        if (!rib) { state.fold = 0; foldIn.value = 0; }
        if (!flat) { state.curl = 0; curlIn.value = 0; }
      }
      syncSliders();
    }

    if (o.showStats) {
      readout = document.createElement("div");
      readout.className = "gl-readout";
      host.appendChild(readout);
    }

    rebuild();

    /* keep the yarn colour in step with the theme — both the site toggle
       and the operating system deciding it is evening */
    const mo = new MutationObserver(rebuild);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rebuild);

    return { scene, rebuild, state };
  }

  /* ---------------------------------------------------------
     The single-stitch anatomy model used in lesson 1.
     --------------------------------------------------------- */
  function mountAnatomy(host, opts) {
    const o = Object.assign({ wales: 6, courses: 5 }, opts || {});
    const hi = [2, 2];   // the stitch we pick out
    const scene = window.KFZGL.create(host, {
      distance: 4.3, phi: 0.12, theta: 0.42, minDist: 1.8, maxDist: 14,
      label: "Interactive 3D model of one knitted stitch and its neighbours",
    });
    if (!scene) return null;
    let firstA = true;

    function rebuild() {
      scene.clear();
      const m = build({ variant: "stockinette", wales: o.wales, courses: o.courses, highlight: hi, seg: 0.5, radial: 11 });
      scene.add({ positions: m.positions, normals: m.normals, colors: m.colors, indices: m.indices });

      const y = m.yarn, W = y.W, H = y.H;

      /* Pull label anchors straight off the generated curve, so they
         stay glued to the geometry however the constants are tuned.
         t = 0 is the top of the loop at the back, t = 0.5 the point
         of the V at the front. */
      function at(i, j, t) {
        const span = [];
        for (let k = 0; k < y.own.length; k++) {
          if (y.own[k][0] === i && y.own[k][1] === j) span.push(y.pts[k]);
          else if (span.length) break;
        }
        if (!span.length) return [0, 0, 0];
        return span[Math.min(span.length - 1, Math.round(t * (span.length - 1)))];
      }

      const legL = at(hi[0], hi[1], 0.28);
      const legR = at(hi[0], hi[1], 0.72);
      const point = at(hi[0], hi[1], 0.5);
      const headBelow = at(hi[0], hi[1] - 1, 0.0);
      const bar = at(hi[0] + 1, hi[1], 0.0);

      scene.addLabel([legL[0] - W * 1.25, legL[1] + H * 0.9, legL[2] + 0.3], "left leg", "ochre");
      scene.addLabel([legR[0] + W * 1.25, legR[1] + H * 0.9, legR[2] + 0.3], "right leg", "ochre");
      scene.addLabel([point[0] - W * 0.15, point[1] - H * 1.9, point[2] + 0.4], "the point of the V", "rust");
      scene.addLabel([headBelow[0] - W * 1.9, headBelow[1] - H * 0.5, headBelow[2] - 0.55], "head of the stitch below", "indigo");
      scene.addLabel([bar[0] + W * 1.4, bar[1] + H * 1.5, bar[2] - 0.5], "running bar", "sage");
      if (firstA) { scene.frame(1.12); firstA = false; }
      scene.invalidate();
    }
    rebuild();
    const mo = new MutationObserver(rebuild);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rebuild);
    return { scene, rebuild };
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-knit3d]").forEach((n) => {
      let o = {};
      try { o = JSON.parse(n.getAttribute("data-knit3d") || "{}"); } catch (e) {}
      if (o.mode === "anatomy") mountAnatomy(n, o);
      else mount(n, o);
    });
  });

  window.Knit3D = { build, buildYarn, mount, mountAnatomy, faceOf, NOTES };
})();
