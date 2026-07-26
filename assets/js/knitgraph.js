/* =========================================================
   Knit From Zero — knitgraph.js
   Procedural SVG drawing of knitted fabric, charts and swatches.
   Everything is generated from stitch geometry, so it scales
   infinitely and re-colours with the theme.
   ========================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

  /* ---------------------------------------------------------
     One knit stitch, drawn face-on: the familiar "V".
     Two curved legs that flare out at the top where they hook
     into the row above.
     --------------------------------------------------------- */
  function knitV(g, x, y, w, h, colour, sw) {
    const cx = x + w / 2;
    // left leg: starts wide at the top, sweeps to the point at bottom centre
    g.appendChild(el("path", {
      d: `M ${x - w * 0.06} ${y + h * 0.02}
          C ${x + w * 0.10} ${y + h * 0.30}, ${cx - w * 0.10} ${y + h * 0.55}, ${cx} ${y + h * 0.90}`,
      fill: "none", stroke: colour, "stroke-width": sw, "stroke-linecap": "round",
    }));
    // right leg
    g.appendChild(el("path", {
      d: `M ${x + w * 1.06} ${y + h * 0.02}
          C ${x + w * 0.90} ${y + h * 0.30}, ${cx + w * 0.10} ${y + h * 0.55}, ${cx} ${y + h * 0.90}`,
      fill: "none", stroke: colour, "stroke-width": sw, "stroke-linecap": "round",
    }));
  }

  /* One purl stitch, face-on: a horizontal bump sitting on a bar. */
  function purlBump(g, x, y, w, h, colour, sw) {
    g.appendChild(el("path", {
      d: `M ${x - w * 0.02} ${y + h * 0.68}
          C ${x + w * 0.10} ${y + h * 0.20}, ${x + w * 0.90} ${y + h * 0.20}, ${x + w * 1.02} ${y + h * 0.68}`,
      fill: "none", stroke: colour, "stroke-width": sw, "stroke-linecap": "round",
    }));
    g.appendChild(el("path", {
      d: `M ${x + w * 0.16} ${y + h * 0.94} L ${x + w * 0.84} ${y + h * 0.94}`,
      fill: "none", stroke: colour, "stroke-width": sw * 0.72,
      "stroke-linecap": "round", opacity: ".55",
    }));
  }

  /* ---------------------------------------------------------
     fabric(target, opts)
       type: stockinette | reverse | garter | rib1x1 | rib2x2 | seed | purlside
     --------------------------------------------------------- */
  function fabric(target, opts) {
    const o = Object.assign({
      type: "stockinette", cols: 10, rows: 7, cell: 26,
      colour: "var(--yarn-a)", colour2: null, label: null, ribPull: true,
    }, opts || {});

    const w = o.cell, h = o.cell * 0.78, sw = Math.max(2.4, w * 0.20);
    const pad = w * 0.5;

    // Ribbing visually pulls in: narrow the purl columns.
    const isRib = o.type === "rib1x1" || o.type === "rib2x2";
    const colW = [];
    for (let c = 0; c < o.cols; c++) {
      let purl = false;
      if (o.type === "rib1x1") purl = c % 2 === 1;
      if (o.type === "rib2x2") purl = c % 4 >= 2;
      colW.push(isRib && o.ribPull && purl ? w * 0.52 : w);
    }
    const totalW = colW.reduce((a, b) => a + b, 0);

    const svg = el("svg", {
      viewBox: `0 0 ${totalW + pad * 2} ${o.rows * h + pad * 2}`,
      role: "img", "aria-label": o.label || (o.type + " fabric"),
      style: "width:100%;display:block",
    });
    const g = el("g", { transform: `translate(${pad},${pad})` });
    svg.appendChild(g);

    for (let r = 0; r < o.rows; r++) {
      let x = 0;
      for (let c = 0; c < o.cols; c++) {
        const cw = colW[c];
        const y = r * h;
        let purl = false;
        switch (o.type) {
          case "stockinette": purl = false; break;
          case "reverse": case "purlside": purl = true; break;
          case "garter": purl = r % 2 === 1; break;
          case "rib1x1": purl = c % 2 === 1; break;
          case "rib2x2": purl = c % 4 >= 2; break;
          case "seed": purl = (r + c) % 2 === 1; break;
        }
        const col = o.colour2 && r % 2 === 1 ? o.colour2 : o.colour;
        if (purl) purlBump(g, x, y, cw, h, col, sw);
        else knitV(g, x, y, cw, h, col, sw);
        x += cw;
      }
    }
    target.innerHTML = "";
    target.appendChild(svg);
    return svg;
  }

  /* ---------------------------------------------------------
     chart(target, opts) — a knitting chart grid.
     grid: array of strings, bottom row LAST (as printed).
     Symbols:  .=knit  p=purl  /=k2tog  \=ssk  o=yo  m=M1
               x=no stitch  v=slip  b=bobble
     --------------------------------------------------------- */
  const SYMBOLS = {
    ".": { name: "knit (RS) / purl (WS)", draw: () => [] },
    "p": { name: "purl (RS) / knit (WS)", draw: (c, s) => [el("circle", { cx: c + s / 2, cy: c + s / 2, r: s * 0.13, fill: "var(--ink)" })] },
    "/": { name: "k2tog — right-leaning decrease", draw: (c, s) => [el("path", { d: `M ${c + s * 0.22} ${c + s * 0.78} L ${c + s * 0.78} ${c + s * 0.22}`, stroke: "var(--ink)", "stroke-width": s * 0.1, "stroke-linecap": "round" })] },
    "\\": { name: "ssk — left-leaning decrease", draw: (c, s) => [el("path", { d: `M ${c + s * 0.22} ${c + s * 0.22} L ${c + s * 0.78} ${c + s * 0.78}`, stroke: "var(--ink)", "stroke-width": s * 0.1, "stroke-linecap": "round" })] },
    "o": { name: "yarn over", draw: (c, s) => [el("circle", { cx: c + s / 2, cy: c + s / 2, r: s * 0.27, fill: "none", stroke: "var(--ink)", "stroke-width": s * 0.09 })] },
    "m": { name: "make one (M1)", draw: (c, s) => [el("path", { d: `M ${c + s * 0.25} ${c + s * 0.68} Q ${c + s * 0.5} ${c + s * 0.22} ${c + s * 0.75} ${c + s * 0.68}`, fill: "none", stroke: "var(--ink)", "stroke-width": s * 0.09 })] },
    "v": { name: "slip stitch purlwise", draw: (c, s) => [el("path", { d: `M ${c + s * 0.28} ${c + s * 0.28} L ${c + s * 0.5} ${c + s * 0.72} L ${c + s * 0.72} ${c + s * 0.28}`, fill: "none", stroke: "var(--ink)", "stroke-width": s * 0.09, "stroke-linejoin": "round" })] },
    "b": { name: "bobble", draw: (c, s) => [el("circle", { cx: c + s / 2, cy: c + s / 2, r: s * 0.26, fill: "var(--ochre)" })] },
    "x": { name: "no stitch", draw: (c, s) => [el("path", { d: `M ${c} ${c} L ${c + s} ${c + s} M ${c + s} ${c} L ${c} ${c + s}`, stroke: "var(--ink-3)", "stroke-width": s * 0.06, opacity: ".5" })] },
  };

  function chart(target, opts) {
    const o = Object.assign({ grid: [], cell: 30, showLegend: true, rsStarts: "right" }, opts || {});
    const rows = o.grid.length, cols = Math.max(...o.grid.map((r) => r.length));
    const s = o.cell, gut = s * 1.35, pad = 6;
    const W = cols * s + gut + pad * 2, H = rows * s + gut + pad * 2;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;max-width:" + W * 1.2 + "px;display:block", role: "img", "aria-label": "knitting chart" });
    const g = el("g", { transform: `translate(${pad},${pad})` });
    svg.appendChild(g);

    g.appendChild(el("rect", { x: gut, y: 0, width: cols * s, height: rows * s, fill: "var(--paper)", stroke: "var(--line-2)", "stroke-width": 1.5 }));

    const used = new Set();
    for (let r = 0; r < rows; r++) {
      const line = o.grid[r];
      const rowNum = rows - r;
      for (let c = 0; c < cols; c++) {
        const ch = line[c] || ".";
        used.add(ch);
        const x = gut + c * s, y = r * s;
        g.appendChild(el("rect", { x, y, width: s, height: s, fill: "none", stroke: "var(--line)", "stroke-width": 1 }));
        const def = SYMBOLS[ch];
        if (def) def.draw(0, s).forEach((n) => { n.setAttribute("transform", `translate(${x},${y})`); g.appendChild(n); });
      }
      // row number on the side the row is read from
      const rightSide = rowNum % 2 === 1;
      const tx = rightSide ? gut + cols * s + s * 0.35 : gut - s * 0.35;
      const t = el("text", {
        x: tx, y: r * s + s * 0.68, "font-size": s * 0.42, fill: "var(--ink-3)",
        "font-family": "var(--mono)", "text-anchor": rightSide ? "start" : "end",
      });
      t.textContent = rowNum;
      g.appendChild(t);
    }
    // column numbers along the bottom, right to left
    for (let c = 0; c < cols; c++) {
      const t = el("text", {
        x: gut + (cols - 1 - c) * s + s / 2, y: rows * s + s * 0.62,
        "font-size": s * 0.38, fill: "var(--ink-3)", "font-family": "var(--mono)", "text-anchor": "middle",
      });
      t.textContent = c + 1;
      g.appendChild(t);
    }

    target.innerHTML = "";
    target.appendChild(svg);

    if (o.showLegend) {
      const box = document.createElement("div");
      box.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem 1.1rem;margin-top:.9rem;font-size:.82rem;color:var(--ink-2)";
      [...used].forEach((ch) => {
        if (!SYMBOLS[ch]) return;
        const item = document.createElement("span");
        item.style.cssText = "display:inline-flex;align-items:center;gap:.4rem";
        const mini = el("svg", { viewBox: `0 0 ${s} ${s}`, width: 22, height: 22 });
        mini.appendChild(el("rect", { x: 0.5, y: 0.5, width: s - 1, height: s - 1, fill: "var(--paper)", stroke: "var(--line-2)" }));
        SYMBOLS[ch].draw(0, s).forEach((n) => mini.appendChild(n));
        item.appendChild(mini);
        item.appendChild(document.createTextNode(SYMBOLS[ch].name));
        box.appendChild(item);
      });
      target.appendChild(box);
    }
    return svg;
  }

  /* ---------------------------------------------------------
     gaugeSwatch(target, {sts, rows}) — a swatch with a 10 cm ruler
     laid over it, so the count is visible, not just stated.
     --------------------------------------------------------- */
  function gaugeSwatch(target, opts) {
    const o = Object.assign({ sts: 22, rows: 30, colour: "var(--yarn-a)" }, opts || {});
    const box = 320;                 // 10 cm rendered as 320 units
    const cw = box / o.sts, ch = box / o.rows;
    const pad = 46;
    const svg = el("svg", { viewBox: `0 0 ${box + pad * 2} ${box + pad * 2}`, style: "width:100%;max-width:440px;display:block" });

    const g = el("g", { transform: `translate(${pad},${pad})` });
    svg.appendChild(g);
    const sw = Math.max(1.6, cw * 0.2);
    for (let r = 0; r < o.rows; r++)
      for (let c = 0; c < o.sts; c++)
        knitV(g, c * cw, r * ch, cw, ch, o.colour, sw);

    // 10 cm measuring frame
    g.appendChild(el("rect", { x: 0, y: 0, width: box, height: box, fill: "none", stroke: "var(--indigo)", "stroke-width": 3, "stroke-dasharray": "9 6" }));

    const arrow = (x1, y1, x2, y2) => {
      g.appendChild(el("path", { d: `M ${x1} ${y1} L ${x2} ${y2}`, stroke: "var(--indigo)", "stroke-width": 2.4, "marker-start": "url(#kfz-a)", "marker-end": "url(#kfz-a)" }));
    };
    const defs = el("defs");
    const mk = el("marker", { id: "kfz-a", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--indigo)" }));
    defs.appendChild(mk); svg.appendChild(defs);
    arrow(0, -20, box, -20);
    arrow(-20, 0, -20, box);

    const t1 = el("text", { x: box / 2, y: -28, "text-anchor": "middle", "font-size": 20, fill: "var(--indigo)", "font-family": "var(--mono)", "font-weight": "600" });
    t1.textContent = `10 cm = ${o.sts} sts`;
    const t2 = el("text", { x: -28, y: box / 2, "text-anchor": "middle", "font-size": 20, fill: "var(--indigo)", "font-family": "var(--mono)", "font-weight": "600", transform: `rotate(-90 ${-28} ${box / 2})` });
    t2.textContent = `10 cm = ${o.rows} rows`;
    g.append(t1, t2);

    target.innerHTML = "";
    target.appendChild(svg);
    return svg;
  }

  /* ---------------------------------------------------------
     schematic(target, dims) — the sweater flat-plan with live
     numbers from the pattern generator.
     --------------------------------------------------------- */
  function schematic(target, d) {
    const W = 760, H = 430;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;display:block", role: "img", "aria-label": "sweater schematic" });

    const line = (x1, y1, x2, y2, o) => el("path", Object.assign({ d: `M ${x1} ${y1} L ${x2} ${y2}`, stroke: "var(--ink-3)", "stroke-width": 1.2 }, o || {}));
    const txt = (x, y, s, o) => { const t = el("text", Object.assign({ x, y, "font-size": 13, fill: "var(--ink-2)", "font-family": "var(--mono)", "text-anchor": "middle" }, o || {})); t.textContent = s; return t; };

    // tube laid flat: collar at left, hem at right
    const x0 = 120, x1 = 660, yTop = 110, yBot = 300;
    const collarH = 54, chestH = 190, waistH = 150;

    const body = el("path", {
      d: `M ${x0} ${205 - collarH / 2}
          L ${x0 + 90} ${205 - chestH / 2}
          L ${x0 + 330} ${205 - chestH / 2}
          L ${x1} ${205 - waistH / 2}
          L ${x1} ${205 + waistH / 2}
          L ${x0 + 330} ${205 + chestH / 2}
          L ${x0 + 90} ${205 + chestH / 2}
          L ${x0} ${205 + collarH / 2} Z`,
      fill: "var(--rust-soft)", stroke: "var(--rust)", "stroke-width": 2.5, "stroke-linejoin": "round",
    });
    svg.appendChild(body);

    // collar ribbing block
    svg.appendChild(el("rect", { x: x0, y: 205 - collarH / 2, width: 62, height: collarH, fill: "var(--ochre-soft)", stroke: "var(--rust)", "stroke-width": 1.4 }));
    // hem ribbing block
    svg.appendChild(el("rect", { x: x1 - 62, y: 205 - waistH / 2 + 4, width: 62, height: waistH - 8, fill: "var(--ochre-soft)", stroke: "var(--rust)", "stroke-width": 1.4 }));

    // leg openings
    [205 - chestH / 2 + 26, 205 + chestH / 2 - 60].forEach((y) => {
      svg.appendChild(el("rect", { x: x0 + 132, y, width: 74, height: 34, rx: 14, fill: "var(--paper)", stroke: "var(--rust)", "stroke-width": 2 }));
    });
    svg.appendChild(txt(x0 + 169, 209, "leg openings", { "font-size": 11.5, fill: "var(--rust)" }));

    // dimension arrows
    const defs = el("defs");
    const mk = el("marker", { id: "kfz-s", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--indigo)" }));
    defs.appendChild(mk); svg.appendChild(defs);
    const dim = (x1_, y1_, x2_, y2_, label, lx, ly, anchor) => {
      svg.appendChild(line(x1_, y1_, x2_, y2_, { stroke: "var(--indigo)", "stroke-width": 1.6, "marker-start": "url(#kfz-s)", "marker-end": "url(#kfz-s)" }));
      svg.appendChild(txt(lx, ly, label, { fill: "var(--indigo)", "font-size": 12.5, "text-anchor": anchor || "middle" }));
    };

    dim(x0, 52, x1, 52, "length " + d.totalLen, (x0 + x1) / 2, 42);
    dim(x0 - 26, 205 - collarH / 2, x0 - 26, 205 + collarH / 2, d.neck, x0 - 34, 208, "end");
    dim(x0 + 300, 205 - chestH / 2 - 12, x0 + 300, 205 + chestH / 2 + 12, d.chest, x0 + 300, 205 + chestH / 2 + 32);
    dim(x1 + 26, 205 - waistH / 2, x1 + 26, 205 + waistH / 2, d.waist, x1 + 34, 208, "start");

    svg.appendChild(txt(x0 + 31, 205 + collarH / 2 + 22, "collar", { "font-size": 11, fill: "var(--ochre)" }));
    svg.appendChild(txt(x1 - 31, 205 + waistH / 2 + 22, "hem rib", { "font-size": 11, fill: "var(--ochre)" }));
    svg.appendChild(txt(x0 + 430, 205, "back / body — stockinette", { "font-size": 13, fill: "var(--rust)" }));
    svg.appendChild(txt((x0 + x1) / 2, H - 12, "The sweater is one tube, knitted from the collar down. Shown flattened.", { "font-size": 12, fill: "var(--ink-3)" }));

    target.innerHTML = "";
    target.appendChild(svg);
    return svg;
  }

  /* auto-run any [data-fabric] / [data-chart] / [data-swatch] blocks */
  function auto() {
    document.querySelectorAll("[data-fabric]").forEach((n) => {
      let o = {};
      try { o = JSON.parse(n.getAttribute("data-fabric")); } catch (e) { o = { type: n.getAttribute("data-fabric") }; }
      fabric(n, o);
    });
    document.querySelectorAll("[data-chart]").forEach((n) => {
      try { chart(n, JSON.parse(n.getAttribute("data-chart"))); } catch (e) { console.warn("bad chart", e); }
    });
    document.querySelectorAll("[data-swatch]").forEach((n) => {
      try { gaugeSwatch(n, JSON.parse(n.getAttribute("data-swatch") || "{}")); } catch (e) {}
    });
  }
  document.addEventListener("DOMContentLoaded", auto);

  window.KnitGraph = { fabric, chart, gaugeSwatch, schematic, knitV, purlBump, SYMBOLS };
})();
