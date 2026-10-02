// Standings: the tower entrance, plus the live refresh from the results API.
import { gsap, D, E, $$ } from './core';
import { fetchF1, type F1Data } from '../f1';
import { driverRows, f1Text, teamRows } from '../f1-render';

const FRESH_MS = 5 * 60_000;
let live: { data: F1Data; at: number } | null = null;

function baked(): F1Data | null {
  const el = document.getElementById('f1-data');
  try {
    return el ? (JSON.parse(el.textContent ?? '') as F1Data) : null;
  } catch {
    return null;
  }
}

/** Fill every [data-f1] slot. Runs with or without motion. */
function writeText(data: F1Data) {
  const text = f1Text(data, Date.now());
  $$('[data-f1]').forEach((el) => {
    const value = text[el.dataset.f1!];
    if (value) el.textContent = value;
  });
}

const signature = (d: F1Data) =>
  `${d.round}|${d.drivers.map((x) => x.code + x.points).join()}|${d.teams.map((x) => x.id + x.points).join()}`;

async function rerender(data: F1Data, animate: boolean) {
  for (const root of $$('[data-standings]')) {
    const lists: [HTMLElement | null, string][] = [
      [root.querySelector('[data-tower="drivers"]'), driverRows(data, Number(root.dataset.drivers))],
      [root.querySelector('[data-tower="teams"]'), teamRows(data, Number(root.dataset.teams))],
    ];
    if (!animate) {
      lists.forEach(([list, html]) => list && (list.innerHTML = html));
      continue;
    }
    // positions changed since the build: slide the rows to their new slots
    const { Flip } = await import('gsap/Flip');
    gsap.registerPlugin(Flip);
    for (const [list, html] of lists) {
      if (!list) continue;
      const state = Flip.getState(list.children);
      list.innerHTML = html;
      Flip.from(state, {
        targets: list.children,
        duration: D.slow,
        ease: E.inOut,
        stagger: 0.02,
        absolute: true,
        onEnter: (els) => gsap.from(els, { autoAlpha: 0, duration: D.base }),
      });
    }
  }
}

function entrance() {
  $$('[data-tower]').forEach((list) => {
    const rows = $$('.trow', list);
    if (!rows.length) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: list, start: 'top 84%', once: true } });
    tl.from(rows, { xPercent: -6, autoAlpha: 0, duration: D.base, stagger: 0.045 })
      .from($$('.trow__chip', list), { scaleY: 0, transformOrigin: 'top', duration: D.base, stagger: 0.045 }, 0.05)
      .from(
        $$('.trow__bar', list),
        { scaleX: 0, duration: D.epic, ease: E.inOut, stagger: 0.045, clearProps: 'transform' },
        0.1,
      );
    // each total counts up as its row arrives
    $$('.trow__pts', list).forEach((el, i) => {
      const end = Number(el.dataset.pts);
      const state = { v: 0 };
      tl.to(
        state,
        { v: end, duration: 1.2, ease: 'power2.out', snap: { v: 1 }, onUpdate: () => (el.textContent = String(state.v)) },
        0.1 + i * 0.045,
      );
    });
  });
}

/** `motion` is false under prefers-reduced-motion: data still refreshes, nothing travels. */
export function standings(motion: boolean, signal: AbortSignal) {
  const built = baked();
  const cached = live && Date.now() - live.at < FRESH_MS ? live.data : null;
  const start = cached ?? built;
  if (!start) return;
  writeText(start);
  // a fresh page arrives with build-time rows; bring it up to what this visit already fetched
  if (cached && built && signature(cached) !== signature(built)) void rerender(cached, false);
  if (motion) entrance();

  if (cached) return;
  fetchF1(signal)
    .then((data) => {
      live = { data, at: Date.now() };
      writeText(data);
      if (signature(data) !== signature(start)) void rerender(data, motion);
    })
    .catch(() => {
      // the baked snapshot stays on screen
    });
}
