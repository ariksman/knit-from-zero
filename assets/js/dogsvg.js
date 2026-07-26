/* =========================================================
   Knit From Zero — dogsvg.js
   A Basenji, drawn in SVG, with optional measuring lines and
   an optional sweater layered on top.
   viewBox is 0 0 640 440; the ground is at y = 400 and the
   withers at y = 150, so 250 units ≈ 42 cm of real dog.
   ========================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a, txt) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    return e;
  };

  const COAT = "#B26234";
  const COAT_DK = "#8E4A24";
  const CREAM = "#F7EFE2";
  const OUTL = "rgba(36,30,25,.62)";

  /* ---- silhouette paths ---- */
  const BODY = `
    M 138 152
    C 170 182, 188 216, 196 248
    C 200 272, 212 288, 234 290
    C 280 292, 330 280, 368 256
    C 398 240, 420 240, 438 248
    C 458 240, 470 208, 462 180
    C 457 165, 448 157, 432 156
    C 400 146, 330 139, 250 146
    C 236 147, 226 149, 218 152
    C 196 150, 170 128, 150 104
    C 146 98, 141 94, 135 92
    C 118 88, 104 95, 96 105
    C 86 109, 68 113, 56 119
    C 49 122, 49 129, 58 132
    C 74 137, 92 141, 108 143
    C 122 147, 132 150, 138 152 Z`;

  const LEG_FRONT_NEAR = `
    M 224 260 C 236 262, 244 272, 243 292
    L 240 372 C 240 386, 246 394, 252 398
    L 220 398 C 214 394, 213 386, 214 372
    L 212 292 C 211 274, 214 264, 224 260 Z`;
  const LEG_FRONT_FAR = `
    M 196 258 C 206 260, 212 270, 211 290
    L 208 368 C 208 382, 213 390, 219 394
    L 191 394 C 185 390, 184 382, 185 368
    L 183 290 C 182 272, 186 260, 196 258 Z`;
  const LEG_BACK_NEAR = `
    M 424 232 C 448 238, 458 262, 450 288
    C 444 308, 428 316, 428 330
    L 430 372 C 430 386, 436 394, 442 398
    L 410 398 C 404 394, 403 386, 404 372
    L 402 330 C 400 312, 412 300, 414 282
    C 416 262, 412 244, 424 232 Z`;
  const LEG_BACK_FAR = `
    M 400 236 C 420 242, 428 264, 421 288
    C 416 304, 402 312, 402 326
    L 404 366 C 404 380, 409 388, 415 392
    L 387 392 C 381 388, 380 380, 381 366
    L 379 326 C 377 310, 387 300, 389 284
    C 391 266, 388 246, 400 236 Z`;

  const TAIL = `
    M 430 158
    C 462 140, 486 156, 484 180
    C 482 202, 458 212, 444 198
    C 432 186, 440 170, 454 172
    C 464 174, 466 184, 460 188`;

  const EAR_FAR = `M 112 104 C 108 84, 114 62, 126 52 C 136 62, 142 86, 140 106 Z`;
  const EAR_NEAR = `M 132 100 C 128 78, 136 54, 150 44 C 162 56, 168 84, 165 104 Z`;

  function draw(target, opts) {
    const o = Object.assign({ sweater: false, measures: [], legMarks: false, caption: null }, opts || {});
    const svg = el("svg", {
      viewBox: "0 0 640 440", style: "width:100%;display:block",
      role: "img", "aria-label": o.caption || "Side view of a Basenji",
    });

    const defs = el("defs");
    const grad = el("linearGradient", { id: "kfz-coat", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.append(el("stop", { offset: "0", "stop-color": COAT }), el("stop", { offset: "1", "stop-color": COAT_DK }));
    defs.appendChild(grad);
    const mk = el("marker", { id: "kfz-dim", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--indigo)" }));
    defs.appendChild(mk);
    svg.appendChild(defs);

    /* ground shadow */
    svg.appendChild(el("ellipse", { cx: 320, cy: 404, rx: 168, ry: 12, fill: "var(--ink)", opacity: ".08" }));

    /* far legs and far ear sit behind everything */
    const back = el("g", { opacity: ".82" });
    back.append(
      el("path", { d: LEG_BACK_FAR, fill: COAT_DK, stroke: OUTL, "stroke-width": 2 }),
      el("path", { d: LEG_FRONT_FAR, fill: COAT_DK, stroke: OUTL, "stroke-width": 2 }),
      el("path", { d: EAR_FAR, fill: COAT_DK, stroke: OUTL, "stroke-width": 2, "stroke-linejoin": "round" })
    );
    svg.appendChild(back);

    /* tail */
    svg.appendChild(el("path", { d: TAIL, fill: "none", stroke: COAT, "stroke-width": 15, "stroke-linecap": "round" }));
    svg.appendChild(el("path", { d: TAIL, fill: "none", stroke: OUTL, "stroke-width": 17.5, "stroke-linecap": "round", opacity: ".28" }));
    svg.appendChild(el("path", { d: TAIL, fill: "none", stroke: COAT, "stroke-width": 14, "stroke-linecap": "round" }));

    /* body */
    svg.appendChild(el("path", { d: BODY, fill: "url(#kfz-coat)", stroke: OUTL, "stroke-width": 2.4, "stroke-linejoin": "round" }));

    /* white chest + blaze + socks */
    const white = el("g", { fill: CREAM, stroke: OUTL, "stroke-width": 1.6 });
    white.appendChild(el("path", { d: "M 196 244 C 206 258, 214 276, 232 286 C 244 288, 250 278, 246 264 C 240 246, 224 232, 208 228 C 198 230, 194 236, 196 244 Z" }));
    /* blaze up the muzzle */
    white.appendChild(el("path", { d: "M 72 116 C 82 110, 94 102, 105 95 C 110 99, 108 106, 100 112 C 90 118, 79 122, 71 121 Z", "stroke-width": 1.2 }));
    svg.appendChild(white);

    /* near legs */
    svg.append(
      el("path", { d: LEG_BACK_NEAR, fill: COAT, stroke: OUTL, "stroke-width": 2.2 }),
      el("path", { d: LEG_FRONT_NEAR, fill: COAT, stroke: OUTL, "stroke-width": 2.2 })
    );
    /* white socks */
    const socks = el("g", { fill: CREAM, stroke: OUTL, "stroke-width": 1.5 });
    socks.append(
      el("path", { d: "M 214 366 L 243 366 L 244 380 C 244 390, 250 396, 254 398 L 218 398 C 214 394, 213 386, 213 378 Z" }),
      el("path", { d: "M 404 366 L 430 366 L 431 380 C 431 390, 437 396, 442 398 L 408 398 C 404 394, 403 386, 403 378 Z" }),
      el("path", { d: "M 456 186 C 466 180, 472 186, 470 194 C 466 202, 456 202, 452 196 Z", "stroke-width": 1.2 })
    );
    svg.appendChild(socks);

    /* near ear */
    svg.appendChild(el("path", { d: EAR_NEAR, fill: COAT, stroke: OUTL, "stroke-width": 2.2, "stroke-linejoin": "round" }));
    svg.appendChild(el("path", { d: "M 140 98 C 138 82, 144 64, 151 55 C 157 65, 159 84, 157 100 Z", fill: COAT_DK, opacity: ".55" }));

    /* face */
    const face = el("g");
    face.appendChild(el("ellipse", { cx: 106, cy: 110, rx: 6.4, ry: 5.2, fill: "#2A1C12", transform: "rotate(-12 106 110)" }));
    face.appendChild(el("circle", { cx: 104.2, cy: 108, r: 1.8, fill: "#fff", opacity: ".85" }));
    face.appendChild(el("path", { d: "M 52 121 C 46 122, 45 129, 52 131 C 58 132, 60 126, 57 122 Z", fill: "#2A1C12" }));
    face.appendChild(el("path", { d: "M 60 130 C 68 136, 78 137, 86 134", fill: "none", stroke: "#2A1C12", "stroke-width": 1.8, "stroke-linecap": "round" }));
    /* the famous forehead wrinkles */
    const wr = el("g", { fill: "none", stroke: COAT_DK, "stroke-width": 1.8, "stroke-linecap": "round", opacity: ".75" });
    wr.append(
      el("path", { d: "M 100 96 C 110 92, 120 92, 128 95" }),
      el("path", { d: "M 99 102 C 109 98, 119 98, 127 101" }),
      el("path", { d: "M 101 89 C 110 86, 118 86, 125 88" })
    );
    face.appendChild(wr);
    svg.appendChild(face);

    /* ---- the sweater ---- */
    if (o.sweater) {
      const sw = el("g");
      sw.appendChild(el("path", {
        d: `M 176 168 C 200 150, 250 143, 320 143
            C 372 143, 410 148, 428 158
            C 444 172, 446 208, 434 240
            C 420 254, 396 250, 372 254
            C 330 278, 280 291, 234 289
            C 214 286, 202 272, 197 250
            C 192 216, 178 190, 176 168 Z`,
        fill: "var(--rust)", opacity: ".92", stroke: "var(--ink)", "stroke-width": 2, "stroke-linejoin": "round",
      }));
      /* collar — a band wrapping across the neck */
      sw.appendChild(el("path", {
        d: `M 156 156 C 148 138, 154 118, 168 106
            C 180 112, 194 120, 205 130
            C 200 150, 202 172, 210 192
            C 190 196, 168 182, 156 156 Z`,
        fill: "var(--ochre)", stroke: "var(--ink)", "stroke-width": 2, "stroke-linejoin": "round",
      }));
      const cr = el("g", { stroke: "rgba(0,0,0,.28)", "stroke-width": 1.5, fill: "none", "stroke-linecap": "round" });
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        cr.appendChild(el("path", { d: `M ${157 + t * 47} ${152 - t * 44} C ${161 + t * 44} ${164 - t * 40}, ${168 + t * 40} ${178 - t * 38}, ${178 + t * 33} ${188 - t * 40}` }));
      }
      sw.appendChild(cr);
      /* leg opening — you see the dog through it */
      sw.appendChild(el("ellipse", { cx: 227, cy: 276, rx: 20, ry: 13, fill: COAT_DK, stroke: "var(--ink)", "stroke-width": 2, transform: "rotate(-18 227 276)" }));
      /* hem rib lines */
      const rib = el("g", { stroke: "var(--ink)", "stroke-width": 1.4, opacity: ".45", fill: "none" });
      for (let i = 0; i < 7; i++) rib.appendChild(el("path", { d: `M ${420 + i * 3} ${168 + i * 2} C ${432 + i * 2} ${190}, ${430 + i * 2} ${222}, ${418 + i * 3} ${242}` }));
      sw.appendChild(rib);
      /* knit texture on the body */
      const tex = el("g", { stroke: "rgba(0,0,0,.16)", "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" });
      for (let row = 0; row < 7; row++) {
        for (let c = 0; c < 12; c++) {
          const x = 205 + c * 18, y = 160 + row * 15 + (c % 2) * 1;
          if (x > 424 || y > 246 - (x - 300) * 0.06) continue;
          tex.appendChild(el("path", { d: `M ${x} ${y} L ${x + 6} ${y + 11} L ${x + 12} ${y}` }));
        }
      }
      sw.appendChild(tex);
      svg.appendChild(sw);
    }

    /* ---- measuring lines ---- */
    const M = {
      neck: { d: "M 170 108 C 200 96, 224 118, 214 152 C 200 176, 168 168, 164 140 C 162 124, 164 114, 170 108 Z", label: "A · Neck", lx: 150, ly: 96, anchor: "end" },
      chest: { d: "M 250 138 C 292 130, 300 200, 282 258 C 264 300, 220 300, 210 254 C 200 202, 216 146, 250 138 Z", label: "B · Chest girth", lx: 300, ly: 122, anchor: "start" },
      waist: { d: "M 372 146 C 404 142, 408 200, 392 240 C 378 268, 344 266, 340 232 C 336 196, 346 152, 372 146 Z", label: "D · Waist girth", lx: 420, ly: 132, anchor: "start" },
    };
    o.measures.forEach((m) => {
      if (M[m]) {
        svg.appendChild(el("path", { d: M[m].d, fill: "none", stroke: "var(--indigo)", "stroke-width": 3, "stroke-dasharray": "10 7", "stroke-linecap": "round" }));
        svg.appendChild(el("text", { x: M[m].lx, y: M[m].ly, "font-size": 17, "font-family": "var(--mono)", "font-weight": 600, fill: "var(--indigo)", "text-anchor": M[m].anchor }, M[m].label));
      }
      if (m === "back") {
        svg.appendChild(el("path", {
          d: "M 214 128 C 260 116, 340 112, 434 128", fill: "none",
          stroke: "var(--indigo)", "stroke-width": 3, "marker-start": "url(#kfz-dim)", "marker-end": "url(#kfz-dim)",
        }));
        svg.appendChild(el("text", { x: 324, y: 104, "font-size": 17, "font-family": "var(--mono)", "font-weight": 600, fill: "var(--indigo)", "text-anchor": "middle" }, "C · Back length"));
      }
      if (m === "leg") {
        svg.appendChild(el("path", { d: "M 226 254 m -26 0 a 26 15 0 1 0 52 0 a 26 15 0 1 0 -52 0", fill: "none", stroke: "var(--rust)", "stroke-width": 3, "stroke-dasharray": "8 6" }));
        svg.appendChild(el("text", { x: 226, y: 316, "font-size": 16, "font-family": "var(--mono)", "font-weight": 600, fill: "var(--rust)", "text-anchor": "middle" }, "E · Front leg"));
      }
    });

    if (o.caption) {
      svg.appendChild(el("text", { x: 320, y: 430, "font-size": 15, "font-family": "var(--sans)", fill: "var(--ink-3)", "text-anchor": "middle" }, o.caption));
    }

    target.innerHTML = "";
    target.appendChild(svg);
    return svg;
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-dog]").forEach((n) => {
      let o = {};
      try { o = JSON.parse(n.getAttribute("data-dog") || "{}"); } catch (e) {}
      draw(n, o);
    });
  });

  window.KnitDog = { draw };
})();
