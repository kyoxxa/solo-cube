// liveMirror.js
// Conservative inference for mirroring one physical face turn at a time.
// It never guesses: if the visible 3x3 pattern matches multiple moves (or
// no move), it reports ambiguous/unmatched and leaves the digital state alone.
import { FACES, idx, applyMove } from './cubeEngine.js';

export const MOVE_TOKENS = FACES.flatMap(face => [face, `${face}'`, `${face}2`]);

export function readFace(state, face) {
  const base = FACES.indexOf(face) * 9;
  if (base < 0) throw new Error(`Unknown face: ${face}`);
  return state.slice(base, base + 9);
}

export function observationSignature(face, stickers) {
  return `${face}|${stickers.join(',')}`;
}

/**
 * Compare a camera's calibrated 3x3 color labels with every possible
 * single face turn. `stickers` must use the same canonical face labels as
 * cubeEngine (U,R,F,D,L,B). maxErrors allows a small number of noisy color
 * classifications; tied matches are always rejected rather than guessed.
 */
export function inferVisibleFaceMove(state, face, stickers, { maxErrors = 1 } = {}) {
  if (!FACES.includes(face)) return { status: 'unmatched', reason: 'unknown-face', candidates: [] };
  if (!Array.isArray(stickers) || stickers.length !== 9 || stickers.some(x => !FACES.includes(x))) {
    return { status: 'unmatched', reason: 'uncertain-colors', candidates: [] };
  }
  // Centers never move relative to their face. A mismatched center means the
  // camera's face orientation/calibration is not trustworthy yet.
  if (stickers[4] !== face) return { status: 'unmatched', reason: 'center-mismatch', candidates: [] };

  const current = readFace(state, face);
  const baselineErrors = mismatchCount(current, stickers);
  if (baselineErrors <= maxErrors) {
    return { status: 'unchanged', candidates: [], errors: baselineErrors };
  }

  let bestErrors = Infinity;
  let candidates = [];
  for (const move of MOVE_TOKENS) {
    const next = applyMove(state, move);
    const errors = mismatchCount(readFace(next, face), stickers);
    if (errors < bestErrors) { bestErrors = errors; candidates = [move]; }
    else if (errors === bestErrors) candidates.push(move);
  }

  if (bestErrors > maxErrors) {
    return { status: 'unmatched', reason: 'not-a-single-visible-turn', errors: bestErrors, candidates: [] };
  }
  if (candidates.length !== 1) {
    return { status: 'ambiguous', errors: bestErrors, candidates };
  }
  return { status: 'detected', move: candidates[0], errors: bestErrors, candidates };
}

function mismatchCount(a, b) {
  let count = 0;
  for (let i = 0; i < 9; i++) if (a[i] !== b[i]) count++;
  return count;
}

/**
 * Require repeated identical face readings before inference. Camera frames
 * during the actual twist are blurry; stableCount protects against reacting
 * to an in-between frame. A confirmed signature is emitted only once.
 */
export class StableObservationGate {
  constructor(stableCount = 4) {
    this.stableCount = stableCount;
    this.pending = '';
    this.count = 0;
    this.lastEmitted = '';
  }
  push(face, stickers) {
    const signature = observationSignature(face, stickers);
    if (signature === this.pending) this.count++;
    else { this.pending = signature; this.count = 1; }
    if (this.count < this.stableCount || signature === this.lastEmitted) return null;
    this.lastEmitted = signature;
    return { face, stickers: stickers.slice(), signature };
  }
  reset() { this.pending = ''; this.count = 0; this.lastEmitted = ''; }
}

/** Test helper: return center-indexed colors for a scanner's face map. */
export function faceMapToState(faceMap) {
  const state = new Array(54);
  for (const face of FACES) {
    const stickers = faceMap[face];
    if (!Array.isArray(stickers) || stickers.length !== 9) throw new Error(`Missing 9 stickers for ${face}`);
    for (let i = 0; i < 9; i++) state[idx(face, Math.floor(i / 3), i % 3)] = stickers[i];
  }
  return state;
}
