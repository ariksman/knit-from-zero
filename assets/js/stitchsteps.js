/* =========================================================
   Knit From Zero — stitchsteps.js
   Draws the two-needle "what your hands are doing" diagrams.
   Every frame is the same scene with different parameters, so
   the needles and stitches never jump between steps.

   Scene space: 0 0 560 360
     · left needle  — horizontal, y = 150, tip pointing right at x = 400
     · right needle — enters from the lower right at 32°
   ========================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a, t) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; };

  const W = 560, H = 360;
  const LN_Y = 150;                 // left needle centreline
  const LN_TIP = 400;               // left needle tip x
  const SP = 46;                    // stitch spacing
  const LOOP_W = 30, LOOP_H = 84;
  const NEEDLE = "#9AA3AA", NEEDLE_DK = "#6E767D";
  const ANG = 32, RAD = ANG * Math.PI / 180;
  const RT_TIP = [292, 116];
  const dirX = Math.cos(RAD), dirY = Math.sin(RAD);

  const YARN = () => "var(--yarn-a)";
  const YARN2 = () => "var(--yarn-b)";

  /* ---- primitives ------------------------------------------------ */

  function needle(g, tip, butt, w) {
    const dx = butt[0] - tip[0], dy = butt[1] - tip[1];
    const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const t = 16; // taper length
    g.appendChild(el("path", {
      d: `M ${tip[0] + ux * t} ${tip[1] + uy * t} L ${butt[0]} ${butt[1]}`,
      stroke: NEEDLE, "stroke-width": w, "stroke-linecap": "round",
    }));
    // tapered point
    const px = -uy, py = ux;
    g.appendChild(el("path", {
      d: `M ${tip[0]} ${tip[1]}
          L ${tip[0] + ux * t + px * w / 2} ${tip[1] + uy * t + py * w / 2}
          L ${tip[0] + ux * t - px * w / 2} ${tip[1] + uy * t - py * w / 2} Z`,
      fill: NEEDLE,
    }));
    g.appendChild(el("path", {
      d: `M ${tip[0] + ux * t} ${tip[1] + uy * t} L ${butt[0] - ux * 6} ${butt[1] - uy * 6}`,
      stroke: NEEDLE_DK, "stroke-width": Math.max(1.4, w * 0.16), "stroke-linecap": "round", opacity: ".55",
    }));
  }

  /* an inverted-U loop sitting on a needle, rotated to match it */
  function loop(g, cx, cy, angle, colour, w, h, opacity) {
    const gg = el("g", { transform: `rotate(${angle} ${cx} ${cy})`, opacity: opacity == null ? 1 : opacity });
    gg.appendChild(el("path", {
      d: `M ${cx - w / 2} ${cy + h} L ${cx - w / 2} ${cy - 2}
          A ${w / 2} ${w / 2 * 0.85} 0 0 1 ${cx + w / 2} ${cy - 2}
          L ${cx + w / 2} ${cy + h}`,
      fill: "none", stroke: colour, "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
    g.appendChild(gg);
  }

  /* the knitted fabric hanging below the left needle */
  function fabric(g, cols, top, colour) {
    const cw = SP * 0.62, ch = 26;
    const gg = el("g", { opacity: ".85" });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 34 + c * SP + (SP - cw) / 2, y = top + r * ch;
        gg.appendChild(el("path", {
          d: `M ${x} ${y} C ${x + cw * 0.2} ${y + ch * 0.5}, ${x + cw * 0.4} ${y + ch * 0.7}, ${x + cw / 2} ${y + ch}`,
          fill: "none", stroke: colour, "stroke-width": 7, "stroke-linecap": "round",
        }));
        gg.appendChild(el("path", {
          d: `M ${x + cw} ${y} C ${x + cw * 0.8} ${y + ch * 0.5}, ${x + cw * 0.6} ${y + ch * 0.7}, ${x + cw / 2} ${y + ch}`,
          fill: "none", stroke: colour, "stroke-width": 7, "stroke-linecap": "round",
        }));
      }
    }
    g.appendChild(gg);
  }

  function arrow(g, d, colour) {
    g.appendChild(el("path", { d, fill: "none", stroke: colour || "var(--indigo)", "stroke-width": 3.4, "stroke-linecap": "round", "marker-end": "url(#kfz-arw)", "stroke-dasharray": "1 0" }));
  }

  function halo(g, x, y, r) {
    g.appendChild(el("circle", { cx: x, cy: y, r: r || 30, fill: "none", stroke: "var(--ochre)", "stroke-width": 3.5, "stroke-dasharray": "7 6", opacity: ".95" }));
  }

  function label(g, x, y, txt, colour, anchor) {
    g.appendChild(el("text", {
      x, y, "font-size": 15, "font-family": "var(--mono)", "font-weight": 600,
      fill: colour || "var(--indigo)", "text-anchor": anchor || "middle",
    }, txt));
  }

  /* ---- the scene -------------------------------------------------- */
  function scene(spec) {
    const s = Object.assign({
      left: 5, right: 2, target: null, rightTip: null,
      wrap: 0, newLoop: false, yarn: "left", ghost: null,
      arrows: [], halos: [], labels: [], noRight: false, noFabric: false,
    }, spec || {});

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;display:block" });
    const defs = el("defs");
    const mk = el("marker", { id: "kfz-arw", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 4.4, markerHeight: 4.4, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--indigo)" }));
    defs.appendChild(mk);
    svg.appendChild(defs);

    const behind = el("g"), mid = el("g"), front = el("g");
    svg.append(behind, mid, front);

    /* stitch x positions on the left needle, counted back from the tip */
    const xs = [];
    for (let i = 0; i < s.left; i++) xs.unshift(LN_TIP - 44 - i * SP);

    if (!s.noFabric) fabric(behind, s.left, LN_Y + LOOP_H - 4, YARN());

    /* right needle first, so its shaft sits behind the left needle */
    const rTip = s.rightTip || RT_TIP;
    if (!s.noRight) {
      const butt = [rTip[0] + dirX * 320, rTip[1] + dirY * 320];
      needle(behind, rTip, butt, 13);
      for (let i = 0; i < s.right; i++) {
        const d = 58 + i * 40;
        loop(mid, rTip[0] + dirX * d, rTip[1] + dirY * d, ANG, YARN(), LOOP_W * 0.9, LOOP_H * 0.55);
      }
    }

    /* left needle */
    needle(mid, [LN_TIP, LN_Y], [24, LN_Y], 13);

    /* stitches on the left needle */
    xs.forEach((x, i) => {
      const dim = s.ghost != null && i === s.ghost;
      loop(front, x, LN_Y, 0, dim ? "var(--ink-3)" : YARN(), LOOP_W, LOOP_H, dim ? 0.4 : 1);
    });

    /* working yarn coming from the ball */
    const lastX = xs[xs.length - 1];
    if (s.yarn === "left") {
      front.appendChild(el("path", {
        d: `M ${lastX + LOOP_W / 2} ${LN_Y + LOOP_H} C ${lastX + 70} ${LN_Y + 150}, ${W - 90} ${LN_Y + 160}, ${W - 30} ${H - 16}`,
        fill: "none", stroke: YARN(), "stroke-width": 8, "stroke-linecap": "round", opacity: ".9",
      }));
    }

    /* yarn wrapped around the right needle */
    if (s.wrap) {
      const p = [rTip[0] + dirX * 34, rTip[1] + dirY * 34];
      front.appendChild(el("path", {
        d: `M ${lastX + LOOP_W / 2} ${LN_Y + LOOP_H}
            C ${lastX + 80} ${LN_Y + 120}, ${p[0] - 70} ${p[1] + 60}, ${p[0] - 22} ${p[1] + 6}
            C ${p[0] - 4} ${p[1] - 14}, ${p[0] + 24} ${p[1] - 6}, ${p[0] + 18} ${p[1] + 18}
            C ${p[0] + 12} ${p[1] + 44}, ${W - 120} ${H - 60}, ${W - 30} ${H - 16}`,
        fill: "none", stroke: YARN(), "stroke-width": 8, "stroke-linecap": "round",
      }));
    }

    /* a freshly drawn-through loop sitting on the right needle tip */
    if (s.newLoop) {
      loop(front, rTip[0] + dirX * 32, rTip[1] + dirY * 32, ANG, YARN2(), LOOP_W * 0.95, LOOP_H * 0.5);
    }

    s.halos.forEach((h) => halo(front, h[0], h[1], h[2]));
    s.arrows.forEach((a) => arrow(front, a));
    s.labels.forEach((l) => label(front, l[0], l[1], l[2], l[3], l[4]));

    return { svg, xs };
  }

  /* ---- named sequences -------------------------------------------- */
  const SEQ = {
    knit: {
      title: "The knit stitch, one step at a time",
      steps: [
        {
          spec: { left: 5, right: 2, rightTip: [292, 116],
            halos: [[356, 150, 34]],
            arrows: [`M 420 250 C 390 210, 360 180, 330 140`],
            labels: [[430, 268, "right needle goes in", "var(--indigo)", "middle"]] },
          text: `<p><b>Push the right needle into the front of the first stitch on the left needle</b> — in from the left, out at the back. The right needle now sits <em>behind</em> the left one.</p>
                 <p class="small">If your needle went in from the right instead, you would be knitting through the back loop, which twists the stitch. Front to back, always, until a pattern tells you otherwise.</p>`,
        },
        {
          spec: { left: 5, right: 2, rightTip: [292, 116], wrap: 1, yarn: "none",
            halos: [[300, 128, 32]],
            arrows: [`M 240 90 C 268 78, 300 84, 312 108`],
            labels: [[210, 82, "wrap counter-clockwise", "var(--indigo)", "middle"]] },
          text: `<p><b>Wrap the working yarn around the right needle, counter-clockwise</b> — up the back, over the top, down the front. The yarn is now lying in the crook of the right needle.</p>
                 <p class="small">"Working yarn" means the strand still attached to the ball. Keep it fairly loose here; a strangled wrap is what makes tight, unhappy knitting.</p>`,
        },
        {
          spec: { left: 5, right: 2, rightTip: [292, 116], newLoop: true,
            halos: [[318, 132, 34]],
            arrows: [`M 250 170 C 272 150, 292 138, 306 130`],
            labels: [[230, 186, "draw the loop through", "var(--indigo)", "middle"]] },
          text: `<p><b>Bring the right needle back out through the old stitch</b>, dragging the wrapped yarn with it. A new loop is now sitting on the right needle. The old stitch is still on the left needle.</p>
                 <p class="small">This is the whole of knitting: one loop pulled through another. Everything else is bookkeeping.</p>`,
        },
        {
          spec: { left: 4, right: 3, rightTip: [292, 116],
            halos: [[344, 138, 30]],
            arrows: [`M 400 96 C 372 104, 352 118, 344 132`],
            labels: [[424, 90, "old stitch slides off", "var(--indigo)", "middle"]] },
          text: `<p><b>Slide the old stitch off the tip of the left needle.</b> That stitch has now been knitted. One stitch has moved from the left needle to the right needle.</p>
                 <p class="small">Count them. Left needle went from 5 to 4; right needle went from 2 to 3. The total never changes — that is how you know you have not accidentally added one.</p>`,
        },
      ],
    },

    purl: {
      title: "The purl stitch — the knit stitch, backwards",
      steps: [
        {
          spec: { left: 5, right: 2, rightTip: [316, 196],
            halos: [[356, 150, 34]],
            arrows: [`M 430 260 C 400 236, 372 214, 344 198`],
            labels: [[452, 278, "in from the right", "var(--indigo)", "middle"]] },
          text: `<p>First, <b>bring the working yarn to the front</b> of the work, between the two needles. Then <b>push the right needle into the first stitch from right to left</b>, in front of the left needle.</p>
                 <p class="small">Compare with the knit stitch: there the needle went in at the front-left and came out at the back. Here it goes in at the front-right and stays in front. That single difference is the entire purl.</p>`,
        },
        {
          spec: { left: 5, right: 2, rightTip: [316, 196], wrap: 1, yarn: "none",
            halos: [[322, 208, 32]],
            arrows: [`M 250 246 C 282 250, 314 236, 326 210`],
            labels: [[222, 258, "wrap counter-clockwise", "var(--indigo)", "middle"]] },
          text: `<p><b>Wrap the yarn counter-clockwise around the right needle</b> — the same direction as for a knit stitch, it just looks different because the needle is in front.</p>`,
        },
        {
          spec: { left: 5, right: 2, rightTip: [316, 196], newLoop: true,
            halos: [[342, 212, 34]],
            arrows: [`M 402 250 C 380 234, 358 222, 342 216`],
            labels: [[424, 264, "push it back through", "var(--indigo)", "middle"]] },
          text: `<p><b>Push the right needle back through the old stitch, away from you</b>, taking the wrapped yarn with it. A new loop appears on the right needle.</p>`,
        },
        {
          spec: { left: 4, right: 3, rightTip: [316, 196],
            halos: [[350, 150, 30]],
            labels: [[430, 118, "and off it comes", "var(--indigo)", "middle"]] },
          text: `<p><b>Slip the old stitch off the left needle.</b> Purled. On the side facing you it makes a little horizontal bump instead of a smooth V.</p>
                 <p class="small">A purl is a knit stitch seen from the other side. If you knitted every stitch of every row and then turned the fabric over, the back would be covered in purl bumps.</p>`,
        },
      ],
    },

    bindoff: {
      title: "Binding off — getting the fabric off the needles safely",
      steps: [
        {
          spec: { left: 4, right: 2, rightTip: [292, 116],
            halos: [[352, 176, 44]],
            labels: [[130, 300, "knit two stitches normally", "var(--indigo)", "start"]] },
          text: `<p><b>Knit the first two stitches</b> exactly as usual, so you have two live stitches on the right needle.</p>`,
        },
        {
          spec: { left: 3, right: 3, rightTip: [292, 116],
            halos: [[368, 148, 30]],
            arrows: [`M 470 210 C 430 190, 400 164, 376 146`],
            labels: [[492, 226, "lift the first over the second", "var(--indigo)", "end"]] },
          text: `<p><b>With the tip of the left needle, lift the first of those two stitches over the second and off the end of the needle.</b> One stitch remains on the right needle.</p>
                 <p class="small">You have just cast off one stitch. It cannot unravel because a loop has been passed over it and closed.</p>`,
        },
        {
          spec: { left: 3, right: 2, rightTip: [292, 116],
            halos: [[352, 150, 32]],
            labels: [[150, 300, "knit one more, lift over, repeat", "var(--indigo)", "start"]] },
          text: `<p><b>Knit one more stitch, then lift the previous one over it again.</b> Repeat all the way along: knit one, lift over, knit one, lift over.</p>
                 <p class="small">Work loosely. A bound-off edge has no give unless you make it, and a tight edge is the single most common reason a finished garment will not go on.</p>`,
        },
        {
          spec: { left: 0, right: 1, rightTip: [292, 116], noFabric: false, ghost: null,
            labels: [[280, 320, "cut, thread through, pull tight", "var(--indigo)", "middle"]] },
          text: `<p><b>When one stitch is left</b>, cut the yarn leaving about 15 cm, pull that tail all the way through the last loop, and tighten. Done — the fabric is off the needles and stable.</p>`,
        },
      ],
    },

    k2tog: {
      title: "k2tog — a decrease that leans right",
      steps: [
        {
          spec: { left: 5, right: 2, rightTip: [270, 116],
            halos: [[334, 150, 56]],
            arrows: [`M 420 250 C 390 208, 352 178, 310 142`],
            labels: [[440, 268, "into TWO stitches at once", "var(--indigo)", "middle"]] },
          text: `<p><b>Push the right needle through the front of the first <em>two</em> stitches together</b>, exactly as if they were one stitch.</p>`,
        },
        {
          spec: { left: 5, right: 2, rightTip: [270, 116], wrap: 1, yarn: "none",
            halos: [[278, 128, 30]] },
          text: `<p><b>Wrap the yarn and pull a loop through both stitches</b>, as for an ordinary knit stitch.</p>`,
        },
        {
          spec: { left: 3, right: 3, rightTip: [270, 116],
            halos: [[338, 140, 34]],
            labels: [[440, 300, "two became one", "var(--rust)", "middle"]] },
          text: `<p><b>Slide both old stitches off together.</b> You went in with two and came out with one: the row is now one stitch narrower.</p>
                 <p class="small">The stitch on top slants to the right. That is why k2tog is called a right-leaning decrease, and why patterns pair it with ssk on the other side of a shaping line so the two lean towards each other.</p>`,
        },
      ],
    },

    ssk: {
      title: "ssk — a decrease that leans left",
      steps: [
        {
          spec: { left: 5, right: 3, rightTip: [292, 116],
            halos: [[356, 150, 34], [310, 150, 34]],
            arrows: [`M 400 84 C 360 96, 330 108, 306 122`],
            labels: [[430, 76, "slip 2, knitwise, one at a time", "var(--indigo)", "middle"]] },
          text: `<p><b>Slip the next two stitches one at a time, knitwise, onto the right needle</b> — that means entering each as if to knit it, but sliding it across without working it.</p>
                 <p class="small">Slipping them knitwise turns each loop around. That turn is what makes the finished decrease lean left.</p>`,
        },
        {
          spec: { left: 3, right: 4, rightTip: [292, 116],
            halos: [[334, 138, 40]],
            arrows: [`M 180 250 C 226 216, 274 178, 316 144`],
            labels: [[160, 268, "left needle back into both", "var(--indigo)", "start"]] },
          text: `<p><b>Push the left needle back into the front of those two slipped stitches</b>, from left to right, and <b>knit them together</b> from this position.</p>`,
        },
        {
          spec: { left: 3, right: 3, rightTip: [292, 116],
            halos: [[338, 140, 32]],
            labels: [[440, 300, "two became one, leaning left", "var(--rust)", "middle"]] },
          text: `<p><b>One stitch where there were two</b>, and the top stitch slants left. Use ssk on the right-hand edge of a shaping line and k2tog on the left, and the decreases will frame the shape neatly.</p>`,
        },
      ],
    },

    m1: {
      title: "M1L and M1R — making a stitch out of thin air",
      steps: [
        {
          spec: { left: 4, right: 3, rightTip: [292, 116],
            halos: [[336, 154, 26]],
            arrows: [`M 250 236 C 288 206, 316 178, 332 160`],
            labels: [[228, 252, "the bar between two stitches", "var(--indigo)", "start"]] },
          text: `<p>Between every pair of stitches there is a small horizontal strand — the <b>running bar</b>. Both "make one" increases turn that bar into a stitch, which is why they leave no hole.</p>`,
        },
        {
          spec: { left: 4, right: 3, rightTip: [292, 116],
            halos: [[336, 154, 26]],
            arrows: [`M 400 230 C 372 200, 350 176, 340 158`],
            labels: [[424, 246, "lift with the LEFT needle, front to back", "var(--indigo)", "middle"]] },
          text: `<p><b>M1L (leans left):</b> pick the bar up with the left needle <b>from front to back</b>, then knit it <b>through the back loop</b>.</p>
                 <p class="small">Knitting through the back loop is the fiddly bit and it is not optional — it twists the new stitch closed. Skip it and you get a hole.</p>`,
        },
        {
          spec: { left: 5, right: 3, rightTip: [292, 116],
            halos: [[310, 150, 28]],
            labels: [[420, 300, "one extra stitch, no hole", "var(--rust)", "middle"]] },
          text: `<p><b>M1R (leans right):</b> the mirror image — pick the bar up <b>from back to front</b>, then knit it <b>through the front loop</b>.</p>
                 <p class="small">In the sweater you use them in pairs, M1R before a marker and M1L after it, so the two new stitches lean away from the marker and the increase line stays invisible.</p>`,
        },
      ],
    },

    join: {
      title: "Joining in the round without twisting",
      steps: [
        {
          spec: { left: 6, right: 0, noRight: true, noFabric: true,
            labels: [[280, 300, "cast on, then STOP", "var(--indigo)", "middle"]] },
          text: `<p><b>Cast all your stitches onto the circular needle</b> and spread them out along the cable and both tips. Do not join yet.</p>`,
        },
        {
          spec: { left: 6, right: 0, noRight: true, noFabric: true,
            halos: [[400, 150, 26]],
            arrows: [`M 120 250 C 200 226, 320 214, 396 178`],
            labels: [[110, 268, "check every cast-on edge points inwards", "var(--indigo)", "start"]] },
          text: `<p><b>Lay the needle down and look along the whole cast-on edge.</b> The bumpy lower edge must face the middle of the circle the whole way round, with no half-turn anywhere.</p>
                 <p class="stop-note small">This is the one mistake in knitting that cannot be fixed later. A twist here becomes a permanent Möbius strip and the only cure is to rip out and start again. Look twice.</p>`,
        },
        {
          spec: { left: 6, right: 1, rightTip: [292, 116],
            halos: [[356, 150, 32]],
            labels: [[440, 300, "knit the first cast-on stitch", "var(--indigo)", "middle"]] },
          text: `<p><b>Place the beginning-of-round marker, then knit the first cast-on stitch</b> using the working yarn. The circle is closed. From here you simply keep going round and round — every round is a knit round, and the smooth stockinette side is always facing you.</p>`,
        },
      ],
    },
  };

  /* ---- build the DOM the site's stepper widget expects -------------- */
  function build(container, name) {
    const seq = SEQ[name];
    if (!seq) return;
    container.classList.add("stepper");
    container.setAttribute("data-title", seq.title);
    container.innerHTML = "";
    seq.steps.forEach((st) => {
      const fig = document.createElement("figure");
      fig.className = "step";
      fig.style.display = "none";
      fig.appendChild(scene(st.spec).svg);
      const txt = document.createElement("div");
      txt.className = "txt";
      txt.innerHTML = st.text;
      fig.appendChild(txt);
      container.appendChild(fig);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-sequence]").forEach((n) => build(n, n.getAttribute("data-sequence")));
  });

  window.KnitSteps = { scene, build, SEQ };
})();
