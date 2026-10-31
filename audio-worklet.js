// audio-worklet.js — captures the microphone and resamples it to 16 kHz mono,
// posting 30 ms frames (480 samples) to the main thread.
class Capture16k extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.t = 0;          // next output position, in input-sample units
    this.g = 0;          // global input sample index
    this.prev = 0;
    // two cascaded one-pole low-pass filters (~6.5 kHz) to limit aliasing
    this.a = 1 - Math.exp((-2 * Math.PI * 6500) / sampleRate);
    this.l1 = 0; this.l2 = 0;
    this.frame = new Float32Array(480);
    this.n = 0;
  }

  push(v) {
    this.frame[this.n++] = v;
    if (this.n === this.frame.length) {
      this.port.postMessage(this.frame, [this.frame.buffer]);
      this.frame = new Float32Array(480);
      this.n = 0;
    }
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (this.ratio === 1) {
      for (let i = 0; i < ch.length; i++) this.push(ch[i]);
      return true;
    }
    for (let i = 0; i < ch.length; i++) {
      this.l1 += this.a * (ch[i] - this.l1);
      this.l2 += this.a * (this.l1 - this.l2);
      const x = this.l2;
      while (this.t <= this.g) {
        const frac = this.t - (this.g - 1);
        this.push(this.prev + (x - this.prev) * frac);
        this.t += this.ratio;
      }
      this.prev = x;
      this.g++;
    }
    return true;
  }
}
registerProcessor('capture-16k', Capture16k);
