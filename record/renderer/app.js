'use strict';
/* ════════════════════════════════════════════════════════════
   MetalDeck SR-79 — منطق الجهاز
   الالتقاط: WebRTC (chromeMediaSource: desktop) + MediaRecorder
   ════════════════════════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const els = {
  preview: $('#preview'), crt: $('#crt'), staticLayer: $('#staticLayer'),
  osdStatus: $('#osdStatus'), osdSrc: $('#osdSrc'), osdClock: $('#osdClock'),
  ledRec: $('#ledRec'), ledRec2: $('#ledRec2'), ledPause: $('#ledPause'), ledReady: $('#ledReady'),
  btnRec: $('#btnRec'), btnPause: $('#btnPause'), btnStop: $('#btnStop'), btnSnap: $('#btnSnap'),
  timer: $('#timer'), statusText: $('#statusText'), vu: $('#vu'),
  modeTrack: $('#modeTrack'), optScreen: $('#optScreen'), optWindow: $('#optWindow'),
  btnTune: $('#btnTune'), srcName: $('#srcName'),
  fmtTrack: $('#fmtTrack'), optWebm: $('#optWebm'), optMp4: $('#optMp4'),
  knobCap: $('#knobCap'), knob: $('#audioKnob'), alabels: $('#alabels'),
  hotkeys: $('#hotkeys'), dirLabel: $('#dirLabel'), btnFolder: $('#btnFolder'), counter: $('#counter'),
  logText: $('#logText'), picker: $('#picker'), pickerGrid: $('#pickerGrid'),
  pickerClose: $('#pickerClose'), snapFlash: $('#snapFlash'),
  btnMin: $('#btnMin'), btnMax: $('#btnMax'), btnClose: $('#btnClose')
};

/* ─── الحالة + التفضيلات المحفوظة محليًا ─── */
const AUDIO_ORDER = ['sys', 'mic', 'mix', 'mute'];
const KNOB_ANGLES = { sys: -54, mic: -18, mix: 18, mute: 54 };
const AUDIO_TXT = {
  sys: 'SYS · صوت النظام فقط', mic: 'MIC · المايكروفون فقط',
  mix: 'MIX · دمج المصدرين',   mute: 'MUTE · بدون صوت'
};
const KEY_ACTIONS = [
  ['rec',   'بدء التسجيل'],
  ['stop',  'إيقاف نهائي'],
  ['pause', 'إيقاف مؤقت / استئناف'],
  ['snap',  'لقطة شاشة']
];
const DEFAULT_KEYS = { rec: 'Ctrl+Alt+R', stop: 'Ctrl+Alt+E', pause: 'Ctrl+Alt+P', snap: 'Ctrl+Alt+S' };

const state = {
  mode: localStorage.getItem('md.mode') || 'screen',
  windowSrc: null,
  audio: AUDIO_ORDER.includes(localStorage.getItem('md.audio')) ? localStorage.getItem('md.audio') : 'sys',
  format: localStorage.getItem('md.format') === 'mp4' ? 'mp4' : 'webm',
  keys: Object.assign({}, DEFAULT_KEYS, JSON.parse(localStorage.getItem('md.keys') || '{}')),
  status: 'idle',                       // idle | recording | paused
  stream: null, sysStream: null, micStream: null,
  audioCtx: null, recDest: null, gains: {}, analyser: null, analyserData: null,
  recorder: null, chunks: [], ext: 'webm',
  tStart: 0, tAccum: 0, timerId: null,
  session: 0
};

/* ─── أدوات عامة ─── */
function log(msg) { els.logText.textContent = msg; }
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ─── أصوات الجهاز (مولّدة داخليًا — بلا ملفات خارجية) ─── */
let beepCtx = null;
function beep(freq, dur = .09, vol = .05, delay = 0) {
  try {
    beepCtx = beepCtx || new AudioContext();
    const t = beepCtx.currentTime + delay;
    const o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(beepCtx.destination);
    o.start(t); o.stop(t + dur + .02);
  } catch {}
}
const sfxStart = () => { beep(920, .07); beep(1380, .1, .05, .09); };
const sfxStop  = () => { beep(740, .09); beep(430, .16, .05, .1); };
const sfxSnap  = () => { beep(1800, .045, .07); beep(260, .05, .09, .02); };
const sfxTick  = () => beep(1200, .035, .03);

