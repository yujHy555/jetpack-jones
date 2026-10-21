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
   * Procedural player footstep sound effect
   * Generates a crisp sci-fi boot impact thud on alien terrain
   */
  public playFootstep() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. High-frequency heel click / gravel crunch
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(340 + Math.random() * 80, t);
    clickOsc.frequency.exponentialRampToValueAtTime(70, t + 0.045);

    clickGain.gain.setValueAtTime(0.12, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(t);
    clickOsc.stop(t + 0.05);

    // 2. Low ground thud
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(110 + Math.random() * 20, t);
    thudOsc.frequency.exponentialRampToValueAtTime(35, t + 0.07);

    thudGain.gain.setValueAtTime(0.18, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    thudOsc.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thudOsc.start(t);
    thudOsc.stop(t + 0.08);
  }

  /**
   * Satisfying Juicy Alien Blob Squish Explosion Pop & Splatter
   */
  public playAlienSquish() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Wet Pop Transient
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(950, t);
    popOsc.frequency.exponentialRampToValueAtTime(160, t + 0.12);

    popGain.gain.setValueAtTime(0.35, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    popOsc.connect(popGain);
    popGain.connect(this.ctx.destination);
    popOsc.start(t);
    popOsc.stop(t + 0.13);

    // 2. Bubbly Squelch & Gurgle
    const squelchOsc = this.ctx.createOscillator();
    const squelchGain = this.ctx.createGain();
    squelchOsc.type = 'triangle';
    squelchOsc.frequency.setValueAtTime(320, t);
    squelchOsc.frequency.linearRampToValueAtTime(680, t + 0.06);
    squelchOsc.frequency.exponentialRampToValueAtTime(80, t + 0.22);

    squelchGain.gain.setValueAtTime(0.28, t);
    squelchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    squelchOsc.connect(squelchGain);
    squelchGain.connect(this.ctx.destination);
    squelchOsc.start(t);
    squelchOsc.stop(t + 0.23);

    // 3. Sub-Bass Splatter Thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.18);

    subGain.gain.setValueAtTime(0.3, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.19);

    // 4. Energetic Sci-Fi Disintegration Zap & Sizzle
    const zapOsc = this.ctx.createOscillator();
    const zapGain = this.ctx.createGain();
    zapOsc.type = 'sawtooth';
    zapOsc.frequency.setValueAtTime(1200, t);
    zapOsc.frequency.exponentialRampToValueAtTime(150, t + 0.25);

    zapGain.gain.setValueAtTime(0.22, t);
    zapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    zapOsc.connect(zapGain);
    zapGain.connect(this.ctx.destination);
    zapOsc.start(t);
    zapOsc.stop(t + 0.26);
  }

  /**
   * Energetic Sci-Fi Laser & Rubbery Splat Impact on Enemy Hit
   */
  public playEnemyImpact() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. High-frequency plasma sizzle/zap transient
    const zapOsc = this.ctx.createOscillator();
    const zapGain = this.ctx.createGain();
    zapOsc.type = 'sawtooth';
    zapOsc.frequency.setValueAtTime(1400 + Math.random() * 200, t);
    zapOsc.frequency.exponentialRampToValueAtTime(320, t + 0.045);

    zapGain.gain.setValueAtTime(0.24, t);
    zapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    zapOsc.connect(zapGain);
    zapGain.connect(this.ctx.destination);
    zapOsc.start(t);
    zapOsc.stop(t + 0.05);

    // 2. Juicy rubbery membrane slap
    const slapOsc = this.ctx.createOscillator();
    const slapGain = this.ctx.createGain();
    slapOsc.type = 'sine';
    slapOsc.frequency.setValueAtTime(280 + Math.random() * 40, t);
    slapOsc.frequency.exponentialRampToValueAtTime(65, t + 0.07);

    slapGain.gain.setValueAtTime(0.28, t);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    slapOsc.connect(slapGain);
    slapGain.connect(this.ctx.destination);
    slapOsc.start(t);
    slapOsc.stop(t + 0.075);
  }

  /**
   * Heavy blunt impact sound for ragdoll knockback
   */
  public playHitImpact() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.22);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  /**
   * Heavy Hydraulic Press Crushing Slam & Metal Crunch
   */
  public playCrushHit() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // 1. Heavy metal slam
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.36);

    // 2. High-frequency metal crunch / clang
    const clang = this.ctx.createOscillator();
    const clangGain = this.ctx.createGain();
    clang.type = 'sawtooth';
    clang.frequency.setValueAtTime(820, t);
    clang.frequency.exponentialRampToValueAtTime(110, t + 0.15);

    clangGain.gain.setValueAtTime(0.3, t);
    clangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    clang.connect(clangGain);
    clangGain.connect(this.ctx.destination);
    clang.start(t);
    clang.stop(t + 0.16);
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
