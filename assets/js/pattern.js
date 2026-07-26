/* =========================================================
   Knit From Zero — pattern.js
   The sizing engine for the Basenji sweater.

   Construction: one piece, top down, in the round.
   collar rib → chest increases → divide for leg openings →
   rejoin → waist shaping → straight → hem rib.

   Every number below is derived from the dog's measurements
   and the knitter's own gauge. Nothing is hard-coded to one size.
   ========================================================= */
(function () {
  "use strict";

  const r = Math.round;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mult = (n, m) => Math.max(m, Math.round(n / m) * m);
  const cm2in = (c) => (c / 2.54).toFixed(1);

  /* Yarn category guessed from stockinette gauge, for the metreage estimate. */
  const YARN_BANDS = [
    { max: 15, name: "Chunky / Bulky", mPer100g: 110, needle: "6–8 mm" },
    { max: 18, name: "Aran / Worsted-heavy", mPer100g: 150, needle: "5–6 mm" },
    { max: 21, name: "Worsted", mPer100g: 180, needle: "4.5–5.5 mm" },
    { max: 24, name: "DK / Light worsted", mPer100g: 220, needle: "3.75–4.5 mm" },
    { max: 27, name: "Sport / 5-ply", mPer100g: 290, needle: "3.25–3.75 mm" },
    { max: 99, name: "4-ply / Fingering", mPer100g: 400, needle: "2.5–3.25 mm" },
  ];

  const DEFAULTS = {
    neck: 36,          // cm, around the base of the neck
    chest: 54,         // cm, deepest point just behind the front legs
    backLength: 42,    // cm, base of neck to base of tail
    stsPer10: 22,      // stockinette gauge
    rowsPer10: 30,
    ease: 1,           // cm of positive ease at the chest
    collarCm: 8,
    hemCm: 5,
    boyNotch: false,
    expressLegs: false,
  };

  function compute(inp) {
    const i = Object.assign({}, DEFAULTS, inp || {});
    const warn = [];

    const spc = i.stsPer10 / 10;   // stitches per cm
    const rpc = i.rowsPer10 / 10;  // rows per cm

    /* ---- collar ------------------------------------------------ */
    // Ribbing is worked with roughly 8% negative ease so it grips.
    const collarCirc = i.neck * 0.92;
    const collarSts = mult(collarCirc * spc, 4);
    const collarRnds = Math.max(8, r(i.collarCm * rpc));

    /* ---- body circumference ------------------------------------ */
    const bodyCirc = i.chest + i.ease;
    let bodySts = mult(bodyCirc * spc, 4);
    if (bodySts <= collarSts + 8) {
      bodySts = collarSts + 12;
      warn.push("The chest and neck measurements are very close. The chest count has been nudged up so there is something to shape.");
    }

    /* ---- chest increase section -------------------------------- */
    const incTotal = bodySts - collarSts;          // always a multiple of 4
    const incRounds = incTotal / 4;                // +4 sts per increase round
    const riseRnds = incRounds * 2 - 1;            // increase round, plain round, …
    const riseCm = riseRnds / rpc;

    /* ---- leg openings ------------------------------------------ */
    // Proportions taken from a standing dog: the front legs sit roughly
    // an eighth of the girth apart, each opening about an eighth wide.
    const legCm = clamp(i.chest * 0.125, 4.5, 9);
    const bridgeCm = clamp(i.chest * 0.11, 4, 8);
    const legDepthCm = clamp(i.chest * 0.115, 4, 8);

    const legSts = Math.max(6, r(legCm * spc));
    let bridgeSts = mult(bridgeCm * spc, 2);
    let backSts = bodySts - 2 * legSts - bridgeSts;
    if (backSts < bodySts * 0.45) {
      bridgeSts = mult(bodySts * 0.1, 2);
      backSts = bodySts - 2 * legSts - bridgeSts;
      warn.push("Leg openings were taking too much of the round, so the belly panel was narrowed.");
    }
    const legRows = mult(legDepthCm * rpc, 2);

    /* ---- waist -------------------------------------------------- */
    const waistCirc = i.chest * 0.84;
    let waistSts = mult(waistCirc * spc, 4);
    if (waistSts >= bodySts) { waistSts = bodySts - 4; }
    const decTotal = bodySts - waistSts;
    const decRounds = decTotal / 4;
    const decRnds = decRounds * 4;                 // decrease round every 4th round
    const decCm = decRnds / rpc;

    /* ---- lengths ------------------------------------------------ */
    // The tube is measured from the bottom of the collar to the hem.
    const garmentCm = i.backLength * 0.93;
    const evenBeforeLegsCm = 1.5;
    const evenRnds = Math.max(2, r(evenBeforeLegsCm * rpc));
    const hemRnds = Math.max(6, r(i.hemCm * rpc));
    const settledCm = riseCm + evenRnds / rpc + legRows / rpc + decCm + i.hemCm;
    let straightCm = garmentCm - settledCm;
    if (straightCm < 0) {
      warn.push("Your dog's back is short relative to its chest, so the plain section has been removed. Shorten the collar or hem if the sweater still comes out long.");
      straightCm = 0;
    }
    const straightRnds = r(straightCm * rpc);
    // legRows covers the divide round and the flat rows; +1 is the rejoin round
    const bodyRndsTotal = riseRnds + evenRnds + legRows + 1 + decRnds + straightRnds + hemRnds;

    /* ---- yarn --------------------------------------------------- */
    const area =
      collarCirc * i.collarCm +
      ((collarCirc + bodyCirc) / 2) * riseCm +
      bodyCirc * (evenRnds / rpc + legRows / rpc) +
      ((bodyCirc + waistCirc) / 2) * decCm +
      waistCirc * (straightCm + i.hemCm) -
      2 * legCm * legDepthCm;
    const gPerCm2 = 0.0887 * rpc / (spc * spc);
    const grams = Math.ceil((area * gPerCm2 * 1.15) / 10) * 10;
    const band = YARN_BANDS.find((b) => i.stsPer10 < b.max) || YARN_BANDS[3];
    const metres = Math.ceil((grams * band.mPer100g) / 100 / 10) * 10;

    /* ---- boy notch ---------------------------------------------- */
    const notchSts = mult(waistSts * 0.42, 4);
    const notchCm = Math.max(4, r(straightCm * 0.45));

    return {
      input: i, warn,
      spc, rpc,
      collar: { circ: collarCirc, sts: collarSts, rnds: collarRnds, cm: i.collarCm },
      body: { circ: bodyCirc, sts: bodySts },
      rise: { incRounds, riseRnds, cm: riseCm, from: collarSts, to: bodySts },
      even: { rnds: evenRnds },
      legs: { sts: legSts, cm: legCm, rows: legRows, depthCm: legRows / rpc, bridgeSts, bridgeCm: bridgeSts / spc, backSts },
      waist: { circ: waistCirc, sts: waistSts, decRounds, rnds: decRnds, cm: decCm },
      straight: { cm: straightCm, rnds: straightRnds },
      hem: { rnds: hemRnds, cm: i.hemCm },
      totals: { bodyRnds: bodyRndsTotal, allRnds: collarRnds + bodyRndsTotal, garmentCm, finishedChest: bodySts / spc, finishedNeck: collarSts / spc, finishedWaist: waistSts / spc },
      yarn: { grams, metres, band: band.name, needle: band.needle, area: Math.round(area) },
      notch: { sts: notchSts, cm: notchCm },
    };
  }

  /* ---------------------------------------------------------------
     Render the computed pattern as HTML.
     --------------------------------------------------------------- */
  function fmt(cm) { return `${cm.toFixed(1)} cm <span style="opacity:.6">(${cm2in(cm)} in)</span>`; }

  function render(p) {
    const i = p.input;
    let rnd = 0;
    const R = (n) => { const s = rnd + 1; rnd += n; return n === 1 ? `Rnd ${s}` : `Rnds ${s}–${rnd}`; };
    const row = (lbl, body) => `<div class="rowline"><span class="lbl">${lbl}</span><span>${body}</span></div>`;

    let h = "";

    h += `<h3>Finished measurements</h3>`;
    h += `<div class="kv"><span class="k">Neck (relaxed rib)</span><span>${fmt(p.totals.finishedNeck)}</span></div>`;
    h += `<div class="kv"><span class="k">Chest</span><span>${fmt(p.totals.finishedChest)}</span></div>`;
    h += `<div class="kv"><span class="k">Waist</span><span>${fmt(p.totals.finishedWaist)}</span></div>`;
    h += `<div class="kv"><span class="k">Length, collar to hem</span><span>${fmt(p.totals.garmentCm)}</span></div>`;
    h += `<div class="kv"><span class="k">Collar depth</span><span>${fmt(p.collar.cm)}</span></div>`;
    h += `<div class="kv"><span class="k">Total rounds</span><span>${p.totals.allRnds}</span></div>`;

    h += `<h3>You will need</h3>`;
    h += `<div class="kv"><span class="k">Yarn</span><span><b>${p.yarn.grams} g</b> ≈ ${p.yarn.metres} m of ${p.yarn.band} weight, machine-washable</span></div>`;
    h += `<div class="kv"><span class="k">Main needles</span><span>circular, 40 cm cable, whatever size gives you ${i.stsPer10} sts / 10 cm (typically ${p.yarn.needle})</span></div>`;
    h += `<div class="kv"><span class="k">Rib needles</span><span>one size smaller, 40 cm circular</span></div>`;
    h += `<div class="kv"><span class="k">Notions</span><span>3 stitch markers (one a different colour for the start of the round), tapestry needle, tape measure</span></div>`;
    h += `<div class="kv"><span class="k">Gauge</span><span>${i.stsPer10} sts &amp; ${i.rowsPer10} rounds = 10 cm in stockinette, in the round, after washing</span></div>`;

    /* --- collar --- */
    h += `<h3>1 · The collar</h3>`;
    h += row("Cast on", `<b>${p.collar.sts} sts</b> with the smaller needles. Join to work in the round, being careful not to twist. Place the beginning-of-round marker.`);
    h += row(R(p.collar.rnds), `*K2, p2; repeat from * to end. <span style="opacity:.7">(2×2 rib, ${p.collar.rnds} rounds ≈ ${p.collar.cm} cm)</span>`);
    h += row("Note", `The beginning of the round sits at the dog's right shoulder. Everything below is counted from here.`);

    /* --- rise --- */
    h += `<h3>2 · Widening over the chest</h3>`;
    h += row("Change", `Swap to the larger needles.`);
    h += row(R(1), `Knit, placing markers as you go: k${Math.round(p.collar.sts / 4)}, <b>pm A</b>, k${Math.round(p.collar.sts / 2)}, <b>pm B</b>, knit to end. <span style="opacity:.7">Markers A and B mark the dog's two sides.</span>`);
    h += row("Increase rnd", `[K to 1 st before marker, M1R, k1, slip marker, k1, M1L] twice, k to end. <b>4 sts increased.</b>`);
    h += row(R(p.rise.riseRnds), `Work the increase round, then one plain knit round, alternately — a total of <b>${p.rise.incRounds} increase rounds</b> (the last one is not followed by a plain round). <b>${p.body.sts} sts.</b>`);
    h += row("Check", `The piece measures about ${fmt(p.rise.cm)} below the collar and ${fmt(p.body.circ)} around.`);

    h += row(R(p.even.rnds), `Knit every round, keeping markers A and B in place.`);

    /* --- legs --- */
    const L = p.legs;
    h += `<h3>3 · Leg openings</h3>`;
    h += row("Before you start", `You are about to split the tube into a wide <b>back panel (${L.backSts} sts)</b> and a narrow <b>belly bridge (${L.bridgeSts} sts)</b>, with a gap at each side for a front leg. Read the whole section first — the diagram in <a href="../lessons/07-in-the-round.html">lesson 7</a> shows exactly what happens. Thread a lifeline through the round below before you start.`);
    h += row(R(1) + " (divide)", `Slip the next ${L.sts} sts onto scrap yarn and leave them — this is leg opening 1. K${L.bridgeSts} (the belly bridge). Slip the next ${L.sts} sts onto scrap yarn — leg opening 2. K${L.backSts} (the back panel). Turn. <b>${L.bridgeSts} sts on the bridge, ${L.backSts} sts on the back, ${L.sts} sts held at each side.</b>`);
    h += row("Why held", `Slipping rather than binding off avoids any counting confusion, and it leaves live stitches that become the top edge of the leg cuff later. Nothing can unravel — scrap yarn holds them perfectly.`);
    h += row("Back panel", `Working back and forth on the ${L.backSts} back-panel sts only, in stockinette (knit RS rows, purl WS rows), begin with a WS row and work until <b>${L.rows} rows</b> in total have been worked since the divide round. End after a WS row. Break the yarn, leaving a 15 cm tail.`);
    h += row("Belly bridge", `Rejoin the yarn to the ${L.bridgeSts} belly-bridge sts at the edge nearest the beginning-of-round marker, right side facing. Knit every row (garter stitch — it will not curl) until the bridge is <b>the same height as the back panel</b>, about ${fmt(L.depthCm)}, ending ready to work a right-side row at that same edge. <span style="opacity:.7">A row more or less will not show in garter; matching the height matters, matching the count does not.</span>`);
    rnd += L.rows - 1; // the flat rows, worked on both panels
    h += row(R(1) + " (rejoin)", `K${L.bridgeSts} across the bridge. Cast on ${L.sts} sts over the first gap using the backward-loop method. K${L.backSts} across the back panel. Cast on ${L.sts} sts over the second gap. Place the beginning-of-round marker. <b>${p.body.sts} sts.</b>`);
    h += row("Openings", `Each opening is ${fmt(L.cm)} wide and ${fmt(L.depthCm)} deep.`);
    h += row("Markers", `On the next round, place marker A at the centre of the first cast-on gap and marker B at the centre of the second. These are your side lines for the waist shaping.`);

    /* --- waist --- */
    h += `<h3>4 · Shaping the waist</h3>`;
    h += row("Decrease rnd", `[K to 3 sts before marker, k2tog, k1, slip marker, k1, ssk] twice, k to end. <b>4 sts decreased.</b>`);
    h += row(R(p.waist.rnds), `Work a decrease round, then 3 plain rounds — repeat <b>${p.waist.decRounds} times</b> in all. <b>${p.waist.sts} sts.</b>`);
    h += row("Why", `A Basenji's waist tucks up sharply behind the ribs. Without this the sweater bags and swings.`);

    /* --- straight --- */
    h += `<h3>5 · Straight to the hem</h3>`;
    if (p.straight.rnds > 0) {
      h += row(R(p.straight.rnds), `Knit every round, until the piece measures about ${fmt(p.totals.garmentCm - p.hem.cm)} from the bottom of the collar.`);
    } else {
      h += row("—", `No plain section is needed at this size — go straight on to the hem.`);
    }

    /* --- hem --- */
    h += `<h3>6 · The hem</h3>`;
    h += row("Change", `Swap to the smaller needles.`);
    h += row(R(p.hem.rnds), `*K2, p2; repeat from * to end. <span style="opacity:.7">(${p.hem.rnds} rounds ≈ ${p.hem.cm} cm)</span>`);
    h += row("Bind off", `Bind off <b>very loosely</b> in pattern — knit the knits, purl the purls — or use a tubular / stretchy bind-off. A tight hem will stop the sweater going on.`);

    /* --- finishing --- */
    h += `<h3>7 · Finishing</h3>`;
    h += row("Leg cuffs", `Recommended — they stop the openings stretching. Put the ${L.sts} held sts of one opening back onto the smaller needles. Pick up and knit about ${Math.round(L.rows * 0.75)} sts down the first side edge, ${L.sts} sts along the cast-on edge, and ${Math.round(L.rows * 0.75)} sts up the second side edge. <b>About ${mult(L.sts * 2 + Math.round(L.rows * 0.75) * 2, 4)} sts.</b> Join in the round, work 4 rounds of k2, p2 rib, and bind off loosely in pattern. Repeat for the second opening.`);
    h += row("Ends", `Weave in every end along the back of a stitch column for at least 5 cm, then reverse for 2 cm. Dogs move; lazy ends work loose.`);
    h += row("Block", `Soak in cool water with a little wool wash for 20 minutes, squeeze (never wring), roll in a towel, then pat out flat to the finished measurements above and leave to dry.`);

    /* --- variation --- */
    if (i.boyNotch) {
      h += `<h3>Variation · belly notch for a boy dog</h3>`;
      h += row("Where", `During section 5, when the piece measures about ${fmt(p.totals.garmentCm - p.hem.cm - p.notch.cm)} from the collar, stop the belly.`);
      h += row("How", `Next round: k to the belly section, bind off the centre <b>${p.notch.sts} sts</b> of the belly, k to end. Work the remaining sts back and forth in stockinette for the rest of the plain section, then in k2/p2 rib for the hem, and bind off loosely. Pick up and rib around the notch opening for a tidy edge.`);
    }
    if (i.expressLegs) {
      h += `<h3>Variation · express leg slits</h3>`;
      h += row("Instead of", `section 3, work this: on one round, slip ${L.sts} sts to scrap yarn, k${L.bridgeSts}, slip ${L.sts} sts to scrap yarn, k${L.backSts}. On the following round, cast on ${L.sts} sts over each gap with the backward-loop method and carry on in the round. No flat knitting at all.`);
      h += row("Trade-off", `Much faster and no flat knitting, but the openings are horizontal slits rather than proper holes. Fine for a lounging dog, less good for a running one.`);
    }

    return h;
  }

  /* Plain-text version, for the download button. */
  function toText(p) {
    const tmp = document.createElement("div");
    tmp.innerHTML = render(p);
    let out = "KNIT FROM ZERO — BASENJI SWEATER\n";
    out += "Generated for: neck " + p.input.neck + " cm, chest " + p.input.chest + " cm, back " + p.input.backLength + " cm\n";
    out += "Gauge: " + p.input.stsPer10 + " sts and " + p.input.rowsPer10 + " rounds = 10 cm\n";
    out += "".padEnd(60, "=") + "\n\n";
    tmp.querySelectorAll("h3, .rowline, .kv").forEach((n) => {
      if (n.tagName === "H3") out += "\n" + n.textContent.toUpperCase() + "\n" + "".padEnd(n.textContent.length, "-") + "\n";
      else {
        const a = n.children[0] ? n.children[0].textContent.trim() : "";
        const b = n.children[1] ? n.children[1].textContent.trim() : n.textContent.trim();
        out += a.padEnd(16) + " " + b + "\n";
      }
    });
    out += "\n\nknit-from-zero — every number recalculated for your dog and your gauge.\n";
    return out;
  }

  window.KFZPattern = { compute, render, toText, DEFAULTS, YARN_BANDS };
})();
