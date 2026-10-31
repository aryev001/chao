// app.js — Chào: offline Vietnamese ⇄ English voice translator.
import {
  PRONOUNS, pronounsFor, applyTone, renderPhrase, matchPhrase, parseOffer, renderOffer,
  normalizeViMoney, priceHints, fixEnMoney, cleanAsr, looksVietnamese, looksChinese,
  splitSentences, numberToVi, formatVnd, formatThousands, viForSpeech,
} from './lang.js';
import { PHRASES, CATEGORIES } from './phrases.js';

// ───────────────────────── Models & packs ─────────────────────────
const MODELS = {
  asrVi:     { key: 'asrVi', task: 'automatic-speech-recognition', id: 'huuquyet/PhoWhisper-base', dtype: 'q8', mb: 79, name: 'Vietnamese speech recognition (PhoWhisper)' },
  asrViTiny: { key: 'asrViTiny', task: 'automatic-speech-recognition', id: 'huuquyet/PhoWhisper-tiny', dtype: 'q8', mb: 35, name: 'Vietnamese speech recognition, fast (PhoWhisper tiny)' },
  mtViEn:    { key: 'mtViEn', task: 'translation', id: 'Xenova/opus-mt-vi-en', dtype: 'q8', mb: 101, name: 'Vietnamese → English' },
  mtEnVi:    { key: 'mtEnVi', task: 'translation', id: 'Xenova/opus-mt-en-vi', dtype: 'q8', mb: 107, name: 'English → Vietnamese' },
  asrEn:     { key: 'asrEn', task: 'automatic-speech-recognition', id: 'Xenova/whisper-base.en', dtype: 'q8', mb: 77, name: 'English speech recognition (Whisper)' },
  ttsVi:     { key: 'ttsVi', task: 'text-to-speech', id: 'Xenova/mms-tts-vie', dtype: 'q8', mb: 36, name: 'Backup Vietnamese voice (MMS)' },
  asrZh:     { key: 'asrZh', task: 'automatic-speech-recognition', id: 'Xenova/whisper-base', dtype: 'q8', mb: 77, name: 'Chinese speech recognition (Whisper)' },
  mtZhEn:    { key: 'mtZhEn', task: 'translation', id: 'Xenova/opus-mt-zh-en', dtype: 'q8', mb: 110, name: 'Chinese → English' },
  mtEnZh:    { key: 'mtEnZh', task: 'translation', id: 'Xenova/opus-mt-en-zh', dtype: 'q8', mb: 110, name: 'English → Chinese' },
};
const viAsrKey = () => (S.asrSize === 'tiny' ? 'asrViTiny' : 'asrVi');
const PACKS = [
  { id: 'vi', name: 'Vietnamese conversation', desc: 'Understands Vietnamese speech and translates both ways. Required.', models: () => [viAsrKey(), 'mtViEn', 'mtEnVi'], core: true },
  { id: 'en', name: 'Speak English to it', desc: 'Lets you talk instead of type.', models: () => ['asrEn'], core: true },
  { id: 'voice', name: 'Backup Vietnamese voice', desc: 'Only needed if your phone has no Vietnamese voice. Sounds more robotic.', models: () => ['ttsVi'] },
  { id: 'zh', name: 'Chinese (Mandarin)', desc: 'For Chinese-speaking shopkeepers, e.g. in Chợ Lớn. Recognition is less accurate than Vietnamese.', models: () => ['asrZh', 'mtZhEn', 'mtEnZh'] },
];
const LANG_NAME = { vi: 'Tiếng Việt', zh: '中文' };
const TTS_LANG = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' };
const ASR_LANG = { vi: 'vietnamese', zh: 'chinese', en: null };

// ───────────────────────── Settings ─────────────────────────
const DEFAULTS = {
  who: 'chi', myGender: 'n', region: 'n', polite: true, theirLang: 'vi',
  earphones: true, continuous: true, liveCaptions: true, pauseMs: 700, asrSize: 'base', micId: '',
  voiceVi: '', voiceEn: '', rateVi: 0.9, rateEn: 1.05, backupVoice: 'auto',
  currency: '₹', rate: 272, theme: 'auto', boostSR: true, boostMT: true, setupDone: false,
};
const S = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('chao.settings') || '{}') }; }
  catch { return { ...DEFAULTS }; }
})();
function save() { try { localStorage.setItem('chao.settings', JSON.stringify(S)); } catch { /* private mode */ } }
const toneCtx = () => ({ who: S.who, myGender: S.myGender, region: S.region, polite: S.polite });

// ───────────────────────── DOM helpers ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const icon = (name) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'i'); s.innerHTML = `<use href="#i-${name}"/>`; return s; };
let toastTimer;
function toast(msg, ms = 3200) {
  let t = $('.toast');
  if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
const mb = (bytes) => `${Math.round(bytes / 1e6)} MB`;

// ───────────────────────── Service worker (offline + multi-threading) ─────────────────────────
let reloading = false;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const coiReload = () => {
    if (self.crossOriginIsolated || reloading) return;
    try { if (sessionStorage.getItem('chao.coi')) return; sessionStorage.setItem('chao.coi', '1'); } catch { return; }
    reloading = true; location.reload();
  };
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  if (navigator.serviceWorker.controller) coiReload();
  navigator.serviceWorker.addEventListener('controllerchange', coiReload);
}

// ───────────────────────── ML worker client ─────────────────────────
class DroppedJob extends Error { constructor() { super('dropped'); this.dropped = true; } }
class ML {
  constructor(onProgress) { this.onProgress = onProgress; this.n = 0; this.queue = []; this.running = false; this.spawn(); }
  spawn() {
    this.waiting = new Map();
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'progress') return this.onProgress?.(data);
      const w = this.waiting.get(data.id);
      if (!w) return;
      this.waiting.delete(data.id);
      data.ok ? w.resolve(data) : w.reject(new Error(data.error));
    };
    this.worker.onerror = (e) => {
      e.preventDefault?.();
      const err = new Error(e.message || 'The translation engine stopped (probably out of memory).');
      for (const w of this.waiting.values()) w.reject(err);
      this.worker.terminate();
      this.running = false;
      for (const st of Object.values(models.state)) { st.loaded = false; st.loading = null; }
      this.spawn();
      toast('Engine restarted — models will reload.');
    };
  }
  call(type, payload = {}, transfer = []) {
    const id = ++this.n;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, ...payload }, transfer);
    });
  }
  job(type, payload, { priority = 1, tag = null, transfer = [] } = {}) {
    if (tag) this.drop(tag);
    return new Promise((resolve, reject) => {
      this.queue.push({ type, payload, priority, tag, transfer, resolve, reject, seq: ++this.n });
      this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      this.pump();
    });
  }
  drop(tag) {
    this.queue = this.queue.filter((j) => { if (j.tag === tag) { j.reject(new DroppedJob()); return false; } return true; });
  }
  get idle() { return !this.running && this.queue.length === 0; }
  async pump() {
    if (this.running) return;
    const j = this.queue.shift();
    if (!j) return;
    this.running = true;
    try { j.resolve(await this.call(j.type, j.payload, j.transfer)); }
    catch (e) { j.reject(e); }
    finally { this.running = false; this.pump(); }
  }
}

