// Everything that reacts to the pointer before a click. Only runs on devices with a real
// hover and a fine pointer, so touch screens never pay for it.
import { gsap, D, E, $$ } from './core';

function cursor(signal: AbortSignal) {
  const el = document.querySelector<HTMLElement>('[data-cursor-el]');
  if (!el) return;
  const label = el.querySelector<HTMLElement>('[data-cursor-label]')!;
  const x = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
  const y = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
  let shown = false;

  window.addEventListener(
    'pointermove',
    (e) => {
      x(e.clientX);
      y(e.clientY);
      if (!shown) {
        shown = true;
        gsap.to(el, { autoAlpha: 1, duration: D.fast });
      }
      const target = (e.target as Element).closest?.('[data-cursor], a, button');
      const text = target?.getAttribute('data-cursor') ?? '';
      const state = text ? 'label' : target ? 'link' : 'idle';
      if (el.dataset.state !== state || label.textContent !== text) {
        el.dataset.state = state;
        label.textContent = text;
        gsap.to(el, {
          '--cursor-size': state === 'label' ? '5.5rem' : state === 'link' ? '2.4rem' : '0.75rem',
          duration: D.fast,
          overwrite: 'auto',
        });
      }
    },
    { signal, passive: true },
  );
  document.documentElement.addEventListener(
    'pointerleave',
    () => {
      shown = false;
      gsap.to(el, { autoAlpha: 0, duration: D.fast });
    },
    { signal },
  );
}

function magnetic(signal: AbortSignal) {
  $$('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3' });
    const y = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3' });
    el.addEventListener(
      'pointermove',
      (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.32);
        y((e.clientY - (r.top + r.height / 2)) * 0.32);
      },
      { signal },
    );
    el.addEventListener('pointerleave', () => (x(0), y(0)), { signal });
  });
}

function tilt(signal: AbortSignal) {
  $$('[data-tilt]').forEach((el) => {
    gsap.set(el, { transformPerspective: 900, transformOrigin: 'center' });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    el.addEventListener(
      'pointermove',
      (e) => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 9);
        rx(((e.clientY - r.top) / r.height - 0.5) * -7);
      },
      { signal },
    );
    el.addEventListener('pointerleave', () => (rx(0), ry(0)), { signal });
  });
}

/** Nav labels roll: the visible word leaves upward as its twin arrives from below. */
function rolls(signal: AbortSignal) {
  $$('[data-roll]').forEach((el) => {
    const a = el.querySelector('.roll__a');
    const b = el.querySelector('.roll__b');
    if (!a || !b) return;
    // the stylesheet parks the twin with a percentage transform; hand that to GSAP as
    // yPercent so it is not read back as a fixed pixel offset
    gsap.set(b, { y: 0, yPercent: 105 });
    const tl = gsap
      .timeline({ paused: true, defaults: { duration: D.fast, ease: E.inOut } })
      .to(a, { yPercent: -105 })
      .fromTo(b, { yPercent: 105 }, { yPercent: 0 }, 0);
    el.addEventListener('pointerenter', () => tl.play(), { signal });
    el.addEventListener('pointerleave', () => tl.reverse(), { signal });
    el.addEventListener('focus', () => tl.play(), { signal });
    el.addEventListener('blur', () => tl.reverse(), { signal });
  });
}

/** Rows fill from the edge the pointer came in on, and the arrow leaves and re-enters. */
function fills(signal: AbortSignal) {
  $$('[data-fill]').forEach((el) => {
    const fill = el.querySelector<HTMLElement>('.fill');
    const arrow = el.querySelector<HTMLElement>('.arrow');
    if (!fill) return;
    gsap.set(fill, { y: 0, yPercent: 101 });
    const fromTop = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return e.clientY - r.top < r.height / 2;
    };
    el.addEventListener(
      'pointerenter',
      (e) => {
        gsap.fromTo(
          fill,
          { yPercent: fromTop(e) ? -101 : 101 },
          { yPercent: 0, duration: D.fast, ease: E.inOut, overwrite: true },
        );
        if (arrow) {
          gsap
            .timeline({ overwrite: true })
            .to(arrow, { xPercent: 120, yPercent: -120, duration: 0.2, ease: 'power2.in' })
            .set(arrow, { xPercent: -120, yPercent: 120 })
            .to(arrow, { xPercent: 0, yPercent: 0, duration: 0.3 });
        }
      },
      { signal },
    );
    el.addEventListener(
      'pointerleave',
      (e) => gsap.to(fill, { yPercent: fromTop(e) ? -101 : 101, duration: D.fast, ease: E.inOut, overwrite: true }),
      { signal },
    );
    // keyboard focus gets the same fill
    el.addEventListener('focus', () => gsap.to(fill, { yPercent: 0, duration: D.fast, ease: E.inOut, overwrite: true }), { signal });
    el.addEventListener('blur', () => gsap.to(fill, { yPercent: 101, duration: D.fast, ease: E.inOut, overwrite: true }), { signal });
  });
}

/** A thumbnail that trails the pointer while it is over a post row. */
function peek(signal: AbortSignal) {
  const box = document.querySelector<HTMLElement>('[data-peek-box]');
  if (!box) return;
  const img = box.querySelector('img')!;
  const x = gsap.quickTo(box, 'x', { duration: 0.6, ease: 'power3' });
  const y = gsap.quickTo(box, 'y', { duration: 0.6, ease: 'power3' });
  const rot = gsap.quickTo(box, 'rotation', { duration: 0.8, ease: 'power3' });
  let lastX = 0;

  $$('[data-peek]').forEach((row) => {
    row.addEventListener(
      'pointerenter',
      () => {
        img.src = row.dataset.peek!;
        img.alt = '';
        gsap.to(box, { autoAlpha: 1, scale: 1, duration: D.fast, overwrite: 'auto' });
        gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: D.base, overwrite: 'auto' });
      },
      { signal },
    );
    row.addEventListener(
      'pointermove',
      (e) => {
        x(e.clientX);
        y(e.clientY);
        rot(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.6));
        lastX = e.clientX;
      },
      { signal },
    );
    row.addEventListener(
      'pointerleave',
      () => {
        gsap.to(box, { autoAlpha: 0, scale: 0.85, duration: D.fast, overwrite: 'auto' });
        rot(0);
      },
      { signal },
    );
  });
}

export function pointer(signal: AbortSignal) {
  cursor(signal);
  magnetic(signal);
  tilt(signal);
  rolls(signal);
  fills(signal);
  peek(signal);
}
