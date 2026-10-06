// Page lifecycle: smooth scroll, the curtain between routes, and building or tearing down
// every scene as Astro's client router swaps pages.
import Lenis from 'lenis';
import { gsap, ScrollTrigger, D, E, $$, type Conditions } from './core';
import { common } from './common';
import { buildIntro } from './intro';
import { home } from './home';
import { pointer } from './pointer';
import { posts } from './posts';
import { standings } from './standings';
import { SITE } from '../site';

const REDUCED = '(prefers-reduced-motion: reduce)';
const root = document.documentElement;

let lenis: Lenis | null = null;
let mm: gsap.MatchMedia | null = null;
let page: AbortController | null = null;
let swapped = false;

const reduced = () => window.matchMedia(REDUCED).matches;

function smoothScroll() {
  if (reduced() || lenis) return;
  lenis = new Lenis({ lerp: 0.11, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* curtain: covers the swap between routes, and plays the start lights on a first visit */
const curtain = () => document.querySelector<HTMLElement>('[data-curtain]');

function curtainIn(): Promise<void> {
  const el = curtain();
  if (!el || reduced()) return Promise.resolve();
  return new Promise((done) => {
    // never hold a navigation hostage to an animation (a hidden tab renders no frames)
    window.setTimeout(done, 900);
    gsap
      .timeline({ onComplete: done })
      .set(el, { visibility: 'visible' })
      .fromTo('[data-curtain-panel]', { yPercent: 101 }, { yPercent: 0, duration: 0.55, ease: E.inOut })
      .fromTo('[data-curtain-mark]', { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.3 }, 0.25);
  });
}

type Cover = 'lights' | 'curtain' | 'none' | 'done';

function curtainOut(cover: Cover): gsap.core.Timeline {
  const el = curtain();
  const tl = gsap.timeline();
  if (!el || cover === 'none' || cover === 'done') return tl;
  if (cover === 'lights') {
    // five lights on, one by one, then lights out and away we go
    const lights = $$('[data-light]', el);
    tl.set('[data-curtain-lights]', { autoAlpha: 1 })
      .to(lights, { backgroundColor: '#c6e33a', duration: 0.01, stagger: 0.13 }, 0.1)
      .to(lights, { backgroundColor: 'transparent', duration: 0.01 }, '+=0.22')
      .to('[data-curtain-lights]', { autoAlpha: 0, duration: 0.15 }, '+=0.05');
  } else {
    tl.to('[data-curtain-mark]', { autoAlpha: 0, scale: 1.2, duration: 0.2 });
  }
  tl.to('[data-curtain-panel]', { yPercent: -101, duration: 0.7, ease: E.inOut })
    .set(el, { visibility: 'hidden' })
    .add(() => root.classList.remove('is-first'));
  return tl;
}

function clock(signal: AbortSignal) {
  const els = $$('[data-clock]');
  if (!els.length) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SITE.timeZone });
  const tick = () => els.forEach((el) => (el.textContent = fmt.format(new Date())));
  tick();
  const id = window.setInterval(tick, 20_000);
  signal.addEventListener('abort', () => window.clearInterval(id));
}

function enter(cover: Cover) {
  page = new AbortController();
  const { signal } = page;

  lenis?.resize();
  lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
  lenis?.start();

  clock(signal);
  posts(!reduced(), signal);
  standings(!reduced(), signal);

  mm = gsap.matchMedia();
  mm.add(
    { desk: '(min-width: 900px)', fine: '(hover: hover) and (pointer: fine)', ok: '(prefers-reduced-motion: no-preference)' },
    (ctx) => {
      const c = ctx.conditions as unknown as Conditions & { ok: boolean };
      if (!c.ok) {
        root.classList.remove('js-motion', 'is-first');
        return;
      }
      const local = new AbortController();
      common(c);
      home(c);
      if (c.fine) pointer(local.signal);
      const intro = buildIntro(c);
      if (cover === 'done') {
        // rebuilt after a breakpoint change: the entrance has already played
        intro.progress(1);
      } else {
        if (cover === 'none') intro.play();
        else curtainOut(cover).add(() => void intro.play(), '-=0.5');
        cover = 'done';
      }
      return () => local.abort();
    },
  );

  ScrollTrigger.refresh();
}

function leave() {
  page?.abort();
  mm?.revert();
  mm = null;
  ScrollTrigger.getAll().forEach((t) => t.kill());
}

let booted = false;

export function boot() {
  if (booted) return;
  booted = true;
  window.clearTimeout((window as any).__dfFailsafe);

  smoothScroll();

  document.addEventListener('astro:before-preparation', (ev) => {
    const e = ev as Event & { loader: () => Promise<void> };
    const load = e.loader;
    e.loader = async () => {
      lenis?.stop();
      await Promise.all([load(), curtainIn()]);
    };
  });
  document.addEventListener('astro:before-swap', leave);
  document.addEventListener('astro:after-swap', () => {
    // the router replaces <html> attributes, so restore the runtime classes
    if (!reduced()) root.classList.add('js-motion');
    if (lenis) root.classList.add('lenis', 'lenis-smooth');
    swapped = true;
  });
  document.addEventListener('astro:page-load', () => {
    if (!swapped) return;
    swapped = false;
    enter(reduced() ? 'none' : 'curtain');
  });

  // first paint: wait for the display face so splits measure the real glyphs
  const first = root.classList.contains('is-first');
  const fonts = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  fonts.then(() => {
    try {
      sessionStorage.setItem('df-seen', '1');
    } catch {
      // private mode: the lights simply play again next visit
    }
    enter(first ? 'lights' : 'none');
  });
}

export { D, E };
