/* =========================================================
   Knit From Zero — gl.js
   A very small hand-rolled WebGL renderer. No libraries.

   It does exactly what this site needs and nothing else:
   indexed triangle meshes, one material (hemisphere ambient +
   one directional light + a rim term), an orbit camera that
   behaves on a phone, HTML labels anchored to 3D points, and
   rendering only when something actually changed.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     4x4 matrix helpers. Column-major, like GL wants.
     --------------------------------------------------------- */
  const M4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),

    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
      return out;
    },

    lookAt(out, eye, at, up) {
      let z0 = eye[0] - at[0], z1 = eye[1] - at[1], z2 = eye[2] - at[2];
      let l = Math.hypot(z0, z1, z2) || 1; z0 /= l; z1 /= l; z2 /= l;
      let x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
      l = Math.hypot(x0, x1, x2);
      if (!l) { x0 = 1; x1 = 0; x2 = 0; } else { x0 /= l; x1 /= l; x2 /= l; }
      const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
      out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
      out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
      out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
      out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
      out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
      out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
      out[15] = 1;
      return out;
    },

    mul(out, a, b) {
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return out;
    },

    transform(m, p) {
      return [
        m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
        m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
      ];
    },
  };

  /* ---------------------------------------------------------
     Shaders. Written in GLSL ES 1.00 so the same source works
     on a WebGL2 context and on a WebGL1 fallback.
     --------------------------------------------------------- */
  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec3 vColor;
    void main() {
      vec4 world = uModel * vec4(aPos, 1.0);
      vWorld = world.xyz;
      vNormal = mat3(uModel) * aNormal;
      vColor = aColor;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }`;

  const FS = `
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec3 vColor;
    uniform vec3 uLightDir;
    uniform vec3 uCamPos;
    uniform vec3 uSky;
    uniform vec3 uGround;
    uniform vec3 uRim;
    uniform float uAmbient;
    uniform float uOpacity;
    void main() {
      vec3 N = normalize(vNormal);
      if (!gl_FrontFacing) N = -N;
      vec3 V = normalize(uCamPos - vWorld);
      vec3 L = normalize(uLightDir);

      float diff = max(dot(N, L), 0.0);
      float back = max(dot(N, normalize(vec3(-L.x, 0.35, -L.z))), 0.0) * 0.22;
      vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5) * uAmbient;
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);

      vec3 col = vColor * (hemi + diff * 0.95 + back) + uRim * rim * 0.30;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), uOpacity);
    }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("KFZGL shader:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  /* read a colour from the CSS custom properties so 3D matches the theme */
  function cssColour(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (!hex) return fallback;
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  /* ---------------------------------------------------------
     Scene
     --------------------------------------------------------- */
  let uid = 0;

  function create(host, opts) {
    const o = Object.assign({
      distance: 4, phi: 0.35, theta: 0.6, target: [0, 0, 0],
      fov: 40, minDist: 1, maxDist: 40, autoRotate: false,
      background: null, caption: null, label: "Interactive 3D model",
    }, opts || {});

    const canvas = document.createElement("canvas");
    canvas.className = "gl-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", o.label);
    canvas.tabIndex = 0;

    const stage = document.createElement("div");
    stage.className = "gl-stage";
    const overlay = document.createElement("div");
    overlay.className = "gl-overlay";
    stage.append(canvas, overlay);

    const HINT_HTML = "<span>drag to turn</span><span>click first, then scroll to zoom</span><span>double-tap to reset</span>";
    const hint = document.createElement("div");
    hint.className = "gl-hint";
    hint.innerHTML = HINT_HTML;
    stage.appendChild(hint);

    /* A canvas is a bitmap and exposes nothing to assistive technology,
       so the instructions live in real text and the camera gets real
       buttons as well as the pointer and the keyboard. */
    const helpId = "gl-help-" + (++uid);
    const help = document.createElement("p");
    help.id = helpId;
    help.className = "sr-only";
    help.textContent = "Interactive 3D model. Use the arrow keys to turn it, plus and minus to zoom, and 0 to reset the view. The buttons below do the same.";
    canvas.setAttribute("aria-describedby", helpId);

    host.appendChild(stage);
    host.appendChild(help);

    const nudge = document.createElement("div");
    nudge.className = "gl-nudge";
    [["↺", "Turn left", () => { cam.theta -= 0.35; }],
     ["↻", "Turn right", () => { cam.theta += 0.35; }],
     ["＋", "Zoom in", () => { cam.d = Math.max(o.minDist, cam.d * 0.85); }],
     ["－", "Zoom out", () => { cam.d = Math.min(o.maxDist, cam.d * 1.18); }],
     ["⌂", "Reset the view", () => { cam.d = home.d; cam.phi = home.phi; cam.theta = home.theta; }],
    ].forEach(([glyph, label, fn]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = glyph;
      b.title = label;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", () => { fn(); kick(); });
      nudge.appendChild(b);
    });
    stage.appendChild(nudge);

    /* register this BEFORE getContext — it is the only place the
       browser tells you why creation failed */
    let creationError = "";
    canvas.addEventListener("webglcontextcreationerror", (e) => { creationError = e.statusMessage || ""; });

    /* alpha:true is deliberate: alpha:false takes a slower compositing
       path on several platforms. antialias:true is close to free on the
       tile-based GPUs in phones and beats raising devicePixelRatio. */
    const ATTRS = { alpha: true, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: "default" };
    let gl = canvas.getContext("webgl2", ATTRS);
    let isGL2 = !!gl;
    if (!gl) gl = canvas.getContext("webgl", ATTRS);
    if (!gl) {
      stage.remove();
      help.remove();
      nudge.remove();
      const msg = document.createElement("div");
      msg.className = "gl-fallback";
      msg.innerHTML = "<b>3D unavailable</b><p>Your browser has WebGL turned off or blocked, so the interactive model cannot be shown. Everything it demonstrates is also covered by the flat diagrams on this page.</p>"
        + (creationError ? '<p class="small" style="margin-top:.5rem;opacity:.7">' + creationError + "</p>" : "");
      host.appendChild(msg);
      return null;
    }
    /* 32-bit indices need WebGL2 or the extension; without either, a mesh
       over 65535 vertices simply cannot be indexed and must be refused
       rather than drawn as garbage */
    let uintOK = isGL2 || !!gl.getExtension("OES_element_index_uint");

    let prog = null;
    const U = {};
    function buildProgram() {
      prog = gl.createProgram();
      const vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, "aPos");
      gl.bindAttribLocation(prog, 1, "aNormal");
      gl.bindAttribLocation(prog, 2, "aColor");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.warn("KFZGL link:", gl.getProgramInfoLog(prog));
      /* uniform locations do not survive a context loss either */
      ["uMVP", "uModel", "uLightDir", "uCamPos", "uSky", "uGround", "uRim", "uAmbient", "uOpacity"]
        .forEach((n) => U[n] = gl.getUniformLocation(prog, n));
    }
    buildProgram();

    const meshes = [];
    const labels = [];
    const proj = M4.ident(), view = M4.ident(), mvp = M4.ident(), vp = M4.ident();

    const cam = { d: o.distance, phi: o.phi, theta: o.theta, target: o.target.slice() };
    const home = { d: cam.d, phi: cam.phi, theta: cam.theta };

    let needsRender = true, visible = true, alive = true, spin = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---- sizing ---- */
    let W = 1, H = 1;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        needsRender = true;
      }
      W = gl.drawingBufferWidth; H = gl.drawingBufferHeight;
    }
    const ro = new ResizeObserver(() => { resize(); kick(); });
    ro.observe(canvas);

    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) kick();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0, rootMargin: "200px 0px" });
    io.observe(canvas);

    /* ---- buffers ---- */
    function upload(mesh) {
      const m = {
        spec: mesh,                 // retained so the mesh survives a context loss
        color: mesh.color || [0.8, 0.4, 0.3],
        model: mesh.model || M4.ident(),
        opacity: mesh.opacity == null ? 1 : mesh.opacity,
        doubleSided: !!mesh.doubleSided,
        hidden: !!mesh.hidden,
        name: mesh.name || "",
        count: mesh.indices.length,
      };
      const n = mesh.positions.length / 3;
      let colours = mesh.colors;
      if (!colours) {
        colours = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { colours[i * 3] = m.color[0]; colours[i * 3 + 1] = m.color[1]; colours[i * 3 + 2] = m.color[2]; }
      }
      m.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
      m.nrm = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.nrm); gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
      m.col = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.col); gl.bufferData(gl.ARRAY_BUFFER, colours, gl.STATIC_DRAW);
      m.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
      const needsBig = mesh.positions.length / 3 > 65535;
      if (needsBig && !uintOK) {
        console.warn("KFZGL: mesh needs 32-bit indices but this context has none; skipping.");
        m.count = 0;
      }
      const big = needsBig && uintOK;
      m.type = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices), gl.STATIC_DRAW);
      /* keep the bounds so the camera can frame the scene */
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < mesh.positions.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = mesh.positions[i + k];
          if (v < lo[k]) lo[k] = v;
          if (v > hi[k]) hi[k] = v;
        }
      }
      m.lo = lo; m.hi = hi;
      meshes.push(m);
      needsRender = true;
      return m;
    }

    /* Point the camera so everything currently in the scene fits. */
    function frame(pad) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      meshes.forEach((m) => {
        if (m.hidden || !m.lo) return;
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.lo[k]); hi[k] = Math.max(hi[k], m.hi[k]); }
      });
      if (!isFinite(lo[0])) return;
      const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
      const half = [0, 1, 2].map((k) => (hi[k] - lo[k]) / 2);
      const radius = Math.hypot(half[0], half[1], half[2]);
      const aspect = W / Math.max(1, H);
      const vFov = o.fov * Math.PI / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      /* fit the bounding box, not its sphere — a flat swatch wastes a
         lot of frame if you fit the sphere */
      const depth = Math.max(half[0], half[1], half[2]) * 0.6;
      const d = Math.max(
        half[1] / Math.tan(vFov / 2),
        half[0] / Math.tan(hFov / 2)
      ) * (pad || 1.06) + depth;
      cam.target = c;
      cam.d = d;
      home.d = d;
      o.maxDist = Math.max(o.maxDist, d * 3);
      o.minDist = Math.min(o.minDist, d * 0.12);
      needsRender = true;
      return { center: c, radius };
    }

    function clear() {
      meshes.forEach((m) => { gl.deleteBuffer(m.pos); gl.deleteBuffer(m.nrm); gl.deleteBuffer(m.col); gl.deleteBuffer(m.idx); });
      meshes.length = 0;
      labels.forEach((l) => l.el.remove());
      labels.length = 0;
      needsRender = true;
    }

    function addLabel(pos, text, cls) {
      const el = document.createElement("span");
      el.className = "gl-label " + (cls || "");
      el.innerHTML = text;
      overlay.appendChild(el);
      const l = { pos, el };
      labels.push(l);
      needsRender = true;
      return l;
    }

    /* ---- drawing ---- */
    function draw() {
      if (gl.isContextLost()) return;
      resize();
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);

      const ct = Math.cos(cam.theta), st = Math.sin(cam.theta);
      const cp = Math.cos(cam.phi), sp = Math.sin(cam.phi);
      const eye = [
        cam.target[0] + cam.d * cp * st,
        cam.target[1] + cam.d * sp,
        cam.target[2] + cam.d * cp * ct,
      ];
      M4.perspective(proj, o.fov * Math.PI / 180, W / Math.max(1, H), 0.05, 200);
      M4.lookAt(view, eye, cam.target, [0, 1, 0]);
      M4.mul(vp, proj, view);

      const sky = cssColour("--paper-3", [0.9, 0.86, 0.78]);
      const ground = cssColour("--paper", [0.98, 0.96, 0.92]);
      const rim = cssColour("--ochre", [0.7, 0.5, 0.1]);
      const dark = document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);

      gl.uniform3fv(U.uLightDir, new Float32Array([0.45, 0.78, 0.44]));
      gl.uniform3fv(U.uCamPos, new Float32Array(eye));
      gl.uniform3fv(U.uSky, new Float32Array(sky));
      gl.uniform3fv(U.uGround, new Float32Array(ground));
      gl.uniform3fv(U.uRim, new Float32Array(rim));
      gl.uniform1f(U.uAmbient, dark ? 0.55 : 0.62);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const opaque = meshes.filter((m) => !m.hidden && m.opacity >= 1);
      const clear_ = meshes.filter((m) => !m.hidden && m.opacity < 1);

      [opaque, clear_].forEach((group, pass) => {
        gl.depthMask(pass === 0);
        group.forEach((m) => {
          if (m.doubleSided) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
          M4.mul(mvp, vp, m.model);
          gl.uniformMatrix4fv(U.uMVP, false, mvp);
          gl.uniformMatrix4fv(U.uModel, false, m.model);
          gl.uniform1f(U.uOpacity, m.opacity);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.nrm); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.col); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
          gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
        });
      });
      gl.depthMask(true);

      /* HTML labels, projected */
      if (labels.length) {
        const rect = canvas.getBoundingClientRect();
        labels.forEach((l) => {
          const c = M4.transform(vp, l.pos);
          if (c[3] <= 0.001) { l.el.style.opacity = 0; return; }
          const x = (c[0] / c[3] * 0.5 + 0.5) * rect.width;
          const y = (-c[1] / c[3] * 0.5 + 0.5) * rect.height;
          l.el.style.transform = `translate(-50%,-50%) translate(${x}px, ${y}px)`;
          l.el.style.opacity = 1;
        });
      }
    }

    let raf = 0;
    function tick() {
      raf = 0;
      if (!alive) return;
      if (o.autoRotate && !reduced && !dragging && !document.hidden) { cam.theta += 0.0035; needsRender = true; }
      if (needsRender) { needsRender = false; draw(); }
      if (visible && !document.hidden && ((o.autoRotate && !reduced) || needsRender)) raf = requestAnimationFrame(tick);
    }
    function kick() {
      needsRender = true;
      /* deliberately NOT gated on document.hidden: a page that loads in a
         background tab must still have a painted first frame, or it shows
         an empty box the moment it is revealed. Continuous animation is
         gated instead, inside tick(). */
      if (raf || !alive || !visible || gl.isContextLost()) return;
      raf = requestAnimationFrame(tick);
    }

    /* ---- orbit controls ---- */
    let dragging = false, lastX = 0, lastY = 0, lastTap = 0;
    const pointers = new Map();
    let pinchStart = 0, pinchDist = 0;

    canvas.style.touchAction = "pan-y";      // vertical page scroll still works

    canvas.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
      if (pointers.size === 2) {
        const p = [...pointers.values()];
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        pinchStart = cam.d;
      }
      const now = performance.now();
      if (now - lastTap < 320) { cam.d = home.d; cam.phi = home.phi; cam.theta = home.theta; kick(); }
      lastTap = now;
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        const p = [...pointers.values()];
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0) {
          cam.d = Math.max(o.minDist, Math.min(o.maxDist, pinchStart * (pinchDist / Math.max(1, d))));
          kick();
        }
        e.preventDefault();
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      /* only claim the gesture once it is clearly horizontal-ish, so a
         vertical flick still scrolls the page */
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        cam.theta -= dx * 0.008;
        cam.phi = Math.max(-1.45, Math.min(1.45, cam.phi + dy * 0.008));
        kick();
      }
    });

    const release = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 1) {
        /* re-seed the drag from the finger that is still down, or the next
           move is interpreted as one huge jump */
        const p = pointers.values().next().value;
        lastX = p.x; lastY = p.y;
      }
      if (pointers.size === 0) dragging = false;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    /* A 16:10 stage is most of a phone screen and half a laptop one, so a
       wheel handler that always zooms traps the reader. Zoom only on a
       trackpad pinch (ctrlKey) or once the reader has actually clicked
       into the model; otherwise let the page scroll past. */
    canvas.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && document.activeElement !== canvas) return;
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const factor = Math.exp(Math.max(-1.2, Math.min(1.2, px * (e.ctrlKey ? 0.012 : 0.0022))));
      cam.d = Math.max(o.minDist, Math.min(o.maxDist, cam.d * factor));
      kick();
    }, { passive: false });

    canvas.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.25 : 0.09;
      let used = true;
      switch (e.key) {
        case "ArrowLeft": cam.theta -= step; break;
        case "ArrowRight": cam.theta += step; break;
        case "ArrowUp": cam.phi = Math.min(1.45, cam.phi + step); break;
        case "ArrowDown": cam.phi = Math.max(-1.45, cam.phi - step); break;
        case "+": case "=": cam.d = Math.max(o.minDist, cam.d * 0.9); break;
        case "-": case "_": cam.d = Math.min(o.maxDist, cam.d * 1.1); break;
        case "0": cam.d = home.d; cam.phi = home.phi; cam.theta = home.theta; break;
        default: used = false;
      }
      if (used) { e.preventDefault(); kick(); }
    });

    /* ---- context loss ---- */
    /* preventDefault is REQUIRED — without it the context stays dead
       for good and webglcontextrestored never fires */
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      hint.innerHTML = "<span>3D paused — the graphics context was lost</span>";
    });
    canvas.addEventListener("webglcontextrestored", () => {
      /* every GPU handle is invalid now — buffers, shaders, the program
         and even the uniform locations. Rebuild all of it from the
         CPU-side data we deliberately kept. */
      uintOK = isGL2 || !!gl.getExtension("OES_element_index_uint");
      buildProgram();
      const specs = meshes.map((m) => m.spec);
      meshes.length = 0;
      specs.forEach(upload);
      hint.innerHTML = HINT_HTML;
      needsRender = true;
      kick();
      if (o.onRestore) o.onRestore();
    });
    const onVisible = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVisible);
    const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

    /* ---- theme changes ---- */
    const mo = new MutationObserver(kick);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    darkMQ.addEventListener("change", kick);

    resize();
    kick();

    return {
      gl, canvas, stage, overlay, cam,
      add: upload,
      clear,
      frame,
      addLabel,
      setHint(html) { hint.innerHTML = html; },
      lookAt(target) { cam.target = target.slice(); kick(); },
      setCamera(c) { Object.assign(cam, c); kick(); },
      home() { cam.d = home.d; cam.phi = home.phi; cam.theta = home.theta; kick(); },
      invalidate: kick,
      meshes,
      dispose() {
        alive = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        ro.disconnect(); io.disconnect(); mo.disconnect();
        document.removeEventListener("visibilitychange", onVisible);
        darkMQ.removeEventListener("change", kick);
        clear();
        /* browsers cap live contexts at roughly a dozen — hand this one back */
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
        stage.remove();
        help.remove();
      },
    };
  }

  /* =========================================================
     Geometry builders
     ========================================================= */

  /* WINDING: every builder here emits counter-clockwise triangles when
     seen from outside the surface, which is what gl.cullFace(BACK)
     expects. Get this backwards and the renderer quietly draws the
     inside of everything — lit from the wrong side, with the rim term
     saturated over the whole model. There is a unit check for it in
     the console: KFZGeom.checkWinding(). */

  /* A tube swept along a polyline, using parallel-transport frames
     so the cross-section never spins as the curve turns. */
  function tube(points, radius, radial, opts) {
    const o = Object.assign({ caps: true, colorAt: null }, opts || {});
    const n = points.length;
    const rad = radial || 8;
    const rFn = typeof radius === "function" ? radius : () => radius;

    /* tangents */
    const T = [];
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const l = Math.hypot(t[0], t[1], t[2]) || 1;
      T.push([t[0] / l, t[1] / l, t[2] / l]);
    }

    /* first frame: any vector not parallel to T[0] */
    let up = Math.abs(T[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let N0 = cross(up, T[0]);
    normalise(N0);
    const N = [N0], B = [cross(T[0], N0)];

    for (let i = 1; i < n; i++) {
      const v = cross(T[i - 1], T[i]);
      const s = Math.hypot(v[0], v[1], v[2]);
      let nn;
      if (s < 1e-8) nn = N[i - 1].slice();
      else {
        normalise(v);
        const c = Math.max(-1, Math.min(1, dot(T[i - 1], T[i])));
        nn = rotAxis(N[i - 1], v, Math.acos(c));
      }
      /* re-orthogonalise against drift */
      const d = dot(nn, T[i]);
      nn = [nn[0] - d * T[i][0], nn[1] - d * T[i][1], nn[2] - d * T[i][2]];
      normalise(nn);
      N.push(nn);
      B.push(cross(T[i], nn));
    }

    const positions = new Float32Array(n * rad * 3);
    const normals = new Float32Array(n * rad * 3);
    const colors = o.colorAt ? new Float32Array(n * rad * 3) : null;
    const indices = [];

    for (let i = 0; i < n; i++) {
      const p = points[i], r = rFn(i, n);
      const c = o.colorAt ? o.colorAt(i, n) : null;
      for (let j = 0; j < rad; j++) {
        const a = (j / rad) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const nx = ca * N[i][0] + sa * B[i][0];
        const ny = ca * N[i][1] + sa * B[i][1];
        const nz = ca * N[i][2] + sa * B[i][2];
        const k = (i * rad + j) * 3;
        positions[k] = p[0] + nx * r; positions[k + 1] = p[1] + ny * r; positions[k + 2] = p[2] + nz * r;
        normals[k] = nx; normals[k + 1] = ny; normals[k + 2] = nz;
        if (c) { colors[k] = c[0]; colors[k + 1] = c[1]; colors[k + 2] = c[2]; }
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < rad; j++) {
        const j2 = (j + 1) % rad;
        const a = i * rad + j, b = i * rad + j2, c = (i + 1) * rad + j, d = (i + 1) * rad + j2;
        indices.push(a, b, c, b, d, c);
      }
    }
    if (o.caps) {
      /* close both ends with a fan, otherwise back-face culling makes the
         cut ends of the yarn read as holes */
      for (let j = 1; j < rad - 1; j++) {
        indices.push(0, j + 1, j);                    // start cap faces backwards along the curve
        const base = (n - 1) * rad;
        indices.push(base, base + j, base + j + 1);   // end cap faces forwards
      }
    }
    return { positions, normals, colors, indices };
  }

  /* A lofted surface through a list of elliptical stations.
     station = { c:[x,y,z], rx, ry, roll?, skip?(seg,ring)->bool } */
  function loft(stations, radial, opts) {
    const o = Object.assign({ capStart: true, capEnd: true, hole: null, colorAt: null }, opts || {});
    const n = stations.length, rad = radial || 24;
    const positions = new Float32Array(n * rad * 3);
    const normals = new Float32Array(n * rad * 3);
    const colors = o.colorAt ? new Float32Array(n * rad * 3) : null;
    const indices = [];

    /* the spine tangent at each station, so rings face along the body */
    const T = [];
    for (let i = 0; i < n; i++) {
      const a = stations[Math.max(0, i - 1)].c, b = stations[Math.min(n - 1, i + 1)].c;
      const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      normalise(t);
      T.push(t);
    }

    for (let i = 0; i < n; i++) {
      const s = stations[i], t = T[i];
      /* pick a reference axis that is not parallel to the tangent, or a
         vertical spine (an ear, a straight collar) gives a zero-length
         cross product and the whole ring collapses onto the centreline */
      const ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let side = cross(ref, t); normalise(side);
      let up = cross(t, side); normalise(up);
      for (let j = 0; j < rad; j++) {
        const a = (j / rad) * Math.PI * 2;
        const c = o.colorAt ? o.colorAt(i, n, a, s) : null;
        const ex = Math.cos(a) * s.rx, ey = Math.sin(a) * s.ry;
        const k = (i * rad + j) * 3;
        positions[k] = s.c[0] + side[0] * ex + up[0] * ey;
        positions[k + 1] = s.c[1] + side[1] * ex + up[1] * ey;
        positions[k + 2] = s.c[2] + side[2] * ex + up[2] * ey;
        /* normal of an ellipse: scale the direction by 1/r² */
        let nx = Math.cos(a) / Math.max(1e-4, s.rx), ny = Math.sin(a) / Math.max(1e-4, s.ry);
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        normals[k] = side[0] * nx + up[0] * ny;
        normals[k + 1] = side[1] * nx + up[1] * ny;
        normals[k + 2] = side[2] * nx + up[2] * ny;
        if (c) { colors[k] = c[0]; colors[k + 1] = c[1]; colors[k + 2] = c[2]; }
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < rad; j++) {
        if (o.hole && o.hole(i, j, n, rad)) continue;
        const j2 = (j + 1) % rad;
        const a = i * rad + j, b = i * rad + j2, c = (i + 1) * rad + j, d = (i + 1) * rad + j2;
        indices.push(a, b, c, b, d, c);
      }
    }
    /* flat caps */
    function cap(ring, flip) {
      const base = ring * rad;
      for (let j = 1; j < rad - 1; j++) {
        if (flip) indices.push(base, base + j + 1, base + j);
        else indices.push(base, base + j, base + j + 1);
      }
    }
    if (o.capStart) cap(0, true);
    if (o.capEnd) cap(n - 1, false);
    return { positions, normals, colors, indices };
  }

  /* A sphere, for eyes, joints and paws. */
  function sphere(cx, cy, cz, r, seg, rings) {
    seg = seg || 14; rings = rings || 10;
    const positions = [], normals = [], indices = [];
    for (let i = 0; i <= rings; i++) {
      const v = (i / rings) * Math.PI, sv = Math.sin(v), cv = Math.cos(v);
      for (let j = 0; j <= seg; j++) {
        const u = (j / seg) * Math.PI * 2;
        const nx = sv * Math.cos(u), ny = cv, nz = sv * Math.sin(u);
        positions.push(cx + nx * r, cy + ny * r, cz + nz * r);
        normals.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j, b = a + seg + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices };
  }

  /* Merge meshes into one draw call, optionally tinting each. */
  function merge(list) {
    let np = 0, ni = 0;
    list.forEach((m) => { np += m.positions.length; ni += m.indices.length; });
    const positions = new Float32Array(np), normals = new Float32Array(np), colors = new Float32Array(np);
    const indices = new Array(ni);
    let po = 0, io = 0, vo = 0;
    list.forEach((m) => {
      positions.set(m.positions, po); normals.set(m.normals, po);
      const cnt = m.positions.length / 3;
      if (m.colors) colors.set(m.colors, po);
      else {
        const c = m.color || [0.8, 0.4, 0.3];
        for (let i = 0; i < cnt; i++) { colors[po + i * 3] = c[0]; colors[po + i * 3 + 1] = c[1]; colors[po + i * 3 + 2] = c[2]; }
      }
      for (let i = 0; i < m.indices.length; i++) indices[io + i] = m.indices[i] + vo;
      po += m.positions.length; io += m.indices.length; vo += cnt;
    });
    return { positions, normals, colors, indices };
  }

  /* ---- tiny vector helpers ---- */
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function normalise(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }
  function rotAxis(v, axis, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), k = dot(axis, v) * (1 - c), x = cross(axis, v);
    return [v[0] * c + x[0] * s + axis[0] * k, v[1] * c + x[1] * s + axis[1] * k, v[2] * c + x[2] * s + axis[2] * k];
  }

  /* Catmull-Rom through control points, for hand-placed curves. */
  function spline(pts, samplesPerSeg, closed) {
    const out = [];
    const n = pts.length;
    const at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < samplesPerSeg; s++) {
        const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map((k) =>
          0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }

  /* Convex test meshes must come out with their triangle normals
     pointing away from the centre. Cheap insurance against the
     winding silently inverting again. */
  function checkWinding() {
    const report = {};
    const test = (name, mesh, centre) => {
      let out = 0, inn = 0;
      for (let k = 0; k < mesh.indices.length; k += 3) {
        const p = (i) => [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
        const a = p(mesh.indices[k]), b = p(mesh.indices[k + 1]), c = p(mesh.indices[k + 2]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = cross(u, v);
        const cen = [(a[0] + b[0] + c[0]) / 3 - centre[0], (a[1] + b[1] + c[1]) / 3 - centre[1], (a[2] + b[2] + c[2]) / 3 - centre[2]];
        const d = dot(n, cen);
        if (Math.abs(d) < 1e-12) continue;
        if (d > 0) out++; else inn++;
      }
      report[name] = { outward: out, inward: inn, ok: inn === 0 };
    };
    test("sphere", sphere(0, 0, 0, 1, 12, 8), [0, 0, 0]);
    const line = []; for (let i = 0; i <= 10; i++) line.push([0, i * 0.5, 0]);
    test("tube", tube(line, 0.3, 10), [0, 2.5, 0]);
    test("loft", loft(line.map((p) => ({ c: p, rx: 0.3, ry: 0.3 })), 12), [0, 2.5, 0]);
    return report;
  }

  window.KFZGL = { create, M4, cssColour };
  window.KFZGeom = { tube, loft, sphere, merge, spline, cross, dot, normalise, checkWinding };
})();
