/**
 * Retro Sci-Fi Web Audio Synthesizer for Jetpack Jones
 * Generates satisfying plasma bubble-bursts, jetpack thrust roars, alien squelches, and pickups.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public masterVolume: number = 0.8;
  public enabled: boolean = true;
  private jetpackGain: GainNode | null = null;
  private jetpackNoiseNode: AudioBufferSourceNode | null = null;
  private isThrusting: boolean = false;

  constructor() {
    // Unlock AudioContext on initial browser user interaction
    const unlockAudio = () => {
      this.initCtx();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.enabled ? this.masterVolume : 0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public get outputNode(): AudioNode {
    if (!this.ctx || !this.masterGain) {
      this.initCtx();
    }
    return this.masterGain || this.ctx!.destination;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && this.enabled) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? this.masterVolume : 0, this.ctx.currentTime);
    }
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
        gain.connect(this.outputNode);
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
    gain1.connect(this.outputNode);
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
    gain2.connect(this.outputNode);
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
    clickGain.connect(this.outputNode);
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
    thudGain.connect(this.outputNode);
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
    popGain.connect(this.outputNode);
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
    squelchGain.connect(this.outputNode);
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
    subGain.connect(this.outputNode);
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
    zapGain.connect(this.outputNode);
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
    zapGain.connect(this.outputNode);
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
    slapGain.connect(this.outputNode);
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
    gain.connect(this.outputNode);
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
    gain.connect(this.outputNode);
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
    clangGain.connect(this.outputNode);
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
    gain.connect(this.outputNode);
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
    gain.connect(this.outputNode);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  public playCoin() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(1318.51, t); // E6
    osc.frequency.setValueAtTime(1760.00, t + 0.08); // A6
    osc2.frequency.setValueAtTime(2637.02, t + 0.08); // E7 harmonic

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.outputNode);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.46);
    osc2.stop(t + 0.46);
  }

  public playShieldToggle(active: boolean) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (active) {
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.22);
    } else {
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    }

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.outputNode);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  public playShieldDeflect() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    // FM Wobble: 620Hz base with 28Hz wobble vibrato
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.28);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(28, t);
    lfoGain.gain.setValueAtTime(140, t);

    lfo.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.30);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

    osc.connect(gain);
    gain.connect(this.outputNode);
    osc.start(t);
    osc.stop(t + 0.31);
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
    gain.connect(this.outputNode);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Cartoony retro sci-fi radio wave transmission ping/chirp
   */
  public playRadioWavePing() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(2450, t + 0.12);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.outputNode);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * Cataclysmic Meteor impact shatter sound (deep seismic thud + glassy/metallic crack)
   */
  public playMeteorShatter(isCrystal: boolean = false) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Deep seismic impact boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(120, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.38);

    subGain.gain.setValueAtTime(0.35, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
    subOsc.connect(subGain);
    subGain.connect(this.outputNode);
    subOsc.start(t);
    subOsc.stop(t + 0.42);

    // Crackle / shatter transient
    const highOsc = this.ctx.createOscillator();
    const highGain = this.ctx.createGain();
    highOsc.type = isCrystal ? 'sine' : 'sawtooth';
    highOsc.frequency.setValueAtTime(isCrystal ? 1800 : 450, t);
    highOsc.frequency.exponentialRampToValueAtTime(isCrystal ? 600 : 80, t + 0.25);

    highGain.gain.setValueAtTime(0.22, t);
    highGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    highOsc.connect(highGain);
    highGain.connect(this.outputNode);
    highOsc.start(t);
    highOsc.stop(t + 0.30);
  }

  /**
   * Soft vintage radio crackle static with squelch and incoming planet sediment alert
   */
  public playRadioCrackleSedimentWarning() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Soft Bandpassed White Noise Radio Crackle with micro-dropouts
    const bufferSize = Math.floor(this.ctx.sampleRate * 1.8);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const pop = Math.random() < 0.04 ? (Math.random() - 0.5) * 1.4 : (Math.random() - 0.5) * 0.22;
      output[i] = pop;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, t);
    bandpass.Q.setValueAtTime(1.8, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, t);
    noiseGain.gain.linearRampToValueAtTime(0.08, t + 0.1);
    noiseGain.gain.setValueAtTime(0.06, t + 1.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

    whiteNoise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.outputNode);
    whiteNoise.start(t);
    whiteNoise.stop(t + 1.8);

    // 2. Comms Radio Chirp Beep (Squelch open & alert chime)
    const chirp = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(820, t + 0.05);
    chirp.frequency.setValueAtTime(1150, t + 0.15);
    chirpGain.gain.setValueAtTime(0.05, t + 0.05);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    chirp.connect(chirpGain);
    chirpGain.connect(this.outputNode);
    chirp.start(t + 0.05);
    chirp.stop(t + 0.36);

    // 3. Spoken Comms Transmission: "Warning - incoming planet sediment"
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Warning: incoming planet sediment');
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    }
  }

  /**
   * Resonant springy sci-fi rubbery boing sound for Bouncy Bubble Ball
   */
  public playBallBounce(strength: number = 1.0) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 160 + Math.min(200, strength * 15);
    osc.frequency.setValueAtTime(baseFreq * 0.75, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, t + 0.22);

    const vol = Math.min(0.28, 0.10 + strength * 0.02);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.outputNode);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}
