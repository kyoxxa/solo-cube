import { solvedState, applyMove, applyMoves, isSolved, invertMove, invertMoves } from '../js/cubeEngine.js';
import assert from 'node:assert';

function eq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }

// 1) Each move applied 4 times returns to solved (quarter turn group order 4)
for (const m of ['U','D','L','R','F','B']) {
  let s = solvedState();
  for (let i=0;i<4;i++) s = applyMove(s, m);
  assert.ok(isSolved(s), `${m} applied 4x should be solved`);
}

// 2) Move + its inverse = identity
for (const m of ['U',"U'",'U2','D',"D'",'D2','L',"L'",'L2','R',"R'",'R2','F',"F'",'F2','B',"B'",'B2']) {
  let s = solvedState();
  s = applyMove(s, m);
  s = applyMove(s, invertMove(m));
  assert.ok(isSolved(s), `${m} then inverse should be solved`);
}

// 3) double move = move applied twice
for (const m of ['U','D','L','R','F','B']) {
  let a = applyMove(applyMove(solvedState(), m), m);
  let b = applyMove(solvedState(), m+'2');
  assert.ok(eq(a,b), `${m}2 should equal ${m} ${m}`);
}

// 4) A long random sequence followed by its exact inverse returns to solved
const faces = ['U','D','L','R','F','B'];
const suffixes = ['', "'", '2'];
function randomScramble(n) {
  const seq = [];
  let lastFace = '';
  for (let i=0;i<n;i++) {
    let f;
    do { f = faces[Math.floor(Math.random()*6)]; } while (f === lastFace);
    lastFace = f;
    seq.push(f + suffixes[Math.floor(Math.random()*3)]);
  }
  return seq;
}
for (let trial=0; trial<50; trial++) {
  const seq = randomScramble(25);
  let s = applyMoves(solvedState(), seq);
  s = applyMoves(s, invertMoves(seq));
  assert.ok(isSolved(s), `scramble+inverse trial ${trial} should be solved. seq=${seq.join(' ')}`);
}

// 5) Known group identity: (R U)^105 = identity (well known order of RU is 105)
{
  let s = solvedState();
  for (let i=0;i<105;i++) { s = applyMove(s,'R'); s = applyMove(s,'U'); }
  assert.ok(isSolved(s), '(RU)^105 should be solved (known order of RU=105)');
}

// 6) sexy move (R U R' U') has order 6
{
  let s = solvedState();
  for (let i=0;i<6;i++) s = applyMoves(s, "R U R' U'");
  assert.ok(isSolved(s), "(R U R' U')^6 should be solved");
}

console.log('ENGINE SANITY: ALL PASS');
