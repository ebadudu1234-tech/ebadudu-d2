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
  if (!pill || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let x = 0, y = 0, px = 0, py = 0, running = false;
  const tick = () => {
    px += (x - px) * 0.22;
    py += (y - py) * 0.22;
    pill.style.transform = `translate(${(px + 18).toFixed(1)}px, ${(py - 25).toFixed(1)}px)`;
    if (pill.classList.contains('is-on') || Math.abs(x - px) > 0.5) requestAnimationFrame(tick); else running = false;
  };
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    const over = !!e.target.closest(selector);
    if (over && !pill.classList.contains('is-on')) { px = x; py = y; }
    pill.classList.toggle('is-on', over);
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => pill.classList.remove('is-on'));
}

/* ============ Home: full-screen slides ============ */
function renderSlides(root) {
  const list = SLIDES.map(bySlug).filter(Boolean);
  root.innerHTML = list.map((p, i) => `
    <section class="slide" data-slug="${p.slug}" id="s${i + 1}">
      <a class="slide-media${p.fit === 'contain' ? ' contain' : ''}" href="${projectUrl(p)}" aria-label="${esc(p.title)}">
        <img src="${coverSrc(p)}" alt="${esc(p.title)}"${i ? ' loading="lazy"' : ''} decoding="async">
      </a>
      <a class="slide-cap glass" href="${projectUrl(p)}"><b>${esc(p.title)}</b><span>${p.year} · ${p.tags.join(' / ')}</span></a>
    </section>`).join('');

  const dots = document.getElementById('dots');
  dots.innerHTML = list.map((p, i) => `<button type="button" aria-label="${esc(p.title)}"></button>`).join('');
  const slides = [...root.children];
  const buttons = [...dots.children];
  buttons.forEach((b, i) => b.addEventListener('click', () => slides[i].scrollIntoView({ behavior: 'smooth' })));

  // works with a video play it while their slide is on screen
  const clips = new Map();
  const setActive = (slide) => {
    slides.forEach((s, i) => {
      const on = s === slide;
      s.classList.toggle('is-on', on);
      buttons[i].setAttribute('aria-current', String(on));
      const p = bySlug(s.dataset.slug);
      const m = videoOf(p);
      if (!m) return;
      if (on) {
        let v = clips.get(s);
        if (!v) {
          v = videoEl(m, p.start, { poster: coverSrc(p), preload: 'auto' });
          s.querySelector('.slide-media').append(v);
          clips.set(s, v);
        }
        v.play().catch(() => {});
      } else clips.get(s)?.pause();
    });
  };
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target); }), { threshold: 0.6 });
  slides.forEach((s) => io.observe(s));
}

/* ============ Begin animation (Figma "begin animation" frames) ============
   7 cards on the 1512×982 frame: scattered (A) → gathered (B) → stacked (C) →
   the top card slips behind and grows to full screen while the stack falls away. */
const P = [264, 318], L = [418, 318];
const DECK = [
  { size: P, a: [285, 127], b: [569, 269], c: [612, 332] },
  { size: P, a: [971, 147], b: [798, 305], c: [612, 332] },
  { size: L, a: [457, 324], b: [470, 332], c: [547, 332] },
  { size: L, a: [1133, -32], b: [685, 305], c: [547, 332] },
  { size: L, a: [1063, 808], b: [589, 376], c: [547, 332] },
  { size: L, a: [-97, 710], b: [457, 362], c: [547, 332] },
  { size: P, a: [701, 878], b: [666, 376], c: [636, 332] },
];
const FULL = [-80, -62, 1696, 1106];  // the full-screen rectangle of the last frame

async function playIntro(intro) {
  const stage = document.getElementById('intro-stage');
  const fit = () => stage.style.setProperty('--s', Math.max(innerWidth / 1512, innerHeight / 982));
  fit();
  addEventListener('resize', fit);

  const cards = DECK.map((d, i) => {
    const p = bySlug(INTRO_DECK[i]);
    const el = document.createElement('div');
    el.className = 'deck-card';
    Object.assign(el.style, { left: `${d.a[0]}px`, top: `${d.a[1]}px`, width: `${d.size[0]}px`, height: `${d.size[1]}px`, opacity: 0 });
    el.innerHTML = p ? `<img src="${coverSrc(p)}" alt="" decoding="async">` : '';
    stage.append(el);
    return el;
  });
  // the growing card shows the first slide, so the hand-off to the page is seamless
  const first = bySlug(SLIDES[0]);
  if (first) cards[6].innerHTML = `<img src="${coverSrc(first)}" alt="" decoding="async">`;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    intro.classList.add('is-leaving');
    document.body.classList.remove('intro-on');
    document.body.style.overflow = '';
    setTimeout(() => intro.classList.add('is-gone'), 550);
  };
  intro.addEventListener('click', finish);
  addEventListener('keydown', finish, { once: true });
  document.body.style.overflow = 'hidden';

  // give the covers a moment to arrive (never more than 1.2s)
  await Promise.race([Promise.all(cards.map((c) => c.querySelector('img')?.decode?.().catch(() => {}))), wait(1200)]);
  if (done) return;

  const move = (el, from, to, opts) => el.animate(
    [{ transform: `translate(${from[0]}px, ${from[1]}px)` }, { transform: `translate(${to[0]}px, ${to[1]}px)` }],
    { fill: 'forwards', ...opts });

  // A: cards pop in where they lie scattered
  cards.forEach((el, i) => el.animate(
    [{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }],
    { duration: 520, delay: i * 70, easing: 'cubic-bezier(.34, 1.4, .64, 1)', fill: 'forwards' }));
  await wait(900);
  if (done) return;

  // A → B: gather towards the middle
  cards.forEach((el, i) => {
    const d = DECK[i];
    move(el, [0, 0], [d.b[0] - d.a[0], d.b[1] - d.a[1]], { duration: 650, delay: i * 25, easing: 'cubic-bezier(.65, 0, .35, 1)' });
  });
  await wait(780);
  if (done) return;

  // B → C: square up into one stack
  cards.forEach((el, i) => {
    const d = DECK[i];
    move(el, [d.b[0] - d.a[0], d.b[1] - d.a[1]], [d.c[0] - d.a[0], d.c[1] - d.a[1]], { duration: 480, easing: 'cubic-bezier(.65, 0, .35, 1)' });
  });
  await wait(560);
  if (done) return;

  // the top card slips behind the stack and grows to full screen; the stack falls away
  const top = cards[6];
  const d = DECK[6];
  top.getAnimations().forEach((a) => a.cancel());
  Object.assign(top.style, { left: `${d.c[0]}px`, top: `${d.c[1]}px`, opacity: 1, zIndex: 0 });
  cards.slice(0, 6).forEach((el) => { el.style.zIndex = 1; });
  top.animate(
    [
      { left: `${d.c[0]}px`, top: `${d.c[1]}px`, width: `${d.size[0]}px`, height: `${d.size[1]}px`, borderRadius: '8px' },
      { left: `${FULL[0]}px`, top: `${FULL[1]}px`, width: `${FULL[2]}px`, height: `${FULL[3]}px`, borderRadius: '0px' },
    ],
    { duration: 780, easing: 'cubic-bezier(.76, 0, .24, 1)', fill: 'forwards' });
  cards.slice(0, 6).forEach((el, i) => el.animate(
    [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.72 }],
    { duration: 420, delay: 180 + i * 30, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' }));
  await wait(820);
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
const slidesRoot = document.getElementById('slides');
if (slidesRoot) renderSlides(slidesRoot);
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
