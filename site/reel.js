// The home hero's carousel. Scroll snapping moves the slides and works without this script.
// This adds the loop, arrows and keys, progress segments, a slideshow that stops for good once the
// visitor takes over, the ambient wash behind the stage and, where CSS scroll-driven animations are
// missing, the focus effect on each slide (shelf.css reads --p and --x).
(() => {
  const reel = document.querySelector('.reel'), bar = document.querySelector('.reel-bar');
  const real = reel ? [...reel.querySelectorAll('.hero-tile')] : [];
  if (!bar || real.length < 2) return;
  const n = real.length, dots = bar.querySelector('.reel-dots'), play = bar.querySelector('.reel-play');
  const status = document.querySelector('.reel-status'), wash = [...document.querySelectorAll('.hero-ambient i')];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const title = (slide) => slide.querySelector('span')?.textContent ?? '';

  // Two copies at each end let the neighbours peek on both sides; on settling on a copy the reel
  // jumps to its original, which looks the same, so the loop never shows a seam.
  const LEAD = 2;
  real.forEach((slide, i) => { slide.dataset.i = i; });
  const copy = (slide) => {
    const c = slide.cloneNode(true);
    c.dataset.copy = ''; c.tabIndex = -1; c.setAttribute('aria-hidden', 'true');
    c.querySelector('img')?.removeAttribute('fetchpriority');
    return c;
  };
  reel.prepend(...real.slice(-LEAD).map(copy)); reel.append(...real.slice(0, LEAD).map(copy));
  const slides = [...reel.querySelectorAll('.hero-tile')];

  // Geometry is read once per layout change, never during a scroll frame.
  let mids = [], width = 0, pitch = 1;
  const measure = () => {
    width = reel.clientWidth;
    mids = slides.map((s) => s.offsetLeft + s.offsetWidth / 2);
    pitch = mids[1] - mids[0] || 1;
  };
  const leftFor = (k) => mids[k] - width / 2;
  const nearest = (x) => {
    let best = 0;
    for (let k = 1; k < slides.length; k++) if (Math.abs(leftFor(k) - x) < Math.abs(leftFor(best) - x)) best = k;
    return best;
  };
  let target = null;
  const move = (k, smooth) => {
    k = Math.max(0, Math.min(slides.length - 1, k));
    target = smooth ? k : null;
    reel.scrollTo({ left: leftFor(k), behavior: smooth && !still.matches ? 'smooth' : 'instant' });
    return k;
  };
  const step = (d) => move((target ?? nearest(reel.scrollLeft)) + d, true);

  // Fallback focus effect for browsers without animation-timeline.
  const tracked = !(window.CSS && CSS.supports('animation-timeline: view()'));
  if (tracked) reel.classList.add('is-tracked');
  const track = (x) => {
    if (!tracked) return;
    const mid = x + width / 2, reach = (width + pitch) / 2;
    slides.forEach((s, k) => {
      const d = mids[k] - mid;
      s.style.setProperty('--p', Math.max(0, 1 - Math.abs(d) / pitch).toFixed(3));
      s.style.setProperty('--x', Math.max(-1, Math.min(1, -d / reach)).toFixed(3));
    });
  };

  const marks = real.map((slide, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', `Show ${title(slide)}`); b.append(document.createElement('i'));
    b.addEventListener('click', () => { stop(); move(LEAD + i, true); });
    li.append(b); dots.append(li);
    return b;
  });

  let lit = 0;
  const glow = (slide) => {
    if (wash.length < 2) return;
    const img = slide.querySelector('img'), small = img.getAttribute('srcset')?.split(',')[0].trim().split(/\s+/)[0];
    const next = wash[lit ^= 1];
    next.style.backgroundImage = `url("${small || img.currentSrc || img.src}")`;
    next.classList.add('is-on'); wash[lit ^ 1].classList.remove('is-on');
  };

  let active = -1, onShow = () => {};
  const show = (i) => {
    if (i === active) return;
    active = i;
    marks.forEach((b, j) => { b.classList.toggle('is-active', j === i); if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    if (status) status.textContent = `${title(real[i])}, ${i + 1} of ${n}`;
    glow(real[i]);
    onShow();
  };

  // A settled reel on a copy jumps to the original, unless a finger is still on the glass.
  let touching = false;
  const settle = () => {
    if (touching) return;
    target = null;
    const k = nearest(reel.scrollLeft), slide = slides[k];
    if ('copy' in slide.dataset) move(LEAD + Number(slide.dataset.i), false);
    show(Number(slide.dataset.i));
  };
  let frame = 0, idle = 0;
  const ends = 'onscrollend' in window;
  reel.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      const x = reel.scrollLeft;
      track(x); show(Number(slides[nearest(x)].dataset.i));
    });
    if (!ends) { clearTimeout(idle); idle = setTimeout(settle, 160); }
  }, { passive: true });
  if (ends) reel.addEventListener('scrollend', settle);
  reel.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  reel.addEventListener('touchend', () => { touching = false; if (!ends) { clearTimeout(idle); idle = setTimeout(settle, 160); } }, { passive: true });

  // The slideshow starts on its own and cycles until the visitor takes over or pauses it. A timer
  // runs the dwell while the active segment's fill (CSS, paused in step with it) shows the time left.
  // Reduced motion keeps the slideshow, with instant changes, and the pause button stays in reach.
  const DWELL = 6500;
  let playing = true, left = DWELL, since = 0, timer = 0, running = false;
  const held = new Set();
  const pause = () => { if (running) { clearTimeout(timer); left -= performance.now() - since; running = false; } };
  const resume = () => {
    if (running || !playing || held.size) return;
    running = true; since = performance.now();
    timer = setTimeout(() => { running = false; left = DWELL; move(nearest(reel.scrollLeft) + 1, true); resume(); }, Math.max(0, left));
  };
  onShow = () => { pause(); left = DWELL; resume(); };
  const sync = () => {
    bar.classList.toggle('is-playing', playing);
    bar.classList.toggle('is-held', held.size > 0);
    play.setAttribute('aria-label', playing ? 'Pause the slideshow' : 'Play the slideshow');
    status?.setAttribute('aria-live', playing && !held.size ? 'off' : 'polite');
    pause(); resume();
  };
  const stop = () => { if (playing) { playing = false; sync(); } };
  const hold = (why, on) => { if (on) held.add(why); else held.delete(why); sync(); };
  play.addEventListener('click', () => { playing = !playing; sync(); });
  bar.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { stop(); step(Number(b.dataset.step)); }));

  // The visitor takes over: touch, a sideways scroll, the keys or a click on a neighbour.
  reel.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') stop(); });
  reel.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(); }, { passive: true });
  reel.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); stop();
    const k = step(e.key === 'ArrowLeft' ? -1 : 1);
    slides[LEAD + Number(slides[k].dataset.i)].focus({ preventScroll: true });
  });
  reel.addEventListener('click', (e) => {
    const k = slides.indexOf(e.target.closest('.hero-tile'));
    if (k < 0 || k === nearest(reel.scrollLeft)) return;
    e.preventDefault(); stop(); move(k, true);
  });
  reel.addEventListener('focusin', (e) => {
    hold('focus', true);
    // A slide reached by Tab comes to the centre; one already there, or its copy on the way, stays.
    const k = slides.indexOf(e.target.closest('.hero-tile'));
    if (k >= 0 && slides[k].dataset.i !== slides[target ?? nearest(reel.scrollLeft)].dataset.i) move(k, true);
  });
  reel.addEventListener('focusout', (e) => { if (!reel.contains(e.relatedTarget)) hold('focus', false); });
  reel.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold('hover', true); });
  reel.addEventListener('pointerleave', () => hold('hover', false));
  document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));
  new IntersectionObserver(([entry]) => hold('away', !entry.isIntersecting), { threshold: 0.35 }).observe(reel);
  new ResizeObserver(() => {
    const keep = active < 0 ? 0 : active;
    measure(); move(LEAD + keep, false); track(reel.scrollLeft);
  }).observe(reel);

  measure(); move(LEAD, false); track(reel.scrollLeft); show(0);
  bar.hidden = false; sync();
})();
