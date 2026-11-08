/* Face detection: MediaPipe BlazeFace -> native FaceDetector -> skin-tone heuristic (fallback chain) */
const $ = (id) => document.getElementById(id);
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const MAX_IMG = 1600, MAX_FILE = 40 * 1024 * 1024;

const el = { modes: $('modes'), engine: $('engine'), msg: $('msg'), pick: $('pick'), file: $('file'), start: $('start'), stop: $('stop'),
  stage: $('stage'), ph: $('placeholder'), media: $('media'), video: $('video'), canvas: $('canvas'),
  now: $('sNow'), peak: $('sPeak'), conf: $('sConf'), fps: $('sFps') };
const ctx = el.canvas.getContext('2d');

let mode = 'image', engine = null /* 'mediapipe' | 'native' | 'skin' */, mp = null, mpMode = 'IMAGE', native = null;
let engineReady = null, running = false, stream = null, lastTs = 0, peak = 0, rafId = 0, fileURL = null, token = 0;

/* ---------- helpers ---------- */
function notify(text, cls) {
  if (!text) { el.msg.classList.add('hidden'); return; }
  el.msg.className = 'notice ' + (cls || ''); el.msg.textContent = text;
}
function setEngine(text, cls, spin) {
  el.engine.className = 'badge ' + (cls || '');
  el.engine.innerHTML = (spin ? '<span class="spinner" style="width:12px;height:12px"></span>' : '') + text;
}
function resetStats() { peak = 0; el.now.textContent = '0'; el.peak.textContent = '0'; el.conf.textContent = '–'; el.fps.textContent = '–'; }
function updateStats(faces, fps) {
  el.now.textContent = faces.length; peak = Math.max(peak, faces.length); el.peak.textContent = peak;
  const sc = faces.filter((f) => typeof f.score === 'number');
  el.conf.textContent = sc.length ? Math.round(sc.reduce((a, f) => a + f.score, 0) / sc.length * 100) + '%' : (faces.length ? 'est.' : '–');
  if (fps) el.fps.textContent = fps.toFixed(0);
}

/* ---------- engines ---------- */
async function initMediaPipe() {
  const lib = await import(MP + '/vision_bundle.mjs');
  const fileset = await lib.FilesetResolver.forVisionTasks(MP + '/wasm');
  const make = (delegate) => lib.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MP_MODEL, delegate }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 });
  try { mp = await make('GPU'); } catch (e) { mp = await make('CPU'); }
  mpMode = 'IMAGE';
}
function ensureEngine() {
  if (engineReady) return engineReady;
  setEngine('Loading detector…', '', true);
  engineReady = (async () => {
    try {
      await Promise.race([initMediaPipe(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 45000))]);
      engine = 'mediapipe'; setEngine('MediaPipe BlazeFace', 'ok'); return;
    } catch (e) { console.warn('MediaPipe unavailable:', e); }
    try {
      if ('FaceDetector' in window) { native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 20 }); engine = 'native'; setEngine('Browser detector', 'ok'); return; }
    } catch (e) { console.warn('Native FaceDetector unavailable:', e); }
    engine = 'skin'; setEngine('Basic mode (approximate)', 'warn');
    notify('The AI detector could not be loaded, so a simple colour-based method is being used. Results are approximate and work best on clear, front-facing faces. Check your connection and reload to retry.', 'warn');
  })();
  return engineReady;
}

function detectSkin(src, sw, sh) {
  const W = 200, H = Math.max(1, Math.round(sh / sw * W));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const Y = 0.299 * r + 0.587 * g + 0.114 * b, cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
    if (Y > 50 && cb >= 77 && cb <= 127 && cr >= 135 && cr <= 173 && r > g && r > b) mask[i] = 1;
  }
  const seen = new Uint8Array(W * H), out = [], stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || seen[s]) continue;
    let minX = W, maxX = 0, minY = H, maxY = 0, n = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(), px = p % W, py = (p / W) | 0; n++;
      if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || seen[q] || !mask[q]) continue;
        if ((q === p - 1 && px === 0) || (q === p + 1 && px === W - 1)) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1, ar = bw / bh, fill = n / (bw * bh);
    if (n > W * H * 0.008 && ar > 0.55 && ar < 1.5 && fill > 0.5 && bw > 12) {
      const k = sw / W; out.push({ x: minX * k, y: minY * k, w: bw * k, h: bh * k, score: null });
    }
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 10);
}