// ───────────────────────── Model manager ─────────────────────────
const models = {
  state: Object.fromEntries(Object.keys(MODELS).map((k) => [k, { cached: null, loaded: false, loading: null, files: {} }])),
  onProgress(ev) {
    const st = this.state[ev.key];
    if (!st || !ev.file) return;
    const f = st.files[ev.file] || (st.files[ev.file] = { loaded: 0, total: 0 });
    if (ev.total) f.total = ev.total;
    f.loaded = ev.status === 'done' ? (f.total || f.loaded) : ev.loaded;
    ui.packProgress();
  },
  fraction(key) {
    const st = this.state[key];
    if (st.loaded || st.cached) return 1;
    const files = Object.values(st.files);
    const loaded = files.reduce((a, f) => a + f.loaded, 0);
    const total = Math.max(files.reduce((a, f) => a + f.total, 0), MODELS[key].mb * 1e6);
    return Math.min(1, loaded / total);
  },
  async refresh(keys = Object.keys(MODELS)) {
    await Promise.all(keys.map(async (k) => {
      try { this.state[k].cached = (await ml.call('cached', { spec: MODELS[k] })).cached; }
      catch { this.state[k].cached = false; }
    }));
  },
  ensure(key) {
    const st = this.state[key];
    if (st.loaded) return Promise.resolve();
    if (!st.loading) {
      if (!navigator.onLine && st.cached === false) {
        return Promise.reject(new Error(`missing:${key}`));
      }
      st.loading = ml.call('load', { spec: MODELS[key] })
        .then(() => { st.loaded = true; st.cached = true; st.loading = null; ui.packs(); ui.status(); })
        .catch((e) => {
          st.loading = null; ui.packs(); ui.status();
          if (st.cached !== true && /404|could not locate|not found|failed to fetch|networkerror|load failed/i.test(String(e?.message))) throw new Error(`missing:${key}`);
          throw e;
        });
      ui.status();
    }
    return st.loading;
  },
  async unload(key) {
    const st = this.state[key];
    if (!st.loaded && !st.loading) return;
    try { await st.loading; } catch { /* ignore */ }
    await ml.call('unload', { spec: MODELS[key] });
    st.loaded = false;
  },
  async remove(key) {
    await this.unload(key);
    try {
      const cache = await caches.open('transformers-cache');
      for (const req of await cache.keys()) if (req.url.includes(`/${MODELS[key].id}/`)) await cache.delete(req);
    } catch { /* no cache api */ }
    Object.assign(this.state[key], { cached: false, files: {} });
  },
  packKeys: (pack) => pack.models(),
  packReady(pack) { return pack.models().every((k) => this.state[k].cached); },
  coreKeys() { return PACKS.filter((p) => p.core).flatMap((p) => p.models()); },
};

function friendly(err) {
  const m = String(err?.message || err);
  if (m.startsWith('missing:') || /404|could not locate|not found|failed to fetch|networkerror/i.test(m)) {
    const key = m.split(':')[1];
    const pack = PACKS.find((p) => p.models().includes(key));
    return `${pack ? `The “${pack.name}” pack` : 'A model'} isn’t downloaded yet. Open Settings › Offline packs while on Wi-Fi.`;
  }
  return `Something went wrong: ${m.slice(0, 140)}`;
}

// ───────────────────────── Browser speed boosts (on-device only) ─────────────────────────
const SR = self.SpeechRecognition || self.webkitSpeechRecognition;
const boosts = {
  sr: {}, mt: {}, translators: {},
  async check() {
    if (SR && typeof SR.available === 'function') {
      for (const l of ['vi-VN', 'en-US']) {
        try { this.sr[l] = await SR.available({ langs: [l], processLocally: true }); } catch { this.sr[l] = 'unavailable'; }
      }
    }
    if ('Translator' in self) {
      for (const [a, b] of [['vi', 'en'], ['en', 'vi']]) {
        try { this.mt[a + b] = await self.Translator.availability({ sourceLanguage: a, targetLanguage: b }); } catch { this.mt[a + b] = 'unavailable'; }
      }
    }
    ui.boosts();
  },
  useSR(lang) { return S.boostSR && this.sr[TTS_LANG[lang]] === 'available'; },
  async translator(from, to) {
    if (!S.boostMT || this.mt[from + to] !== 'available') return null;
    try { return this.translators[from + to] ||= await self.Translator.create({ sourceLanguage: from, targetLanguage: to }); }
    catch { return null; }
  },
};

class BrowserRecognizer {
  start(lang, { continuous, onInterim, onFinal, onEnd }) {
    const session = this.session = { want: true };
    const r = this.r = new SR();
    r.lang = TTS_LANG[lang]; r.continuous = continuous; r.interimResults = true;
    try { r.processLocally = true; } catch { /* older API */ }
    r.onresult = (e) => {
      if (this.session !== session) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onFinal(res[0].transcript); else interim += res[0].transcript;
      }
      onInterim(interim);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'language-not-supported') { session.want = false; toast(`On-device recognizer: ${e.error}`); }
    };
    r.onend = () => {
      if (this.session !== session) return;
      if (session.want && continuous) { try { r.start(); } catch { /* restarting */ } } else onEnd?.();
    };
    r.start();
  }
  stop() { if (this.session) this.session.want = false; try { this.r?.stop(); } catch { /* not running */ } }
}

// ───────────────────────── Microphone & voice activity detection ─────────────────────────
class Mic {
  async start(deviceId) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    await this.ctx.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url));
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'capture-16k', { numberOfInputs: 1, numberOfOutputs: 1 });
    const mute = this.ctx.createGain(); mute.gain.value = 0;
    this.node.port.onmessage = (e) => this.onFrame?.(e.data);
    src.connect(this.node).connect(mute).connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  get alive() { return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === 'live'); }
  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    try { this.ctx?.close(); } catch { /* closed */ }
    this.stream = this.ctx = this.node = null;
  }
}

