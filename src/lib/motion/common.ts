// Behaviours declared in markup with data attributes. Each element type gets its own verb:
// display type splits, media clips, rules draw, numbers count, lists stagger.
import { gsap, ScrollTrigger, SplitText, D, E, $$, type Conditions } from './core';

const ONCE = (trigger: Element, start = 'top 86%') => ({ trigger, start, once: true });

/** Room for ascenders and descenders inside the masks of tight display type. */
function padMasks(masks: Element[]) {
  gsap.set(masks, { paddingTop: '0.12em', paddingBottom: '0.16em', marginTop: '-0.12em', marginBottom: '-0.16em' });
}

export function splitChars(el: HTMLElement, vars: gsap.TweenVars = {}) {
  return SplitText.create(el, {
    type: 'words,chars',
    mask: 'words',
    autoSplit: true,
    onSplit(self) {
      padMasks(self.masks);
      gsap.set(el, { visibility: 'visible' });
      return gsap.from(self.chars, {
        yPercent: 118,
        duration: D.slow,
        stagger: { each: 0.028, from: 'start' },
        ...vars,
      });
    },
  });
}

export function splitLines(el: HTMLElement, vars: gsap.TweenVars = {}) {
  return SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit(self) {
      padMasks(self.masks);
      gsap.set(el, { visibility: 'visible' });
      return gsap.from(self.lines, { yPercent: 112, duration: D.slow, stagger: 0.085, ...vars });
    },
  });
}

function splits() {
  // anything inside the hero is driven by the intro timeline instead
  $$('[data-split]').forEach((el) => {
    if (el.closest('[data-intro]')) return;
    const st = { scrollTrigger: ONCE(el) };
    if (el.dataset.split === 'chars') splitChars(el, st);
    else splitLines(el, st);
  });
}

const CLIP_FROM: Record<string, string> = {
  clip: 'inset(0% 0% 100% 0%)',
  'clip-left': 'inset(0% 100% 0% 0%)',
  'clip-right': 'inset(0% 0% 0% 100%)',
};

function reveals(c: Conditions) {
  $$('[data-reveal]').forEach((el) => {
    if (el.closest('[data-intro]')) return;
    const kind = el.dataset.reveal!;

    if (kind in CLIP_FROM) {
      const img = el.querySelector('img');
      const tl = gsap.timeline({ scrollTrigger: ONCE(el, 'top 82%') });
      tl.set(el, { visibility: 'visible' }).fromTo(
        el,
        { clipPath: CLIP_FROM[kind] },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: c.desk ? D.epic : D.slow, clearProps: 'clipPath' },
      );
      if (img) tl.from(img, { scale: 1.32, duration: c.desk ? D.epic + 0.2 : D.slow }, 0);
      return;
    }

    if (kind === 'stagger') {
      gsap.set(el, { visibility: 'visible' });
      gsap.from(el.children, {
        y: 36,
        autoAlpha: 0,
        scale: 0.985,
        duration: D.base,
        stagger: 0.06,
        scrollTrigger: ONCE(el),
      });
      return;
    }

    // 'up': the plain entrance, kept for small supporting copy only
    gsap.set(el, { visibility: 'visible' });
    gsap.from(el, { y: 28, autoAlpha: 0, duration: D.base, scrollTrigger: ONCE(el, 'top 90%') });
  });
}

/** Photos inside a post wipe open as they arrive, a few at a time. */
function proseImages() {
  const imgs = $$('.prose img');
  if (!imgs.length) return;
  gsap.set(imgs, { clipPath: 'inset(0% 0% 100% 0%)' });
  ScrollTrigger.batch(imgs, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0%)', duration: D.slow, ease: E.inOut, stagger: 0.12, clearProps: 'clipPath' }),
  });
}

function rules() {
  $$('[data-rule]').forEach((el) => {
    gsap.fromTo(
      el,
      { scaleX: 0 },
      { scaleX: 1, duration: D.epic, ease: E.inOut, scrollTrigger: ONCE(el, 'top 92%') },
    );
  });
}

function counts() {
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    if (!Number.isFinite(end)) return;
    const state = { v: 0 };
    gsap.to(state, {
      v: end,
      duration: gsap.utils.clamp(0.6, 1.8, 0.5 + end / 250),
      ease: 'power2.out',
      snap: { v: 1 },
      scrollTrigger: ONCE(el, 'top 92%'),
      onUpdate: () => (el.textContent = String(state.v)),
    });
  });
}

function draws() {
  $$<SVGGeometryElement>('[data-draw]').forEach((el) => {
    if (el.closest('[data-intro]')) return;
    gsap.from(el, {
      drawSVG: '0%',
      duration: D.epic,
      ease: E.inOut,
      scrollTrigger: ONCE(el.closest('svg') ?? el),
    });
  });
}

function parallax(c: Conditions) {
  $$('[data-parallax]').forEach((el) => {
    const amount = Number(el.dataset.parallax) * (c.desk ? 1 : 0.5);
    gsap.fromTo(
      el,
      { yPercent: -amount },
      {
        yPercent: amount,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      },
    );
  });
}

function marquees() {
  $$('[data-marquee]').forEach((track) => {
    const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
    const skew = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    let settle: gsap.core.Tween | undefined;
    let upright: gsap.core.Tween | undefined;
    ScrollTrigger.create({
      trigger: track,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate(self) {
        const v = self.getVelocity();
        // scroll speeds the ticker up and leans it into the direction of travel
        loop.timeScale(gsap.utils.clamp(-6, 6, (v >= 0 ? 1 : -1) * (1 + Math.abs(v) / 350)));
        skew(gsap.utils.clamp(-12, 12, v / -160));
        settle?.kill();
        settle = gsap.to(loop, { timeScale: v >= 0 ? 1 : -1, duration: 0.9, ease: 'power2.out', delay: 0.05 });
        upright?.kill();
        upright = gsap.delayedCall(0.15, () => skew(0));
      },
    });
  });
}

function header() {
  const bar = document.querySelector<HTMLElement>('[data-header]');
  if (!bar) return;
  const show = gsap.quickTo(bar, 'yPercent', { duration: 0.5, ease: 'power3' });
  ScrollTrigger.create({
    start: 120,
    end: 'max',
    onUpdate: (self) => show(self.direction === 1 && self.scroll() > 400 ? -160 : 0),
    onLeaveBack: () => show(0),
  });

  const progress = bar.querySelector<HTMLElement>('[data-progress]');
  const article = document.querySelector('[data-article]');
  if (progress && article) {
    gsap.fromTo(
      progress,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: article, start: 'top 30%', end: 'bottom 70%', scrub: 0.4 },
      },
    );
  }
}

function footer() {
  const word = document.querySelector<HTMLElement>('[data-footer-word]');
  if (word) {
    SplitText.create(word, {
      type: 'chars',
      mask: 'chars',
      onSplit(self) {
        padMasks(self.masks);
        return gsap.from(self.chars, {
          yPercent: 120,
          duration: D.epic,
          stagger: { each: 0.05, from: 'center' },
          scrollTrigger: ONCE(word, 'top 96%'),
        });
      },
    });
  }
  // ambient: the kerb never stops rolling
  $$('[data-kerb]').forEach((k) => gsap.to(k, { x: -56, duration: 1.6, ease: 'none', repeat: -1 }));
}

export function common(c: Conditions) {
  splits();
  reveals(c);
  proseImages();
  rules();
  counts();
  draws();
  parallax(c);
  marquees();
  header();
  footer();
}