/* Returns [{x,y,w,h,score}] in the source's own pixel space */
async function detect(src, sw, sh, isVideo) {
  await ensureEngine();
  try {
    if (engine === 'mediapipe') {
      const want = isVideo ? 'VIDEO' : 'IMAGE';
      if (mpMode !== want) { await mp.setOptions({ runningMode: want }); mpMode = want; }
      let res;
      if (isVideo) { lastTs = Math.max(lastTs + 1, performance.now()); res = mp.detectForVideo(src, lastTs); }
      else res = mp.detect(src);
      return res.detections.map((d) => ({ x: d.boundingBox.originX, y: d.boundingBox.originY, w: d.boundingBox.width, h: d.boundingBox.height, score: d.categories?.[0]?.score ?? null }));
    }
    if (engine === 'native') {
      const r = await native.detect(src);
      return r.map((f) => ({ x: f.boundingBox.x, y: f.boundingBox.y, w: f.boundingBox.width, h: f.boundingBox.height, score: null }));
    }
  } catch (e) {
    console.warn('Detector error, switching to basic mode:', e);
    engine = 'skin'; setEngine('Basic mode (approximate)', 'warn');
  }
  return detectSkin(src, sw, sh);
}

/* ---------- drawing ---------- */
function drawBoxes(faces, W, H, mirror) {
  const lw = Math.max(2, Math.round(W / 220)), fs = Math.max(12, Math.round(W / 45));
  ctx.lineWidth = lw; ctx.font = '600 ' + fs + 'px system-ui,sans-serif'; ctx.textBaseline = 'top';
  faces.forEach((f, i) => {
    const x = mirror ? W - f.x - f.w : f.x;
    const g = ctx.createLinearGradient(x, f.y, x + f.w, f.y + f.h); g.addColorStop(0, '#8b5cf6'); g.addColorStop(1, '#22d3ee');
    ctx.strokeStyle = g; ctx.shadowColor = 'rgba(34,211,238,.6)'; ctx.shadowBlur = lw * 3;
    const r = Math.min(f.w, f.h) * 0.12; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, f.y, f.w, f.h, r) : ctx.rect(x, f.y, f.w, f.h); ctx.stroke(); ctx.shadowBlur = 0;
    const label = 'Face ' + (i + 1) + (typeof f.score === 'number' ? ' · ' + Math.round(f.score * 100) + '%' : '');
    const tw = ctx.measureText(label).width + fs, th = fs * 1.6, ty = Math.max(0, f.y - th);
    ctx.fillStyle = 'rgba(15,18,40,.82)'; ctx.fillRect(x, ty, tw, th);
    ctx.fillStyle = '#fff'; ctx.fillText(label, x + fs / 2, ty + fs * 0.3);
  });
}

/* ---------- Image mode ---------- */
async function handleImage(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('Please choose an image file (JPG, PNG, WEBP).', 'bad'); return; }
  if (file.size > MAX_FILE) { notify('That file is too large. Please choose one under 40 MB.', 'bad'); return; }
  const my = ++token; notify('');
  const url = URL.createObjectURL(file), img = new Image();
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('decode')); img.src = url; });
  } catch (e) { URL.revokeObjectURL(url); notify('This image could not be read. It may be corrupted or unsupported.', 'bad'); return; }
  if (my !== token) return;
  const k = Math.min(1, MAX_IMG / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
  el.ph.classList.add('hidden'); el.media.classList.remove('hidden'); el.video.classList.add('hidden');
  el.canvas.style.cssText = ''; el.canvas.width = W; el.canvas.height = H; ctx.drawImage(img, 0, 0, W, H);
  resetStats();
  const t0 = performance.now();
  const faces = await detect(img, W, H, false); if (my !== token) return;
  drawBoxes(faces, W, H, false); updateStats(faces, 0);
  el.fps.textContent = Math.round(performance.now() - t0) + 'ms';
  URL.revokeObjectURL(url);
  if (!faces.length) notify('No faces found in this image. Try a clearer, well-lit photo where faces are front-facing.', 'warn');
  else if (engine === 'skin') notify(faces.length + ' possible face region(s) found using the basic method.', 'warn');
  else notify(faces.length + ' face' + (faces.length > 1 ? 's' : '') + ' detected.', 'ok');
}