class VAD {
  constructor() { this.noise = -58; this.hp = { x: 0, y: 0 }; this.reset(); }
  reset() { this.speaking = false; this.frames = []; this.pre = []; this.run = 0; this.silence = 0; this.sinceInterim = 0; }
  level(frame) {
    // 120 Hz high-pass removes motorbike rumble before measuring energy
    let sum = 0; const a = 0.955;
    for (let i = 0; i < frame.length; i++) {
      const y = a * (this.hp.y + frame[i] - this.hp.x);
      this.hp.x = frame[i]; this.hp.y = y; sum += y * y;
    }
    return 10 * Math.log10(sum / frame.length + 1e-10);
  }
  feed(frame) {
    const db = this.level(frame);
    this.db = db;
    if (!this.speaking) this.noise = db < this.noise ? 0.85 * this.noise + 0.15 * db : 0.995 * this.noise + 0.005 * db;
    else this.noise = 0.9995 * this.noise + 0.0005 * db;
    this.noise = Math.max(-75, Math.min(-25, this.noise));
    const thr = Math.max(this.noise + 9, -52);
    const voiced = db > thr;
    if (!this.speaking) {
      this.pre.push(frame); if (this.pre.length > 10) this.pre.shift();
      this.run = voiced ? this.run + 1 : 0;
      if (this.run >= 3) { this.speaking = true; this.frames = [...this.pre]; this.silence = 0; this.onStart?.(); }
      return;
    }
    this.frames.push(frame);
    this.silence = db > thr - 3 ? 0 : this.silence + 1;
    const ms = this.frames.length * 30;
    if (this.silence * 30 >= this.pauseMs) return this.finish(this.frames.length - this.silence + 7);
    if (ms >= this.maxMs) {
      // cut at the quietest moment of the last 1.5 s so words aren't split
      let best = this.frames.length - 1, bestDb = Infinity;
      for (let i = this.frames.length - 50; i < this.frames.length; i++) {
        const d = this.rms(this.frames[i]); if (d < bestDb) { bestDb = d; best = i; }
      }
      const rest = this.frames.slice(best);
      this.finish(best);
      this.speaking = true; this.frames = rest; this.onStart?.();
      return;
    }
    if (this.onInterim && ++this.sinceInterim >= 10 && ms > 1000) { this.sinceInterim = 0; this.onInterim(this.concat(this.frames)); }
  }
  rms(f) { let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i]; return s / f.length; }
  concat(frames) {
    const out = new Float32Array(frames.length * 480);
    frames.forEach((f, i) => out.set(f, i * 480));
    return out;
  }
  finish(keep) {
    const frames = this.frames.slice(0, Math.max(0, keep));
    const speechMs = (frames.length - 10) * 30;
    this.reset();
    if (speechMs < 300) return;
    const audio = this.concat(frames);
    let peak = 0; for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]));
    if (peak > 0 && peak < 0.5) { const g = Math.min(4, 0.7 / peak); for (let i = 0; i < audio.length; i++) audio[i] *= g; }
    this.onSegment?.(audio);
  }
}

// ───────────────────────── Voices ─────────────────────────
const synth = self.speechSynthesis;
const voices = {
  list: [],
  load() { this.list = synth ? synth.getVoices() : []; ui.voiceSelects(); },
  for(lang) { return this.list.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang)); },
  pick(lang) {
    const name = lang === 'vi' ? S.voiceVi : lang === 'en' ? S.voiceEn : '';
    const all = this.for(lang);
    return all.find((v) => v.name === name) || all.find((v) => v.localService) || all[0] || null;
  },
  hasLocalVi() { return this.for('vi').some((v) => v.localService); },
};
class Speaker {
  constructor() { this.chain = Promise.resolve(); this.active = 0; this.out = null; }
  backupFor(lang) {
    if (lang !== 'vi' || S.backupVoice === 'never') return false;
    if (!models.state.ttsVi.cached) return false;
    return S.backupVoice === 'always' || !voices.for('vi').length;
  }
  speak(text, lang, { aloud = false } = {}) {
    if (!text) return Promise.resolve();
    const run = () => this.play(text, lang, aloud);
    this.chain = this.chain.then(run, run);
    return this.chain;
  }
  async play(text, lang, aloud) {
    this.active++;
    conversation.onSpeechStart(lang, aloud);
    try {
      if (this.backupFor(lang)) await this.playModel(text);
      else await this.playDevice(text, lang);
    } catch (e) { console.warn('TTS failed', e); }
    finally { this.active--; conversation.onSpeechEnd(lang, aloud); }
  }
  playDevice(text, lang) {
    if (!synth) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(lang === 'vi' ? viForSpeech(text, S.region) : text);
      u.lang = TTS_LANG[lang];
      const v = voices.pick(lang); if (v) u.voice = v;
      u.rate = lang === 'vi' ? S.rateVi : lang === 'en' ? S.rateEn : 1;
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
      u.onend = finish; u.onerror = finish;
      // some engines never fire "end": fall back to an estimate
      const timer = setTimeout(finish, 2500 + (text.length * 95) / u.rate);
      if (synth.paused) synth.resume();
      synth.speak(u);
    });
  }
  async playModel(text) {
    await models.ensure('ttsVi');
    const clean = viForSpeech(text, S.region).toLocaleLowerCase('vi').replace(/[^\p{L}\p{M}\s,.?!]/gu, ' ');
    const r = await ml.job('tts', { spec: MODELS.ttsVi, text: clean }, { priority: 4 });
    this.out ||= new AudioContext();
    if (this.out.state === 'suspended') await this.out.resume();
    const buf = this.out.createBuffer(1, r.audio.length, r.sr);
    buf.copyToChannel(r.audio, 0);
    await new Promise((resolve) => {
      const src = this.out.createBufferSource();
      src.buffer = buf; src.playbackRate.value = Math.max(0.7, Math.min(1.3, S.rateVi / 0.9));
      src.connect(this.out.destination); src.onended = resolve; src.start();
      this.src = src;
    });
  }
  cancel() { try { synth?.cancel(); } catch { /* none */ } try { this.src?.stop(); } catch { /* none */ } }
}

// ───────────────────────── Conversation engine ─────────────────────────
const ml = new ML((ev) => models.onProgress(ev));
const speaker = new Speaker();
const mic = new Mic();
const vad = new VAD();
const browserRec = SR ? new BrowserRecognizer() : null;
let wakeLock = null;
let lastAsrMs = 1200;

async function transcribe(audio, lang, { interim = false } = {}) {
  const key = lang === 'vi' ? viAsrKey() : lang === 'en' ? 'asrEn' : 'asrZh';
  await models.ensure(key);
  const t0 = performance.now();
  const r = await ml.job('asr', { spec: MODELS[key], audio, language: ASR_LANG[lang] },
    { priority: interim ? 0 : 3, tag: interim ? 'interim' : null, transfer: [audio.buffer] });
  if (!interim) lastAsrMs = 0.7 * lastAsrMs + 0.3 * (performance.now() - t0);
  return r.text;
}

async function translate(text, from, to) {
  const bt = await boosts.translator(from, to);
  if (bt) { try { return await bt.translate(text); } catch { /* fall back */ } }
  const key = { vien: 'mtViEn', envi: 'mtEnVi', zhen: 'mtZhEn', enzh: 'mtEnZh' }[from + to];
  await models.ensure(key);
  const parts = splitSentences(text);
  const r = await ml.job('mt', { spec: MODELS[key], texts: parts.length ? parts : [text] }, { priority: 2 });
  return r.texts.join(' ').replace(/\s+/g, ' ').trim();
}