/* ─── تشويش الشاشة (يولَّد مرة واحدة) ─── */
(function makeStatic() {
  const c = document.createElement('canvas'); c.width = 180; c.height = 102;
  const x = c.getContext('2d'), img = x.createImageData(180, 102);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255 | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 40;
  }
  x.putImageData(img, 0, 0);
  els.staticLayer.style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ساعة OSD */
setInterval(() => { els.osdClock.textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);

/* ─── مؤشر VU ─── */
for (let i = 0; i < 14; i++) els.vu.appendChild(document.createElement('i'));
function setVU(level) {
  const lit = Math.round(level * 14);
  [...els.vu.children].forEach((seg, i) => seg.classList.toggle('on', i < lit));
}
let vuRAF = 0;
function vuLoop() {
  if (!state.analyser) { setVU(0); vuRAF = 0; return; }
  state.analyser.getByteTimeDomainData(state.analyserData);
  let s = 0; const d = state.analyserData;
  for (let i = 0; i < d.length; i++) { const x = (d[i] - 128) / 128; s += x * x; }
  setVU(Math.min(1, Math.sqrt(s / d.length) * 3));
  vuRAF = requestAnimationFrame(vuLoop);
}

/* ─── عرض الحالة (LEDs + OSD + النصوص) ─── */
function setStatus(s) {
  state.status = s;
  const rec = s === 'recording', paused = s === 'paused', on = s !== 'idle';
  for (const led of [els.ledRec, els.ledRec2]) {
    led.classList.toggle('on', rec); led.classList.toggle('blink', rec);
  }
  els.ledPause.classList.toggle('on', paused);
  els.ledReady.classList.toggle('on', !on);
  els.btnRec.classList.toggle('armed', on);
  els.btnPause.classList.toggle('pressed', paused);
  els.btnStop.classList.toggle('disabled', !on);
  els.crt.classList.toggle('live', on);
  els.timer.classList.toggle('blink', paused);
  els.statusText.textContent = rec ? '● جارٍ التسجيل الآن' : paused ? 'إيقاف مؤقت' : 'جاهز للتسجيل';
  els.osdStatus.textContent = rec ? '● REC' : paused ? '❚❚ PAUSE' : 'NO SIGNAL';
  els.osdStatus.className = rec ? 'red' : paused ? 'amber' : 'dim';
  els.osdSrc.textContent = on
    ? (state.mode === 'window' ? (state.windowSrc?.name || 'WINDOW') : 'FULL SCREEN') + ' · ' + state.audio.toUpperCase()
    : '';
}
function renderTimer() {
  const ms = state.status === 'paused' ? state.tAccum : state.tAccum + performance.now() - state.tStart;
  els.timer.textContent = fmtTime(ms);
}
function renderCounter() { els.counter.textContent = String(state.session).padStart(3, '0'); }

/* ─── عرض الإعدادات ─── */
function renderMode() {
  const win = state.mode === 'window';
  els.modeTrack.classList.toggle('right', win);
  els.optScreen.classList.toggle('active', !win);
  els.optWindow.classList.toggle('active', win);
  els.btnTune.classList.toggle('disabled', !win);
  els.srcName.textContent = win
    ? (state.windowSrc ? state.windowSrc.name : '— SELECT WINDOW —')
    : 'FULL SCREEN · الشاشة كاملة';
}
function renderAudio() {
  els.knobCap.style.setProperty('--rot', KNOB_ANGLES[state.audio] + 'deg');
  els.alabels.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === state.audio));
}
function renderFormat() {
  els.fmtTrack.classList.toggle('right', state.format === 'mp4');
  els.optWebm.classList.toggle('active', state.format === 'webm');
  els.optMp4.classList.toggle('active', state.format === 'mp4');
}
function renderKeys() {
  els.hotkeys.innerHTML = '';
  for (const [a, label] of KEY_ACTIONS) {
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.className = 'hk-name'; nm.textContent = label;
    const btn = document.createElement('button');
    btn.className = 'combo'; btn.textContent = state.keys[a] || '—';
    btn.title = 'انقر ثم اضغط تركيب المفاتيح الجديد';
    btn.onclick = () => listenKey(btn, a);
    li.append(nm, btn); els.hotkeys.appendChild(li);
  }
}

/* ═══════════════ محرك الصوت (ميكسر داخلي) ═══════════════
   يسمح بتبديل مصدر الصوت حيًّا أثناء التسجيل عبر عقد Gain */
const SYS_AUDIO = { mandatory: { chromeMediaSource: 'desktop' } };
const videoConstraint = id => ({ mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id } });

