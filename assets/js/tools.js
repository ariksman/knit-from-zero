/* =========================================================
   Knit From Zero — tools.js
   Self-contained calculators. Drop <div data-tool="gauge"></div>
   anywhere and it builds itself.
   ========================================================= */
(function () {
  "use strict";

  const NEEDLES = [
    [2.0, "0", "14"], [2.25, "1", "13"], [2.5, "—", "—"], [2.75, "2", "12"],
    [3.0, "—", "11"], [3.25, "3", "10"], [3.5, "4", "—"], [3.75, "5", "9"],
    [4.0, "6", "8"], [4.5, "7", "7"], [5.0, "8", "6"], [5.5, "9", "5"],
    [6.0, "10", "4"], [6.5, "10½", "3"], [7.0, "—", "2"], [7.5, "—", "1"],
    [8.0, "11", "0"], [9.0, "13", "00"], [10.0, "15", "000"], [12.0, "17", "—"],
    [15.0, "19", "—"], [20.0, "36", "—"],
  ];

  const WEIGHTS = [
    { n: 0, name: "Lace", other: "2-ply, cobweb", sts: "33–40", needle: "1.5–2.25 mm", use: "Shawls. Not this project." },
    { n: 1, name: "Super fine", other: "Fingering, sock, 4-ply", sts: "27–32", needle: "2.25–3.25 mm", use: "Fine, slow, very durable. A lovely but long dog sweater." },
    { n: 2, name: "Fine", other: "Sport, 5-ply", sts: "23–26", needle: "3.25–3.75 mm", use: "Light layer for indoors or a mild autumn." },
    { n: 3, name: "Light", other: "DK, 8-ply, light worsted", sts: "21–24", needle: "3.75–4.5 mm", use: "★ The recommendation for this pattern." },
    { n: 4, name: "Medium", other: "Worsted, aran, 10-ply", sts: "16–20", needle: "4.5–5.5 mm", use: "Faster and warmer. Great for a cold climate." },
    { n: 5, name: "Bulky", other: "Chunky, 12-ply", sts: "12–15", needle: "5.5–8 mm", use: "Very fast, but stiff and bulky under the front legs." },
    { n: 6, name: "Super bulky", other: "Roving", sts: "7–11", needle: "8–12.75 mm", use: "Too thick to move in. Avoid." },
    { n: 7, name: "Jumbo", other: "—", sts: "≤6", needle: "12.75 mm +", use: "A dog-shaped rug." },
  ];

  const $ = (h) => { const d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstChild; };
  const num = (el) => parseFloat(el.value.replace(",", ".")) || 0;

  /* ---------- gauge calculator ---------- */
  function gauge(host) {
    host.appendChild($(`
      <div class="card">
        <h3 style="margin-top:0">Gauge calculator</h3>
        <p class="small">Knit a swatch at least 15 cm square, wash and dry it the way you will wash the sweater, lay it flat without stretching, then count stitches and rows across the <em>middle</em> — never near the edges.</p>
        <div class="grid g4" style="margin:1rem 0">
          <div class="field"><label for="g-s">Stitches counted</label><input type="number" id="g-s" value="33" min="1" step="0.5"></div>
          <div class="field"><label for="g-sw">over how many cm</label><input type="number" id="g-sw" value="15" min="1" step="0.1"></div>
          <div class="field"><label for="g-r">Rows counted</label><input type="number" id="g-r" value="45" min="1" step="0.5"></div>
          <div class="field"><label for="g-rw">over how many cm</label><input type="number" id="g-rw" value="15" min="1" step="0.1"></div>
        </div>
        <div class="pattern-out" id="g-out"></div>
        <div class="grid g2" style="margin-top:1rem">
          <div class="field"><label for="g-want">I need this many cm of fabric</label><input type="number" id="g-want" value="54" step="0.5"></div>
          <div class="field"><label for="g-mult">…rounded to a multiple of</label>
            <select id="g-mult"><option value="1">1 (any number)</option><option value="2">2</option><option value="4" selected>4 (for 2×2 rib)</option><option value="6">6</option></select></div>
        </div>
        <div class="pattern-out" id="g-out2"></div>
      </div>`));

    const ids = ["g-s", "g-sw", "g-r", "g-rw", "g-want", "g-mult"].map((i) => host.querySelector("#" + i));
    function run() {
      const [s, sw, r, rw, want, mult] = ids;
      const sp10 = (num(s) / num(sw)) * 10, rp10 = (num(r) / num(rw)) * 10;
      const spc = sp10 / 10;
      host.querySelector("#g-out").innerHTML =
        `<div class="kv"><span class="k">Your gauge</span><span><b>${sp10.toFixed(1)} sts</b> and <b>${rp10.toFixed(1)} rows</b> = 10 cm</span></div>` +
        `<div class="kv"><span class="k">One stitch is</span><span>${(10 / sp10).toFixed(2)} cm wide</span></div>` +
        `<div class="kv"><span class="k">One row is</span><span>${(10 / rp10).toFixed(2)} cm tall</span></div>` +
        `<div class="kv"><span class="k">Compared with the pattern</span><span>${cmp(sp10)}</span></div>`;
      const m = +mult.value;
      const raw = num(want) * spc;
      const rounded = Math.max(m, Math.round(raw / m) * m);
      host.querySelector("#g-out2").innerHTML =
        `<div class="kv"><span class="k">${num(want)} cm needs</span><span><b>${rounded} stitches</b> <span style="opacity:.6">(exactly ${raw.toFixed(1)})</span></span></div>` +
        `<div class="kv"><span class="k">…which will measure</span><span>${(rounded / spc).toFixed(1)} cm</span></div>` +
        `<div class="kv"><span class="k">${num(want)} cm of length needs</span><span><b>${Math.round(num(want) * rp10 / 10)} rows</b></span></div>`;
    }
    function cmp(sp10) {
      const d = sp10 - 22;
      if (Math.abs(d) < 0.6) return `<span style="color:var(--sage)">Spot on for the sample pattern (22 sts / 10 cm).</span>`;
      if (d > 0) return `<span style="color:var(--ochre)">Tighter than the sample. Your stitches are smaller — go up a needle size, or just let the generator resize the pattern.</span>`;
      return `<span style="color:var(--ochre)">Looser than the sample. Your stitches are bigger — go down a needle size, or let the generator resize the pattern.</span>`;
    }
    ids.forEach((i) => i.addEventListener("input", run));
    run();
  }

  /* ---------- needle converter ---------- */
  function needles(host) {
    let rows = NEEDLES.map((n) => `<tr><td class="num">${n[0].toFixed(2).replace(/0$/, "").replace(/\.$/, "")} mm</td><td class="num">${n[1]}</td><td class="num">${n[2]}</td></tr>`).join("");
    host.appendChild($(`
      <div class="card">
        <h3 style="margin-top:0">Needle size converter</h3>
        <p class="small">Metric is the only unambiguous system — US and old UK sizes overlap and disagree. If a pattern gives a US size, convert to millimetres and buy that.</p>
        <div class="table-wrap" style="max-height:340px;overflow:auto">
          <table><thead><tr><th>Metric</th><th>US</th><th>UK / Canada (old)</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        <p class="small" style="margin:.8rem 0 0"><b>For this project:</b> 4 mm (US 6) for the body and 3.5 mm (US 4) for the ribbing — but only if those sizes give you the gauge. The needle size printed on a ball band is a suggestion, not an instruction.</p>
      </div>`));
  }

  /* ---------- yarn weight chooser ---------- */
  function weights(host) {
    const rows = WEIGHTS.map((w) => `<tr${w.n === 3 ? ' style="background:var(--rust-soft)"' : ""}>
      <td class="num">${w.n}</td><td><b>${w.name}</b><br><span class="small">${w.other}</span></td>
      <td class="num">${w.sts}</td><td class="num">${w.needle}</td><td class="small">${w.use}</td></tr>`).join("");
    host.appendChild($(`
      <div class="card">
        <h3 style="margin-top:0">Yarn weights, and which one to buy</h3>
        <div class="table-wrap">
          <table><thead><tr><th>#</th><th>Name</th><th>Sts / 10 cm</th><th>Needles</th><th>For a dog sweater</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        <p class="small" style="margin:.8rem 0 0">“Sts / 10 cm” is the range the yarn is designed for. Two yarns labelled DK can still knit up differently, which is exactly why you swatch.</p>
      </div>`));
  }

  /* ---------- wraps per inch ---------- */
  function wpi(host) {
    host.appendChild($(`
      <div class="card">
        <h3 style="margin-top:0">Identify a mystery yarn (wraps per inch)</h3>
        <p class="small">Found a ball with no label? Wind the yarn around a ruler for 2.5 cm (1 inch), snug but not stretched, with the strands just touching. Count the wraps.</p>
        <div class="field" style="max-width:220px"><label for="w-in">Wraps per 2.5 cm</label><input type="number" id="w-in" value="12" min="3" max="45"></div>
        <div class="pattern-out" id="w-out"></div>
      </div>`));
    const inp = host.querySelector("#w-in"), out = host.querySelector("#w-out");
    function run() {
      const w = num(inp);
      let name, sts, needle;
      if (w <= 6) { name = "Super bulky / jumbo"; sts = "7–11"; needle = "8 mm +"; }
      else if (w <= 8) { name = "Bulky / chunky"; sts = "12–15"; needle = "5.5–8 mm"; }
      else if (w <= 11) { name = "Worsted / aran"; sts = "16–20"; needle = "4.5–5.5 mm"; }
      else if (w <= 14) { name = "DK / light worsted"; sts = "21–24"; needle = "3.75–4.5 mm"; }
      else if (w <= 17) { name = "Sport"; sts = "23–26"; needle = "3.25–3.75 mm"; }
      else if (w <= 24) { name = "Fingering / sock"; sts = "27–32"; needle = "2.25–3.25 mm"; }
      else { name = "Lace"; sts = "33–40"; needle = "1.5–2.25 mm"; }
      out.innerHTML = `<div class="kv"><span class="k">Probably</span><span><b>${name}</b></span></div>
        <div class="kv"><span class="k">Expect roughly</span><span>${sts} sts / 10 cm on ${needle}</span></div>
        <div class="kv"><span class="k">Then</span><span>swatch it anyway — this method is ±1 category.</span></div>`;
    }
    inp.addEventListener("input", run); run();
  }

  /* ---------- yarn quantity ---------- */
  function yarn(host) {
    host.appendChild($(`
      <div class="card">
        <h3 style="margin-top:0">How much yarn will I need?</h3>
        <p class="small">A rough but honest estimate from the surface area of the garment and your gauge. Always buy one ball more than this says, from the same dye lot.</p>
        <div class="grid g3" style="margin:1rem 0">
          <div class="field"><label for="y-c">Chest, cm</label><input type="number" id="y-c" value="54"></div>
          <div class="field"><label for="y-l">Back length, cm</label><input type="number" id="y-l" value="42"></div>
          <div class="field"><label for="y-g">Gauge, sts / 10 cm</label><input type="number" id="y-g" value="22"></div>
        </div>
        <div class="pattern-out" id="y-out"></div>
      </div>`));
    const a = host.querySelector("#y-c"), b = host.querySelector("#y-l"), c = host.querySelector("#y-g");
    function run() {
      if (!window.KFZPattern) { host.querySelector("#y-out").textContent = "Loading…"; return; }
      const p = KFZPattern.compute({ chest: num(a), backLength: num(b), stsPer10: num(c), rowsPer10: num(c) * 1.36 });
      host.querySelector("#y-out").innerHTML =
        `<div class="kv"><span class="k">Fabric area</span><span>${p.yarn.area} cm²</span></div>
         <div class="kv"><span class="k">Estimate</span><span><b>${p.yarn.grams} g</b> ≈ ${p.yarn.metres} m</span></div>
         <div class="kv"><span class="k">Yarn weight</span><span>${p.yarn.band}</span></div>
         <div class="kv"><span class="k">Buy</span><span>${Math.ceil(p.yarn.grams / 50) + 1} × 50 g balls, same dye lot</span></div>`;
    }
    [a, b, c].forEach((i) => i.addEventListener("input", run));
    setTimeout(run, 0);
  }

  /* ---------- row counter (multiple, named) ---------- */
  function counters(host) {
    host.appendChild($(`
      <div class="card">
        <h3 style="margin-top:0">Row &amp; round counters</h3>
        <p class="small">One for each section of the sweater. They keep counting even if you close the tab.</p>
        <div data-counter="collar" data-label="Collar rounds"></div>
        <div style="height:.8rem"></div>
        <div data-counter="rise" data-label="Increase rounds"></div>
        <div style="height:.8rem"></div>
        <div data-counter="legs" data-label="Leg opening rows"></div>
        <div style="height:.8rem"></div>
        <div data-counter="body" data-label="Body rounds"></div>
      </div>`));
  }

  const TOOLS = { gauge, needles, weights, wpi, yarn, counters };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-tool]").forEach((n) => {
      const t = TOOLS[n.getAttribute("data-tool")];
      if (t) t(n);
    });
    /* counters injected by tools need wiring after the fact */
    if (window.KFZinitCounters) window.KFZinitCounters();
    document.querySelectorAll("[data-counter]").forEach((el) => {
      if (el.dataset.wired) return;
      el.dataset.wired = "1";
      const key = "kfz-count-" + el.getAttribute("data-counter");
      let v = parseInt(localStorage.getItem(key) || "0", 10);
      const label = el.getAttribute("data-label") || "Rows worked";
      el.className = "counter";
      el.innerHTML = `<div><div class="small" style="letter-spacing:.1em;text-transform:uppercase">${label}</div><div class="val">${v}</div></div>
        <button class="primary big" data-inc>+1</button><button data-dec>−1</button><button data-reset>Reset</button>`;
      const out = el.querySelector(".val");
      const set = (n) => { v = Math.max(0, n); out.textContent = v; localStorage.setItem(key, v); };
      el.querySelector("[data-inc]").addEventListener("click", () => set(v + 1));
      el.querySelector("[data-dec]").addEventListener("click", () => set(v - 1));
      el.querySelector("[data-reset]").addEventListener("click", () => { if (confirm("Reset to 0?")) set(0); });
    });
  });

  window.KFZTools = TOOLS;
})();