const CURRENCY_WORD = { '₹': 'rupees', '$': 'dollars', '€': 'euros', '£': 'pounds', 'A$': 'Australian dollars', 'S$': 'Singapore dollars' };
function convert(vnd) {
  const r = Number(S.rate) || 0;
  if (!r) return null;
  const v = vnd / r;
  return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
}

const conversation = {
  turns: [],
  mode: 'idle',          // idle | listen | speak
  resumeListen: false,
  muted: false,
  askedPrice: 0,
  theirChain: Promise.resolve(),

  add(turn) {
    turn.id = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    this.turns.push(turn);
    ui.turn(turn);
    return turn;
  },
  remove(turn) { this.turns = this.turns.filter((t) => t !== turn); $(`#${turn.id}`)?.remove(); ui.empty(); },

  // ---- They speak ----
  async their(audio) {
    const lang = S.theirLang;
    const turn = this.add({ dir: 'in', lang, pending: 'Recognising…' });
    try {
      const raw = await transcribe(audio, lang);
      this.theirText(cleanAsr(raw, lang), turn);
    } catch (e) {
      if (e.dropped) return this.remove(turn);
      turn.pending = null; turn.err = friendly(e); ui.turn(turn);
    }
  },
  async theirText(src, turn = null, { typed = false } = {}) {
    const lang = typed && looksVietnamese(src) ? 'vi' : typed && looksChinese(src) ? 'zh' : S.theirLang;
    if (!src) { if (turn) this.remove(turn); return; }
    turn ||= this.add({ dir: 'in', lang });
    ui.live('');
    turn.src = src; turn.pending = 'Translating…'; ui.turn(turn);
    try {
      let input = src, hints = [];
      if (lang === 'vi') {
        const norm = normalizeViMoney(src);
        input = norm.text;
        hints = priceHints(norm, { askedPrice: this.askedPrice > 0 });
        this.askedPrice = Math.max(0, this.askedPrice - 1);
      }
      const en = fixEnMoney(await translate(input, lang, 'en'));
      turn.dst = en; turn.hints = hints; turn.pending = null; ui.turn(turn);
      const extra = hints.map((hn) => {
        const c = convert(hn.vnd);
        const cur = CURRENCY_WORD[S.currency] || S.currency;
        if (hn.implied) return ` They probably mean ${formatThousands(hn.vnd)} dong${c != null ? `, about ${c} ${cur}` : ''}.`;
        return c != null ? ` That’s about ${c} ${cur}.` : '';
      }).join('');
      speaker.speak(en + extra, 'en');
    } catch (e) {
      turn.pending = null; turn.err = friendly(e); ui.turn(turn);
    }
  },

  // ---- I speak / type ----
  async mine(text) {
    text = (text || '').trim();
    if (!text) return;
    if (looksVietnamese(text) || (S.theirLang === 'zh' && looksChinese(text))) return this.theirText(text, null, { typed: true });
    const turn = this.add({ dir: 'out', lang: S.theirLang, src: text, pending: 'Translating…' });
    try {
      let out, say, tag;
      if (S.theirLang === 'vi') {
        const offer = parseOffer(text);
        const ph = !offer && matchPhrase(text, PHRASES);
        if (offer) {
          const o = renderOffer(offer.amount, toneCtx());
          out = o.display; say = o.speak; tag = 'Price';
        } else if (ph) {
          out = renderPhrase(ph.phrase.vi, toneCtx()); tag = 'Phrasebook';
        } else {
          out = applyTone(await translate(text, 'en', 'vi'), toneCtx()); tag = 'AI translation';
        }
        if (/how much|price|cost|altogether|total/i.test(text)) this.askedPrice = 2;
      } else {
        out = await translate(text, 'en', S.theirLang); tag = 'AI translation';
      }
      Object.assign(turn, { dst: out, say: say || out, tag, pending: null });
      ui.turn(turn);
      speaker.speak(turn.say, turn.lang, { aloud: true });
    } catch (e) {
      turn.pending = null; turn.err = friendly(e); ui.turn(turn);
    }
  },
  sayPhrase(vi, en, speakText) {
    const turn = this.add({ dir: 'out', lang: 'vi', src: en, dst: vi, say: speakText || vi, tag: 'Phrasebook' });
    speaker.speak(turn.say, 'vi', { aloud: true });
    return turn;
  },

  // ---- Microphone modes ----
  async startMic() {
    if (mic.alive) return true;
    try {
      await mic.start(S.micId);
      mic.onFrame = (f) => this.frame(f);
      ui.mics();
      return true;
    } catch (e) {
      const m = e?.name === 'NotAllowedError' ? 'Microphone blocked. Allow it in your browser’s site settings, then try again.'
        : e?.name === 'OverconstrainedError' ? 'That microphone isn’t available. Pick another in Settings.' : `Couldn’t start the microphone (${e?.message || e}).`;
      if (e?.name === 'OverconstrainedError') { S.micId = ''; save(); }
      toast(m, 5000);
      return false;
    }
  },
  stopMic() { mic.stop(); vad.reset(); ui.meter(0); },

  frame(f) {
    if (this.muted || this.mode === 'idle' || (this.mode === 'listen' && this.usingBrowserSR)) return;
    vad.feed(f);
    ui.meter(Math.max(0, Math.min(1, (vad.db - vad.noise) / 30)));
  },

  async listen() {
    if (this.mode === 'listen') return this.stop();
    if (this.mode === 'speak') { this.resumeListen = false; if (this.usingBrowserSR) browserRec.stop(); this.endSpeak(); }
    unlockAudio();
    this.mode = 'listen'; ui.modes();
    lockScreen();
    const lang = S.theirLang;
    if (boosts.useSR(lang)) {
      this.usingBrowserSR = true;
      browserRec.start(lang, {
        continuous: S.continuous,
        onInterim: (t) => ui.live(t),
        onFinal: (t) => { this.theirText(cleanAsr(t, lang)); if (!S.continuous) this.stop(); },
        onEnd: () => { if (this.mode === 'listen' && !S.continuous) this.stop(); },
      });
      return;
    }
    this.usingBrowserSR = false;
    if (!(await this.startMic())) { this.mode = 'idle'; ui.modes(); return; }
    vad.reset();
    vad.pauseMs = S.pauseMs; vad.maxMs = 9000;
    vad.onStart = () => ui.live('…');
    vad.onInterim = S.liveCaptions ? (audio) => this.interim(audio) : null;
    vad.onSegment = (audio) => {
      ml.drop('interim');
      this.theirChain = this.theirChain.then(() => this.their(audio));
      if (!S.continuous) this.stop();
    };
  },
  interimBusy: false, lastInterim: 0,
  async interim(audio) {
    const now = performance.now();
    if (this.interimBusy || !ml.idle || now - this.lastInterim < Math.max(1000, lastAsrMs * 1.4)) return;
    this.interimBusy = true; this.lastInterim = now;
    try {
      const t = await transcribe(audio, S.theirLang, { interim: true });
      if (vad.speaking && this.mode === 'listen') ui.live(t ? `${t}…` : '…');
    } catch { /* dropped or failed: captions are best-effort */ }
    finally { this.interimBusy = false; }
  },

  async speak() {
    if (this.mode === 'speak') return this.stopSpeak(true);
    unlockAudio();
    this.resumeListen = this.mode === 'listen';
    if (this.mode === 'listen') { browserRec?.stop(); vad.reset(); }
    speaker.cancel();
    this.mode = 'speak'; ui.modes(); ui.live('Go ahead…');
    if (boosts.useSR('en')) {
      this.usingBrowserSR = true;
      let said = '';
      browserRec.start('en', {
        continuous: false,
        onInterim: (t) => ui.live(t || 'Go ahead…'),
        onFinal: (t) => { said += ` ${t}`; },
        onEnd: () => { const t = said.trim(); this.endSpeak(); if (t) this.mine(t); },
      });
      return;
    }
    this.usingBrowserSR = false;
    if (!(await this.startMic())) { this.mode = 'idle'; ui.modes(); return; }
    vad.reset();
    vad.pauseMs = Math.max(900, S.pauseMs + 300); vad.maxMs = 15000; vad.onInterim = null;
    vad.onStart = () => ui.live('Listening to you…');
    vad.onSegment = (audio) => this.mySegment(audio);
  },
  async mySegment(audio) {
    this.endSpeak();
    ui.live('Recognising…');
    try {
      const text = cleanAsr(await transcribe(audio, 'en'), 'en');
      ui.live('');
      if (text) this.mine(text); else toast('Didn’t catch that — try again or type it.');
    } catch (e) { ui.live(''); toast(friendly(e), 5000); }
  },
  stopSpeak(flush) {
    if (this.usingBrowserSR) { browserRec.stop(); return; }
    if (flush && vad.speaking && vad.frames.length > 15) { vad.finish(vad.frames.length); return; }
    this.endSpeak();
  },
  endSpeak() {
    vad.reset();
    if (this.mode !== 'speak') return;
    ui.live('');
    if (this.resumeListen) { this.mode = 'idle'; this.listen(); }
    else { this.mode = 'idle'; this.stopMic(); ui.modes(); unlockScreen(); }
  },
  stop() {
    browserRec?.stop();
    this.mode = 'idle'; this.resumeListen = false;
    this.stopMic(); ui.modes(); ui.live(''); unlockScreen();
  },

  // ---- Avoid hearing our own voice ----
  onSpeechStart(lang, aloud) {
    const blocking = aloud || !S.earphones;
    if (!blocking) return;
    this.muted = true; vad.reset();
    if (this.usingBrowserSR && this.mode === 'listen') browserRec.stop();
    // Release the mic while the phone talks out loud: on iPhones an open mic
    // can push speech to the quiet earpiece instead of the speaker.
    if (aloud && mic.alive) { this.pausedMic = true; this.stopMic(); }
  },
  onSpeechEnd() {
    if (speaker.active > 0) return;
    setTimeout(async () => {
      if (speaker.active > 0) return;
      this.muted = false;
      if (this.mode === 'listen') {
        if (this.usingBrowserSR) { this.mode = 'idle'; this.listen(); }
        else if (!mic.alive) await this.startMic();
      }
      this.pausedMic = false;
    }, 250);
  },
};