async function ensureAudioSrc(kind) {
  if (kind === 'sys' && !state.sysStream)
    state.sysStream = await navigator.mediaDevices.getUserMedia({ audio: SYS_AUDIO, video: false });
  if (kind === 'mic' && !state.micStream)
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false
    });
}
function connectSource(kind) {
  const stream = kind === 'sys' ? state.sysStream : state.micStream;
  if (!stream || !state.audioCtx || state.gains[kind]) return;
  const g = state.audioCtx.createGain();
  state.audioCtx.createMediaStreamSource(stream).connect(g);
  g.connect(state.recDest);
  state.gains[kind] = g;
}
function applyGains() {
  const on = {
    sys: state.audio === 'sys' || state.audio === 'mix',
    mic: state.audio === 'mic' || state.audio === 'mix'
  };
  for (const k of ['sys', 'mic']) if (state.gains[k]) state.gains[k].gain.value = on[k] ? 1 : 0;
}
async function openAudioGraph() {
  const ctx = new AudioContext();
  await ctx.resume().catch(() => {});
  state.audioCtx = ctx;
  state.recDest = ctx.createMediaStreamDestination();
  const need = {
    sys: state.audio === 'sys' || state.audio === 'mix',
    mic: state.audio === 'mic' || state.audio === 'mix'
  };
  for (const kind of ['sys', 'mic']) {
    if (!need[kind]) continue;
    try { await ensureAudioSrc(kind); connectSource(kind); }
    catch { log(kind === 'mic' ? '⚠ تعذّر فتح المايكروفون — تحقق من أذونات النظام' : '⚠ تعذّر التقاط صوت النظام'); }
  }
  applyGains();
  state.analyser = ctx.createAnalyser();
  state.analyser.fftSize = 1024;
  state.analyserData = new Uint8Array(state.analyser.fftSize);
  ctx.createMediaStreamSource(state.recDest.stream).connect(state.analyser);
  return state.recDest.stream;
}
async function switchAudioLive() {
  const need = {
    sys: state.audio === 'sys' || state.audio === 'mix',
    mic: state.audio === 'mic' || state.audio === 'mix'
  };
  for (const k of ['sys', 'mic']) {
    if (need[k] && !state.gains[k]) {
      try { await ensureAudioSrc(k); connectSource(k); }
      catch { log('⚠ تعذّر فتح مصدر الصوت'); }
    }
  }
  applyGains();
}
async function setAudio(v) {
  state.audio = v;
  localStorage.setItem('md.audio', v);
  renderAudio(); sfxTick();
  if (state.status !== 'idle') await switchAudioLive();
  log('مصدر الصوت: ' + AUDIO_TXT[v]);
}

/* ═══════════════ التسجيل ═══════════════ */
async function currentSource() {
  if (state.mode === 'screen') {
    const s = await window.deck.getSources(['screen']);
    if (!s.length) throw new Error('لم يتم العثور على شاشة');
    return s[0];
  }
  if (!state.windowSrc) throw new Error('اختر نافذة أولاً من زر TUNE');
  return state.windowSrc;
}
function pickMime() {
  const list = state.format === 'mp4'
    ? ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find(m => window.MediaRecorder.isTypeSupported(m)) || '';
}

async function startRecording() {
  if (state.status !== 'idle') return;
  try {
    const src = await currentSource();
    const vs = await navigator.mediaDevices.getUserMedia({ video: videoConstraint(src.id), audio: false });

    let audioStream = null;
    try { audioStream = await openAudioGraph(); }
    catch { log('⚠ الصوت غير متاح — تسجيل صامت'); }

    state.stream = new MediaStream([
      ...vs.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : [])
    ]);

    const mime = pickMime();
    state.recorder = new MediaRecorder(state.stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    state.ext = (state.recorder.mimeType || mime || '').includes('mp4') ? 'mp4' : 'webm';
    state.chunks = [];
    state.recorder.ondataavailable = e => { if (e.data && e.data.size) state.chunks.push(e.data); };
    state.recorder.onerror = () => log('⚠ خطأ أثناء التسجيل');
    state.recorder.onstop = () => finalizeRecording();
    state.recorder.start(1000);            // مقطع كل ثانية → موثوقية أعلى عند الانقطاع

    els.preview.srcObject = state.stream;
    state.tStart = performance.now(); state.tAccum = 0;
    state.timerId = setInterval(renderTimer, 200);
    setStatus('recording');
    vuLoop(); sfxStart();
    log('● بدأ التسجيل — ' + AUDIO_TXT[state.audio]);
  } catch (err) {
    cleanup(); setStatus('idle');
    log('⚠ تعذّر بدء التسجيل: ' + (err.message || err));
  }
}

