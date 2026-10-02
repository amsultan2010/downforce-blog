// Home page scenes: hero depth, the ambient racing line, and the one pinned set piece.
import { gsap, ScrollTrigger, SplitText, $, $$, type Conditions } from './core';

function hero() {
  const root = $('[data-hero]');
  if (!root) return;
  const scrub = (extra: object = {}) => ({
    trigger: root,
    start: 'top top',
    end: 'bottom top',
    scrub: 0.6,
    ...extra,
  });

  // four layers, four rates
  gsap.to('[data-hero-word]', { yPercent: 26, ease: 'none', scrollTrigger: scrub() });
  gsap.to('[data-hero-media] img', { yPercent: 12, ease: 'none', scrollTrigger: scrub() });
  gsap.to('[data-hero-line]', { yPercent: -12, rotation: -4, ease: 'none', scrollTrigger: scrub() });
  gsap.to('[data-hero-grid]', { yPercent: 9, ease: 'none', scrollTrigger: scrub() });

  // ambient: a light runs the circuit for as long as the hero is on screen
  const car = $<SVGPathElement>('[data-hero-car]');
  if (car) {
    const len = car.getTotalLength();
    gsap.set(car, { strokeDasharray: `${len * 0.06} ${len * 0.94}` });
    const lap = gsap.fromTo(car, { strokeDashoffset: 0 }, { strokeDashoffset: -len, duration: 11, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (s) => (s.isActive ? lap.play() : lap.pause()),
    });
  }
  gsap.to('[data-hero-cue] i', { y: 9, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

function manifesto(c: Conditions) {
  const sec = $('[data-manifesto]');
  const text = $('[data-manifesto-text]');
  const track = $('[data-manifesto-track]');
  if (!sec || !text || !track) return;

  const split = SplitText.create(text, { type: 'words' });
  const figures = $$('figure', track);

  if (!c.desk) {
    gsap.fromTo(
      split.words,
      { opacity: 0.16 },
      { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 45%', scrub: 0.5 } },
    );
    return;
  }

  const travel = () => track.scrollWidth - window.innerWidth + track.offsetLeft * 2;
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec,
      pin: true,
      scrub: 1,
      start: 'top top',
      end: () => '+=' + (travel() + window.innerHeight * 0.9),
      invalidateOnRefresh: true,
    },
  });

  tl.fromTo(split.words, { opacity: 0.16 }, { opacity: 1, stagger: 0.06, ease: 'none', duration: 0.3 }, 0)
    .fromTo(track, { x: () => window.innerWidth * 0.62 }, { x: () => -travel(), ease: 'none', duration: 2 }, 0.15)
    // each photo slides inside its own frame while the track moves
    .fromTo($$('img', track), { xPercent: -9 }, { xPercent: 9, ease: 'none', duration: 2 }, 0.15)
    .fromTo(figures, { rotation: (i) => (i % 2 ? 2.5 : -2.5) }, { rotation: 0, ease: 'none', duration: 1.2, stagger: 0.2 }, 0.15)
    .fromTo('[data-manifesto-bar]', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 2.15 }, 0);
}

export function home(c: Conditions) {
  hero();
  manifesto(c);
}
