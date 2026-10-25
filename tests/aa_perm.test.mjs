import { solvedState, applySequence, isSolved } from '../js/cubeEngine.js';
import assert from 'node:assert';

// Aa-perm (pure 3-corner cycle, edges fixed), classic algorithm, order 3.
const AA = "x R' U R' D2 R U' R' D2 R2 x'";
{
  let s = solvedState();
  for (let i=0;i<3;i++) s = applySequence(s, AA);
  assert.ok(isSolved(s), 'Aa-perm^3 should be solved (known order 3)');
  // and not solved after 1 or 2 applications
  let s1 = applySequence(solvedState(), AA);
  assert.ok(!isSolved(s1), 'Aa-perm once should not be solved');
}

// Ua-perm (pure 3-edge cycle, corners fixed), order 3
const UA = "R U' R U R U R U' R' U' R2";
{
  let s = solvedState();
  for (let i=0;i<3;i++) s = applySequence(s, UA);
  assert.ok(isSolved(s), 'Ua-perm^3 should be solved (known order 3)');
}

console.log('AA/UA PERM VERIFY: PASS');
