/* ================================================================== */
/*  AUDIO ENGINE — ambient bed + event-locked cues.                    */
/*  Every sound is tied to something visible. One master mute.         */
/* ================================================================== */

type Listener = (muted: boolean, ready: boolean) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private started = false;
  muted = false;
  ready = false;
  private subs = new Set<Listener>();
  private lastTick = 0;

  sub(f: Listener) { this.subs.add(f); f(this.muted, this.ready); return () => { this.subs.delete(f); }; }
  private emit() { this.subs.forEach((f) => f(this.muted, this.ready)); }

  /** Called from the first user gesture (browser autoplay policy). */
  unlock() {
    if (this.started) { this.ctx?.resume(); return; }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startBed();
      this.started = true;
      this.ready = true;
      this.emit();
    } catch { /* audio unavailable — silent fallback */ }
  }

  private startBed() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const bed = ctx.createGain();
    bed.gain.value = 0.0;
    bed.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.7;
    filter.connect(bed);

    // two detuned low oscillators = slow "universe hum"
    [55, 82.4, 110.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.06 : 0.13;
      o.connect(g); g.connect(filter);
      o.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.03 + i * 0.017;
      const lg = ctx.createGain();
      lg.gain.value = 0.05;
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start();
    });
    bed.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 4);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.5, this.ctx.currentTime + 0.25);
    }
    this.emit();
  }
  toggle() { this.unlock(); this.setMuted(!this.muted); }

  private env(freq: number, dur: number, type: OscillatorType, vol: number, sweep = 0) {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || this.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + sweep), ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  /** UI selection — a soft wooden tick. Rate-limited so it never becomes noise. */
  tick(pitch = 660) {
    const now = performance.now();
    if (now - this.lastTick < 55) return;
    this.lastTick = now;
    this.env(pitch, 0.09, 'triangle', 0.055);
  }
  /** Positive confirmation (correct answer, badge, completed mission). */
  chime() { this.env(523.25, 0.22, 'sine', 0.07); setTimeout(() => this.env(783.99, 0.3, 'sine', 0.055), 90); }
  /** Error / occlusion / warning. */
  thud() { this.env(150, 0.26, 'sawtooth', 0.05, -70); }
  /** Era travel / scene morph. */
  whoosh() {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master || this.muted) return;
    const len = 0.9;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(240, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + len);
    const g = ctx.createGain(); g.gain.value = 0.09;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }
  /** Heartbeat — locked to the visible systole in the body simulator. */
  beat(strength = 1) {
    this.env(58, 0.13, 'sine', 0.09 * strength);
    setTimeout(() => this.env(44, 0.16, 'sine', 0.06 * strength), 135);
  }
}

export const audio = new AudioEngine();
