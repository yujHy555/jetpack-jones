/**
 * Retro Sci-Fi Web Audio Synthesizer for Jetpack Jones
 * Generates satisfying plasma bubble-bursts, jetpack thrust roars, alien squelches, and pickups.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private jetpackGain: GainNode | null = null;
  private jetpackNoiseNode: AudioBufferSourceNode | null = null;
  private isThrusting: boolean = false;

  constructor() {}

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled && this.jetpackGain) {
      this.jetpackGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
    return this.enabled;
  }

  /**
   * Epic Jetpack thruster roar with combustion rumble & filtered air turbulence
   */
  public setJetpackThrust(active: boolean) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    if (active && !this.isThrusting) {
      this.isThrusting = true;
      const t = this.ctx.currentTime;

      if (!this.jetpackGain) {
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          output[i] = (b0 + b1 + b2) * 0.22;
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 750;
        filter.Q.value = 2.4;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);

        this.jetpackGain = gain;
        this.jetpackNoiseNode = noise;
      }

      this.jetpackGain.gain.cancelScheduledValues(t);
      this.jetpackGain.gain.linearRampToValueAtTime(0.32, t + 0.1);

    } else if (!active && this.isThrusting) {
      this.isThrusting = false;
      if (this.jetpackGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.jetpackGain.gain.cancelScheduledValues(t);
        this.jetpackGain.gain.linearRampToValueAtTime(0.0001, t + 0.2);
      }
    }
  }

  /**
   * Satisfying Sci-Fi Plasma Bubble Burst Laser Zap!
   * Combines an energetic frequency sweep with an acoustic bubble pop transient.
   */
  public playLaser() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Plasma bubble burst transient (chirp pop)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(420, t);
    osc1.frequency.exponentialRampToValueAtTime(1450, t + 0.04);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.16);

    gain1.gain.setValueAtTime(0.28, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.17);

    // 2. Low punch thump
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(160, t);
    osc2.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    gain2.gain.setValueAtTime(0.22, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.13);
  }

  /**
   * Juicy Alien Blob Squish Pop
   */
  public playAlienSquish() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(250, t + 0.08);
    osc.frequency.linearRampToValueAtTime(550, t + 0.16);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.28);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.29);
  }

  public playExplosion() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.4);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  public playPickup() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(880.00, t + 0.08); // A5
    osc.frequency.setValueAtTime(1174.66, t + 0.16); // D6

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  public playWarning() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}
