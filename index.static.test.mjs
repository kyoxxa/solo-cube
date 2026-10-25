// Static regression checks on index.html (no browser needed).
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(!html.includes('getUserMedia'), 'index.html must not call getUserMedia directly; only js/camera.js may');
assert.ok(html.includes("from './js/camera.js'"), 'module must use CameraController');
assert.ok(/let rejectedCenterRGB\s*=/.test(html), 'rejectedCenterRGB must be declared (auto-capture crashed without it)');
assert.ok(!html.includes('Camera safety net'), 'old competing fallback camera script must be gone');
for (const id of ['startCamera', 'retryCamera', 'switchCamera', 'cameraError', 'cameraStatus'])
  assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
console.log('INDEX STATIC: ALL PASS');
