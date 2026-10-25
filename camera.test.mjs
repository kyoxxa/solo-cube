import assert from 'node:assert';
import { CameraController, describeCameraError } from '../js/camera.js';

class Emitter { constructor(){this.l={};} addEventListener(t,f,o){(this.l[t]??=[]).push({f,once:o?.once});}
  removeEventListener(t,f){this.l[t]=(this.l[t]||[]).filter(x=>x.f!==f);}
  emit(t){const ls=this.l[t]||[];this.l[t]=ls.filter(x=>!x.once);ls.forEach(x=>x.f());} }
function fakeTrack(){ const t=new Emitter(); t.stopped=false; t.stop=()=>{t.stopped=true}; t.getSettings=()=>({}); return t; }
function fakeStream(){ const tr=fakeTrack(); return { tr, getTracks:()=>[tr], getVideoTracks:()=>[tr] }; }
function fakeVideo({ never=false }={}){ const v=new Emitter(); v.readyState=0; v.videoWidth=0; v.setAttribute=()=>{};
  v.pause=()=>{}; v.play=()=>Promise.resolve();
  Object.defineProperty(v,'srcObject',{set(s){this._s=s; if(s&&!never) setTimeout(()=>{v.readyState=4;v.videoWidth=1280;v.emit('loadedmetadata');},5);}, get(){return this._s;}});
  return v; }
function env(gum){ const doc=new Emitter(); doc.visibilityState='visible'; const win=new Emitter(); win.isSecureContext=true;
  return { doc, win, mediaDevices:{ getUserMedia:gum, enumerateDevices:async()=>[] } }; }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// error mapping uses the exact copy requested
assert.equal(describeCameraError({name:'NotAllowedError'}).message,'Camera permission was blocked. Enable it in your browser settings.');
assert.equal(describeCameraError({name:'NotFoundError'}).message,'No camera found. You can enter the cube colors manually.');
assert.equal(describeCameraError({name:'NotReadableError'}).message,'Camera is busy in another app or tab.');

// 1. happy path -> live, stop releases tracks
{ const s=fakeStream(); const e=env(async()=>s); const c=new CameraController(fakeVideo(),{...e});
  assert.equal(await c.start(),true); assert.equal(c.state,'live'); c.stop(); assert.ok(s.tr.stopped); assert.equal(c.state,'idle'); }

// 2. user leaves while permission prompt is open -> late stream is stopped, state stays idle
{ let resolve; const s=fakeStream(); const e=env(()=>new Promise(r=>resolve=r)); const c=new CameraController(fakeVideo(),{...e});
  const p=c.start(); assert.equal(c.state,'starting'); c.stop(); resolve(s); assert.equal(await p,false);
  assert.ok(s.tr.stopped,'late stream must be stopped'); assert.equal(c.state,'idle'); }

// 3. permission denied -> error state with friendly message
{ const e=env(async()=>{const x=new Error('x');x.name='NotAllowedError';throw x;}); const c=new CameraController(fakeVideo(),{...e});
  await c.start(); assert.equal(c.state,'error'); assert.equal(c.error.code,'denied'); }

// 4. video never produces frames -> timeout error, never stuck in "starting"
{ const s=fakeStream(); const e=env(async()=>s); const c=new CameraController(fakeVideo({never:true}),{...e,warmupMs:30});
  await c.start(); assert.equal(c.state,'error'); assert.equal(c.error.code,'timeout'); assert.ok(s.tr.stopped); }

// 5. insecure context / unsupported
{ const e=env(async()=>fakeStream()); e.win.isSecureContext=false; const c=new CameraController(fakeVideo(),{...e});
  await c.start(); assert.equal(c.error.code,'insecure'); }
{ const e=env(null); e.mediaDevices={}; const c=new CameraController(fakeVideo(),{...e}); await c.start(); assert.equal(c.error.code,'unsupported'); }

// 6. overconstrained -> retries with bare constraints
{ let calls=0; const s=fakeStream(); const e=env(async()=>{ if(calls++===0){const x=new Error();x.name='OverconstrainedError';throw x;} return s; });
  const c=new CameraController(fakeVideo(),{...e}); assert.equal(await c.start(),true); assert.equal(calls,2); }

// 7. tab hidden -> paused + tracks stopped; visible -> resumes
{ let n=0; const streams=[]; const e=env(async()=>{const s=fakeStream();streams.push(s);n++;return s;});
  const c=new CameraController(fakeVideo(),{...e}); await c.start();
  e.doc.visibilityState='hidden'; e.doc.emit('visibilitychange'); assert.equal(c.state,'paused'); assert.ok(streams[0].tr.stopped);
  e.doc.visibilityState='visible'; e.doc.emit('visibilitychange'); await sleep(30); assert.equal(c.state,'live'); assert.equal(n,2); c.destroy(); }

// 8. pagehide stops camera; track 'ended' (taken by other app) -> busy error
{ const s=fakeStream(); const e=env(async()=>s); const c=new CameraController(fakeVideo(),{...e}); await c.start();
  e.win.emit('pagehide'); assert.ok(s.tr.stopped); assert.equal(c.state,'idle'); }
{ const s=fakeStream(); const e=env(async()=>s); const c=new CameraController(fakeVideo(),{...e}); await c.start();
  s.tr.emit('ended'); assert.equal(c.state,'error'); assert.equal(c.error.code,'busy'); }

// 9. double click "Scan" -> only the latest request survives, first stream released
{ const ss=[]; const e=env(async()=>{const s=fakeStream();ss.push(s);await sleep(5);return s;});
  const c=new CameraController(fakeVideo(),{...e}); const a=c.start(), b=c.start(); assert.equal(await a,false); assert.equal(await b,true);
  assert.ok(ss[0].tr.stopped); assert.ok(!ss[1].tr.stopped); }

console.log('CAMERA CONTROLLER: ALL PASS');
