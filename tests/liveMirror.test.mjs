import assert from 'node:assert';
import { applyMoves, solvedState } from '../js/cubeEngine.js';
import { inferVisibleFaceMove, StableObservationGate, readFace, faceMapToState } from '../js/liveMirror.js';

// Scanner face maps are serialized in canonical U,R,F,D,L,B order.
{
  const map={};
  for(const f of ['U','R','F','D','L','B'])map[f]=Array(9).fill(f);
  assert.deepEqual(faceMapToState(map),solvedState());
  assert.throws(()=>faceMapToState({...map,B:Array(8).fill('B')}),/Missing 9 stickers/);
}

// State unchanged -> never invent a move.
{
  const state = applyMoves(solvedState(), "R U F' L2");
  for (const face of ['U','R','F','D','L','B']) {
    const result = inferVisibleFaceMove(state, face, readFace(state, face));
    assert.equal(result.status, 'unchanged');
  }
}

// The detector is conservative: it only reports a move when one visible
// face gives a unique match. Every reported move must reproduce the observed
// stickers exactly (synthetic camera observations).
{
  const faces = ['U','R','F','D','L','B'];
  const tokens = faces.flatMap(f => [f, `${f}'`, `${f}2`]);
  let checked = 0, ambiguous = 0, unmatched = 0, unchanged = 0;
  for (let trial=0; trial<35; trial++) {
    const scramble = Array.from({length:10}, () => tokens[Math.floor(Math.random()*tokens.length)]);
    const state = applyMoves(solvedState(), scramble);
    for (const move of tokens) {
      const next = applyMoves(state, [move]);
      for (const face of faces) {
        const observed = readFace(next, face);
        const r = inferVisibleFaceMove(state, face, observed, {maxErrors:0});
        if (r.status === 'detected') {
          assert.equal(r.move, move, `detected wrong move ${r.move} for ${move}`);
          assert.deepEqual(readFace(applyMoves(state,[r.move]),face), observed);
          checked++;
        } else if (r.status === 'ambiguous') ambiguous++;
        else if (r.status === 'unmatched') unmatched++;
        else if (r.status === 'unchanged') unchanged++;
      }
    }
  }
  assert.ok(checked > 20, `expected some unique visible move matches, saw ${checked}`);
  assert.ok(ambiguous > 0, 'some one-face patterns should correctly be reported ambiguous');
  assert.ok(unchanged > 0, 'opposite-face turns should remain unchanged from a one-face view');
  console.log(`LIVE MIRROR INFERENCE: ${checked} unique move matches; ${ambiguous} ambiguous and ${unmatched} no-match, ${unchanged} unchanged/opposite-face readings`);
}

// One noisy sticker is tolerated; two noisy stickers are not.
{
  const state = applyMoves(solvedState(), "R U F L D");
  const next = applyMoves(state, ['F']);
  const obs = readFace(next, 'F');
  const noisy = obs.slice(); noisy[0] = noisy[0] === 'U' ? 'D' : 'U';
  const r = inferVisibleFaceMove(state, 'F', noisy, {maxErrors:1});
  assert.equal(r.status, 'detected');
  const tooNoisy = noisy.slice(); tooNoisy[1] = tooNoisy[1] === 'U' ? 'D' : 'U';
  assert.notEqual(inferVisibleFaceMove(state, 'F', tooNoisy, {maxErrors:0}).status, 'detected');
}

// Reject a color pattern with the wrong center rather than applying a move.
{
  const s = solvedState();
  const bad = readFace(s, 'F').slice(); bad[4] = 'R';
  assert.equal(inferVisibleFaceMove(s, 'F', bad).reason, 'center-mismatch');
}

// Stability gate emits after N identical camera readings, once per change.
{
  const g = new StableObservationGate(3), face = 'F', colors = ['U','U','U','R','F','L','D','D','D'];
  assert.equal(g.push(face, colors), null);
  assert.equal(g.push(face, colors), null);
  assert.ok(g.push(face, colors));
  assert.equal(g.push(face, colors), null, 'same reading only emits once');
  const next = colors.slice(); next[0] = 'R';
  g.push(face, next);g.push(face,next);
  assert.ok(g.push(face,next));
}

console.log('LIVE MIRROR GATE: ALL PASS');
