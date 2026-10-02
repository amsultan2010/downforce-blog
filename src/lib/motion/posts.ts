// Posts index: category filter (rows glide to their new slots) and the random post button.
import { navigate } from 'astro:transitions/client';
import { gsap, ScrollTrigger, D, E, $$ } from './core';

export function posts(motion: boolean, signal: AbortSignal) {
  const list = document.querySelector<HTMLElement>('[data-plist]');
  if (!list) return;
  const rows = $$('[data-cat]', list);
  const buttons = $$<HTMLButtonElement>('[data-filter]');

  const apply = (cat: string) => {
    rows.forEach((row) => (row.hidden = cat !== 'all' && row.dataset.cat !== cat));
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
    // looked up each time: the intro's text split replaces this node when it reverts
    const shown = document.querySelector<HTMLElement>('[data-shown]');
    if (shown) shown.textContent = String(rows.filter((r) => !r.hidden).length);
  };

  const select = async (cat: string, animate: boolean) => {
    const url = new URL(location.href);
    if (cat === 'all') url.searchParams.delete('c');
    else url.searchParams.set('c', cat);
    history.replaceState(history.state, '', url);

    if (!animate) return apply(cat);
    const { Flip } = await import('gsap/Flip');
    gsap.registerPlugin(Flip);
    const state = Flip.getState(rows);
    apply(cat);
    Flip.from(state, {
      duration: D.base,
      ease: E.inOut,
      stagger: 0.015,
      absolute: true,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, xPercent: -4 }, { autoAlpha: 1, xPercent: 0, duration: D.base }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, duration: D.fast }),
      onComplete: () => ScrollTrigger.refresh(),
    });
  };

  buttons.forEach((b) => b.addEventListener('click', () => void select(b.dataset.filter!, motion), { signal }));

  const initial = new URL(location.href).searchParams.get('c');
  if (initial && buttons.some((b) => b.dataset.filter === initial)) apply(initial);

  document.querySelector('[data-random]')?.addEventListener(
    'click',
    () => {
      const links = rows.filter((r) => !r.hidden).map((r) => r.querySelector('a')?.getAttribute('href'));
      const href = links[Math.floor(Math.random() * links.length)];
      if (href) void navigate(href);
    },
    { signal },
  );
}