function stopRecording() {
  if (state.status === 'idle') return;
  if (state.status === 'recording') state.tAccum += performance.now() - state.tStart;
  els.preview.srcObject = null;
  try { state.recorder.stop(); } catch {}
  setStatus('idle'); sfxStop();
  log('■ إيقاف — جارٍ الحفظ…');
}

async function finalizeRecording() {
  clearInterval(state.timerId); state.timerId = null;
  const blob = new Blob(state.chunks, { type: state.recorder?.mimeType || 'video/webm' });
  state.chunks = [];
  if (blob.size > 400) {
    try {
      const buf = new Uint8Array(await blob.arrayBuffer());
      const file = await window.deck.saveVideo(buf, state.ext);
      state.session++; renderCounter();
      log('✓ تم حفظ الفيديو: ' + file);
    } catch (e) { log('⚠ فشل حفظ الملف: ' + e); }
  } else log('⚠ لا توجد بيانات كافية للحفظ');
  cleanup();
}

function togglePause() {
  if (state.status === 'recording') {
    state.recorder.pause();
    state.tAccum += performance.now() - state.tStart;
    setStatus('paused'); beep(500, .08);
    log('❚❚ إيقاف مؤقت');
  } else if (state.status === 'paused') {
    state.recorder.resume();
    state.tStart = performance.now();
    setStatus('recording'); beep(900, .08);
    log('● استئناف التسجيل');
  }
}

function cleanup() {
  cancelAnimationFrame(vuRAF); vuRAF = 0; setVU(0);
  for (const s of [state.stream, state.sysStream, state.micStream])
    s?.getTracks().forEach(t => t.stop());
  try { state.audioCtx?.close(); } catch {}
  Object.assign(state, {
    stream: null, sysStream: null, micStream: null,
    audioCtx: null, recDest: null, gains: {}, analyser: null, recorder: null
  });
  els.preview.srcObject = null;
}

/* ─── التقاط الصور ─── */
async function snap() {
  try {
    let v = null, temp = null;
    if (state.status !== 'idle' && els.preview.srcObject) {
      v = els.preview;
    } else {
      const src = await currentSource();
      temp = await navigator.mediaDevices.getUserMedia({ video: videoConstraint(src.id), audio: false });
      v = document.createElement('video');
      v.muted = true; v.srcObject = temp;
      await v.play();
      await new Promise(r => setTimeout(r, 420));
    }
    if (!v.videoWidth) throw new Error('لا يوجد إطار للالتقاط');
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const b = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = await window.deck.saveImage(new Uint8Array(await b.arrayBuffer()), 'png');
    state.session++; renderCounter();
    flash(); sfxSnap();
    log('✓ لقطة محفوظة: ' + file);
    if (temp) temp.getTracks().forEach(t => t.stop());
  } catch (e) { log('⚠ تعذّر الالتقاط: ' + e.message); }
}
function flash() {
  els.snapFlash.classList.remove('go'); void els.snapFlash.offsetWidth;
  els.snapFlash.classList.add('go');
}

/* ─── اختيار المصدر / الصيغة ─── */
function setMode(m) {
  if (state.status !== 'idle') return log('⚠ أوقف التسجيل قبل تغيير المصدر');
  state.mode = m; localStorage.setItem('md.mode', m);
  if (m === 'screen') state.windowSrc = null;
  renderMode(); sfxTick();
}
function setFormat(f) {
  if (state.status !== 'idle') return log('⚠ أوقف التسجيل قبل تغيير الصيغة');
  state.format = f; localStorage.setItem('md.format', f);
  renderFormat(); sfxTick();
}

/* ─── مُنتقي النوافذ ─── */
async function openPicker() {
  els.picker.classList.remove('hidden');
  els.pickerGrid.innerHTML = '<p class="loading">جارٍ مسح النوافذ المفتوحة…</p>';
  try {
    const srcs = (await window.deck.getSources(['window'])).filter(s => s.name && s.name.trim());
    if (!srcs.length) { els.pickerGrid.innerHTML = '<p class="loading">لا توجد نوافذ مفتوحة</p>'; return; }
    els.pickerGrid.innerHTML = '';
    for (const s of srcs) {
      const card = document.createElement('div');
      card.className = 'win-card';
      card.innerHTML = `<img src="${s.thumb}" alt=""><div class="nm">${escapeHtml(s.name)}</div>`;
      card.onclick = () => {
        state.windowSrc = { id: s.id, name: s.name };
        setMode('window');
        els.picker.classList.add('hidden');
        log('تم ضبط المصدر على نافذة: ' + s.name);
      };
      els.pickerGrid.appendChild(card);
    }
  } catch { els.pickerGrid.innerHTML = '<p class="loading">⚠ خطأ في جلب النوافذ</p>'; }
}

