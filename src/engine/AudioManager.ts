/**
 * Retro 80s Web Audio Synthesizer for Jetpack Jones
 * Zero external audio assets required - runs instantly on any browser/mobile.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private jetpackGain: GainNode | null = null;
  private jetpackNoiseNode: AudioBufferSourceNode | null = null;
  private isThrusting: boolean = false;

  constructor() {
    // Lazily initialized on user interaction to comply with browser autoplay policies
  }

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
   * Jetpack thruster rocket roar with low-pass filtered noise and bass oscillation
   */
  public setJetpackThrust(active: boolean) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    if (active && !this.isThrusting) {
      this.isThrusting = true;
      const t = this.ctx.currentTime;

      if (!this.jetpackGain) {
        // Build looping pink noise buffer for realistic combustion roar
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          output[i] = (b0 + b1 + b2) * 0.18;
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 650;
        filter.Q.value = 2.0;

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
      this.jetpackGain.gain.linearRampToValueAtTime(0.28, t + 0.12);

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
   * Classic retro laser raygun zap
   */
  public playLaser() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.14);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Explosive crunch / obstacle impact sound
   */
  public playExplosion() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  /**
   * Chime pickup for fuel canisters or score tokens
   */
  public playPickup() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc1.frequency.setValueAtTime(659.25, t + 0.08); // E5
    osc1.frequency.setValueAtTime(783.99, t + 0.16); // G5
    osc1.frequency.setValueAtTime(1046.50, t + 0.24); // C6

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc1.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.4);
  }

  /**
   * Low fuel warning emergency bleep
   */
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
