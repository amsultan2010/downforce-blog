// The one place GSAP is configured. Every scene imports from here, never from 'gsap'
// directly, so timing and easing stay the same across the site.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase);

CustomEase.create('out', '0.16, 1, 0.3, 1');
CustomEase.create('inOut', '0.65, 0, 0.35, 1');

export const D = { fast: 0.35, base: 0.7, slow: 1.1, epic: 1.6 };
export const E = { out: 'out', inOut: 'inOut', pop: 'back.out(1.7)' };

gsap.defaults({ ease: E.out, duration: D.base });

// dev only: lets the gsap-max browser probes count triggers from the console
if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger });

export interface Conditions {
  desk: boolean;
  fine: boolean;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/** A loop only earns its frames while it is on screen: it runs between the trigger entering
 *  and leaving the viewport, and sits paused the rest of the time. */
export function park(loop: gsap.core.Animation, trigger: Element) {
  loop.pause();
  return ScrollTrigger.create({
    trigger,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
  });
}

export { gsap, ScrollTrigger, SplitText };
