// FERROX-9 — all sound is synthesized with the Web Audio API.
// No audio files ship with the game; every effect below is built from
// oscillators and filtered noise at run time.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientNodes = null;
    this.enabled = true;
  }

  // Browsers require a user gesture before audio may start; call this
  // from the first click / keypress, then from the start button.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // A low foundry hum that runs under the whole game.
  startAmbient() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 110.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc2.start();
    lfo.start();
    this.ambientNodes = { osc, osc2, lfo, gain };
  }

  tone({ type = 'square', freq = 440, freqEnd = null, dur = 0.1, vol = 0.2, when = 0, attack = 0.005 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.now() + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.15, vol = 0.25, filterFreq = 1800, type = 'bandpass', when = 0, sweepTo = null }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.now() + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shot() {
    this.noise({ dur: 0.11, vol: 0.32, filterFreq: 2600, sweepTo: 300 });
    this.tone({ type: 'square', freq: 190, freqEnd: 60, dur: 0.09, vol: 0.16 });
  }

  dryFire() {
    this.tone({ type: 'square', freq: 1200, dur: 0.03, vol: 0.08 });
  }

  reload() {
    this.tone({ type: 'square', freq: 500, dur: 0.04, vol: 0.1 });
    this.tone({ type: 'square', freq: 700, dur: 0.04, vol: 0.1, when: 0.28 });
    this.tone({ type: 'square', freq: 950, dur: 0.05, vol: 0.12, when: 0.62 });
  }

  hitMarker() {
    this.tone({ type: 'sine', freq: 2100, dur: 0.045, vol: 0.14 });
  }

  kill() {
    this.tone({ type: 'triangle', freq: 660, freqEnd: 990, dur: 0.12, vol: 0.16 });
    this.noise({ dur: 0.2, vol: 0.14, filterFreq: 900, sweepTo: 150 });
  }

  hurt() {
    this.tone({ type: 'sawtooth', freq: 140, freqEnd: 70, dur: 0.22, vol: 0.22 });
    this.noise({ dur: 0.18, vol: 0.12, filterFreq: 500, type: 'lowpass' });
  }

  enemyShot() {
    this.tone({ type: 'sawtooth', freq: 880, freqEnd: 220, dur: 0.14, vol: 0.07 });
  }

  explosion() {
    this.noise({ dur: 0.5, vol: 0.4, filterFreq: 1200, sweepTo: 90, type: 'lowpass' });
    this.tone({ type: 'sine', freq: 90, freqEnd: 32, dur: 0.45, vol: 0.3 });
  }

  coreTick(pitch) {
    this.tone({ type: 'sine', freq: 440 + pitch * 160, dur: 0.07, vol: 0.12 });
  }

  coreOnline() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ type: 'triangle', freq: f, dur: 0.22, vol: 0.16, when: i * 0.09 }));
    this.noise({ dur: 0.4, vol: 0.1, filterFreq: 2400, sweepTo: 400 });
  }

  pickup() {
    this.tone({ type: 'sine', freq: 740, dur: 0.09, vol: 0.14 });
    this.tone({ type: 'sine', freq: 1108, dur: 0.12, vol: 0.14, when: 0.08 });
  }

  denied() {
    this.tone({ type: 'square', freq: 180, dur: 0.12, vol: 0.12 });
  }

  win() {
    [392, 494, 587, 784, 988].forEach((f, i) =>
      this.tone({ type: 'triangle', freq: f, dur: 0.4, vol: 0.16, when: i * 0.12 }));
  }

  lose() {
    [330, 262, 196, 131].forEach((f, i) =>
      this.tone({ type: 'sawtooth', freq: f, dur: 0.35, vol: 0.14, when: i * 0.16 }));
  }

  click() {
    this.tone({ type: 'sine', freq: 900, dur: 0.04, vol: 0.1 });
  }
}
