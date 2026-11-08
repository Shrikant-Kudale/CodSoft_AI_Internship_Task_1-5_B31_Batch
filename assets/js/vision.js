/* Image recognition: ResNet-50 via Transformers.js (in-browser), with a pixel-analysis fallback */
const $ = (id) => document.getElementById(id);
const CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const MODEL = 'Xenova/resnet-50';
const MAX_BYTES = 15 * 1024 * 1024;

const els = { drop: $('drop'), file: $('file'), preview: $('preview'), msg: $('dropMsg'), scan: $('scan'), again: $('again'),
  engine: $('engine'), prog: $('prog'), idle: $('idle'), res: $('res'), caption: $('caption'), bars: $('bars'),
  time: $('time'), mode: $('mode'), err: $('err') };

let classifier = null, loading = null, modelFailed = false, currentURL = null, busy = false;

function setEngine(text, cls, spin) {
  els.engine.className = 'badge ' + (cls || '');
  els.engine.innerHTML = (spin ? '<span class="spinner" style="width:12px;height:12px"></span>' : '') + text;
}
function showError(m) { els.err.textContent = m; els.err.classList.remove('hidden'); els.idle.classList.add('hidden'); els.res.classList.add('hidden'); }
function clearError() { els.err.classList.add('hidden'); }

/* ---------- Model loading ---------- */
function loadModel() {
  if (classifier) return Promise.resolve(classifier);
  if (loading) return loading;
  setEngine('Loading AI model…', '', true); els.prog.classList.remove('hidden');
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Model download timed out')), 120000));
  loading = Promise.race([(async () => {
    const lib = await import(CDN);
    lib.env.allowLocalModels = false;
    const files = {};
    classifier = await lib.pipeline('image-classification', MODEL, {
      progress_callback: (p) => {
        if (p.status === 'progress' && p.file) {
          files[p.file] = p.progress || 0;
          const vals = Object.values(files); const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          els.prog.firstElementChild.style.width = avg.toFixed(0) + '%';
          setEngine('Downloading model ' + avg.toFixed(0) + '%', '', true);
        }
      }
    });
    return classifier;
  })(), timeout]).then((c) => {
    setEngine('ResNet-50 ready', 'ok'); els.prog.classList.add('hidden'); modelFailed = false; return c;
  }).catch((e) => {
    console.warn('Model load failed:', e);
    classifier = null; loading = null; modelFailed = true;
    setEngine('Basic mode (model unavailable)', 'warn'); els.prog.classList.add('hidden');
    return null;
  });
  return loading;
}

/* ---------- Fallback: simple pixel analysis ---------- */
function analyseFallback(img) {
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S).data;
  let r = 0, g = 0, b = 0, br = 0, sat = 0, edge = 0; const n = S * S;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2];
    r += R; g += G; b += B; lum[i] = 0.299 * R + 0.587 * G + 0.114 * B; br += lum[i];
    sat += Math.max(R, G, B) - Math.min(R, G, B);
  }
  for (let y = 0; y < S - 1; y++) for (let xx = 0; xx < S - 1; xx++) {
    const i = y * S + xx; edge += Math.abs(lum[i] - lum[i + 1]) + Math.abs(lum[i] - lum[i + S]);
  }
  r /= n; g /= n; b /= n; br /= n; sat /= n; edge /= n;
  const aspect = img.naturalWidth / img.naturalHeight;
  const tone = br > 170 ? 'bright' : br < 85 ? 'dark' : 'balanced';
  const colour = sat < 22 ? 'muted, near-monochrome' : sat > 90 ? 'vivid' : 'moderately colourful';
  const dom = (g > r + 8 && g > b + 8) ? 'green' : (b > r + 8 && b >= g) ? 'blue' : (r > g + 15 && r > b + 15) ? 'warm red or orange' : 'neutral';
  const detail = edge > 22 ? 'highly detailed' : edge > 9 ? 'moderately detailed' : 'smooth with few details';
  const shape = aspect > 1.3 ? 'landscape' : aspect < 0.77 ? 'portrait' : 'square-ish';
  return [
    { label: tone + ' ' + colour + ' image', score: 0.0 },
    { label: dom + ' tones dominate', score: 0.0 },
    { label: detail + ', ' + shape + ' frame', score: 0.0 }
  ];
}

