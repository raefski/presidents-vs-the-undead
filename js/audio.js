/* ============================================================
   audio.js — every sound is synthesized at runtime with WebAudio.
   No .wav files, no loading, no CORS problems when you open the
   page straight off the filesystem.
   ============================================================ */

const Sound = {
  ctx: null,
  master: null,
  muted: false,
  _noise: null,
  _last: Object.create(null),   // throttle map: sound name -> last play time

  /** Must be called from a user gesture — browsers block audio otherwise. */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);

    // One second of white noise, reused for every percussive sound.
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  },

  /* ---------- primitives ---------- */

  /** A pitched blip. type: sine/square/saw/triangle. */
  tone(freq, dur, type, vol, freqEnd, delay) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol == null ? 0.25 : vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /** A filtered noise burst — impacts, explosions, footsteps. */
  noise(dur, vol, filtHz, filtEnd, q) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q == null ? 1.1 : q;
    f.frequency.setValueAtTime(filtHz, t);
    if (filtEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, filtEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },

  /**
   * Play a named sound, but at most once every `ms`.
   * Fifty enemies dying on the same frame would otherwise produce
   * fifty overlapping hits and clip the output to mush.
   */
  throttled(name, ms, fn) {
    const now = performance.now();
    if (this._last[name] && now - this._last[name] < ms) return;
    this._last[name] = now;
    fn();
  },

  /* ---------- game sounds ---------- */

  hit() { this.throttled('hit', 45, () => this.noise(0.06, 0.14, 1900, 700, 0.8)); },

  kill() {
    this.throttled('kill', 55, () => {
      this.noise(0.11, 0.16, 900, 200, 0.7);
      this.tone(rand(180, 260), 0.08, 'square', 0.06, 70);
    });
  },

  bigHit() { this.throttled('big', 90, () => { this.noise(0.22, 0.3, 500, 90, 0.6); this.tone(90, 0.2, 'sine', 0.22, 40); }); },

  swing() { this.throttled('swing', 70, () => this.noise(0.1, 0.09, 3200, 900, 1.6)); },

  shoot() { this.throttled('shoot', 40, () => this.tone(rand(620, 760), 0.06, 'square', 0.07, 260)); },

  beam() { this.throttled('beam', 120, () => { this.tone(520, 0.3, 'sawtooth', 0.1, 1400); this.tone(1040, 0.3, 'sine', 0.05, 2600); }); },

  boom() { this.noise(0.36, 0.34, 320, 55, 0.5); this.tone(70, 0.3, 'sine', 0.26, 32); },

  pickup() { this.throttled('xp', 28, () => this.tone(rand(880, 1100), 0.05, 'triangle', 0.05, 1500)); },

  heal() { this.tone(520, 0.09, 'sine', 0.16, 780); this.tone(780, 0.12, 'sine', 0.14, 1180, 0.06); },

  levelup() {
    const n = [523, 659, 784, 1047];
    for (let i = 0; i < n.length; i++) this.tone(n[i], 0.16, 'square', 0.13, null, i * 0.06);
  },

  hurt() { this.throttled('hurt', 220, () => { this.tone(190, 0.16, 'sawtooth', 0.2, 70); this.noise(0.13, 0.15, 700, 200); }); },

  bossSpawn() {
    this.tone(110, 0.7, 'sawtooth', 0.2, 55);
    this.tone(82, 0.9, 'square', 0.14, 41);
    this.noise(0.7, 0.16, 240, 60, 0.4);
  },

  bossDie() {
    for (let i = 0; i < 5; i++) {
      this.tone(140 + i * 60, 0.3, 'square', 0.12, 60, i * 0.09);
      this.noise(0.25, 0.2, 500 - i * 60, 60);
    }
  },

  ui() { this.tone(720, 0.045, 'square', 0.07, 900); },
  uiBig() { this.tone(420, 0.07, 'square', 0.1, 640); this.tone(640, 0.1, 'square', 0.08, 880, 0.05); },
  gameover() {
    const n = [523, 466, 392, 262];
    for (let i = 0; i < n.length; i++) this.tone(n[i], 0.42, 'triangle', 0.16, null, i * 0.22);
  },
  win() {
    const n = [392, 523, 659, 784, 1047, 1319];
    for (let i = 0; i < n.length; i++) this.tone(n[i], 0.3, 'square', 0.13, null, i * 0.13);
  }
};
