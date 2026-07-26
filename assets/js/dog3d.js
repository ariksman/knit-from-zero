/* =========================================================
   Knit From Zero — dog3d.js
   A Basenji, built as real 3D geometry rather than drawn.

   Everything is in units of H, the height at the withers, and the
   numbers come from the FCI and AKC breed standards plus the usual
   conformation ratios: body length exactly 1.00 H (the breed is
   square), depth of body 0.47 H, forearm 0.415 H (this breed is
   famously leggy), and a ribcage whose cross-section is an upright
   oval nearly twice as deep as it is wide.

   Convention: the dog stands square facing -X, the ground is y = 0,
   the prosternum is x = 0, and z is lateral.

   The sweater is a second surface lofted over the same stations,
   offset outwards, with the leg openings cut out of it — so the
   garment genuinely wraps this body rather than being drawn on it.
   ========================================================= */
(function () {
  "use strict";

  const G = window.KFZGeom;
  const DEG = Math.PI / 180;

  /* torso: x, full width, full height, centre y — measured stations */
  const TORSO = [
    { x: 0.000, w: 0.090, h: 0.230, cy: 0.690 },  // prosternum / point of forechest
    { x: 0.050, w: 0.140, h: 0.320, cy: 0.706 },
    { x: 0.100, w: 0.160, h: 0.360, cy: 0.725 },  // S1 base of the neck
    { x: 0.210, w: 0.205, h: 0.440, cy: 0.750 },  // S2 elbow plane — the chest girth a sweater must clear
    { x: 0.320, w: 0.235, h: 0.445, cy: 0.7525 }, // S3 deepest chest
    { x: 0.430, w: 0.245, h: 0.430, cy: 0.755 },  // S4 widest
    { x: 0.540, w: 0.215, h: 0.370, cy: 0.785 },  // S5 ribcage narrowing
    { x: 0.620, w: 0.190, h: 0.320, cy: 0.815 },  // S6 last rib, tuck-up steep
    { x: 0.700, w: 0.170, h: 0.270, cy: 0.840 },  // S7 waist — the minimum
    { x: 0.800, w: 0.210, h: 0.335, cy: 0.798 },  // S8 over the hip
    { x: 0.900, w: 0.200, h: 0.320, cy: 0.792 },  // S9 croup
    { x: 0.975, w: 0.140, h: 0.235, cy: 0.828 },  // point of buttock
  ];

  /* neck core, base to poll */
  const NECK = [
    { p: [0.170, 0.855, 0], w: 0.175, h: 0.300 },
    { p: [0.115, 0.945, 0], w: 0.160, h: 0.265 },
    { p: [0.055, 1.030, 0], w: 0.140, h: 0.225 },
    { p: [0.005, 1.100, 0], w: 0.125, h: 0.200 },
    { p: [-0.040, 1.160, 0], w: 0.118, h: 0.180 },
  ];

  /* head, along an axis running forward and 10 degrees down */
  const HEAD = [
    { t: 0.00, w: 0.190, h: 0.170 },   // ear set — widest
    { t: 0.28, w: 0.150, h: 0.155 },
    { t: 0.53, w: 0.105, h: 0.135 },   // stop
    { t: 0.72, w: 0.092, h: 0.108 },
    { t: 0.90, w: 0.078, h: 0.095 },
    { t: 1.00, w: 0.066, h: 0.086 },   // nose — rounded cushions, never snipy
  ];
  const OCCIPUT = [-0.045, 1.215, 0], NOSE = [-0.463, 1.135, 0];

  const FORELEG = [[0.045, 0.729], [0.212, 0.530], [0.212, 0.115], [0.185, 0.0]];
  const HINDLEG = [[0.795, 0.760], [0.775, 0.455], [0.885, 0.215], [0.870, 0.0]];

  const COAT = [0.70, 0.385, 0.205];
  const COAT_DK = [0.55, 0.28, 0.145];
  const CREAM = [0.955, 0.925, 0.875];
  const NOSE_C = [0.14, 0.10, 0.07];

  /* ---------------------------------------------------------
     Build the animal.
     --------------------------------------------------------- */
  function buildDog() {
    const parts = [];

    /* torso */
    const torsoStations = resample(TORSO.map((s) => ({
      c: [s.x, s.cy, 0], rx: s.w / 2, ry: s.h / 2,
    })), 4);
    const torso = G.loft(torsoStations, 30, {
      capStart: true, capEnd: true,
      colorAt: (i, n, a, st) => {
        const low = Math.sin(a) < -0.52;                 // underside of the ellipse
        return low && st.c[0] < 0.30 ? CREAM : COAT;     // white forechest and brisket
      },
    });
    parts.push(torso);

    /* neck */
    const neck = G.loft(NECK.map((s) => ({ c: s.p, rx: s.w / 2, ry: s.h / 2 })), 24, { capStart: false, capEnd: false });
    neck.color = COAT;
    parts.push(neck);

    /* head — lofted along the occiput-to-nose axis */
    const axis = [NOSE[0] - OCCIPUT[0], NOSE[1] - OCCIPUT[1], 0];
    const head = G.loft(HEAD.map((s) => ({
      c: [OCCIPUT[0] + axis[0] * s.t, OCCIPUT[1] + axis[1] * s.t, 0],
      rx: s.w / 2, ry: s.h / 2,
    })), 22, { capStart: true, capEnd: true });
    head.color = COAT;
    parts.push(head);

    /* the nose leather */
    const nose = G.sphere(NOSE[0] - 0.012, NOSE[1] - 0.006, 0, 0.030, 14, 10);
    nose.color = NOSE_C;
    parts.push(nose);

    /* eyes — dark almonds set at the corner of the wedge */
    [-1, 1].forEach((s) => {
      const e = G.sphere(-0.205, 1.185, s * 0.058, 0.021, 12, 9);
      e.color = NOSE_C;
      parts.push(e);
    });

    /* ears: small, erect, hooded, set well forward */
    [-1, 1].forEach((s) => {
      const base = [-0.075, 1.230, s * 0.052];
      const tip = [-0.115, 1.350, s * 0.062];
      const ear = G.loft([
        { c: base, rx: 0.048, ry: 0.020 },
        { c: [(base[0] + tip[0]) / 2 - 0.004, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2], rx: 0.034, ry: 0.015 },
        { c: tip, rx: 0.008, ry: 0.006 },
      ], 12, { capStart: false, capEnd: true });
      ear.color = COAT_DK;
      parts.push(ear);
    });

    /* legs */
    [-1, 1].forEach((s) => {
      parts.push(legMesh(FORELEG, s * 0.070, 0.062, 0.030, COAT));
      parts.push(legMesh(HINDLEG, s * 0.075, 0.084, 0.032, COAT));
      const fp = G.sphere(FORELEG[3][0] - 0.010, 0.026, s * 0.070, 0.036, 12, 9); fp.color = CREAM;
      const hp = G.sphere(HINDLEG[3][0] - 0.010, 0.026, s * 0.075, 0.036, 12, 9); hp.color = CREAM;
      parts.push(fp, hp);
    });

    /* the tail: up and back, then an acute break forward into a tight
       curl lying to the dog's right, against the thigh */
    parts.push(tailMesh());

    /* the famous forehead wrinkles */
    for (let k = 0; k < 3; k++) {
      const t = 0.10 + k * 0.075;
      const cx = OCCIPUT[0] + axis[0] * t, cy = OCCIPUT[1] + axis[1] * t;
      const w = 0.088 - k * 0.008;
      const pts = [];
      for (let q = 0; q <= 10; q++) {
        const a = -0.85 + (q / 10) * 1.7;
        pts.push([cx + Math.abs(a) * 0.012, cy + 0.052 - Math.abs(a) * 0.014, Math.sin(a) * w]);
      }
      const wr = G.tube(pts, 0.0075, 6);
      wr.color = COAT_DK;
      parts.push(wr);
    }

    /* blaze up the muzzle */
    const stripe = G.loft([
      { c: [-0.408, 1.170, 0], rx: 0.014, ry: 0.010 },
      { c: [-0.340, 1.188, 0], rx: 0.018, ry: 0.011 },
      { c: [-0.268, 1.212, 0], rx: 0.016, ry: 0.009 },
      { c: [-0.212, 1.228, 0], rx: 0.009, ry: 0.006 },
    ], 12, { capStart: true, capEnd: true });
    stripe.color = CREAM;
    parts.push(stripe);

    return G.merge(parts);
  }

  /* a flat disc just above the ground, dark and translucent — enough
     to stop the dog looking like it is floating */
  function groundShadow() {
    const seg = 48, positions = [], normals = [], indices = [];
    positions.push(0.5, 0.002, 0); normals.push(0, 1, 0);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      positions.push(0.5 + Math.cos(a) * 0.52, 0.002, Math.sin(a) * 0.20);
      normals.push(0, 1, 0);
    }
    for (let i = 1; i <= seg; i++) indices.push(0, i, i + 1);
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices };
  }

  function legMesh(chain, z, rTop, rBot, colour) {
    const pts = [];
    chain.forEach((j, i) => {
      pts.push([j[0], j[1], z]);
      if (i < chain.length - 1) {
        const n = chain[i + 1];
        pts.push([(j[0] + n[0]) / 2, (j[1] + n[1]) / 2, z]);
      }
    });
    const smooth = G.spline(pts, 5);
    const m = G.tube(smooth, (i, n) => rTop + (rBot - rTop) * Math.pow(i / (n - 1), 0.75), 12, {
      colorAt: (i, n) => (i / n > 0.86 ? CREAM : colour),   // white socks
    });
    return m;
  }

  function tailMesh() {
    const root = [0.925, 0.925, 0];
    const C = [0.870, 1.010];
    const pts = [root];
    /* the short run up and back before the acute break */
    pts.push([root[0] + 0.028, root[1] + 0.040, 0.012]);
    const th0 = Math.atan2(root[1] + 0.040 - C[1], root[0] + 0.028 - C[0]);
    const turns = 1.5, steps = 46;
    const r0 = 0.101, r1 = 0.046;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const th = th0 + f * turns * Math.PI * 2;
      const rr = r0 + (r1 - r0) * f;
      const tilt = 18 * DEG;
      const x = C[0] + Math.cos(th) * rr;
      const y = C[1] + Math.sin(th) * rr * Math.cos(tilt);
      const z = 0.012 + Math.min(0.075, f * 4 * 0.075) + Math.sin(th) * rr * Math.sin(tilt);
      pts.push([x, y, z]);
    }
    const m = G.tube(G.spline(pts, 3), (i, n) => 0.036 - 0.014 * (i / n), 11);
    m.color = COAT;
    return m;
  }

  /* denser stations make a smoother loft */
  function resample(stations, mult) {
    const out = [];
    for (let i = 0; i < stations.length - 1; i++) {
      for (let k = 0; k < mult; k++) {
        const t = k / mult;
        const a = stations[i], b = stations[i + 1];
        const am = stations[Math.max(0, i - 1)], bp = stations[Math.min(stations.length - 1, i + 2)];
        const cr = (p0, p1, p2, p3) => {
          const t2 = t * t, t3 = t2 * t;
          return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        };
        out.push({
          c: [cr(am.c[0], a.c[0], b.c[0], bp.c[0]), cr(am.c[1], a.c[1], b.c[1], bp.c[1]), 0],
          rx: cr(am.rx, a.rx, b.rx, bp.rx),
          ry: cr(am.ry, a.ry, b.ry, bp.ry),
        });
      }
    }
    out.push(stations[stations.length - 1]);
    return out;
  }

  /* ---------------------------------------------------------
     The sweater: the same body, offset outwards, with the leg
     openings actually cut out of the surface.
     --------------------------------------------------------- */
  const SECTIONS = [
    { key: "collar", name: "Collar — 2×2 rib", colour: [0.86, 0.60, 0.13] },
    { key: "rise", name: "Chest increases", colour: [0.30, 0.56, 0.38] },
    { key: "legs", name: "Leg openings", colour: [0.18, 0.42, 0.66] },
    { key: "waist", name: "Waist decreases", colour: [0.80, 0.26, 0.15] },
    { key: "hem", name: "Hem — 2×2 rib", colour: [0.86, 0.60, 0.13] },
  ];

  function sectionAt(x) {
    if (x < 0.155) return 1;          // chest increases
    if (x < 0.290) return 2;          // leg openings
    if (x < 0.640) return 3;          // waist decreases
    return 4;                         // hem
  }

  function buildSweater(opts) {
    const o = Object.assign({ coloured: true, gap: 0.030 }, opts || {});
    const rad = 36;
    const xa = 0.085, xb = 0.760;
    const rings = 64;
    const stations = [];
    for (let i = 0; i < rings; i++) {
      const x = xa + (xb - xa) * (i / (rings - 1));
      const t = torsoAt(x);
      stations.push({ c: [x, t.cy, 0], rx: t.rx + o.gap, ry: t.ry + o.gap, x });
    }

    /* two openings, low on each side, level with the elbow */
    const holeX = [0.150, 0.268];
    const holeA = [-62 * DEG, -118 * DEG];
    const holeHalf = 21 * DEG;
    function hole(i, j) {
      const x = stations[i].x, x2 = stations[Math.min(rings - 1, i + 1)].x;
      if (x2 < holeX[0] || x > holeX[1]) return false;
      const a = (j / rad) * Math.PI * 2;
      return holeA.some((h) => {
        let d = a - (h + Math.PI * 2);
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.abs(d) < holeHalf;
      });
    }

    const body = G.loft(stations, rad, {
      capStart: false, capEnd: false, hole,
      colorAt: (i) => o.coloured ? SECTIONS[sectionAt(stations[i].x)].colour : [0.68, 0.27, 0.18],
    });

    /* collar: a rib tube around the neck */
    const collar = G.loft(NECK.slice(0, 3).map((s, i) => ({
      c: s.p, rx: s.w / 2 + o.gap, ry: s.h / 2 + o.gap,
    })), 26, { capStart: false, capEnd: false });
    collar.color = SECTIONS[0].colour;

    return { body, collar };
  }

  function torsoAt(x) {
    for (let i = 0; i < TORSO.length - 1; i++) {
      const a = TORSO[i], b = TORSO[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x);
        const s = t * t * (3 - 2 * t);
        return {
          rx: (a.w + (b.w - a.w) * s) / 2,
          ry: (a.h + (b.h - a.h) * s) / 2,
          cy: a.cy + (b.cy - a.cy) * s,
        };
      }
    }
    const l = TORSO[TORSO.length - 1];
    return { rx: l.w / 2, ry: l.h / 2, cy: l.cy };
  }

  /* ---------------------------------------------------------
     Mount
     --------------------------------------------------------- */
  function mount(host, opts) {
    const o = Object.assign({
      sweater: true, coloured: true, measures: false, controls: true, legend: true,
      label: "Interactive 3D model of a Basenji wearing the sweater",
    }, opts || {});

    const scene = window.KFZGL.create(host, {
      distance: 3, phi: 0.10, theta: -0.42, fov: 34,
      minDist: 0.7, maxDist: 12, label: o.label,
    });
    if (!scene) return null;

    const state = { sweater: o.sweater, coloured: o.coloured, measures: o.measures };
    let legend, framed = false;

    function rebuild() {
      scene.clear();
      const sh = groundShadow();
      scene.add({ positions: sh.positions, normals: sh.normals, indices: sh.indices, color: [0.05, 0.04, 0.03], opacity: 0.22 });
      const dog = buildDog();
      scene.add({ positions: dog.positions, normals: dog.normals, colors: dog.colors, indices: dog.indices });

      if (state.sweater) {
        const sw = buildSweater({ coloured: state.coloured });
        scene.add({
          positions: sw.body.positions, normals: sw.body.normals,
          colors: sw.body.colors, indices: sw.body.indices, doubleSided: true,
        });
        scene.add({
          positions: sw.collar.positions, normals: sw.collar.normals,
          indices: sw.collar.indices, color: SECTIONS[0].colour, doubleSided: true,
        });
      }

      if (state.measures) {
        const ring = (x, colour, text, lift, side) => {
          const t = torsoAt(x);
          const pts = [];
          for (let k = 0; k <= 64; k++) {
            const a = (k / 64) * Math.PI * 2;
            pts.push([x, t.cy + Math.sin(a) * (t.ry + 0.022), Math.cos(a) * (t.rx + 0.022)]);
          }
          const m = G.tube(pts, 0.007, 6);
          m.color = colour;
          scene.add({ positions: m.positions, normals: m.normals, indices: m.indices, color: colour });
          scene.addLabel([x, t.cy + t.ry + lift, side], text, colour === MEAS_B ? "indigo" : "sage");
        };
        /* stagger the heights, or they stack on top of each other head-on */
        ring(0.115, MEAS_A, "A · neck", 0.30, -0.34);
        ring(0.300, MEAS_B, "B · chest girth", 0.06, 0.36);
        ring(0.700, MEAS_A, "D · waist", 0.26, -0.36);
        scene.addLabel([0.46, 1.27, 0], "C · back length", "indigo");
        scene.addLabel([1.14, 0.84, 0.14], "tail stays free", "ochre");
      }

      /* frame once only — re-framing on every toggle would throw away a
         zoom the reader deliberately set */
      if (!framed) { scene.frame(1.02); scene.cam.target[1] += 0.02; framed = true; }
      if (legend) {
        legend.innerHTML = state.sweater && state.coloured
          ? SECTIONS.filter((s, i) => i > 0).map((s) =>
            `<span style="display:inline-flex;align-items:center;gap:.4rem;margin-right:1rem">
               <i style="width:12px;height:12px;border-radius:3px;background:rgb(${s.colour.map((c) => Math.round(c * 255)).join(",")})"></i>${s.name}</span>`).join("")
            + `<span style="display:inline-flex;align-items:center;gap:.4rem"><i style="width:12px;height:12px;border-radius:3px;background:rgb(199,143,41)"></i>Collar &amp; hem — 2×2 rib</span>`
          : "<span style='opacity:.75'>A Basenji at 1.00 H long by 1.00 H tall — the breed is square. Chest depth 0.47 H, waist 65% of the chest girth. That drop is why the sweater has waist shaping.</span>";
      }
      scene.invalidate();
    }

    if (o.controls) {
      const bar = document.createElement("div");
      bar.className = "gl-controls";
      const grp = document.createElement("div");
      grp.className = "grp";
      const mk = (text, on, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.classList.toggle("on", !!on);
        b.setAttribute("aria-pressed", String(!!on));
        b.addEventListener("click", () => { fn(b); rebuild(); });
        grp.appendChild(b);
        return b;
      };
      const press = (b, on) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); };
      mk("Sweater on", state.sweater, (b) => { state.sweater = !state.sweater; press(b, state.sweater); b.textContent = state.sweater ? "Sweater on" : "Sweater off"; });
      mk("Pattern sections", state.coloured, (b) => { state.coloured = !state.coloured; press(b, state.coloured); });
      mk("Measuring rings", state.measures, (b) => { state.measures = !state.measures; press(b, state.measures); });
      bar.appendChild(grp);
      const reset = document.createElement("button");
      reset.textContent = "Reset view";
      reset.style.borderColor = "var(--line-2)";
      reset.addEventListener("click", () => scene.home());
      bar.appendChild(reset);
      host.appendChild(bar);
    }

    if (o.legend) {
      legend = document.createElement("div");
      legend.className = "gl-readout";
      host.appendChild(legend);
    }

    rebuild();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", rebuild);
    return { scene, rebuild, state };
  }

  const MEAS_A = [0.36, 0.51, 0.39];
  const MEAS_B = [0.24, 0.40, 0.55];

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-dog3d]").forEach((n) => {
      let o = {};
      try { o = JSON.parse(n.getAttribute("data-dog3d") || "{}"); } catch (e) {}
      mount(n, o);
    });
  });

  window.Dog3D = { mount, buildDog, buildSweater, TORSO, torsoAt, SECTIONS };
})();