/* ─── الاختصارات العالمية ─── */
function keyToAccel(e) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (!parts.length) return null;
  let k = e.key;
  if (k === ' ') k = 'Space'; else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join('+');
}
function listenKey(btn, action) {
  document.querySelectorAll('.combo.listening').forEach(b => b.classList.remove('listening'));
  btn.classList.add('listening'); btn.textContent = 'اضغط الاختصار…';
  const h = e => {
    e.preventDefault(); e.stopPropagation();
    const acc = keyToAccel(e);
    if (!acc) return;
    window.removeEventListener('keydown', h, true);
    btn.classList.remove('listening');
    state.keys[action] = acc;
    localStorage.setItem('md.keys', JSON.stringify(state.keys));
    btn.textContent = acc;
    registerKeys(); sfxTick();
  };
  window.addEventListener('keydown', h, true);
  setTimeout(() => {
    window.removeEventListener('keydown', h, true);
    if (btn.classList.contains('listening')) {
      btn.classList.remove('listening'); btn.textContent = state.keys[action];
    }
  }, 12000);
}
async function registerKeys() {
  try {
    const res = await window.deck.registerShortcuts(state.keys);
    for (const [a, ok] of Object.entries(res))
      if (!ok) log('⚠ تعذّر تسجيل الاختصار: ' + state.keys[a]);
  } catch {}
}
window.deck.onShortcut(a => {
  if (a === 'rec')   state.status === 'idle' ? startRecording() : stopRecording();
  else if (a === 'stop')  stopRecording();
  else if (a === 'pause') togglePause();
  else if (a === 'snap')  snap();
});

/* الموثوقية: عند إغلاق التطبيق أثناء التسجيل → احفظ الجزء المسجّل ثم اخرج */
window.deck.onPrepareQuit(async () => {
  if (state.status === 'idle' || !state.recorder) return window.deck.quitDone();
  try {
    state.recorder.onstop = async () => {
      try {
        const blob = new Blob(state.chunks, { type: state.recorder?.mimeType || 'video/webm' });
        if (blob.size > 400)
          window.deck.saveVideoSync(new Uint8Array(await blob.arrayBuffer()), state.ext);
      } catch {}
      window.deck.quitDone();
    };
    state.recorder.stop();
  } catch { window.deck.quitDone(); }
});

/* ─── ربط الواجهة ─── */
els.btnRec.onclick   = () => state.status === 'idle' ? startRecording() : stopRecording();
els.btnStop.onclick  = () => stopRecording();
els.btnPause.onclick = () => togglePause();
els.btnSnap.onclick  = () => snap();
els.btnTune.onclick  = () => openPicker();
els.pickerClose.onclick = () => els.picker.classList.add('hidden');
els.btnFolder.onclick = () => window.deck.openFolder();

els.optScreen.onclick = () => setMode('screen');
els.optWindow.onclick = () => { setMode('window'); if (!state.windowSrc) openPicker(); };
els.modeTrack.onclick = () => state.mode === 'screen' ? els.optWindow.onclick() : setMode('screen');

els.optWebm.onclick = () => setFormat('webm');
els.optMp4.onclick  = () => setFormat('mp4');
els.fmtTrack.onclick = () => setFormat(state.format === 'webm' ? 'mp4' : 'webm');

els.alabels.querySelectorAll('button').forEach(b => b.onclick = () => setAudio(b.dataset.v));
els.knob.onclick = () => setAudio(AUDIO_ORDER[(AUDIO_ORDER.indexOf(state.audio) + 1) % 4]);
els.knob.onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.knob.onclick(); }
};

els.btnMin.onclick   = () => window.deck.winControl('min');
els.btnMax.onclick   = () => window.deck.winControl('max');
els.btnClose.onclick = () => window.deck.winControl('close');

/* ─── الإقلاع ─── */
renderMode(); renderAudio(); renderFormat(); renderKeys(); renderCounter();
setStatus('idle'); registerKeys();
window.deck.getSaveDir().then(d => els.dirLabel.textContent = d).catch(() => {});
log('النظام جاهز — كل المعالجة والتخزين يتمان محليًا');