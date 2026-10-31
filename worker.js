// worker.js — runs every on-device AI model off the main thread.
// Models are downloaded once from the Hugging Face Hub, then served from the
// browser's Cache Storage, so everything here keeps working with no signal.
import { pipeline, env, ModelRegistry } from './transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;   // models → Cache Storage ("transformers-cache")
env.useWasmCache = false;     // the runtime itself is precached by sw.js

const wasm = env.backends.onnx.wasm;
wasm.wasmPaths = {
  mjs: new URL('./ort-wasm-simd-threaded.mjs', import.meta.url).href,
  wasm: new URL('./ort-wasm-simd-threaded.wasm', import.meta.url).href,
};
// Multi-threading needs cross-origin isolation (sw.js adds the headers).
wasm.numThreads = self.crossOriginIsolated
  ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))
  : 1;
wasm.proxy = false;

const pipes = new Map(); // key → Promise<pipeline>

function getPipe(spec, onProgress) {
  if (!pipes.has(spec.key)) {
    const p = pipeline(spec.task, spec.id, {
      dtype: spec.dtype || 'q8',
      device: 'wasm',
      progress_callback: onProgress || undefined,
    }).catch((err) => { pipes.delete(spec.key); throw err; });
    pipes.set(spec.key, p);
  }
  return pipes.get(spec.key);
}

const textOf = (out) => (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out?.text) || '';

self.onmessage = async ({ data: msg }) => {
  const { id, type, spec } = msg;
  const reply = (o, transfer = []) => self.postMessage({ id, ...o }, transfer);
  try {
    switch (type) {
      case 'info':
        reply({ ok: true, threads: wasm.numThreads, isolated: !!self.crossOriginIsolated });
        break;

      case 'load': {
        let last = 0;
        await getPipe(spec, (e) => {
          if (e.status !== 'progress' && e.status !== 'done' && e.status !== 'initiate') return;
          const now = performance.now();
          if (e.status === 'progress' && now - last < 120) return; // throttle UI updates
          last = now;
          self.postMessage({ type: 'progress', key: spec.key, status: e.status, file: e.file, loaded: e.loaded || 0, total: e.total || 0 });
        });
        reply({ ok: true });
        break;
      }

      case 'cached': {
        let cached = false;
        try { cached = await ModelRegistry.is_pipeline_cached(spec.task, spec.id, { dtype: spec.dtype || 'q8', device: 'wasm' }); }
        catch { cached = false; }
        reply({ ok: true, cached });
        break;
      }

      case 'unload': {
        const p = pipes.get(spec.key);
        pipes.delete(spec.key);
        if (p) { try { await (await p).dispose(); } catch { /* already gone */ } }
        reply({ ok: true });
        break;
      }

      case 'asr': {
        const p = await getPipe(spec);
        const t0 = performance.now();
        const opts = { max_new_tokens: 120, return_timestamps: false };
        if (msg.language) { opts.language = msg.language; opts.task = 'transcribe'; }
        let out;
        try {
          out = await p(msg.audio, opts);
        } catch (err) {
          // Some fine-tuned checkpoints don't accept language/task flags.
          if (!msg.language || !/language|task|english-only|lang_to_id/i.test(String(err?.message))) throw err;
          out = await p(msg.audio, { max_new_tokens: 120 });
        }
        reply({ ok: true, text: textOf(out).trim(), ms: performance.now() - t0 });
        break;
      }

      case 'mt': {
        const p = await getPipe(spec);
        const t0 = performance.now();
        const texts = [];
        for (const s of msg.texts) {
          const out = await p(s, { max_new_tokens: 200 });
          texts.push((Array.isArray(out) ? out[0]?.translation_text : out?.translation_text) || '');
        }
        reply({ ok: true, texts, ms: performance.now() - t0 });
        break;
      }

      case 'tts': {
        const p = await getPipe(spec);
        const out = await p(msg.text);
        const audio = Float32Array.from(out.data ?? out.audio);
        reply({ ok: true, audio, sr: out.sampling_rate }, [audio.buffer]);
        break;
      }

      default:
        reply({ ok: false, error: `Unknown job ${type}` });
    }
  } catch (err) {
    reply({ ok: false, error: String(err?.message || err) });
  }
};