let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth?.speak(u); } catch { /* no tts */ }
  try { speaker.out ||= new AudioContext(); speaker.out.resume(); } catch { /* no audio */ }
}
async function lockScreen() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ } }
function unlockScreen() { try { wakeLock?.release(); } catch { /* none */ } wakeLock = null; }
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || conversation.mode !== 'listen') return;
  lockScreen();
  if (!conversation.usingBrowserSR && !mic.alive && !conversation.muted) await conversation.startMic();
});

// ───────────────────────── UI ─────────────────────────
const ui = {
  view: 'talk',
  go(view) {
    this.view = view;
    for (const v of ['talk', 'phrases', 'settings']) $(`#view-${v}`).hidden = v !== view;
    $$('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    $('#dock').hidden = view !== 'talk';
    if (view === 'phrases') this.phrases();
    if (view === 'settings') { this.settings(); this.packs(); this.storage(); this.mics(); }
  },

  empty() { $('#empty').hidden = conversation.turns.length > 0; },
  live(t) { $('#live').textContent = t || ''; if (t) this.scroll(); },
  scroll() { const v = $('#view-talk'); requestAnimationFrame(() => { v.scrollTop = v.scrollHeight; }); },

  turn(t) {
    this.empty();
    let node = $(`#${t.id}`);
    const fresh = !node;
    node ||= h('article', { id: t.id, class: `turn ${t.dir}` });
    node.replaceChildren();
    const srcLang = t.dir === 'in' ? t.lang : 'en';
    const dstLang = t.dir === 'in' ? 'en' : t.lang;
    if (t.src) node.append(h('p', { class: 'src', lang: srcLang }, t.src));
    if (t.dst) node.append(h('p', { class: 'dst', lang: dstLang }, t.dst));
    else if (t.pending) node.append(h('p', { class: 'dst pending' }, t.pending));
    if (t.err) node.append(h('p', { class: 'err' }, t.err));
    const meta = h('div', { class: 'meta' });
    for (const hn of t.hints || []) {
      const c = convert(hn.vnd);
      const conv = c != null ? ` ≈ ${S.currency}${formatThousands(c)}` : '';
      meta.append(h('span', { class: 'chip-price' }, hn.implied ? `“${hn.said}” = ${formatVnd(hn.vnd)}₫?${conv}` : `${formatVnd(hn.vnd)}₫${conv}`));
    }
    if (t.tag) meta.append(h('span', { class: `tag${t.tag === 'Phrasebook' || t.tag === 'Price' ? ' good' : ''}` }, t.tag));
    if (t.dst) {
      meta.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Play again', onclick: () => speaker.speak(t.dir === 'in' ? t.dst : t.say || t.dst, t.dir === 'in' ? 'en' : t.lang, { aloud: t.dir === 'out' }) }, icon('play')));
      if (t.dir === 'out') meta.append(h('button', { class: 'icon-btn', type: 'button', onclick: () => show.open(t.dst, t.src, t.say, t.lang) }, icon('show'), 'Show'));
    }
    if (meta.childNodes.length) node.append(meta);
    if (fresh) $('#transcript').append(node);
    this.scroll();
  },

  modes() {
    const m = conversation.mode;
    const L = $('#btnListen'), Sp = $('#btnSpeak');
    L.setAttribute('aria-pressed', String(m === 'listen'));
    Sp.setAttribute('aria-pressed', String(m === 'speak'));
    $('.t', L).textContent = m === 'listen' ? 'Listening' : 'Listen';
    $('small', L).textContent = m === 'listen' ? 'Tap to stop' : (S.theirLang === 'zh' ? 'They speak Chinese' : 'They speak');
    $('.t', Sp).textContent = m === 'speak' ? 'I’m done' : 'Speak';
    $('small', Sp).textContent = m === 'speak' ? 'Or just pause' : 'I speak English';
    $('use', Sp).setAttribute('href', m === 'speak' ? '#i-stop' : '#i-mic');
    if (m === 'idle') this.meter(0);
  },
  meter(v) {
    const btn = conversation.mode === 'speak' ? $('#btnSpeak') : $('#btnListen');
    $$('.big .meter').forEach((e) => { e.style.width = '0'; });
    if (conversation.mode !== 'idle') $('.meter', btn).style.width = `${Math.round(v * 100)}%`;
  },

  who() {
    const box = $('#who');
    $$('button', box).forEach((b) => b.remove());
    for (const [k, p] of Object.entries(PRONOUNS)) {
      box.append(h('button', {
        type: 'button', 'aria-pressed': String(S.who === k), title: p.hint,
        onclick: () => { S.who = k; save(); this.who(); if (this.view === 'phrases') this.phrases(); },
      }, p.label, h('span', {}, p.short)));
    }
    box.hidden = S.theirLang !== 'vi';
  },

  lang() {
    $('#theirLang').textContent = LANG_NAME[S.theirLang];
    $('#typeInput').placeholder = S.theirLang === 'vi' ? 'Type in English…' : 'Type in English (or paste Chinese)…';
    this.who(); this.modes();
  },

  status() {
    const el = $('#status');
    const core = models.coreKeys();
    const viKeys = PACKS[0].models();
    const loading = Object.values(models.state).some((s) => s.loading);
    const viCached = viKeys.every((k) => models.state[k].cached);
    const allLoaded = core.filter((k) => models.state[k].cached).every((k) => models.state[k].loaded);
    let state, text;
    if (models.state[viKeys[0]].cached === null) { state = 'busy'; text = 'Checking…'; }
    else if (!viCached) { state = 'missing'; text = 'Download needed'; }
    else if (loading || !allLoaded) {
      const n = core.filter((k) => models.state[k].loaded).length;
      state = 'busy'; text = `Loading ${n}/${core.filter((k) => models.state[k].cached).length}`;
    } else { state = 'ready'; text = navigator.onLine ? 'Ready offline' : 'Offline · ready'; }
    el.dataset.state = state;
    $('span', el).textContent = text;
  },

  // ---- Phrases ----
  phraseCat: 'app',
  phrases() {
    const cats = $('#phraseCats');
    const q = $('#phraseSearch').value.trim().toLowerCase();
    cats.replaceChildren(...CATEGORIES.map((c) => h('button', {
      type: 'button', 'aria-pressed': String(!q && this.phraseCat === c.id),
      onclick: () => { this.phraseCat = c.id; $('#phraseSearch').value = ''; this.phrases(); },
    }, c.label)));
    const ctx = toneCtx();
    const list = PHRASES.filter((p) => (q ? (p.en + ' ' + (p.alts || []).join(' ') + ' ' + p.vi).toLowerCase().includes(q) : p.cat === this.phraseCat));
    $('#phraseList').replaceChildren(...list.map((p) => {
      const vi = renderPhrase(p.vi, ctx);
      return h('div', { class: 'phrase' },
        h('button', { class: 'say', type: 'button', onclick: () => { unlockAudio(); conversation.sayPhrase(vi, p.en); toast(`Saying: ${vi}`); } },
          h('span', { class: 'en' }, p.en), h('span', { class: 'vi', lang: 'vi' }, vi)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Show “${p.en}” to shopkeeper`, onclick: () => show.open(vi, p.en, vi, 'vi') }, icon('show')));
    }));
    if (!list.length) $('#phraseList').append(h('p', { class: 'help' }, 'No phrase matches. Type it on the Talk tab and the app will translate it.'));
    this.price();
  },
  priceValue() { const n = parseFloat(($('#priceInput').value || '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0; },
  price() {
    const v = this.priceValue();
    $('#priceWords').textContent = v ? `${numberToVi(v, S.region)} đồng` : 'Type a price in thousands of dong';
    const c = v ? convert(v) : null;
    $('#priceConv').textContent = v ? `${formatVnd(v)}₫${c != null ? ` ≈ ${S.currency}${formatThousands(c)}` : ''}` : '';
  },

  // ---- Settings ----
  settings() {
    $$('[data-setting]').forEach((el) => {
      const k = el.dataset.setting;
      if (el.classList.contains('seg')) $$('button', el).forEach((b) => b.setAttribute('aria-pressed', String(String(S[k]) === b.dataset.v)));
      else if (el.type === 'checkbox') el.checked = !!S[k];
      else el.value = S[k];
    });
    $('#pauseVal').textContent = `${(S.pauseMs / 1000).toFixed(1)} s`;
    this.voiceSelects();
    this.boosts();
    this.engineInfo();
  },
  async mics() {
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
      const sel = $('#micSelect');
      sel.replaceChildren(h('option', { value: '' }, 'Default'), ...devs.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => h('option', { value: d.deviceId }, d.label || `Microphone ${i + 1}`)));
      sel.value = S.micId;
    } catch { /* no permission yet */ }
  },
  voiceSelects() {
    for (const lang of ['vi', 'en']) {
      const sel = $(lang === 'vi' ? '#voiceVi' : '#voiceEn');
      if (!sel) continue;
      const list = voices.for(lang);
      sel.replaceChildren(h('option', { value: '' }, list.length ? 'Automatic' : 'None found'), ...list.map((v) => h('option', { value: v.name }, `${v.name}${v.localService ? '' : ' (needs internet)'}`)));
      sel.value = lang === 'vi' ? S.voiceVi : S.voiceEn;
    }
    const note = voiceNote();
    for (const id of ['#voiceViNote', '#setupVoice']) { const el = $(id); if (el) el.replaceChildren(note.cloneNode(true)); }
  },
  boosts() {
    const box = $('#boosts');
    if (!box) return;
    box.replaceChildren();
    const srState = boosts.sr['vi-VN'];
    const mtState = boosts.mt.vien;
    if (!srState && !mtState) { box.append(h('p', { class: 'help' }, 'Your browser has no on-device speech or translation built in. The app’s own models handle everything.')); return; }
    if (srState) {
      box.append(h('label', { class: 'toggle' }, h('div', {}, h('b', {}, 'Browser speech recognition (on-device)'),
        h('small', {}, srState === 'available' ? 'Installed — gives instant live captions.' : srState === 'unavailable' ? 'Not available for Vietnamese here.' : 'Not installed yet.')),
      h('input', { type: 'checkbox', checked: S.boostSR, disabled: srState !== 'available', onchange: (e) => { S.boostSR = e.target.checked; save(); } })));
      if (srState === 'downloadable') box.append(h('button', { class: 'btn alt', type: 'button', onclick: async () => {
        toast('Installing on-device recognizer…');
        try { await SR.install({ langs: ['vi-VN', 'en-US'], processLocally: true }); } catch (e) { toast(String(e.message || e)); }
        boosts.check();
      } }, 'Install browser recognizer'));
    }
    if (mtState) {
      box.append(h('label', { class: 'toggle' }, h('div', {}, h('b', {}, 'Browser translator (on-device)'),
        h('small', {}, mtState === 'available' ? 'Installed — usually more fluent than the built-in model.' : mtState === 'unavailable' ? 'Not available for Vietnamese here.' : 'Not installed yet.')),
      h('input', { type: 'checkbox', checked: S.boostMT, disabled: mtState !== 'available', onchange: (e) => { S.boostMT = e.target.checked; save(); } })));
      if (mtState === 'downloadable' || mtState === 'downloading') box.append(h('button', { class: 'btn alt', type: 'button', onclick: async () => {
        toast('Downloading browser translator…');
        try {
          for (const [a, b] of [['vi', 'en'], ['en', 'vi']]) await self.Translator.create({ sourceLanguage: a, targetLanguage: b });
        } catch (e) { toast(String(e.message || e)); }
        boosts.check();
      } }, 'Download browser translator'));
    }
  },
  async engineInfo() {
    try {
      const info = await ml.call('info');
      $('#engineInfo').textContent = `Engine: ${info.threads} thread${info.threads > 1 ? 's' : ''}${info.isolated ? '' : ' (single-threaded: this browser blocks multi-threading)'} · Vietnamese recognizer: ${MODELS[viAsrKey()].id}`;
    } catch { /* worker busy */ }
  },

  // ---- Packs ----
  packs(target = $('#packs'), { setup = false } = {}) {
    if (!target) return;
    target.replaceChildren(...PACKS.map((p) => {
      const keys = p.models();
      const ready = models.packReady(p);
      const loading = keys.some((k) => models.state[k].loading);
      const size = keys.reduce((a, k) => a + MODELS[k].mb, 0);
      const row = h('div', { class: 'pack', 'data-pack': p.id });
      const head = h('div', { class: 'pack-head' });
      if (setup) {
        const cb = h('input', { type: 'checkbox', 'aria-label': p.name, checked: setupChoice[p.id], disabled: p.id === 'vi' || ready || loading, onchange: (e) => { setupChoice[p.id] = e.target.checked; } });
        head.append(cb);
      }
      head.append(h('b', {}, p.name), h('span', { class: 'size' }, ready ? '' : `~${size} MB`));
      if (ready) head.append(h('span', { class: 'state ok' }, 'Downloaded'));
      else if (!setup && !loading) head.append(h('button', { class: 'btn alt', type: 'button', onclick: () => downloadPack(p) }, 'Download'));
      row.append(head, h('p', {}, p.desc));
      if (loading || (!ready && keys.some((k) => Object.keys(models.state[k].files).length))) row.append(h('div', { class: 'bar' }, h('i')));
      if (ready && !setup) row.append(h('p', {}, h('button', { class: 'btn alt', type: 'button', style: 'margin-top:6px;padding:6px 12px', onclick: async () => {
        if (!confirm(`Delete “${p.name}” from this phone? You’ll need internet to download it again.`)) return;
        for (const k of keys) await models.remove(k);
        this.packs(); this.status(); this.storage();
      } }, 'Delete')));
      return row;
    }));
    this.packProgress();
  },
  packProgress() {
    $$('.pack').forEach((row) => {
      const p = PACKS.find((x) => x.id === row.dataset.pack);
      const bar = $('.bar i', row);
      if (!p || !bar) return;
      const keys = p.models();
      const total = keys.reduce((a, k) => a + MODELS[k].mb, 0);
      const done = keys.reduce((a, k) => a + models.fraction(k) * MODELS[k].mb, 0);
      bar.style.width = `${Math.round((done / total) * 100)}%`;
    });
  },
  async storage() {
    try {
      const est = await navigator.storage?.estimate();
      const persisted = await navigator.storage?.persisted?.();
      if (est) $('#storageNote').textContent = `Using ${mb(est.usage || 0)} on this phone.${persisted ? ' Protected from automatic clean-up.' : ''}`;
    } catch { /* unsupported */ }
  },
};

function voiceNote() {
  const vi = voices.for('vi');
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const how = ios
    ? 'On iPhone: Settings › Accessibility › Spoken Content › Voices › Vietnamese, and download a voice (e.g. Linh).'
    : 'On Android: Settings › search “Text-to-speech” › Google › Install voice data › Vietnamese.';
  if (vi.some((v) => v.localService)) return h('p', { class: 'help' }, `✓ Vietnamese voice found: ${vi.find((v) => v.localService).name}. It works offline.`);
  if (vi.length) return h('div', { class: 'note' }, `Your Vietnamese voice may need internet. ${how} Or download the backup voice pack.`);
  return h('div', { class: 'note bad' }, `No Vietnamese voice on this phone yet. ${how} Or download the backup voice pack below.`);
}

// ───────────────────────── Downloads & setup ─────────────────────────
const setupChoice = { vi: true, en: true, voice: false, zh: false };
async function downloadPack(p) {
  if (!navigator.onLine) { toast('Connect to Wi-Fi to download.'); return; }
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  const keys = p.models();
  ui.packs(); ui.packs($('#setupPacks'), { setup: true });
  try {
    for (const k of keys) await models.ensure(k);
    toast(`${p.name}: ready offline`);
    // free memory for packs that aren't in use right now
    if (p.id === 'zh' && S.theirLang !== 'zh') for (const k of keys) await models.unload(k);
    if (p.id === 'voice' && S.backupVoice === 'never') await models.unload('ttsVi');
  } catch (e) {
    toast(friendly(e), 6000);
  }
  ui.packs(); ui.packs($('#setupPacks'), { setup: true }); ui.status(); ui.storage();
}

async function runSetup() {
  const go = $('#setupGo');
  go.disabled = true; $('#setupSkip').disabled = true;
  $('#setupMsg').textContent = 'Downloading… keep this screen open.';
  for (const p of PACKS) if (setupChoice[p.id] && !models.packReady(p)) await downloadPack(p);
  const ok = models.packReady(PACKS[0]);
  $('#setupMsg').textContent = ok ? 'Done. Try it in airplane mode to be sure.' : 'Download didn’t finish — check your connection and tap the button again.';
  go.disabled = false; $('#setupSkip').disabled = false;
  if (ok) finishSetup();
}
function finishSetup() {
  S.setupDone = true; save();
  $('#setup').hidden = true;
  warmUp();
}
function openSetup() {
  setupChoice.voice = !voices.hasLocalVi();
  ui.settings();
  ui.packs($('#setupPacks'), { setup: true });
  ui.voiceSelects();
  $('#setup').hidden = false;
}

async function warmUp() {
  // Load the models you'll need into memory now, so the first sentence at a stall is quick.
  const order = ['mtEnVi', viAsrKey(), 'mtViEn', 'asrEn'];
  if (S.theirLang === 'zh') order.push('asrZh', 'mtZhEn', 'mtEnZh');
  if (S.backupVoice === 'always' || (S.backupVoice === 'auto' && !voices.for('vi').length)) order.push('ttsVi');
  for (const k of order) {
    if (!models.state[k].cached) continue;
    try { await models.ensure(k); } catch (e) { console.warn('warm-up failed', k, e); }
  }
  ui.status();
}

// ───────────────────────── Show to shopkeeper ─────────────────────────
const show = {
  open(vi, en, say, lang = 'vi') {
    this.say = say || vi; this.lang = lang;
    $('#showVi').textContent = vi; $('#showVi').lang = lang;
    $('#showEn').textContent = en || '';
    $('#show').classList.remove('flipped');
    $('#show').hidden = false;
    $('#showPlay').focus();
  },
  close() { $('#show').hidden = true; },
};

// ───────────────────────── Wire up ─────────────────────────
function applyTheme() {
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = S.theme;
}

function bind() {
  $$('nav.tabs button').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.view)));
  $('#btnListen').addEventListener('click', () => conversation.listen());
  $('#btnSpeak').addEventListener('click', () => conversation.speak());
  $('#typeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    unlockAudio();
    const v = $('#typeInput').value;
    $('#typeInput').value = '';
    conversation.mine(v);
  });
  $('#status').addEventListener('click', () => ui.go('settings'));
  $('#theirLang').addEventListener('click', async () => {
    const next = S.theirLang === 'vi' ? 'zh' : 'vi';
    const zh = PACKS.find((p) => p.id === 'zh');
    if (next === 'zh' && !models.packReady(zh)) { toast('Download the Chinese pack in Settings first.'); ui.go('settings'); return; }
    if (conversation.mode !== 'idle') conversation.stop();
    S.theirLang = next; save(); ui.lang();
    toast(next === 'zh' ? 'Now translating Chinese ⇄ English' : 'Now translating Vietnamese ⇄ English');
    if (next === 'zh') { for (const k of zh.models()) models.ensure(k).catch(() => {}); }
    else for (const k of zh.models()) models.unload(k);
  });

  // phrases
  $('#phraseSearch').addEventListener('input', () => ui.phrases());
  $('#priceInput').addEventListener('input', () => ui.price());
  $('#priceQuick').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const cur = ui.priceValue() / 1000;
    $('#priceInput').value = b.hasAttribute('data-clear') ? '' : String(Math.max(0, cur + Number(b.dataset.add)) || '');
    ui.price();
  });
  const priceOr = (fn) => () => { const v = ui.priceValue(); if (!v) { toast('Type a price first.'); $('#priceInput').focus(); return; } unlockAudio(); fn(v); };
  $('#priceOffer').addEventListener('click', priceOr((v) => { const o = renderOffer(v, toneCtx()); conversation.sayPhrase(o.display, `Can you do ${formatThousands(v)}₫?`, o.speak); toast(`Saying: ${o.display}`); }));
  $('#priceSay').addEventListener('click', priceOr((v) => speaker.speak(`${formatVnd(v)}đ`, 'vi', { aloud: true })));
  $('#priceShow').addEventListener('click', priceOr((v) => show.open(`${formatVnd(v)}₫`, `${numberToVi(v, S.region)} đồng`, `${formatVnd(v)}đ`, 'vi')));

  // settings (shared by Settings view and setup screen)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-setting] button');
    if (!b) return;
    const k = b.parentElement.dataset.setting;
    S[k] = b.dataset.v; save();
    $$(`.seg[data-setting="${k}"] button`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === S[k])));
    if (k === 'theme') applyTheme();
    if (k === 'asrSize') {
      models.unload(S.asrSize === 'tiny' ? 'asrVi' : 'asrViTiny');
      ui.packs(); ui.status(); ui.engineInfo();
      if (!models.state[viAsrKey()].cached) toast('Download the Vietnamese pack again for this option.');
      else models.ensure(viAsrKey()).catch(() => {});
    }
    if (k === 'backupVoice' && S.backupVoice !== 'never' && !models.state.ttsVi.cached && !voices.for('vi').length) toast('Download the backup voice pack below.');
  });
  $$('#view-settings [data-setting]:not(.seg)').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.setting;
    S[k] = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.type === 'number') ? Number(el.value) : el.value;
    save();
    if (k === 'pauseMs') $('#pauseVal').textContent = `${(S.pauseMs / 1000).toFixed(1)} s`;
    if (k === 'micId' && mic.alive) { conversation.stopMic(); if (conversation.mode !== 'idle') conversation.startMic(); }
  }));
  $('#pauseMs').addEventListener('input', (e) => { $('#pauseVal').textContent = `${(e.target.value / 1000).toFixed(1)} s`; });
  $('#testVoices').addEventListener('click', () => {
    unlockAudio();
    speaker.speak('This is how translations will sound in your earphones.', 'en');
    speaker.speak(renderPhrase('{A} ơi, cái này bao nhiêu tiền ạ?', toneCtx()), 'vi', { aloud: true });
  });
  $('#clearChat').addEventListener('click', () => { conversation.turns = []; $('#transcript').replaceChildren(); ui.empty(); toast('Conversation cleared'); });
  $('#rerunSetup').addEventListener('click', openSetup);

  // setup
  $('#setupGo').addEventListener('click', runSetup);
  $('#setupSkip').addEventListener('click', finishSetup);

  // show
  $('#showClose').addEventListener('click', () => show.close());
  $('#showFlip').addEventListener('click', () => $('#show').classList.toggle('flipped'));
  $('#showPlay').addEventListener('click', () => { unlockAudio(); speaker.speak(show.say, show.lang, { aloud: true }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#show').hidden) show.close(); });

  addEventListener('online', () => ui.status());
  addEventListener('offline', () => ui.status());
  document.addEventListener('pointerdown', unlockAudio, { once: true });
}

async function init() {
  if (reloading) return;
  applyTheme();
  bind();
  if (synth) { voices.load(); synth.addEventListener?.('voiceschanged', () => voices.load()); }
  ui.who(); ui.lang(); ui.empty(); ui.go('talk'); ui.status();
  await models.refresh();
  ui.status(); ui.packs();
  boosts.check();
  if (!S.setupDone) openSetup();
  else warmUp();
}
init();
