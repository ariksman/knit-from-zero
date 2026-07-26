/* =========================================================
   Knit From Zero — knit3d.js
   Real 3D knitted fabric, generated from the geometry of a
   single loop and swept as one continuous strand of yarn.

   Coordinate convention used throughout:
     +x  along a course (left to right)
     +y  up the wales (course 0 at the bottom)
     +z  towards the viewer — the technical face, the knit side

   One stitch, over t in [0,1]:
     x(t) = W * (i + t + kx*sin(2*pi*t))
     y(t) = H * (j + 0.5 + 0.5*cos(2*pi*t))
     z(t) = -d * cos(2*pi*t) * face

   so t = 0 and t = 1 sit at the top of the loop at the BACK
   (the needle loop head and the sinker loops, which is what you
   see as bumps on the purl side) and t = 0.5 sits at the bottom
   of the V at the FRONT (the two legs, which is what you see as
   the V on the knit side). Course j+1 sits exactly H higher, so
   its legs come down through the head of course j — which is the
   whole trick of knitting, and the reason this has to be 3D.
   ========================================================= */
(function () {
  "use strict";

  const G = window.KFZGeom;
  const TAU = Math.PI * 2;

  /* Proportions taken from real DK-weight stockinette at 22 sts and
     30 rounds to 10 cm: wale spacing 4.5 mm, course spacing 3.3 mm,
     yarn about 2 mm thick, fabric about two yarn diameters deep.
     Everything below is in units of the wale spacing.

     The loop is NOT a sine wave. A sine of this aspect ratio turns
     far too tightly at its peaks — tighter than the yarn is thick —
     and the tube turns inside out there. Real yarn cannot bend
     tighter than itself, so the loop is built the way the yarn
     actually lies: straight legs joined by arcs of a fixed radius
     comfortably larger than the yarn. */
  const DEF = {
    wales: 11, courses: 9,
    W: 1,          // wale spacing
    HR: 0.72,      // course spacing / wale spacing — a stitch is wider than it is tall
    loopH: 3.0,    // nominal zigzag height / course spacing. Rounding the corners eats
                   // into it, leaving a real loop about 1.8 course spacings tall — so
                   // consecutive courses interlock instead of merely stacking.
    bend: 0.26,    // radius of the arcs at the top and bottom of every loop
    r: 0.195,      // yarn radius — must stay below `bend`
    d: 0.235,      // how far the loop travels front to back
    arcSteps: 11,  // samples per arc
    radial: 8,     // sides of the yarn tube
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
     Ribbing: the fabric is not narrower because the yarn got
     shorter — it is narrower because the same width of fabric
     now follows a wavy path through depth. So we walk the wave,
     accumulating arc length, and map flat-x (arc length) onto
     the folded position. Let go of a rib and this is what
     physically happens.
     --------------------------------------------------------- */
  function foldMap(period, amp, phase, span) {
    if (amp <= 1e-6) return (u) => [u, 0];
    const step = 0.01;
    const xs = [0], zs = [amp * Math.cos(TAU * (0 - phase) / period)], ss = [0];
    let s = 0, x = 0;
    while (s < span + 2) {
      const z0 = amp * Math.cos(TAU * (x - phase) / period);
      const z1 = amp * Math.cos(TAU * (x + step - phase) / period);
      s += Math.hypot(step, z1 - z0);
      x += step;
      xs.push(x); zs.push(z1); ss.push(s);
    }
    return (u) => {
      /* binary search the arc-length table */
      let lo = 0, hi = ss.length - 1;
      if (u <= 0) return [xs[0], zs[0]];
      if (u >= ss[hi]) return [xs[hi], zs[hi]];
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ss[mid] < u) lo = mid; else hi = mid; }
      const f = (u - ss[lo]) / Math.max(1e-9, ss[hi] - ss[lo]);
      return [xs[lo] + (xs[hi] - xs[lo]) * f, zs[lo] + (zs[hi] - zs[lo]) * f];
    };
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
  /* Round off every corner of a 2D polyline with an arc of the given
     radius — the shape a length of yarn takes when it is bent as far
     as it will go and no further. Returns points plus, for each one,
     the x it corresponds to, so the caller can work out which wale
     it belongs to. */
  function filletPolyline(poly, radius, steps) {
    const out = [poly[0].slice()];
    for (let i = 1; i < poly.length - 1; i++) {
      const P = poly[i], A = poly[i - 1], B = poly[i + 1];
      let u = [P[0] - A[0], P[1] - A[1]];
      let v = [B[0] - P[0], B[1] - P[1]];
      const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
      u = [u[0] / lu, u[1] / lu]; v = [v[0] / lv, v[1] / lv];
      const cosB = Math.max(-0.9999, Math.min(0.9999, u[0] * v[0] + u[1] * v[1]));
      const beta = Math.acos(cosB);
      if (beta < 1e-3) { out.push(P.slice()); continue; }
      /* never let the fillet eat more than half of either neighbouring segment */
      const T = Math.min(radius * Math.tan(beta / 2), lu * 0.5, lv * 0.5);
      const rho = T / Math.tan(beta / 2);
      const S = [P[0] - u[0] * T, P[1] - u[1] * T];
      const E = [P[0] + v[0] * T, P[1] + v[1] * T];
      const turn = Math.sign(u[0] * v[1] - u[1] * v[0]) || 1;
      const C = [S[0] - u[1] * rho * turn, S[1] + u[0] * rho * turn];
      const a0 = Math.atan2(S[1] - C[1], S[0] - C[0]);
      let a1 = Math.atan2(E[1] - C[1], E[0] - C[0]);
      while (a1 - a0 > Math.PI) a1 -= TAU;
      while (a1 - a0 < -Math.PI) a1 += TAU;
      for (let s = 0; s <= steps; s++) {
        const a = a0 + (a1 - a0) * (s / steps);
        out.push([C[0] + Math.cos(a) * rho, C[1] + Math.sin(a) * rho]);
      }
    }
    out.push(poly[poly.length - 1].slice());
    return out;
  }

  function buildYarn(opts) {
    const o = Object.assign({}, DEF, opts || {});
    const W = o.W, H = o.W * o.HR, d = o.d, ht = H * o.loopH;
    const pts = [], own = [];

    const isRib = o.variant === "rib1x1" || o.variant === "rib2x2";
    const period = o.variant === "rib1x1" ? 2 : 4;
    const phase = o.variant === "rib1x1" ? 0.5 : 1.0;
    const amp = isRib ? o.fold * 0.62 * W : 0;
    const fold = foldMap(period, amp, phase, o.wales + 1);

    /* Which way a point faces, blended across the boundary between a
       knit wale and a purl one so the yarn does not jump through the
       fabric. Wale centres — the points of the Vs — sit at i + 0.5. */
    function faceAt(x, j) {
      const c = x - 0.5;
      const i0 = Math.floor(c);
      let fr = c - i0;
      fr = fr * fr * (3 - 2 * fr);                       // smoothstep
      const a = faceOf(o.variant, Math.max(0, Math.min(o.wales - 1, i0)), j);
      const b = faceOf(o.variant, Math.max(0, Math.min(o.wales - 1, i0 + 1)), j);
      return a * (1 - fr) + b * fr;
    }

    /* One course, as a zigzag: top of the loop at every wale boundary,
       point of the V at every wale centre. Corners then rounded off. */
    const zig = [];
    for (let i = -1; i <= o.wales + 1; i++) {
      zig.push([i, ht]);
      zig.push([i + 0.5, 0]);
    }
    /* Build a wale wider than needed at each end, then clip — otherwise
       the un-rounded first and last corners of the zigzag stick out
       above the fabric as spikes. */
    const profile = filletPolyline(zig, o.bend, o.arcSteps)
      .filter((p) => p[0] >= -1e-6 && p[0] <= o.wales + 1e-6);
    /* the fillets cut into the zigzag, so ask the profile how tall it
       actually came out and map depth onto that, not onto the nominal
       height — otherwise the loop never reaches full front or back */
    let pLo = Infinity, pHi = -Infinity;
    profile.forEach((p) => { if (p[1] < pLo) pLo = p[1]; if (p[1] > pHi) pHi = p[1]; });
    const pSpan = Math.max(1e-6, pHi - pLo);

    /* every course, as its own list, so the selvedge turns can be
       drawn between the points that actually exist rather than
       between where the un-rounded zigzag would have gone */
    const rows = [];
    for (let j = 0; j < o.courses; j++) {
      const rtl = j % 2 === 1;                    // alternate courses run the other way
      const seq = rtl ? profile.slice().reverse() : profile;
      const row = [];
      seq.forEach((p) => {
        const x = p[0], ly = p[1];
        const f = faceAt(x, j);
        const z = d * (1 - 2 * (ly - pLo) / pSpan) * f;
        const wale = Math.max(0, Math.min(o.wales - 1, Math.floor(x)));
        if (!amp) row.push([[x * W, H * j + ly, z], wale]);
        else {
          const [fx, fz] = fold(x);
          row.push([[fx * W, H * j + ly, fz + z], wale]);
        }
      });
      rows.push({ row, rtl });
    }

    rows.forEach((r, j) => {
      r.row.forEach((q) => { pts.push(q[0]); own.push([q[1], j]); });
      if (j < rows.length - 1) {
        const a = r.row[r.row.length - 1][0];
        const b = rows[j + 1].row[0][0];
        const out = r.rtl ? -1 : 1;               // which edge we turn at
        for (let k = 1; k <= 6; k++) {
          const t = k / 7;
          const bulge = Math.sin(t * Math.PI) * 0.30 * W * out;
          pts.push([
            a[0] + (b[0] - a[0]) * t + bulge,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * 0.12 * W,
          ]);
          own.push([-1, j]);
        }
      }
    });

    /* let the swatch go */
    if (o.curl > 0 && (o.variant === "stockinette" || o.variant === "reverse")) {
      const sgn = o.variant === "reverse" ? -1 : 1;
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      pts.forEach((p) => {
        if (p[0] < xMin) xMin = p[0]; if (p[0] > xMax) xMax = p[0];
        if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1];
      });
      const R = Math.max(0.42, 1.5 - o.curl * 1.05) * W;
      const inset = 1.35 * W;
      for (let k = 0; k < pts.length; k++) {
        let p = pts[k];
        p = roll(p, 1, yMax - inset * 0.9, R, sgn, +1);       // top edge → knit side
        p = roll(p, 1, yMin + inset * 0.9, R, sgn, -1);       // bottom edge → knit side
        p = roll(p, 0, xMax - inset, R, -sgn, +1);            // right edge → purl side
        p = roll(p, 0, xMin + inset, R, -sgn, -1);            // left edge → purl side
        pts[k] = p;
      }
    }

    /* centre it on the origin so the camera behaves */
    let cx = 0, cy = 0, cz = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; cz += p[2]; });
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    pts.forEach((p) => { p[0] -= cx; p[1] -= cy; p[2] -= cz; });

    return { pts, own, W, H, d, opts: o };
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
        b.textContent = name;
        b.className = key === state.variant ? "on" : "";
        b.addEventListener("click", () => {
          state.variant = key;
          grp.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
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

    /* keep the yarn colour in step with the theme */
    const mo = new MutationObserver(rebuild);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

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
      const m = build({ variant: "stockinette", wales: o.wales, courses: o.courses, highlight: hi, arcSteps: 15, radial: 11 });
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

      scene.addLabel([legL[0] - W * 0.72, legL[1] + H * 0.30, legL[2] + 0.3], "left leg", "ochre");
      scene.addLabel([legR[0] + W * 0.72, legR[1] + H * 0.30, legR[2] + 0.3], "right leg", "ochre");
      scene.addLabel([point[0], point[1] - H * 0.95, point[2] + 0.35], "the point of the V", "rust");
      scene.addLabel([headBelow[0] - W * 1.15, headBelow[1] - H * 0.15, headBelow[2] - 0.5], "head of the stitch below", "indigo");
      scene.addLabel([bar[0] + W * 0.95, bar[1] + H * 0.75, bar[2] - 0.45], "running bar", "sage");
      if (firstA) { scene.frame(1.12); firstA = false; }
      scene.invalidate();
    }
    rebuild();
    const mo = new MutationObserver(rebuild);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
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
