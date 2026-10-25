// camera.js - camera lifecycle, isolated from UI.
// The UI only calls start()/stop()/switchCamera() and renders `state`.
// States: idle | starting | live | paused | error
// Guarantees:
//  - only one getUserMedia request in flight; a stream that arrives after
//    stop()/close is stopped immediately (no leaked camera light)
//  - warm-up (metadata + play) has a timeout, so UI never hangs on "Starting"
//  - tab hidden / phone locked -> tracks stopped; resumes when visible again
//  - pagehide -> everything stopped

export const CAMERA_MESSAGES = {
  insecure: 'The camera only works on a secure (https://) page. Open https://kyoxxa.github.io/solo-cube/ instead.',
  unsupported: "This browser can't use the camera. You can enter the cube colors manually.",
  denied: 'Camera permission was blocked. Enable it in your browser settings.',
  notFound: 'No camera found. You can enter the cube colors manually.',
  busy: 'Camera is busy in another app or tab.',
  timeout: "The camera didn't start in time. Please try again.",
  unknown: 'The camera could not start. Please try again, or enter the colors manually.',
};

/** Map any getUserMedia / playback error to a friendly {code, message}. */
export function describeCameraError(err) {
  const name = (err && (err.code || err.name)) || '';
  let code = 'unknown';
  if (['insecure', 'unsupported', 'timeout'].includes(name)) code = name;
  else if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) code = 'denied';
  else if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(name)) code = 'notFound';
  else if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) code = 'busy';
  return { code, message: CAMERA_MESSAGES[code] };
}

function codedError(code) { const e = new Error(code); e.code = code; return e; }

export class CameraController {
  constructor(video, opts = {}) {
    this.video = video;
    this.win = opts.win || globalThis.window;
    this.doc = opts.doc || globalThis.document;
    this.media = opts.mediaDevices !== undefined ? opts.mediaDevices : this.win?.navigator?.mediaDevices;
    this.warmupMs = opts.warmupMs ?? 8000;
    this.onChange = opts.onChange || (() => {});
    this.state = 'idle';
    this.error = null;           // {code, message} when state === 'error'
    this.stream = null;
    this.facing = 'environment'; // rear camera first on phones
    this.deviceId = null;
    this._token = 0;             // increments on every start/stop; stale results are dropped
    this._resumeOnVisible = false;
    this._onVisibility = () => this._handleVisibility();
    this._onPageHide = () => this.stop();
    this.doc?.addEventListener?.('visibilitychange', this._onVisibility);
    this.win?.addEventListener?.('pagehide', this._onPageHide);
  }

  _set(state, error = null) {
    this.state = state; this.error = error;
    this.onChange({ state, error, facing: this.facing });
  }

  async start({ deviceId } = {}) {
    if (deviceId !== undefined) this.deviceId = deviceId;
    this._release();
    const token = ++this._token;
    this._set('starting');
    try {
      if (this.win && this.win.isSecureContext === false) throw codedError('insecure');
      if (!this.media?.getUserMedia) throw codedError('unsupported');
      const stream = await this._request();
      if (token !== this._token) { stopTracks(stream); return false; } // user left meanwhile
      this.stream = stream;
      stream.getVideoTracks().forEach(t => t.addEventListener?.('ended', () => {
        if (token === this._token && this.state === 'live') this._fail(codedError('NotReadableError'));
      }));
      await this._attach(stream);
      if (token !== this._token) return false;
      this._set('live');
      return true;
    } catch (err) {
      if (token !== this._token) return false;
      this._fail(err);
      return false;
    }
  }

  async _request() {
    const base = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const video = this.deviceId ? { ...base, deviceId: { exact: this.deviceId } }
                                : { ...base, facingMode: { ideal: this.facing } };
    try {
      return await this.media.getUserMedia({ audio: false, video });
    } catch (err) {
      // Some laptops/old phones reject any constraints; retry with the bare minimum.
      if (['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(err?.name)) {
        this.deviceId = null;
        return await this.media.getUserMedia({ audio: false, video: true });
      }
      throw err;
    }
  }

  // Attach stream to <video> and wait for real frames, with a timeout.
  _attach(stream) {
    const v = this.video;
    v.muted = true; v.setAttribute?.('playsinline', ''); v.setAttribute?.('muted', '');
    v.srcObject = stream;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = fn => (x) => { if (done) return; done = true; clearTimeout(timer); fn(x); };
      const ok = finish(resolve), bad = finish(reject);
      const timer = setTimeout(() => bad(codedError('timeout')), this.warmupMs);
      const tryPlay = () => Promise.resolve(v.play?.()).then(() => {
        if (v.readyState >= 2 || v.videoWidth > 0) ok();
        else v.addEventListener('loadeddata', ok, { once: true });
      }, bad);
      if (v.readyState >= 1) tryPlay(); else v.addEventListener('loadedmetadata', tryPlay, { once: true });
    });
  }

  _fail(err) { this._release(); this._set('error', describeCameraError(err)); }

  _release() {
    stopTracks(this.stream); this.stream = null;
    if (this.video) { try { this.video.pause?.(); } catch {} this.video.srcObject = null; }
  }

  /** Stop the camera (closing scanner, leaving page, manual entry...). */
  stop() {
    this._token++; this._resumeOnVisible = false;
    this._release();
    if (this.state !== 'idle') this._set('idle');
  }

  /** Flip front/rear. Falls back to cycling devices on desktops with 2+ cameras. */
  async switchCamera() {
    const cams = await this.listCameras();
    if (cams.length > 2 || (cams.length === 2 && this.deviceId)) {
      const cur = this.stream?.getVideoTracks()[0]?.getSettings?.().deviceId || this.deviceId;
      const i = cams.findIndex(c => c.deviceId === cur);
      return this.start({ deviceId: cams[(i + 1) % cams.length].deviceId });
    }
    this.facing = this.facing === 'environment' ? 'user' : 'environment';
    this.deviceId = null;
    return this.start();
  }

  async listCameras() {
    try { return (await this.media?.enumerateDevices?.() || []).filter(d => d.kind === 'videoinput'); }
    catch { return []; }
  }

  _handleVisibility() {
    if (this.doc.visibilityState === 'hidden') {
      if (this.state === 'live' || this.state === 'starting') {
        this._token++; this._release(); this._resumeOnVisible = true; this._set('paused');
      }
    } else if (this._resumeOnVisible) {
      this._resumeOnVisible = false; this.start();
    }
  }

  destroy() {
    this.stop();
    this.doc?.removeEventListener?.('visibilitychange', this._onVisibility);
    this.win?.removeEventListener?.('pagehide', this._onPageHide);
  }
}

function stopTracks(stream) { stream?.getTracks?.().forEach(t => { try { t.stop(); } catch {} }); }
