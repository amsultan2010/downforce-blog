// Posts index: category filter (rows glide to their new slots) and the random post button.
import { navigate } from 'astro:transitions/client';
import { gsap, ScrollTrigger, D, E, $$ } from './core';

/** Rows arrive a few at a time as the list scrolls. The <li> belongs to the filter's Flip,
 *  so the entrance moves the parts inside each link and leaves the row itself alone.
 *  Returns a function that shows whatever is still waiting. */
function entrance(list: HTMLElement, rows: HTMLElement[]) {
  const parts = rows.map((row) => $$('.prow__main, .prow__cat, .prow__date', row));
  gsap.set(parts.flat(), { autoAlpha: 0 });
  gsap.set(list, { visibility: 'visible' });
  const waiting = ScrollTrigger.batch(rows, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      batch.forEach((row, i) => {
        const [main, ...meta] = parts[rows.indexOf(row as HTMLElement)];
        gsap
          .timeline({ delay: i * 0.07 })
          .fromTo(main, { x: -28 }, { x: 0, autoAlpha: 1, duration: D.base })
          .to(meta, { autoAlpha: 1, duration: D.fast, stagger: 0.06 }, 0.12);
      }),
  });
  return () => {
    waiting.forEach((t) => t.kill());
    gsap.set(parts.flat(), { autoAlpha: 1, x: 0 });
  };
}

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
    // the list is about to be reordered, so nothing waits for its scroll position any more
    settle?.();
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
  const settle = motion ? entrance(list, rows) : undefined;

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
