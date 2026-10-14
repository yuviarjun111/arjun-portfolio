/* Arjun. Y portfolio: cursor-tracking hero
 * 9 head poses (public/frames/0..8.webp, cut from the 3x3 avatar sheet):
 *   0 up-left   1 up      2 up-right
 *   3 left      4 center  5 right
 *   6 down-left 7 down    8 down-right
 * Exactly one frame is drawn at 100% opacity (no blending, so no ghosting).
 */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const loader = document.getElementById('loader');

  const FRAME_W = 960, FRAME_H = 540;
  const FACE = { x: 0.5, y: 0.47 };          // face centre inside a frame (0..1)
  const FOLLOW = 0.26;                        // smoothing factor per 60fps tick
  const DEADZONE = 0.085;                     // x diagonal of viewport -> eye contact
  const HYSTERESIS = 28;                      // degrees before switching sector (sector is 45 wide)
  // sector 0 = right, then clockwise on screen (y down)
  const SECTOR_TO_FRAME = [5, 8, 7, 6, 3, 0, 1, 2];

  const frames = [];
  let loaded = 0;

  const state = {
    vw: innerWidth, vh: innerHeight, dpr: Math.min(devicePixelRatio || 1, 2),
    portrait: false, stage: { left: 0, top: 0, w: 0, h: 0 },
    target: null,        // pointer position (client coords) or null when idle
    smooth: null,        // smoothed pointer
    sector: 0, inCenter: true, drawn: -1, heroVisible: true
  };

  /* ---------- load frames ---------- */
  for (let i = 0; i < 9; i++) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => { if (++loaded === 9) start(); };
    img.src = `public/frames/${i}.webp`;
    frames.push(img);
  }

  /* ---------- layout ---------- */
  function layout() {
    const vw = innerWidth, vh = hero.clientHeight;
    state.vw = vw; state.vh = vh;
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    state.portrait = vw / vh < 1.25;
    hero.classList.toggle('portrait-mode', state.portrait);

    let w, h, top;
    if (state.portrait) {
      w = vw * 2.0; h = w * FRAME_H / FRAME_W;
      top = vh * 0.62 - h;                   // character sits above the text block
    } else {
      h = vh * 0.9; w = h * FRAME_W / FRAME_H; top = vh - h;   // anchored to the bottom
    }
    const left = (vw - w) / 2;
    state.stage = { left, top, w, h };

    canvas.style.left = left + 'px';
    canvas.style.top = top + 'px';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * state.dpr);
    canvas.height = Math.round(h * state.dpr);

    // feather the frame edges into the page backdrop
    const side = 'linear-gradient(to right, transparent 0, #000 16%, #000 84%, transparent 100%)';
    const vert = state.portrait
      ? 'linear-gradient(to bottom, transparent 0, #000 12%, #000 80%, transparent 100%)'
      : 'linear-gradient(to bottom, transparent 0, #000 16%, #000 100%)';
    const m = `${vert}, ${side}`;
    canvas.style.webkitMaskImage = m; canvas.style.maskImage = m;
    canvas.style.webkitMaskComposite = 'source-in'; canvas.style.maskComposite = 'intersect';

    state.drawn = -1;                          // force redraw
  }

  function draw(i) {
    const img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    state.drawn = i;
  }

  /* ---------- pointer ---------- */
  function setTarget(e) { state.target = { x: e.clientX, y: e.clientY }; if (!state.smooth) state.smooth = { ...state.target }; }
  addEventListener('pointermove', setTarget, { passive: true });
  addEventListener('pointerdown', setTarget, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { state.target = null; });

  const norm = a => ((a % 360) + 360) % 360;
  const angDiff = (a, b) => { const d = norm(a - b); return d > 180 ? d - 360 : d; };

  /* ---------- render loop ---------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!state.heroVisible) return;

    const r = canvas.getBoundingClientRect();
    const fx = r.left + r.width * FACE.x, fy = r.top + r.height * FACE.y;

    // idle: ease the aim back to the face so she looks at the viewer
    const goal = state.target || { x: fx, y: fy };
    if (!state.smooth) state.smooth = { x: fx, y: fy };
    const k = 1 - Math.pow(1 - FOLLOW, dt * 60);
    state.smooth.x += (goal.x - state.smooth.x) * k;
    state.smooth.y += (goal.y - state.smooth.y) * k;

    const dx = state.smooth.x - fx, dy = state.smooth.y - fy;
    const dist = Math.hypot(dx, dy);
    const R = Math.hypot(innerWidth, innerHeight) * DEADZONE;

    // deadzone with hysteresis -> eye contact
    if (state.inCenter && dist > R * 1.15) state.inCenter = false;
    else if (!state.inCenter && dist < R) state.inCenter = true;

    let idx = 4;
    if (!state.inCenter) {
      const ang = norm(Math.atan2(dy, dx) * 180 / Math.PI);
      const cur = state.sector * 45;
      if (Math.abs(angDiff(ang, cur)) > HYSTERESIS) state.sector = Math.round(ang / 45) % 8;
      idx = SECTOR_TO_FRAME[state.sector];
    }
    if (idx !== state.drawn) draw(idx);
  }

  /* ---------- custom cursor ---------- */
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) {
    document.body.classList.add('has-cursor');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; }, { passive: true });
    (function tick() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(tick);
    })();
    document.addEventListener('pointerover', e => { if (e.target.closest('a, button')) ring.classList.add('hot'); });
    document.addEventListener('pointerout', e => { if (e.target.closest('a, button')) ring.classList.remove('hot'); });
  }

  /* ---------- placeholders: stop dead links jumping to the top ---------- */
  document.querySelectorAll('a[href="#"]').forEach(a =>
    a.addEventListener('click', e => e.preventDefault()));

  /* ---------- boot ---------- */
  function start() {
    layout();
    draw(4);
    loader.classList.add('done');
    document.body.classList.add('ready');
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([en]) => { state.heroVisible = en.isIntersecting; }, { threshold: 0 }).observe(hero);
  addEventListener('resize', () => { if (loaded === 9) layout(); });
})();