/* ---------- Live (webcam / video file) ---------- */
function overlaySetup() {
  el.canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
  el.media.classList.remove('hidden'); el.ph.classList.add('hidden'); el.video.classList.remove('hidden');
}
function loop() {
  if (!running) return;
  const v = el.video; let last = performance.now(), frames = 0, fpsAcc = 0, lastTime = -1;
  const tick = async () => {
    if (!running) return;
    if (v.readyState >= 2 && !v.paused && !v.ended && v.currentTime !== lastTime && v.videoWidth) {
      lastTime = v.currentTime;
      if (el.canvas.width !== v.videoWidth) { el.canvas.width = v.videoWidth; el.canvas.height = v.videoHeight; }
      const t = performance.now(), faces = await detect(v, v.videoWidth, v.videoHeight, true);
      if (!running) return;
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      drawBoxes(faces, el.canvas.width, el.canvas.height, mode === 'webcam');
      frames++; fpsAcc += performance.now() - t;
      if (performance.now() - last > 500) { updateStats(faces, frames / ((performance.now() - last) / 1000)); frames = 0; last = performance.now(); fpsAcc = 0; }
      else { el.now.textContent = faces.length; peak = Math.max(peak, faces.length); el.peak.textContent = peak; }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}
function stopLive() {
  running = false; cancelAnimationFrame(rafId);
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  el.video.pause(); el.video.srcObject = null;
  if (fileURL) { URL.revokeObjectURL(fileURL); fileURL = null; }
  el.video.removeAttribute('src'); el.video.controls = false; el.video.load();
  el.stop.classList.add('hidden');
  if (mode === 'webcam') el.start.classList.remove('hidden');
}
async function startWebcam() {
  notify('');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { notify('Camera access is not available here. Use a modern browser over HTTPS (your deployed Vercel URL qualifies).', 'bad'); return; }
  el.start.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    el.start.disabled = false;
    const m = { NotAllowedError: 'Camera permission was denied. Allow camera access in your browser settings and try again.', NotFoundError: 'No camera was found on this device.',
      NotReadableError: 'The camera is in use by another application. Close it and try again.', OverconstrainedError: 'The camera does not support the requested settings.' };
    notify(m[e.name] || 'Could not start the camera (' + (e.name || 'unknown error') + ').', 'bad'); return;
  }
  el.start.disabled = false;
  overlaySetup(); el.video.classList.add('mirror'); el.video.srcObject = stream;
  try { await el.video.play(); } catch (e) { /* autoplay muted should succeed */ }
  resetStats(); await ensureEngine();
  running = true; el.start.classList.add('hidden'); el.stop.classList.remove('hidden'); loop();
}
async function startVideoFile(file) {
  if (!file) return; notify('');
  if (!file.type.startsWith('video/')) { notify('Please choose a video file (MP4, WEBM, MOV).', 'bad'); return; }
  stopLive(); fileURL = URL.createObjectURL(file);
  overlaySetup(); el.video.classList.remove('mirror'); el.video.controls = true; el.video.loop = true; el.video.src = fileURL;
  try {
    await new Promise((res, rej) => { el.video.onloadeddata = res; el.video.onerror = () => rej(new Error('decode')); });
    await el.video.play();
  } catch (e) { if (e.message === 'decode') { notify('This video could not be played. Try an MP4 (H.264) or WEBM file.', 'bad'); stopLive(); return; } }
  resetStats(); await ensureEngine(); running = true; el.stop.classList.remove('hidden'); loop();
}

/* ---------- Mode switching ---------- */
function setMode(m) {
  token++; stopLive(); mode = m; notify(''); resetStats(); ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  el.media.classList.add('hidden'); el.ph.classList.remove('hidden');
  el.modes.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  const fileMode = m !== 'webcam';
  el.pick.classList.toggle('hidden', !fileMode); el.start.classList.toggle('hidden', m !== 'webcam'); el.stop.classList.add('hidden');
  el.file.accept = m === 'video' ? 'video/*' : 'image/*';
  el.pick.textContent = m === 'video' ? 'Choose video' : 'Choose image';
  el.ph.innerHTML = '<div style="font-size:3rem">' + (m === 'webcam' ? '📹' : m === 'video' ? '🎞️' : '🙂') + '</div>' +
    (m === 'webcam' ? 'Press “Start camera” to begin' : m === 'video' ? 'Choose a video to analyse' : 'Choose an image to begin');
}
el.modes.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
el.file.addEventListener('change', () => { const f = el.file.files[0]; el.file.value = ''; mode === 'video' ? startVideoFile(f) : handleImage(f); });
el.start.addEventListener('click', startWebcam);
el.stop.addEventListener('click', () => { stopLive(); notify('Stopped. Peak faces seen: ' + peak + '.', 'ok'); });
['dragover', 'drop'].forEach((ev) => el.stage.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' && mode !== 'webcam') { const f = e.dataTransfer.files[0]; mode === 'video' ? startVideoFile(f) : handleImage(f); } }));
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'webcam' && running) { stopLive(); notify('Camera stopped because the tab was hidden.', 'warn'); } });
window.addEventListener('pagehide', stopLive);

setMode('image'); ensureEngine();
