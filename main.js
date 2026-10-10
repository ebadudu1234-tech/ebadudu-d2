const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ---------- Project data helpers ---------- */
const bySlug = (slug) => PROJECTS.find((p) => p.slug === slug);
const mediaOf = (p) => MEDIA[p.slug] || [];
const coverItem = (p) => mediaOf(p)[p.cover || 0];
const coverSrc = (p) => { const m = coverItem(p); return m && (m.poster || m.src); };
const videoOf = (p) => (p.hoverVideo != null ? mediaOf(p)[p.hoverVideo] : mediaOf(p).find((m) => m.type === 'video'));
const projectUrl = (p) => `project.html?p=${encodeURIComponent(p.slug)}`;
const tagsHtml = (tags) => `<ul class="tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

/* Loop a muted video from `start` seconds (skips the title card at the head of some films) */
function loopVideo(v, start = 0) {
  v.muted = true;
  v.playsInline = true;
  if (!start) { v.loop = true; return v; }
  const toStart = () => { v.currentTime = start; };
  if (v.readyState >= 1) toStart(); else v.addEventListener('loadedmetadata', toStart, { once: true });
  v.addEventListener('ended', () => { toStart(); v.play().catch(() => {}); });
  return v;
}
function videoEl(m, start, { poster = m.poster, preload = 'metadata' } = {}) {
  const v = document.createElement('video');
  v.src = m.src;
  if (poster) v.poster = poster;
  v.preload = preload;
  return loopVideo(v, start);
}

/* Reveal elements as they scroll in (adds .is-in) */
function reveal(selector, opts = { threshold: 0.12 }) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), opts);
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}

/* ---------- Green pill that trails the cursor over the given elements ---------- */
function setupFollow(selector) {
  const pill = document.getElementById('follow');
  if (!pill) return;
  pillCursor(pill, (target) => !!target.closest(selector));
}

/* The pill IS the mouse: centred on the pointer, no lag, the arrow is hidden (CSS
   cursor: none) wherever the pill shows. `isOn(target)` says where it shows. */
function pillCursor(pill, isOn) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let x = 0, y = 0, queued = false;
  const place = () => {
    queued = false;
    pill.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  };
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    pill.classList.add('is-following');
    pill.classList.toggle('is-on', isOn(e.target instanceof Element ? e.target : document.body));
    if (!queued) { queued = true; requestAnimationFrame(place); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => pill.classList.remove('is-on'));
}

/* ============ Home: one screen, works play one after another ============ */
const SLIDE_MS = 6000;

function setupHome() {
  const list = SLIDES.map(bySlug).filter(Boolean);
  const slidesEl = document.getElementById('slides');
  const dots = document.getElementById('dots');
  const cap = document.getElementById('cap');
  const stage = document.getElementById('stage');

  // each slide: the cover still, plus its video (if any) which plays while the slide is on
  const slides = list.map((p) => {
    const el = document.createElement('div');
    el.className = 'slide';
    const img = new Image();
    img.src = coverSrc(p);
    img.alt = p.title;
    el.append(img);
    const m = videoOf(p);
    let video = null;
    if (m) {
      video = videoEl(m, p.start, { poster: null, preload: 'none' });
      video.addEventListener('playing', () => el.classList.add('is-playing'));
      el.append(video);
    }
    slidesEl.append(el);
    return { p, el, img, video };
  });
  dots.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);
  dots.innerHTML = list.map((p) => `<button type="button" aria-label="${esc(p.title)}"></button>`).join('');
  const buttons = [...dots.children];

  const canvas = document.getElementById('fx');
  const fx = flowSupported() ? createFxFlow(canvas) : createFxLite(canvas);
  if (fx) document.body.classList.add('fx-on');

  let current = -1, timer = 0;
  const show = (i) => {
    i = (i + slides.length) % slides.length;
    if (i === current) return;
    const prev = slides[current];
    current = i;
    const s = slides[i];
    if (prev) {
      prev.el.classList.remove('is-on', 'is-playing');
      prev.video?.pause();
    }
    s.el.classList.add('is-on');
    if (s.video) {
      s.video.preload = 'auto';
      s.video.play().catch(() => {});
    }
    buttons.forEach((b, n) => b.setAttribute('aria-current', String(n === i)));
    if (fx) fx.setSlide(s, !!prev);
    // caption swaps with a little fade
    cap.classList.add('swap');
    setTimeout(() => {
      cap.href = projectUrl(s.p);
      cap.querySelector('b').textContent = s.p.title;
      cap.querySelector('span').textContent = `${s.p.year} · ${s.p.tags.join(' / ')}`;
      cap.classList.remove('swap');
    }, prev ? 280 : 0);
    clearTimeout(timer);
    timer = setTimeout(() => show(current + 1), SLIDE_MS);
  };
  buttons.forEach((b, n) => b.addEventListener('click', () => show(n)));
  addEventListener('keydown', (e) => {
    if (document.body.classList.contains('intro-on')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') show(current + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') show(current - 1);
  });
  // the whole picture is the "VIEW ALL MY WORK" button
  stage.addEventListener('click', () => { location.href = 'work.html'; });
  show(0);
  setupGoFollow();
}

/* "VIEW ALL MY WORK" is the mouse on the home page; over the nav, caption and dots
   the normal arrow comes back so they stay clickable */
function setupGoFollow() {
  pillCursor(document.getElementById('go'), (target) => !target.closest('.bar, .slide-cap, .dots'));
}

/* ============ Flowing particles (WebGL2 GPU simulation) ============
   Every particle has its own offset and velocity, stored in float textures and stepped
   on the GPU each frame. The mouse pushes nearby particles away, carries them along its
   path and swirls them; disturbed particles drift on a curl-noise flow, then a soft
   spring brings each one home with a little overshoot. Where particles are out, the
   picture underneath drops to ~10% so they carry the image; moving ones glint. */
function flowSupported() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    return !!(gl && gl.getExtension('EXT_color_buffer_float'));
  } catch (e) { return false; }
}

function createFxFlow(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;

  /* feel — tweak here */
  const FEEL = {
    radius: 74,     // px reach of the mouse (KA 0.6667 of the first version)
    repel: 2200,    // push away while the mouse moves
    rest: 240,      // a gentle push even when the mouse is still
    carry: 1.1,     // how much particles travel with the mouse (kept short)
    swirl: 1300,    // sideways spin around the mouse
    flow: 380,      // curl-noise drift of disturbed particles
    spring: 22,     // pull home (higher = snappier)
    damping: 3.3,   // friction (lower = more overshoot / wobble)
    fade: 1.1,      // how fast a particle calms down again
  };

  const V = '#version 300 es\n';
  const quadVS = `${V}in vec2 aQ; out vec2 vUv; void main() { vUv = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`;
  const picture = `
    uniform sampler2D uT0, uT1; uniform vec2 uAsp, uRes; uniform float uMix;
    vec2 cover(vec2 uv, float ia) {
      float sa = uRes.x / uRes.y;
      vec2 r = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
      return (uv - 0.5) * r + 0.5;
    }
    vec3 picture(vec2 p) {
      vec2 uv = vec2(p.x / uRes.x, 1.0 - p.y / uRes.y);
      return mix(texture(uT0, cover(uv, uAsp.x)).rgb, texture(uT1, cover(uv, uAsp.y)).rgb, uMix);
    }`;

  // 1. step the simulation (one texel = one particle; home = its grid cell)
  const stepFS = `${V}precision highp float;
    uniform sampler2D uS0, uS1;
    uniform float uSp, uDt, uTime, uOn;
    uniform vec2 uMouse, uMVel;
    uniform float uR, uRepel, uRest, uCarry, uSwirl, uFlow, uSpring, uDamp, uFade;
    layout(location = 0) out vec4 o0;
    layout(location = 1) out vec4 o1;
    vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(dot(h2(i), f), dot(h2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
                 mix(dot(h2(i + vec2(0, 1)), f - vec2(0, 1)), dot(h2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
    }
    vec2 curl(vec2 p) {
      float e = 0.05;
      float dx = noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0));
      float dy = noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e));
      return vec2(dy, -dx) / (2.0 * e);
    }
    void main() {
      ivec2 ij = ivec2(gl_FragCoord.xy);
      vec4 s0 = texelFetch(uS0, ij, 0);
      float act = texelFetch(uS1, ij, 0).x;
      vec2 cell = (vec2(ij) + 0.5) * uSp;
      float r1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float r2 = fract(sin(dot(cell + 3.1, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 home = cell + (vec2(r1, r2) - 0.5) * uSp * 0.9;   // scattered inside its cell: no visible grid
      float weight = 0.55 + 0.9 * r2;                         // every particle reacts a bit differently
      vec2 off = s0.xy, vel = s0.zw;
      vec2 d = home + off - uMouse;
      float dist = length(d);
      vec2 n = d / (dist + 0.001);
      float fall = exp(-dist * dist / (uR * uR)) * uOn;
      float sp = clamp(length(uMVel) / 900.0, 0.0, 1.6);
      vec2 F = (n * fall * (uRest + uRepel * sp)
             + uMVel * fall * uCarry
             + vec2(-n.y, n.x) * fall * sp * uSwirl) * weight;
      act = max(act * exp(-uDt * uFade), fall * min(1.0, 0.2 + sp));
      F += curl(home * 0.011 + vec2(uTime * 0.13, -uTime * 0.09) + r1 * 0.4) * uFlow * act;
      F -= off * uSpring;
      vel += F * uDt;
      vel *= exp(-uDt * uDamp);
      off += vel * uDt;
      float L = length(off);
      if (L > 200.0) off *= 200.0 / L;
      o0 = vec4(off, vel);
      o1 = vec4(act, 0.0, 0.0, 1.0);
    }`;

  // 2. the picture, nudged by the particles' offsets and darkened where they are out
  const quadFS = `${V}precision highp float;
    in vec2 vUv; out vec4 o;
    uniform sampler2D uS0, uS1; uniform vec2 uGrid, uShift;
    ${picture}
    void main() {
      vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
      vec2 g = (p + uShift) / uGrid;   // this pixel's place on the particle grid
      float act = texture(uS1, g).x;
      vec2 off = texture(uS0, g).xy;
      vec3 c = picture(p - off * 0.35 - uShift);
      float hole = smoothstep(0.05, 0.42, act);
      o = vec4(c * (1.0 - hole * 0.9), 1.0);
    }`;

  // 3. the particles, coloured from their home in the picture; moving ones glint
  const ptsVS = `${V}precision highp float;
    uniform sampler2D uS0, uS1; uniform int uCols; uniform float uSp, uDpr, uTime; uniform vec2 uShift;
    ${picture}
    out vec3 vCol; out float vA;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      ivec2 ij = ivec2(gl_VertexID % uCols, gl_VertexID / uCols);
      vec4 s0 = texelFetch(uS0, ij, 0);
      float act = texelFetch(uS1, ij, 0).x;
      vec2 cell = (vec2(ij) + 0.5) * uSp;
      float r1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float r2 = fract(sin(dot(cell + 3.1, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 home = cell + (vec2(r1, r2) - 0.5) * uSp * 0.9;
      float h = r1;
      float glint = pow(0.5 + 0.5 * sin(uTime * 5.0 + h * 61.0 + length(s0.zw) * 0.015), 14.0) * act;
      vec2 p = home + s0.xy - uShift;
      vCol = picture(home - uShift) * (1.0 + act * 0.35) + glint * 0.9;
      vA = smoothstep(0.04, 0.28, act) * (0.55 + 0.45 * h);
      gl_PointSize = (1.3 + act * 1.7 + glint * 1.6) * uDpr;
      gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
    }`;
  const ptsFS = `${V}precision mediump float;
    in vec3 vCol; in float vA; out vec4 o;
    void main() {
      float r = length(gl_PointCoord - 0.5);
      if (r > 0.5) discard;
      o = vec4(vCol, vA * (1.0 - smoothstep(0.28, 0.5, r)));
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aQ');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  };
  let stepP, quadP, ptsP;
  try {
    stepP = program(quadVS, stepFS);
    quadP = program(quadVS, quadFS);
    ptsP = program(ptsVS, ptsFS);
  } catch (e) { console.warn('flow fx off:', e.message); return null; }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const emptyVao = gl.createVertexArray();  // particles need no attributes (gl_VertexID)

  const tex = (w, h, filter, internal, format, type) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    return t;
  };

  // two ping-pong states, each: [offset.xy, velocity.xy] + [activity]
  let SP = 4, cols = 0, rows = 0, W = 0, H = 0, dpr = 1;
  let states = [];
  const makeStates = () => {
    states.forEach((s) => { gl.deleteFramebuffer(s.fb); gl.deleteTexture(s.a); gl.deleteTexture(s.b); });
    states = [0, 1].map(() => {
      const a = tex(cols, rows, gl.LINEAR, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
      const b = tex(cols, rows, gl.LINEAR, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, a, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, b, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.viewport(0, 0, cols, rows);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { a, b, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    SP = W < 700 ? 5 : 4;
    cols = Math.ceil(W / SP); rows = Math.ceil(H / SP);
    makeStates();
  };
  resize();
  addEventListener('resize', resize);

  // the work pictures: slot 0 going away, slot 1 arriving
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const imgTex = () => {
    const t = tex(1, 1, gl.LINEAR, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  };
  const slots = [{ tex: imgTex(), src: null, asp: 1 }, { tex: imgTex(), src: null, asp: 1 }];
  let mixv = 1, mixFrom = 0;
  const upload = (slot) => {
    const s = slot.src;
    if (!s) return;
    const v = s.video;
    const useVideo = v && v.readyState >= 2 && v.videoWidth;
    const el = useVideo ? v : s.img;
    if (!useVideo && (!el.complete || !el.naturalWidth || slot.uploaded === el)) return;
    gl.bindTexture(gl.TEXTURE_2D, slot.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
    slot.asp = useVideo ? v.videoWidth / v.videoHeight : el.naturalWidth / el.naturalHeight;
    slot.uploaded = useVideo ? null : el;
  };

  // mouse: exact position + a smoothed velocity (px/s) that settles to 0 when it stops
  let mx = -9999, my = -9999, on = 0, onTarget = 0, vx = 0, vy = 0, rawVx = 0, rawVy = 0, lastMove = 0, lastT = 0, lx = 0, ly = 0;
  addEventListener('pointermove', (e) => {
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (list.length ? list : [e]).forEach((ev) => {
      if (lastT) {
        const dt = Math.max(1, ev.timeStamp - lastT) / 1000;
        rawVx = (ev.clientX - lx) / dt;
        rawVy = (ev.clientY - ly) / dt;
      }
      lx = ev.clientX; ly = ev.clientY; lastT = ev.timeStamp;
    });
    mx = e.clientX; my = e.clientY; onTarget = 1; lastMove = performance.now();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { onTarget = 0; });

  let sx = 0, sy = 0, prev = 0, cur = 0;
  const frame = (now) => {
    const dt = Math.min(0.033, prev ? (now - prev) / 1000 : 0.016);
    prev = now;
    if (now - lastMove > 60) { rawVx = 0; rawVy = 0; }      // the mouse has stopped
    const k = 1 - Math.exp(-dt * 14);
    vx += (rawVx - vx) * k; vy += (rawVy - vy) * k;
    on += (onTarget - on) * (1 - Math.exp(-dt * 6));
    if (mx > -9999) {
      const e2 = 1 - Math.exp(-dt * 3);
      sx += ((mx - W / 2) * -0.012 - sx) * e2;
      sy += ((my - H / 2) * -0.012 - sy) * e2;
    }
    if (mixv < 1) mixv = Math.min(1, (now - mixFrom) / 1100);
    upload(slots[1]);
    if (mixv < 1) upload(slots[0]);

    // step
    const from = states[cur], to = states[1 - cur];
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
    gl.viewport(0, 0, cols, rows);
    gl.disable(gl.BLEND);
    gl.useProgram(stepP.p);
    const su = stepP.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, from.a); gl.uniform1i(su.uS0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, from.b); gl.uniform1i(su.uS1, 1);
    gl.uniform1f(su.uSp, SP); gl.uniform1f(su.uDt, dt); gl.uniform1f(su.uTime, now / 1000); gl.uniform1f(su.uOn, on);
    gl.uniform2f(su.uMouse, mx + sx, my + sy); gl.uniform2f(su.uMVel, vx, vy);
    gl.uniform1f(su.uR, FEEL.radius); gl.uniform1f(su.uRepel, FEEL.repel); gl.uniform1f(su.uRest, FEEL.rest);
    gl.uniform1f(su.uCarry, FEEL.carry); gl.uniform1f(su.uSwirl, FEEL.swirl); gl.uniform1f(su.uFlow, FEEL.flow);
    gl.uniform1f(su.uSpring, FEEL.spring); gl.uniform1f(su.uDamp, FEEL.damping); gl.uniform1f(su.uFade, FEEL.fade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cur = 1 - cur;
    const st = states[cur];

    // draw: picture, then particles
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const bindCommon = (u) => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.a); gl.uniform1i(u.uS0, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, st.b); gl.uniform1i(u.uS1, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, slots[0].tex); gl.uniform1i(u.uT0, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, slots[1].tex); gl.uniform1i(u.uT1, 3);
      gl.uniform2f(u.uAsp, slots[0].asp, slots[1].asp);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform1f(u.uMix, mixv);
      gl.uniform2f(u.uShift, sx, sy);
    };
    gl.useProgram(quadP.p);
    bindCommon(quadP.u);
    gl.uniform2f(quadP.u.uGrid, cols * SP, rows * SP);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(emptyVao);
    gl.useProgram(ptsP.p);
    bindCommon(ptsP.u);
    gl.uniform1i(ptsP.u.uCols, cols); gl.uniform1f(ptsP.u.uSp, SP); gl.uniform1f(ptsP.u.uDpr, dpr); gl.uniform1f(ptsP.u.uTime, now / 1000);
    gl.drawArrays(gl.POINTS, 0, cols * rows);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    setSlide(src, animate) {
      const [a, b] = slots;
      slots[0] = b; slots[1] = a;
      slots[1].src = src;
      slots[1].uploaded = null;
      upload(slots[1]);
      mixv = animate ? 0 : 1;
      mixFrom = performance.now();
    },
  };
}

/* ============ Fallback particles (WebGL1, for browsers without the flow version) ============
   The current work is drawn on a canvas. Moving the mouse breaks the picture into
   particles coloured from the image: they are dragged along the mouse's path and
   settle back into the picture after ~1s. No ripples. */
function createFxLite(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 2) return null;

  const N = 40;  // remembered points along the mouse path
  const field = `
    uniform vec4 uA[${N}];   // x, y, direction x, direction y (CSS px)
    uniform vec2 uB[${N}];   // strength, age (s)
    uniform vec4 uBox;       // only pixels inside this box are near the trail
    const float KA = 0.6667; // size of the broken area (first version = 1)
    const float KD = 0.1667; // how far particles are dragged after the mouse
    const float KS = 0.3333; // how far particles spread apart
    void wave(vec2 p, out vec2 drag, out vec2 push, out float f) {
      drag = vec2(0.0); push = vec2(0.0); f = 0.0;
      if (p.x < uBox.x || p.y < uBox.y || p.x > uBox.z || p.y > uBox.w) return;
      for (int i = 0; i < ${N}; i++) {
        float s = uB[i].x;
        if (s < 0.002) continue;
        vec2 d = p - uA[i].xy;
        float dist = length(d);
        float g = exp(-dist * dist / (12100.0 * KA * KA));           // soft blob around the point
        vec2 n = d / (dist + 1.0);
        drag += uA[i].zw * g * s;
        push += n * g * s * 0.6;
        f += g * s;
      }
    }
    vec2 cover(vec2 uv, float ia, vec2 res) {
      float sa = res.x / res.y;
      vec2 r = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
      return (uv - 0.5) * r + 0.5;
    }
    vec3 picture(vec2 p, vec2 res, sampler2D t0, sampler2D t1, vec2 asp, float mixv) {
      vec2 uv = vec2(p.x / res.x, 1.0 - p.y / res.y);
      vec3 a = texture2D(t0, cover(uv, asp.x, res)).rgb;
      vec3 b = texture2D(t1, cover(uv, asp.y, res)).rgb;
      return mix(a, b, mixv);
    }`;
  const head = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 uRes; uniform vec2 uShift; uniform sampler2D uT0, uT1; uniform vec2 uAsp; uniform float uMix;`;

  // the picture, pulled a little along the mouse and darkened where it has broken into particles
  const quadVS = `attribute vec2 aQ; varying vec2 vUv; void main() { vUv = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`;
  const quadFS = `${head}${field}
    varying vec2 vUv;
    void main() {
      vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
      vec2 drag, push; float f;
      wave(p, drag, push, f);
      vec2 q = p - push * 9.0 * KS - drag * 10.0 * KD - uShift;
      vec3 c = picture(q, uRes, uT0, uT1, uAsp, uMix);
      // where it breaks the work drops to ~10% visibility, so the particles carry the picture
      float hole = smoothstep(0.1, 0.55, f);
      gl_FragColor = vec4(c * (1.0 - hole * 0.9), 1.0);
    }`;
  // the particles: one per grid cell, coloured from where they started
  const ptsVS = `${head}${field}
    attribute vec2 aPos;
    uniform float uDpr;
    varying vec3 vCol; varying float vA;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 drag, push; float f;
      wave(aPos, drag, push, f);
      float h = hash(aPos);
      vec2 scatter = (vec2(hash(aPos + 1.7), hash(aPos + 9.2)) - 0.5) * f * 46.0 * KS;
      vec2 p = aPos + drag * 78.0 * KD + push * 24.0 * KS + scatter - uShift;
      vCol = picture(aPos - uShift, uRes, uT0, uT1, uAsp, uMix) * (1.0 + min(f, 1.0) * 0.5);
      vA = smoothstep(0.05, 0.35, f) * (0.5 + 0.5 * h);
      gl_PointSize = (1.4 + min(f, 1.6) * 1.3) * uDpr;
      gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
    }`;
  const ptsFS = `precision mediump float; varying vec3 vCol; varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5);
      if (r > 0.5 || vA < 0.01) discard;
      gl_FragColor = vec4(vCol, vA * (1.0 - smoothstep(0.25, 0.5, r)));
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  let quadP, ptsP;
  try { quadP = program(quadVS, quadFS); ptsP = program(ptsVS, ptsFS); } catch (e) { console.warn('fx off:', e.message); return null; }

  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ptsBuf = gl.createBuffer();
  let ptsCount = 0;

  const makeTex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // two slots: the picture going away (0) and the one arriving (1)
  const slots = [{ tex: makeTex(), src: null, asp: 1 }, { tex: makeTex(), src: null, asp: 1 }];
  let mixv = 1, mixFrom = 0;
  const upload = (slot) => {
    const s = slot.src;
    if (!s) return;
    const v = s.video;
    const useVideo = v && v.readyState >= 2 && v.videoWidth;
    const el = useVideo ? v : s.img;
    if (!useVideo) {
      if (!el.complete || !el.naturalWidth) return;
      if (slot.uploaded === el) return;  // still images upload once
    }
    gl.bindTexture(gl.TEXTURE_2D, slot.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
    slot.asp = useVideo ? v.videoWidth / v.videoHeight : el.naturalWidth / el.naturalHeight;
    slot.uploaded = useVideo ? null : el;
  };

  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const step = W < 700 ? 5 : 4;
    const pts = [];
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) pts.push(x, y);
    gl.bindBuffer(gl.ARRAY_BUFFER, ptsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    ptsCount = pts.length / 2;
  };
  resize();
  addEventListener('resize', resize);

  // mouse trail: points laid along the real pointer path (every coalesced event,
  // gaps filled every SPACING px), so a fast swipe stays one smooth stroke instead
  // of separate jumps; each point fades over ~1s
  const SPACING = 12;
  const trail = [];
  let mx = -1, my = -1, last = null, sx = 0, sy = 0, prevNow = 0;
  const push = (x, y, dx, dy, s) => {
    trail.push({ x, y, dx, dy, s, t: performance.now() });
    if (trail.length > N) trail.shift();
  };
  const addPoint = (x, y, ts) => {
    if (!last) { last = { x, y, ts }; return; }
    const dx = x - last.x, dy = y - last.y, d = Math.hypot(dx, dy);
    if (d < SPACING) return;
    const speed = d / Math.max(1, ts - last.ts);          // px per ms
    const s = Math.min(1.4, Math.max(0.3, speed * 0.8));
    const steps = Math.min(Math.ceil(d / SPACING), 10);
    for (let k = 1; k <= steps; k++) push(last.x + (dx * k) / steps, last.y + (dy * k) / steps, dx / d, dy / d, s);
    last = { x, y, ts };
  };
  addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (list.length ? list : [e]).forEach((ev) => addPoint(ev.clientX, ev.clientY, ev.timeStamp));
  }, { passive: true });
  const A = new Float32Array(N * 4), B = new Float32Array(N * 2);
  const box = new Float32Array([1e6, 1e6, -1e6, -1e6]);
  const uni = (p) => {
    const get = (n) => gl.getUniformLocation(p, n);
    return { box: get('uBox'), res: get('uRes'), shift: get('uShift'), t0: get('uT0'), t1: get('uT1'), asp: get('uAsp'), mix: get('uMix'), a: get('uA'), b: get('uB'), dpr: get('uDpr') };
  };
  const uq = uni(quadP), up = uni(ptsP);
  const setCommon = (u) => {
    gl.uniform4fv(u.box, box);
    gl.uniform2f(u.res, W, H);
    gl.uniform2f(u.shift, sx, sy);
    gl.uniform1i(u.t0, 0);
    gl.uniform1i(u.t1, 1);
    gl.uniform2f(u.asp, slots[0].asp, slots[1].asp);
    gl.uniform1f(u.mix, mixv);
    gl.uniform4fv(u.a, A);
    gl.uniform2fv(u.b, B);
  };

  const frame = (now) => {
    // time-based easing, so a dropped frame does not make anything jump
    const dt = Math.min(0.05, prevNow ? (now - prevNow) / 1000 : 0.016);
    prevNow = now;
    // the whole picture leans a touch away from the mouse, easing behind it
    if (mx >= 0) {
      const ease = 1 - Math.exp(-dt * 3);
      sx += ((mx - W / 2) * -0.012 - sx) * ease;
      sy += ((my - H / 2) * -0.012 - sy) * ease;
    }
    let x0 = 1e6, y0 = 1e6, x1 = -1e6, y1 = -1e6;
    for (let i = 0; i < N; i++) {
      const s = trail[i];
      if (!s) { B[i * 2] = 0; continue; }
      const age = (now - s.t) / 1000;
      const st = s.s * Math.exp(-age / 0.75);
      A.set([s.x, s.y, s.dx, s.dy], i * 4);
      B[i * 2] = st;
      B[i * 2 + 1] = age;
      if (st > 0.002) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); }
    }
    // pixels farther than this from every live point are untouched, so they skip the maths
    const m = 110 * 0.6667 * 3.2 + 30;
    box.set(x1 < x0 ? [1e6, 1e6, -1e6, -1e6] : [x0 - m, y0 - m, x1 + m, y1 + m]);
    if (mixv < 1) mixv = Math.min(1, (now - mixFrom) / 1100);
    upload(slots[1]);
    if (mixv < 1) upload(slots[0]);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, slots[0].tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, slots[1].tex);

    gl.disable(gl.BLEND);
    gl.useProgram(quadP);
    setCommon(uq);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    const aq = gl.getAttribLocation(quadP, 'aQ');
    gl.enableVertexAttribArray(aq);
    gl.vertexAttribPointer(aq, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(aq);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(ptsP);
    setCommon(up);
    gl.uniform1f(up.dpr, dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, ptsBuf);
    const ap = gl.getAttribLocation(ptsP, 'aPos');
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, ptsCount);
    gl.disableVertexAttribArray(ap);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    // cross-fade to a new slide
    setSlide(src, animate) {
      const [a, b] = slots;
      slots[0] = b; slots[1] = a;   // the arriving picture takes the other slot
      slots[1].src = src;
      slots[1].uploaded = null;
      upload(slots[1]);
      mixv = animate ? 0 : 1;
      mixFrom = performance.now();
    },
  };
}

/* ============ Begin animation (2s) ============
   Two works fly in from left and right and meet in the middle; their grey ghosts run
   through a gooey SVG filter, so they stick and merge. Only then does the grey block
   appear, growing and fading up out of them. More works keep flying in and melt into
   it as it swells, then it grows to full screen while the first work fades in. */
async function playIntro(intro) {
  const W = innerWidth, H = innerHeight;
  const DUR = 1800;                                   // + 0.2s fade = 2s in all
  const w0 = Math.min(W * 0.36, 480), h0 = w0 * 0.7;  // the block at its "swallowing" size
  const rect = (w, h, r = 8) => `inset(${(H - h) / 2}px ${(W - w) / 2}px ${(H - h) / 2}px ${(W - w) / 2}px round ${r}px)`;
  const first = bySlug(SLIDES[0]);
  const pool = (INTRO_DECK && INTRO_DECK.length ? INTRO_DECK : PROJECTS.map((p) => p.slug))
    .filter((s) => s !== SLIDES[0]).map(bySlug).filter(Boolean).slice(0, 12);

  const goo = document.getElementById('goo');
  const photos = document.getElementById('intro-photos');
  const block = document.getElementById('goo-block');
  const reveal = document.getElementById('intro-reveal');
  const text = document.getElementById('intro-text');
  if (first) reveal.style.backgroundImage = `url("${coverSrc(first)}")`;
  text.style.top = `${(H + h0) / 2 + 22}px`;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    intro.classList.add('is-leaving');
    document.body.classList.remove('intro-on');
    setTimeout(() => intro.classList.add('is-gone'), 220);
  };
  intro.addEventListener('click', finish);
  addEventListener('keydown', finish, { once: true });

  // the block: nothing until the first two works meet (~0.45s), then it grows and fades up
  // out of them, swells while swallowing the rest (to 1.3s), then grows to full screen
  const grow = [
    { offset: 0, clipPath: rect(w0 * 0.25, h0 * 0.25), opacity: 0 },
    { offset: 0.24, clipPath: rect(w0 * 0.25, h0 * 0.25), opacity: 0, easing: 'cubic-bezier(.34, 1.4, .64, 1)' },
    { offset: 0.38, clipPath: rect(w0 * 0.62, h0 * 0.62), opacity: 1, easing: 'cubic-bezier(.3, 0, .2, 1)' },
    { offset: 0.72, clipPath: rect(w0, h0), opacity: 1, easing: 'cubic-bezier(.76, 0, .24, 1)' },
    { offset: 1, clipPath: rect(W, H, 0), opacity: 1 },
  ];
  block.animate(grow, { duration: DUR, fill: 'forwards' });
  // the first work opens through the same shape, fading in while it grows
  reveal.animate(grow.map((k) => ({ ...k, opacity: k.offset < 0.72 ? 0 : k.offset === 1 ? 1 : 0 })), { duration: DUR, fill: 'forwards' });
  setTimeout(() => !done && text.classList.add('is-on'), 650);
  setTimeout(() => text.classList.remove('is-on'), 1250);

  // works fly in one after another and melt into the block
  const cw = w0 * 0.5, ch = cw * 0.7;
  const far = Math.hypot(W, H) * 0.6 + cw;
  pool.forEach((p, i) => {
    const ghost = document.createElement('div');
    ghost.className = 'goo-ghost';
    const photo = document.createElement('div');
    photo.className = 'intro-photo';
    photo.innerHTML = `<img src="${coverSrc(p)}" alt="" decoding="async">`;
    [ghost, photo].forEach((el) => Object.assign(el.style, { width: `${cw}px`, height: `${ch}px` }));
    goo.append(ghost);
    photos.append(photo);

    // the first two come from left and right at the same time and meet side by side
    const pair = i < 2;
    const ang = pair ? (i ? 0 : Math.PI) + (Math.random() - 0.5) * 0.3 : (i / pool.length) * Math.PI * 2 + Math.random() * 0.5;
    const sx = W / 2 + Math.cos(ang) * far - cw / 2, sy = H / 2 + Math.sin(ang) * far - ch / 2;
    const ex = W / 2 - cw / 2 + (pair ? (i ? 1 : -1) * cw * 0.32 : 0), ey = H / 2 - ch / 2;
    const r0 = (Math.random() - 0.5) * 60;
    const path = [
      { transform: `translate(${sx}px, ${sy}px) rotate(${r0}deg) scale(1)` },
      { transform: `translate(${ex + (sx - ex) * 0.18}px, ${ey + (sy - ey) * 0.18}px) rotate(${r0 * 0.2}deg) scale(.8)`, offset: 0.7 },
      { transform: `translate(${ex}px, ${ey}px) rotate(0deg) scale(${pair ? 0.75 : 0.3})` },   // the pair stays big enough to touch
    ];
    const timing = pair
      ? { duration: 450, delay: 0, easing: 'cubic-bezier(.3, .1, .3, 1)', fill: 'forwards' }
      : { duration: 500, delay: 380 + (i - 2) * 70, easing: 'cubic-bezier(.3, .1, .3, 1)', fill: 'forwards' };
    ghost.animate(path, timing);
    photo.animate(path, timing);
    photo.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0, offset: 0.82 }, { opacity: 0 }], timing);
  });

  await wait(DUR);
  finish();
}

