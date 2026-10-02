// The entrance for whatever sits inside [data-intro] at the top of a page. It reuses the
// same data attributes as the scroll reveals, but sequences them on one timeline that
// plays as the curtain lifts.
import { gsap, SplitText, D, E, $$, type Conditions } from './core';

const CLIP_FROM: Record<string, string> = {
  clip: 'inset(0% 0% 100% 0%)',
  'clip-left': 'inset(0% 100% 0% 0%)',
  'clip-right': 'inset(0% 0% 0% 100%)',
};

export function buildIntro(c: Conditions): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const root = document.querySelector<HTMLElement>('[data-intro]');
  if (!root) return tl;

  const lineSplits: SplitText[] = [];
  let cursor = 0;

  $$('[data-split], [data-reveal], [data-rule], [data-draw]', root).forEach((el) => {
    const at = el.dataset.at !== undefined ? Number(el.dataset.at) : cursor;
    const kind = el.dataset.split ?? el.dataset.reveal ?? (el.hasAttribute('data-rule') ? 'rule' : 'draw');
    tl.set(el, { visibility: 'visible' }, 0);

    switch (kind) {
      case 'chars': {
        const s = SplitText.create(el, { type: 'words,chars', mask: 'words' });
        gsap.set(s.masks, { paddingTop: '0.12em', paddingBottom: '0.16em', marginTop: '-0.12em', marginBottom: '-0.16em' });
        tl.from(s.chars, { yPercent: 118, duration: D.epic, stagger: 0.034 }, at);
        break;
      }
      case 'lines': {
        const s = SplitText.create(el, { type: 'lines', mask: 'lines' });
        lineSplits.push(s);
        tl.from(s.lines, { yPercent: 112, duration: D.slow, stagger: 0.08 }, at);
        break;
      }
      case 'clip':
      case 'clip-left':
      case 'clip-right': {
        const img = el.querySelector('img');
        tl.fromTo(
          el,
          { clipPath: CLIP_FROM[kind] },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: c.desk ? D.epic : D.slow, ease: E.inOut, clearProps: 'clipPath' },
          at,
        );
        if (img) tl.from(img, { scale: 1.35, duration: D.epic + 0.3 }, at);
        break;
      }
      case 'stagger':
        tl.from(el.children, { y: 26, autoAlpha: 0, duration: D.base, stagger: 0.07, ease: E.pop }, at);
        break;
      case 'rule':
        tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: D.epic, ease: E.inOut }, at);
        break;
      case 'draw':
        tl.from(el, { drawSVG: '0%', duration: 2.4, ease: E.inOut }, at);
        break;
      default:
        tl.from(el, { y: 24, autoAlpha: 0, duration: D.base }, at);
    }
    cursor = at + 0.11;
  });

  // line splits hard-wrap the copy, so hand the paragraph back once it has landed
  tl.eventCallback('onComplete', () => lineSplits.forEach((s) => s.revert()));
  return tl;
}
