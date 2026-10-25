import { solvedState, applyMoves, isSolved, idx } from '../js/cubeEngine.js';
import assert from 'node:assert';

// Sune: R U R' U R U2 R'  -- known order 6
{
  let s = solvedState();
  for (let i=0;i<6;i++) s = applyMoves(s, "R U R' U R U2 R'");
  assert.ok(isSolved(s), 'Sune^6 should be solved (known order 6)');
}

// T-perm: R U R' U' R' F R2 U' R' U' R U R' F' -- known order 2
{
  let s = applyMoves(solvedState(), "R U R' U' R' F R2 U' R' U' R U R' F'");
  s = applyMoves(s, "R U R' U' R' F R2 U' R' U' R U R' F'");
  assert.ok(isSolved(s), "T-perm^2 should be solved (order 2)");
}
// T-perm should NOT itself be solved (sanity it does something)
{
  let s = applyMoves(solvedState(), "R U R' U' R' F R2 U' R' U' R U R' F'");
  assert.ok(!isSolved(s), 'T-perm alone should scramble the solved cube');
}

// Edge-orientation alg F R U R' U' F' : applied to SOLVED cube, then applied
// AGAIN in a way that should restore (since flipping same 2 edges twice = identity
// only if nothing else changed net), check order divides small number.
// Instead: verify applying it 1x then its own exact reverse-of-effect by re-deriving
// via repeated application is consistent - here we just check it has finite small order.
{
  let s = solvedState();
  let steps = 0;
  for (let i=1;i<=24;i++) {
    s = applyMoves(s, "F R U R' U' F'");
    if (isSolved(s)) { steps = i; break; }
  }
  console.log('F R U R\' U\' F\' order =', steps || 'not found within 24 (unexpected)');
  assert.ok(steps > 0 && steps <= 24, 'edge alg should have a finite small order');
}

console.log('ALGORITHM VERIFY: ALL PASS');
