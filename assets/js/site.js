/* =========================================================
   Knit From Zero — site chrome
   Builds header/sidebar/pager, theme toggle, progress tracking,
   the step-through widget and the row counter.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- site map ---------- */
  const MAP = [
    {
      group: "Start here",
      items: [
        { id: "home", n: "", href: "index.html", title: "Welcome" },
        { id: "l01", n: "01", href: "lessons/01-what-is-knitting.html", title: "What knitting actually is" },
        { id: "l02", n: "02", href: "lessons/02-materials.html", title: "Yarn, needles & tools" },
      ],
    },
    {
      group: "The core skills",
      items: [
        { id: "l03", n: "03", href: "lessons/03-first-stitches.html", title: "Slip knot & casting on" },
        { id: "l04", n: "04", href: "lessons/04-knit-and-purl.html", title: "Knit, purl & bind off" },
        { id: "l05", n: "05", href: "lessons/05-fabric-and-gauge.html", title: "Fabric & gauge" },
        { id: "l06", n: "06", href: "lessons/06-shaping.html", title: "Increases & decreases" },
        { id: "l07", n: "07", href: "lessons/07-in-the-round.html", title: "Knitting in the round" },
        { id: "l08", n: "08", href: "lessons/08-fixing-mistakes.html", title: "Fixing mistakes" },
        { id: "l09", n: "09", href: "lessons/09-finishing.html", title: "Finishing & blocking" },
        { id: "l10", n: "10", href: "lessons/10-reading-patterns.html", title: "Reading patterns & charts" },
      ],
    },
    {
      group: "The project — a Basenji sweater",
      items: [
        { id: "p01", n: "★", href: "project/measure-your-dog.html", title: "Measure your dog" },
        { id: "p02", n: "★", href: "project/pattern.html", title: "The pattern (auto-sized)" },
        { id: "p03", n: "★", href: "project/knit-along.html", title: "Knit-along walkthrough" },
        { id: "p04", n: "★", href: "project/variations.html", title: "Snood, socks & variations" },
      ],
    },
    {
      group: "Reference",
      items: [
        { id: "r00", n: "", href: "reference/3d-models.html", title: "3D models" },
        { id: "r01", n: "", href: "reference/tools.html", title: "Calculators & counters" },
        { id: "r02", n: "", href: "reference/glossary.html", title: "Glossary & abbreviations" },
        { id: "r03", n: "", href: "reference/troubleshooting.html", title: "Troubleshooting index" },
      ],
    },
  ];

  const FLAT = MAP.flatMap((g) => g.items);
  const root = document.documentElement.getAttribute("data-root") || "";
  const pageId = document.body.getAttribute("data-page") || "";

  /* ---------- theme ---------- */
  const THEME_KEY = "kfz-theme";
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme(localStorage.getItem(THEME_KEY));

  function currentTheme() {
    const set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /* ---------- progress ---------- */
  const PROG_KEY = "kfz-progress";
  function getProgress() {
    try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch (e) { return {}; }
  }
  function setDone(id, v) {
    const p = getProgress();
    if (v) p[id] = 1; else delete p[id];
    localStorage.setItem(PROG_KEY, JSON.stringify(p));
    paintProgress();
  }
  function paintProgress() {
    const p = getProgress();
    document.querySelectorAll(".sidebar a[data-id]").forEach((a) => {
      a.classList.toggle("done", !!p[a.getAttribute("data-id")]);
    });
    const lessons = FLAT.filter((i) => i.id !== "home" && !i.id.startsWith("r"));
    const done = lessons.filter((i) => p[i.id]).length;
    const pct = Math.round((done / lessons.length) * 100);
    document.querySelectorAll("[data-progress-bar] i").forEach((i) => (i.style.width = pct + "%"));
    document.querySelectorAll("[data-progress-text]").forEach((el) => {
      el.textContent = done + " of " + lessons.length + " done · " + pct + "%";
    });
    const btn = document.querySelector("[data-mark-done]");
    if (btn) {
      const on = !!p[pageId];
      btn.classList.toggle("primary", !on);
      btn.innerHTML = on ? "✓ Marked complete — undo" : "Mark this lesson complete";
    }
  }

  /* ---------- markup ---------- */
  const LOGO = `<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="none" stroke="var(--rust)" stroke-width="2"/>
    <g fill="none" stroke="var(--rust)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 29 L15 13 L21 29"/><path d="M19 29 L25 13 L31 29"/>
    </g>
    <path d="M9 18 Q20 24 31 18" fill="none" stroke="var(--ochre)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  function buildHeader() {
    const h = document.createElement("header");
    h.className = "site-header";
    h.innerHTML = `<div class="bar">
      <button class="icon-btn nav-toggle" aria-label="Open lesson menu" aria-expanded="false">☰</button>
      <a class="brand" href="${root}index.html">
        ${LOGO}
        <span style="display:block"><b>Knit From Zero</b><span>to a dog in a sweater</span></span>
      </a>
      <nav class="header-links">
        <a href="${root}lessons/01-what-is-knitting.html" class="hide-sm">Lessons</a>
        <a href="${root}project/pattern.html">The Pattern</a>
        <a href="${root}reference/tools.html" class="hide-sm">Tools</a>
        <a href="${root}reference/glossary.html" class="hide-sm">Glossary</a>
        <button class="icon-btn" data-theme-toggle aria-label="Switch colour theme">◐</button>
      </nav>
    </div>`;
    document.body.insertBefore(h, document.body.firstChild);

    h.querySelector("[data-theme-toggle]").addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
    const t = h.querySelector(".nav-toggle");
    t.addEventListener("click", () => {
      const sb = document.querySelector(".sidebar");
      if (!sb) return;
      const open = sb.classList.toggle("open");
      document.body.classList.toggle("nav-open", open);
      t.setAttribute("aria-expanded", String(open));
    });
  }

  function buildSidebar() {
    const sb = document.querySelector(".sidebar");
    if (!sb) return;
    let html = `<div class="progress-wrap">
        <div class="progress-bar" data-progress-bar><i></i></div>
        <div class="small" style="margin-top:.35rem" data-progress-text></div>
      </div>`;
    MAP.forEach((g) => {
      html += `<h5>${g.group}</h5><ol>`;
      g.items.forEach((it) => {
        const active = it.id === pageId ? " active" : "";
        html += `<li><a class="${active}" data-id="${it.id}" href="${root}${it.href}">
          <span class="n">${it.n}</span><span>${it.title}</span></a></li>`;
      });
      html += `</ol>`;
    });
    sb.innerHTML = html;
    sb.addEventListener("click", (e) => {
      if (e.target.closest("a") && window.innerWidth <= 940) {
        sb.classList.remove("open");
        document.body.classList.remove("nav-open");
      }
    });
  }

  function buildPager() {
    const slot = document.querySelector("[data-pager]");
    if (!slot) return;
    const i = FLAT.findIndex((x) => x.id === pageId);
    if (i < 0) return;
    const prev = FLAT[i - 1], next = FLAT[i + 1];
    let html = "";
    if (prev) html += `<a href="${root}${prev.href}"><span>← Previous</span><b>${prev.title}</b></a>`;
    if (next) html += `<a class="next" href="${root}${next.href}"><span>Next →</span><b>${next.title}</b></a>`;
    slot.className = "pager";
    slot.innerHTML = html;
  }

  function buildFooter() {
    const f = document.createElement("footer");
    f.className = "site-footer";
    f.innerHTML = `<div class="inner">
      <div style="flex:1 1 260px">
        <b style="font-family:var(--serif);font-size:1.05rem;color:var(--ink)">Knit From Zero</b><br>
        A complete beginner's knitting course whose graduation project is a
        sweater that actually fits a Basenji.
      </div>
      <div>
        <b style="color:var(--ink-2)">Course</b><br>
        <a href="${root}lessons/01-what-is-knitting.html">All lessons</a><br>
        <a href="${root}project/pattern.html">The pattern</a><br>
        <a href="${root}reference/tools.html">Calculators</a>
      </div>
      <div>
        <b style="color:var(--ink-2)">Reference</b><br>
        <a href="${root}reference/glossary.html">Glossary</a><br>
        <a href="${root}reference/troubleshooting.html">Troubleshooting</a><br>
        <a href="${root}project/variations.html">Variations</a>
      </div>
      <div style="flex:1 1 100%;border-top:1px solid var(--line);padding-top:1rem">
        Written to be read in order. Measurements in centimetres with inches alongside.
        Every diagram on this site is hand-drawn SVG — zoom in as far as you like.
      </div>
    </div>`;
    document.body.appendChild(f);
  }

  /* ---------- stepper widget ---------- */
  function initSteppers(root) {
    (root || document).querySelectorAll(".stepper").forEach(initStepper);
  }
  function initStepper(el) {
    {
      const steps = Array.from(el.querySelectorAll(".step"));
      if (!steps.length || el.dataset.built) return;
      el.dataset.built = "1";
      const title = el.getAttribute("data-title") || "Step through it";
      let idx = 0, timer = null;

      const head = document.createElement("div");
      head.className = "stepper-head";
      head.innerHTML = `<span class="title">${title}</span><div class="stepper-dots"></div>`;

      const stage = document.createElement("div");
      stage.className = "stepper-stage";

      const foot = document.createElement("div");
      foot.className = "stepper-foot";
      foot.innerHTML = `<button data-prev>← Back</button>
        <button class="primary" data-next>Next →</button>
        <button data-play>▶ Play</button>
        <span class="count"></span>`;

      el.textContent = "";
      el.append(head, stage, foot);

      const dots = head.querySelector(".stepper-dots");
      steps.forEach((_, i) => {
        const b = document.createElement("button");
        b.textContent = i + 1;
        b.setAttribute("aria-label", "Go to step " + (i + 1));
        b.addEventListener("click", () => { stop(); show(i); });
        dots.appendChild(b);
      });

      function show(i) {
        idx = (i + steps.length) % steps.length;
        stage.innerHTML = "";
        const s = steps[idx];
        const art = document.createElement("div");
        art.className = "art";
        const svg = s.querySelector("svg");
        if (svg) art.appendChild(svg.cloneNode(true));
        const body = document.createElement("div");
        body.className = "stepper-body";
        body.innerHTML = `<h4>Step ${idx + 1} of ${steps.length}</h4>` + (s.querySelector(".txt") ? s.querySelector(".txt").innerHTML : "");
        stage.append(art, body);
        Array.from(dots.children).forEach((b, j) => b.setAttribute("aria-current", String(j === idx)));
        foot.querySelector(".count").textContent = idx + 1 + " / " + steps.length;
      }
      function stop() {
        if (timer) { clearInterval(timer); timer = null; foot.querySelector("[data-play]").textContent = "▶ Play"; }
      }
      foot.querySelector("[data-prev]").addEventListener("click", () => { stop(); show(idx - 1); });
      foot.querySelector("[data-next]").addEventListener("click", () => { stop(); show(idx + 1); });
      foot.querySelector("[data-play]").addEventListener("click", (e) => {
        if (timer) return stop();
        e.target.textContent = "❚❚ Pause";
        timer = setInterval(() => show(idx + 1), 1900);
      });
      show(0);
    }
  }

  /* ---------- row counters ---------- */
  function initCounters() {
    document.querySelectorAll("[data-counter]").forEach((el) => {
      if (el.dataset.wired) return;
      el.dataset.wired = "1";
      const key = "kfz-count-" + el.getAttribute("data-counter");
      let v = parseInt(localStorage.getItem(key) || "0", 10);
      const label = el.getAttribute("data-label") || "Rows / rounds worked";
      el.className = "counter";
      el.innerHTML = `<div><div class="small" style="letter-spacing:.1em;text-transform:uppercase">${label}</div>
          <div class="val">${v}</div></div>
        <button class="primary big" data-inc>+1</button>
        <button data-dec>−1</button>
        <button data-reset>Reset</button>
        <span class="small">Saved in this browser.</span>`;
      const out = el.querySelector(".val");
      function set(n) { v = Math.max(0, n); out.textContent = v; localStorage.setItem(key, v); }
      el.querySelector("[data-inc]").addEventListener("click", () => set(v + 1));
      el.querySelector("[data-dec]").addEventListener("click", () => set(v - 1));
      el.querySelector("[data-reset]").addEventListener("click", () => { if (confirm("Reset this counter to 0?")) set(0); });
    });
  }

  /* ---------- persistent checklists ---------- */
  function initChecklists() {
    document.querySelectorAll(".checklist[data-key]").forEach((list) => {
      const key = "kfz-check-" + list.getAttribute("data-key");
      let state = {};
      try { state = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) {}
      list.querySelectorAll("input[type=checkbox]").forEach((cb, i) => {
        cb.checked = !!state[i];
        cb.addEventListener("change", () => {
          state[i] = cb.checked;
          localStorage.setItem(key, JSON.stringify(state));
        });
      });
    });
  }

  /* ---------- mark-complete button ---------- */
  function initMarkDone() {
    const btn = document.querySelector("[data-mark-done]");
    if (!btn) return;
    btn.addEventListener("click", () => setDone(pageId, !getProgress()[pageId]));
  }

  /* ---------- unit switch (cm ⇄ in) ---------- */
  function initUnits() {
    document.querySelectorAll("[data-cm]").forEach((el) => {
      const cm = parseFloat(el.getAttribute("data-cm"));
      el.textContent = cm + " cm (" + (cm / 2.54).toFixed(1) + " in)";
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    buildHeader();
    buildSidebar();
    buildPager();
    buildFooter();
    initSteppers();
    initCounters();
    initChecklists();
    initMarkDone();
    initUnits();
    paintProgress();
    document.querySelectorAll(".header-links a").forEach((a) => {
      if (a.getAttribute("href") && location.pathname.endsWith(a.getAttribute("href").replace(root, ""))) a.classList.add("active");
    });
  });

  window.KFZ = { getProgress, setDone, MAP, FLAT, initStepper, initSteppers, initCounters, initChecklists };
})();
