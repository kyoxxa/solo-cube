import { solvedState, applyMoves, isSolved, idx, FACES } from '../js/cubeEngine.js';
import assert from 'node:assert';

function bottomLayerIntact(state) {
  // D face fully D, and bottom row (row 2) of F,R,B,L all match their own face
  for (let r=0;r<3;r++) for (let c=0;c<3;c++) if (state[idx('D',r,c)] !== 'D') return false;
  for (const f of ['F','R','B','L']) for (let c=0;c<3;c++) if (state[idx(f,2,c)] !== f) return false;
  return true;
}

const RIGHT_INSERT = "U R U' R' U' F' U F";
const LEFT_INSERT = "U' L' U L U F U' F'";

for (const [name, alg] of [['right', RIGHT_INSERT], ['left', LEFT_INSERT]]) {
  const s = applyMoves(solvedState(), alg);
  assert.ok(bottomLayerIntact(s), `${name} insert must preserve the whole bottom (white) layer`);
  assert.ok(!isSolved(s), `${name} insert must actually change the cube`);
  // Also confirm it does NOT touch D row orientation of middle layer below U (sanity: M slice e.g. row1 of F/R/B/L may change - that's expected)
  console.log(name, 'insert preserves bottom layer: OK, cube changed: OK');
}

console.log('MIDLAYER ALG VERIFY: PASS');
