// cubeEngine.js
// -----------------------------------------------------------------------
// Pure, dependency-free model of a 3x3x3 Rubik's Cube using a 54-cell
// "facelet" representation. This is the single source of truth for cube
// state used by the scanner, the manual entry UI, the solver and the 3D
// preview - so there is exactly one definition of "what a move does",
// eliminating an entire class of bugs where the visual cube and the
// solver disagree about orientation.
//
// Faces are labelled U(p) R(ight) F(ront) D(own) L(eft) B(ack).
// Each face has 9 stickers in row-major order (row 0 = top row as seen
// looking straight at that face in its own solved orientation):
//   0 1 2
//   3 4 5
//   6 7 8
// Sticker 4 is always the center and never changes face - it defines
// which color "belongs" to that face.
// -----------------------------------------------------------------------

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// Geometric position of each (face,row,col) sticker on a cubie grid from
// -1..1 on each axis. This mirrors the mapping used by the 3D renderer so
// the digital twin and the solver are always in agreement.
function coordFor(face, row, col) {
  switch (face) {
    case 'F': return { x: col - 1, y: 1 - row, z: 1 };
    case 'R': return { x: 1, y: 1 - row, z: 1 - col };
    case 'B': return { x: 1 - col, y: 1 - row, z: -1 };
    case 'L': return { x: -1, y: 1 - row, z: col - 1 };
    case 'U': return { x: col - 1, y: 1, z: row - 1 };
    case 'D': return { x: col - 1, y: -1, z: 1 - row };
    default: throw new Error('Unknown face ' + face);
  }
}

const FACE_NORMAL = {
  U: { x: 0, y: 1, z: 0 },
  D: { x: 0, y: -1, z: 0 },
  F: { x: 0, y: 0, z: 1 },
  B: { x: 0, y: 0, z: -1 },
  R: { x: 1, y: 0, z: 0 },
  L: { x: -1, y: 0, z: 0 },
};

function faceForNormal(v) {
  for (const f of FACES) {
    const n = FACE_NORMAL[f];
    if (n.x === v.x && n.y === v.y && n.z === v.z) return f;
  }
  throw new Error('No face for normal ' + JSON.stringify(v));
}

// index into the flat 54-length facelet array
export function idx(face, row, col) {
  return FACES.indexOf(face) * 9 + row * 3 + col;
}

// Inverse lookup: (face, x,y,z) -> {row, col}
const INVERSE = {};
for (const face of FACES) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const c = coordFor(face, row, col);
      INVERSE[`${face}:${c.x},${c.y},${c.z}`] = { row, col };
    }
  }
}

// Move definitions shared with the 3D renderer: which axis/layer turns,
// and the rotation sign for a single clockwise (non-primed) quarter turn.
export const MOVE_DEFS = {
  U: { axis: 'y', layer: 1, sign: -1 },
  D: { axis: 'y', layer: -1, sign: 1 },
  L: { axis: 'x', layer: -1, sign: 1 },
  R: { axis: 'x', layer: 1, sign: -1 },
  F: { axis: 'z', layer: 1, sign: -1 },
  B: { axis: 'z', layer: -1, sign: 1 },
};

// Rotate a {x,y,z} integer vector by `steps` quarter turns (positive =
// right-hand-rule positive rotation) around `axis`.
function rotateVector(v, axis, steps) {
  let { x, y, z } = v;
  const n = ((steps % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    if (axis === 'x') { const ny = -z, nz = y; y = ny; z = nz; }
    else if (axis === 'y') { const nx = z, nz = -x; x = nx; z = nz; }
    else { const nx = -y, ny = x; x = nx; y = ny; }
  }
  return { x, y, z };
}

/**
 * Create a solved cube: a flat 54-length array of face labels, where
 * arr[idx(face,row,col)] === the color-face assigned to that position.
 * We store actual color *names* once scanned; a solved reference cube
 * just uses the face label as a stand-in color key.
 */
export function solvedState() {
  const arr = new Array(54);
  for (const face of FACES) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        arr[idx(face, row, col)] = face;
      }
    }
  }
  return arr;
}