/* ============ Work page: all works as cards ============ */
function renderCards(root) {
  const list = [...PROJECTS].sort((a, b) => b.year - a.year);
  root.innerHTML = list.map((p, i) => `
    <a class="card" href="${projectUrl(p)}" data-slug="${p.slug}" style="--d:${(i % 3) * 0.07}s">
      <img src="${coverSrc(p)}" alt="${esc(p.title)}" loading="lazy" decoding="async">
      <h2 class="card-title">${esc(p.title)}</h2>
      ${tagsHtml(p.tags)}
    </a>`).join('');
  reveal('.card');

  // hover plays the work's video over the still cover
  root.querySelectorAll('.card').forEach((card) => {
    const p = bySlug(card.dataset.slug);
    const m = videoOf(p);
    if (!m) return;
    let v = null;
    card.addEventListener('pointerenter', () => {
      if (!v) {
        v = videoEl(m, p.start, { poster: null, preload: 'auto' });
        v.addEventListener('playing', () => card.classList.add('is-playing'));
        card.querySelector('img').after(v);
      }
      v.play().catch(() => {});
    });
    card.addEventListener('pointerleave', () => { v?.pause(); card.classList.remove('is-playing'); });
  });
  setupFollow('.card');
}

/* ============ Project page ============ */
function renderProject(root) {
  const p = bySlug(new URLSearchParams(location.search).get('p'));
  if (!p) {
    root.innerHTML = `<p class="p-missing">Work not found. <a href="work.html">Back to all work →</a></p>`;
    return;
  }
  document.title = `${p.title} — EBADUDU`;
  const media = mediaOf(p);
  const heroIdx = p.hero || 0;
  const hero = media[heroIdx];
  const rest = media.filter((_, i) => i !== heroIdx);

  const fig = (m, i) => m.type === 'video'
    ? `<figure style="--r:${(m.w / m.h).toFixed(4)};--d:${i * 0.1}s"><video src="${m.src}" poster="${m.poster}" controls playsinline preload="none"></video></figure>`
    : `<figure style="--r:${(m.w / m.h).toFixed(4)};--d:${i * 0.1}s"><img src="${m.src}" width="${m.w}" height="${m.h}" alt="${esc(p.title)}" loading="lazy" decoding="async"></figure>`;
  let rows = '';
  for (let i = 0; i < rest.length; i += 2) {
    const pair = rest.slice(i, i + 2);
    rows += `<div class="p-row${pair.length === 1 ? ' single' : ''}">${pair.map(fig).join('')}</div>`;
  }

  const order = [...PROJECTS].sort((a, b) => b.year - a.year);
  const next = order[(order.indexOf(p) + 1) % order.length];
  root.innerHTML = `
    <section class="p-cover${p.fit === 'contain' ? ' contain' : ''}">
      <div class="media">${hero ? (hero.type === 'video' ? '' : `<img src="${hero.src}" alt="${esc(p.title)}">`) : ''}</div>
      <div class="p-head"><h1>${esc(p.title)}</h1>${tagsHtml([String(p.year), ...p.tags])}</div>
    </section>
    <div class="p-body">
      <div class="p-intro">
        <p class="p-label">ABOUT THIS WORK</p>
        <div>${p.intro ? `<p class="p-text">${esc(p.intro)}</p>` : ''}${p.detail ? `<p class="p-text">${esc(p.detail)}</p>` : ''}</div>
      </div>
      <div class="p-gallery">${rows}</div>
    </div>
    <a class="p-next" href="${projectUrl(next)}"><img src="${coverSrc(next)}" alt="" loading="lazy"><span><small>Next work</small>${esc(next.title)}</span></a>`;

  if (hero && hero.type === 'video') {
    const v = videoEl(hero, p.start, { preload: 'auto' });
    v.autoplay = true;
    root.querySelector('.p-cover .media').append(v);
    v.play().catch(() => {});
  }
  requestAnimationFrame(() => root.querySelector('.p-cover').classList.add('is-in'));
  reveal('.p-row figure');
  setupFollow('.p-next');
}

/* ============ Boot ============ */
if (document.getElementById('stage')) setupHome();
const cardsRoot = document.getElementById('cards');
if (cardsRoot) renderCards(cardsRoot);
const projectRoot = document.getElementById('project');
if (projectRoot) renderProject(projectRoot);

// the begin animation plays once per visit (click or any key skips it)
const intro = document.getElementById('intro');
if (intro) {
  let seen = false;
  try { seen = sessionStorage.getItem('ebadudu-d2-intro') === '1'; } catch (e) {}
  if (!seen && !location.hash) {
    try { sessionStorage.setItem('ebadudu-d2-intro', '1'); } catch (e) {}
    playIntro(intro);
  } else {
    intro.classList.add('is-gone');
    document.body.classList.remove('intro-on');
  }
}
