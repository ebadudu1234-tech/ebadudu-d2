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
    pill.classList.toggle('is-on', isOn(e.target));
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

  const fx = createFx(document.getElementById('fx'));
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

/* ============ Screen-wave particles (WebGL) ============
   The current work is drawn on a canvas. Moving the mouse breaks the picture into
   particles coloured from the image: they are dragged along the mouse's path and
   settle back into the picture after ~1s. No ripples. */
function createFx(canvas) {
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

/* ============ Begin animation ============
   Works fly in from outside the screen and pile into one rectangle, which turns grey;
   the grey rectangle grows to full screen while the first work fades in. Under 3s. */
async function playIntro(intro) {
  const W = innerWidth, H = innerHeight;
  const cw = Math.min(W * 0.36, 480), ch = cw * 0.7;
  const cx = W / 2, cy = H * 0.47;
  const x0 = cx - cw / 2, y0 = cy - ch / 2;
  const first = bySlug(SLIDES[0]);
  const pool = (INTRO_DECK && INTRO_DECK.length ? INTRO_DECK : PROJECTS.map((p) => p.slug))
    .filter((s) => s !== SLIDES[0]).map(bySlug).filter(Boolean);

  const cards = pool.slice(0, 16).map((p) => {
    const el = document.createElement('div');
    el.className = 'deck-card';
    Object.assign(el.style, { width: `${cw}px`, height: `${ch}px` });
    el.innerHTML = `<img src="${coverSrc(p)}" alt="" decoding="async">`;
    intro.append(el);
    return el;
  });
  const block = document.createElement('div');
  block.className = 'deck-block';
  Object.assign(block.style, { left: `${x0}px`, top: `${y0}px`, width: `${cw}px`, height: `${ch}px` });
  block.innerHTML = first ? `<img src="${coverSrc(first)}" alt="">` : '';
  intro.append(block);
  const text = document.getElementById('intro-text');
  text.style.top = `${y0 + ch + 22}px`;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    intro.classList.add('is-leaving');
    document.body.classList.remove('intro-on');
    setTimeout(() => intro.classList.add('is-gone'), 320);
  };
  intro.addEventListener('click', finish);
  addEventListener('keydown', finish, { once: true });

  // give the covers a moment (never more than 0.25s)
  await Promise.race([Promise.all(cards.map((c) => c.querySelector('img').decode().catch(() => {}))), wait(250)]);
  if (done) return;

  // 1. fly in from every side and pile up, each a little off-square
  const far = Math.hypot(W, H) * 0.62 + cw;
  cards.forEach((el, i) => {
    const ang = (i / cards.length) * Math.PI * 2 + Math.random() * 0.6;
    const sx = cx + Math.cos(ang) * far - cw / 2, sy = cy + Math.sin(ang) * far - ch / 2;
    const ex = x0 + (Math.random() - 0.5) * 22, ey = y0 + (Math.random() - 0.5) * 16;
    const r0 = (Math.random() - 0.5) * 70, r1 = (Math.random() - 0.5) * 6;
    el.animate(
      [{ transform: `translate(${sx}px, ${sy}px) rotate(${r0}deg)` }, { transform: `translate(${ex}px, ${ey}px) rotate(${r1}deg)` }],
      { duration: 600, delay: i * 30, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'forwards' });
  });
  await wait(cards.length * 30 + 600);
  if (done) return;

  // 2. the pile becomes one grey rectangle, with the line of text under it
  block.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
  text.classList.add('is-on');
  await wait(340);
  if (done) return;
  cards.forEach((el) => el.remove());

  // 3. it grows to full screen while the first work fades in
  const dur = 650, ease = 'cubic-bezier(.76, 0, .24, 1)';
  block.animate(
    [
      { left: `${x0}px`, top: `${y0}px`, width: `${cw}px`, height: `${ch}px`, borderRadius: '8px' },
      { left: '0px', top: '0px', width: `${W}px`, height: `${H}px`, borderRadius: '0px' },
    ],
    { duration: dur, easing: ease, fill: 'forwards' });
  block.querySelector('img')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'ease-in', fill: 'forwards' });
  text.classList.remove('is-on');
  await wait(dur);
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
