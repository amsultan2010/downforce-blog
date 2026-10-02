import { fetchF1, type F1Data } from './f1';
import snapshot from '../data/f1-snapshot.json';

let cached: Promise<F1Data> | null = null;

/**
 * Standings for the static HTML. Tries the live API once per build and falls back to the
 * checked-in snapshot, so a slow or unreachable API never fails a build.
 */
export function getBuildF1(): Promise<F1Data> {
  cached ??= fetchF1(AbortSignal.timeout(8000)).catch((err) => {
    console.warn(`[f1] live fetch failed, using snapshot from ${snapshot.fetchedAt}: ${err.message}`);
    return snapshot as F1Data;
  });
  return cached;
}