export function cloneState(state) {
  return state.slice();
}

/**
 * Apply a single move (e.g. "R", "R'", "R2") to a facelet state and
 * return a NEW state (does not mutate the input).
 */
export function applyMove(state, move) {
  const face = move[0];
  const def = MOVE_DEFS[face];
  if (!def) throw new Error('Unknown move ' + move);
  const prime = move.includes("'");
  const double = move.includes('2');
  const turns = double ? 2 : 1;
  const steps = def.sign * (prime ? -1 : 1) * turns; // signed quarter turns

  const next = state.slice();
  for (const f of FACES) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const pos = coordFor(f, row, col);
        if (Math.round(pos[def.axis]) !== def.layer) continue; // untouched layer
        const dir = FACE_NORMAL[f];
        const newPos = rotateVector(pos, def.axis, steps);
        const newDir = rotateVector(dir, def.axis, steps);
        const newFace = faceForNormal(newDir);
        const dest = INVERSE[`${newFace}:${newPos.x},${newPos.y},${newPos.z}`];
        next[idx(newFace, dest.row, dest.col)] = state[idx(f, row, col)];
      }
    }
  }
  return next;
}

/** Apply a space-separated sequence of moves, returns the final state. */
export function applyMoves(state, moves) {
  let s = state;
  for (const m of normalizeMoveList(moves)) s = applyMove(s, m);
  return s;
}

export function normalizeMoveList(moves) {
  if (Array.isArray(moves)) return moves.filter(Boolean);
  return String(moves).trim().split(/\s+/).filter(Boolean);
}

/** Returns the inverse of a single move token. */
export function invertMove(move) {
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move[0];
  return move + "'";
}

export function invertMoves(moves) {
  return normalizeMoveList(moves).slice().reverse().map(invertMove);
}

export function isSolved(state) {
  for (const face of FACES) {
    const center = state[idx(face, 1, 1)];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (state[idx(face, row, col)] !== center) return false;
      }
    }
  }
  return true;
}

export { coordFor, faceForNormal, FACE_NORMAL };

// -----------------------------------------------------------------------
// Whole-cube reorientations (x, y, z, with ' and 2 variants). These do not
// turn any face relative to another - they just change which face you are
// calling "front" etc. They are useful for expressing a few last-layer
// algorithms compactly and for "rotate the whole cube" scan instructions.
// -----------------------------------------------------------------------
const ROTATION_AXIS = { x: 'x', y: 'y', z: 'z' };

export function applyRotation(state, rot) {
  const letter = rot[0];
  const axis = ROTATION_AXIS[letter];
  if (!axis) throw new Error('Unknown rotation ' + rot);
  // x follows R's handedness, y follows U's, z follows F's.
  const signSource = { x: MOVE_DEFS.R.sign, y: MOVE_DEFS.U.sign, z: MOVE_DEFS.F.sign }[letter];
  const prime = rot.includes("'");
  const double = rot.includes('2');
  const turns = double ? 2 : 1;
  const steps = signSource * (prime ? -1 : 1) * turns;

  const next = new Array(54);
  for (const f of FACES) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const pos = coordFor(f, row, col);
        const dir = FACE_NORMAL[f];
        const newPos = rotateVector(pos, axis, steps);
        const newDir = rotateVector(dir, axis, steps);
        const newFace = faceForNormal(newDir);
        const dest = INVERSE[`${newFace}:${newPos.x},${newPos.y},${newPos.z}`];
        next[idx(newFace, dest.row, dest.col)] = state[idx(f, row, col)];
      }
    }
  }
  return next;
}

/** Apply a mixed sequence of moves and whole-cube rotations (x,y,z). */
export function applySequence(state, tokens) {
  let s = state;
  for (const t of normalizeMoveList(tokens)) {
    s = 'xyz'.includes(t[0]) ? applyRotation(s, t) : applyMove(s, t);
  }
  return s;
}