/* ---------- UI ---------- */
function pretty(label) { return label.split(',')[0].trim(); }
function renderResults(preds, ms, mode) {
  clearError(); els.idle.classList.add('hidden'); els.res.classList.remove('hidden'); els.bars.innerHTML = '';
  if (mode === 'ai') {
    const top = preds[0], pct = (top.score * 100).toFixed(1);
    els.caption.textContent = 'This looks like ' + (/^[aeiou]/i.test(pretty(top.label)) ? 'an ' : 'a ') + pretty(top.label) + ' (' + pct + '% confident).';
    preds.forEach((p, i) => {
      const w = document.createElement('div'); w.className = 'result-item';
      w.innerHTML = '<div class="top"><span></span><span>' + (p.score * 100).toFixed(1) + '%</span></div><div class="bar"><span></span></div>';
      w.querySelector('.top span').textContent = (i + 1) + '. ' + pretty(p.label);
      els.bars.appendChild(w);
      requestAnimationFrame(() => setTimeout(() => { w.querySelector('.bar span').style.width = Math.max(2, p.score * 100) + '%'; }, 80 + i * 120));
    });
    els.mode.textContent = 'ResNet-50 · ImageNet classes';
  } else {
    els.caption.textContent = 'The AI model could not be loaded, so here is a basic description of the picture.';
    preds.forEach((p) => { const d = document.createElement('div'); d.className = 'notice'; d.style.marginBottom = '10px'; d.textContent = '• ' + p.label; els.bars.appendChild(d); });
    const btn = document.createElement('button'); btn.className = 'btn sm'; btn.type = 'button'; btn.textContent = 'Retry loading the model';
    btn.onclick = async () => { loading = null; await loadModel(); if (classifier && els.preview.src) analyse(); };
    els.bars.appendChild(btn);
    els.mode.textContent = 'Basic analysis';
  }
  els.time.textContent = 'Analysed in ' + (ms / 1000).toFixed(2) + ' s';
}

async function analyse() {
  if (busy) return; busy = true; els.scan.classList.remove('hidden'); els.again.disabled = true; clearError();
  const t0 = performance.now();
  try {
    await els.preview.decode().catch(() => {});
    const model = await loadModel();
    if (model) {
      try {
        const out = await model(els.preview.src, { topk: 3 });
        renderResults(out, performance.now() - t0, 'ai');
      } catch (e) { console.warn('Inference failed:', e); renderResults(analyseFallback(els.preview), performance.now() - t0, 'basic'); }
    } else renderResults(analyseFallback(els.preview), performance.now() - t0, 'basic');
  } catch (e) { console.error(e); showError('Something went wrong while analysing this image. Please try a different one.'); }
  finally { busy = false; els.scan.classList.add('hidden'); els.again.disabled = false; }
}

function handleFile(f) {
  if (!f) return;
  if (!f.type || !f.type.startsWith('image/')) { UI.toast('Please choose an image file'); showError('That file is not an image. Please choose a JPG, PNG, WEBP or GIF.'); return; }
  if (f.size > MAX_BYTES) { showError('That image is larger than 15 MB. Please choose a smaller one.'); return; }
  if (currentURL) URL.revokeObjectURL(currentURL);
  currentURL = URL.createObjectURL(f);
  els.preview.onerror = () => { showError('This image could not be read. It may be corrupted or in an unsupported format.'); els.preview.classList.add('hidden'); els.msg.classList.remove('hidden'); };
  els.preview.onload = () => { els.preview.onload = null; analyse(); };
  els.preview.src = currentURL; els.preview.classList.remove('hidden'); els.msg.classList.add('hidden'); els.again.disabled = false;
}

els.file.addEventListener('change', () => { handleFile(els.file.files[0]); els.file.value = ''; });
els.again.addEventListener('click', () => els.file.click());
['dragenter', 'dragover'].forEach((ev) => els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove('drag'); }));
els.drop.addEventListener('drop', (e) => handleFile(e.dataTransfer && e.dataTransfer.files[0]));
els.drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.file.click(); } });
document.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) handleFile(item.getAsFile());
});

loadModel(); // warm up in the background
