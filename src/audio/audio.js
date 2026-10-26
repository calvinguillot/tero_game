import { rand, choice, clamp } from '../core/math.js';

// Everything you hear is synthesised with the Web Audio API: chiptune-style
// effects, a rain/wind bed that follows the weather, little day and night
// sounds, and an optional soft pentatonic tune. Browsers only allow audio
// after a key press or tap, so the graph is built on the first one (unlock).
//
// Buses: sfx, ambience and music, into a master gain and a gentle compressor.

const SCALES = {
  day: { root: 261.63, steps: [0, 2, 4, 7, 9] }, // C major pentatonic
  night: { root: 220.0, steps: [0, 3, 5, 7, 10] }, // A minor pentatonic
};
const BEAT = 0.34; // seconds per music step

const semis = (f, n) => f * 2 ** (n / 12);

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.duck = false; // quieter ambience while paused
    this.step = 0;
    this.nextNote = 0;
    this.melody = 2;
    this.chirpT = 1;
  }

  // Call from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  build() {
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(c.destination);
    this.master = this.gain(this.settings.sound ? 0.8 : 0, comp);
    this.sfx = this.gain(0.55, this.master);
    this.amb = this.gain(0.7, this.master);
    this.music = this.gain(this.settings.music ? 0.22 : 0, this.master);

    // Two seconds of white noise, reused by every noisy sound.
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Rain: hiss band plus a low roar that only comes in for heavy rain.
    this.rainG = this.gain(0, this.amb);
    this.loopNoise([this.filter('highpass', 500), this.filter('lowpass', 4200)], this.rainG);
    this.roarG = this.gain(0, this.amb);
    this.loopNoise([this.filter('lowpass', 320)], this.roarG);
    // Wind: a resonant band that wanders.
    this.windG = this.gain(0, this.amb);
    this.windF = this.filter('bandpass', 500, 4);
    this.loopNoise([this.windF], this.windG);
    this.nextNote = c.currentTime + 0.2;
  }

  // ---- building blocks ------------------------------------------------------

  gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  loopNoise(chain, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    let node = src;
    for (const f of chain) node = node.connect(f);
    node.connect(dest);
    src.start();
  }

  // One oscillator note with an exponential pitch glide and envelope.
  tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol = 0.1, attack = 0.004, at = 0, dest = this.sfx }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // A burst of filtered noise; the filter can sweep from f0 to f1.
  noise({ type = 'bandpass', f0 = 1000, f1 = f0, q = 1, dur = 0.2, vol = 0.2, attack = 0.005, at = 0, dest = this.sfx }) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.filter(type, f0, q);
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, rand(0, 1.5));
    src.stop(t + dur + 0.05);
  }

  // ---- sound effects --------------------------------------------------------

  // Blip that climbs a semitone per point in a row.
  score(streak) {
    const f = semis(660, Math.min(streak, 14));
    this.tone({ f0: f, f1: f * 1.5, dur: 0.07, vol: 0.06 });
  }

  close() {
    this.tone({ type: 'triangle', f0: 1319, dur: 0.08, vol: 0.12 });
    this.tone({ type: 'triangle', f0: 1760, dur: 0.12, vol: 0.12, at: 0.06 });
    this.tone({ type: 'sine', f0: 2637, dur: 0.2, vol: 0.05, at: 0.1 });
  }

  milestone() {
    [0, 4, 7, 12].forEach((n, i) => this.tone({ f0: semis(523, n), dur: 0.12, vol: 0.07, at: i * 0.07 }));
  }

  lifeUp() {
    [0, 4, 7, 12, 16].forEach((n, i) => this.tone({ type: 'triangle', f0: semis(523, n), dur: 0.16, vol: 0.14, at: i * 0.08 }));
    this.tone({ type: 'square', f0: semis(523, 24), dur: 0.3, vol: 0.05, at: 0.4 });
  }

  hit() {
    this.noise({ type: 'lowpass', f0: 2400, f1: 300, dur: 0.3, vol: 0.35 });
    this.tone({ f0: 420, f1: 110, dur: 0.35, vol: 0.12 });
    this.tone({ type: 'triangle', f0: 300, f1: 80, dur: 0.4, vol: 0.15, at: 0.03 });
  }

  fieldFire() {
    this.tone({ type: 'sine', f0: 220, f1: 50, dur: 0.45, vol: 0.4 });
    this.noise({ f0: 2600, f1: 260, q: 0.8, dur: 0.5, vol: 0.3 });
    this.tone({ type: 'triangle', f0: 880, f1: 1760, dur: 0.18, vol: 0.06 });
  }

  fieldFade() {
    this.tone({ type: 'sine', f0: 620, f1: 300, dur: 0.3, vol: 0.05 });
  }

  fieldReady() {
    this.tone({ type: 'triangle', f0: 988, dur: 0.1, vol: 0.12 });
    this.tone({ type: 'triangle', f0: 1319, dur: 0.22, vol: 0.12, at: 0.09 });
  }

  // Umbrellas snapping shut in the wave.
  shut() {
    this.noise({ type: 'highpass', f0: 2500, dur: 0.05, vol: 0.12 });
    this.tone({ f0: 300, f1: 180, dur: 0.06, vol: 0.05 });
  }

  gameOver() {
    [7, 4, 0, -5].forEach((n, i) => this.tone({ type: 'triangle', f0: semis(392, n), dur: 0.3, vol: 0.14, at: i * 0.22 }));
  }

  newPlace() {
    [0, 7, 12].forEach((n, i) => this.tone({ type: 'sine', f0: semis(784, n), dur: 0.4, vol: 0.08, at: i * 0.12 }));
  }

  thunder(soft) {
    const at = rand(0.25, 1.1);
    const v = soft ? 0.35 : 0.6;
    if (at < 0.5) this.noise({ type: 'highpass', f0: 1800, dur: 0.15, vol: v * 0.4, at });
    this.noise({ type: 'lowpass', f0: 500, f1: 60, dur: 2.6, vol: v, attack: 0.08, at, dest: this.amb });
  }

  gust() {
    this.noise({ f0: 350, f1: 900, q: 1.5, dur: 2.2, vol: 0.25, attack: 0.6, dest: this.amb });
  }

  puddle() {
    this.noise({ f0: 1600, f1: 500, q: 2, dur: 0.12, vol: 0.06 });
  }

  menuMove() {
    this.tone({ f0: 660, dur: 0.03, vol: 0.05 });
  }

  menuSelect() {
    this.tone({ f0: 880, f1: 1320, dur: 0.08, vol: 0.07 });
  }

  // ---- ambience and music, every frame ------------------------------------

  set(param, v, k = 0.4) {
    param.setTargetAtTime(v, this.ctx.currentTime, k);
  }

  update(dt, world) {
    if (!this.ctx) return;
    const s = this.settings;
    this.set(this.master.gain, s.sound ? 0.8 : 0, 0.05);
    this.set(this.music.gain, s.music && !this.duck ? 0.22 : 0, 0.3);
    if (!this.ready || !world) return;

    const sky = world.sky;
    const rain = sky.p.rain;
    const duck = this.duck ? 0.35 : 1;
    this.set(this.rainG.gain, Math.min(1.4, rain) * 0.2 * duck);
    this.set(this.roarG.gain, clamp(rain - 1, 0, 1.2) * 0.35 * duck);
    const wind = Math.abs(sky.wind) / 55;
    this.set(this.windG.gain, (wind * 0.5 + sky.p.wind * 0.04) * duck, 0.25);
    this.set(this.windF.frequency, 380 + wind * 600 + Math.sin(sky.age * 0.7) * 120, 0.3);

    // Crickets on dry-ish nights, birds on bright days.
    if ((this.chirpT -= dt) <= 0) {
      this.chirpT = rand(0.6, 2.2);
      if (sky.night > 0.6 && rain < 0.6) this.cricket();
      else if (sky.night < 0.2 && rain < 0.5) this.bird();
    }

    this.playMusic(sky);
  }

  cricket() {
    for (let i = 0; i < 3; i++) this.tone({ type: 'sine', f0: 4400, dur: 0.035, vol: 0.025, at: i * 0.06, dest: this.amb });
  }

  bird() {
    const f = rand(2200, 3200);
    const n = Math.floor(rand(2, 4));
    for (let i = 0; i < n; i++) this.tone({ type: 'sine', f0: f, f1: f * rand(1.2, 1.5), dur: 0.08, vol: 0.03, at: i * 0.12, dest: this.amb });
  }

  // A wandering pentatonic line over a soft bass, in a major key by day and
  // a minor one by night; quieter and sparser in storms.
  playMusic(sky) {
    const c = this.ctx;
    const scale = sky.night > 0.5 ? SCALES.night : SCALES.day;
    while (this.nextNote < c.currentTime + 0.2) {
      const at = this.nextNote - c.currentTime;
      if (this.step % 8 === 0) {
        const bass = scale.root / 2;
        this.tone({ type: 'triangle', f0: this.step % 16 === 0 ? bass : semis(bass, scale.steps[3]), dur: BEAT * 3.5, vol: 0.12, attack: 0.03, at, dest: this.music });
      }
      const rest = sky.p.wind > 0.5 ? 0.6 : 0.3;
      if (Math.random() > rest) {
        this.melody = clamp(this.melody + choice([-2, -1, -1, 1, 1, 2]), 0, 9);
        const step = scale.steps[this.melody % 5] + 12 * Math.floor(this.melody / 5);
        this.tone({ type: 'triangle', f0: semis(scale.root, step), dur: BEAT * 1.6, vol: 0.09, attack: 0.01, at, dest: this.music });
      }
      this.step++;
      this.nextNote += BEAT;
    }
  }
}
