import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager';
import { InputManager } from './engine/InputManager';
import { AudioManager } from './engine/AudioManager';
import { Player } from './entities/Player';
import { ObstacleManager, ObstacleType, PickupType } from './level/Obstacles';
import { ParallaxLayers } from './level/ParallaxLayers';
import { LevelGenerator } from './level/LevelGenerator';
import { HUD } from './ui/HUD';
import { MeteorManager, MeteorType } from './entities/MeteorManager';

enum GameState {
  START,
  PLAYING,
  GAMEOVER
}

class Game {
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private audioManager: AudioManager;
  private player: Player;
  private obstacleManager: ObstacleManager;
  private parallaxLayers: ParallaxLayers;
  private levelGenerator: LevelGenerator;
  private hud: HUD;
  private meteorManager: MeteorManager;

  private state: GameState = GameState.START;
  private score: number = 0;
  private clock: THREE.Clock;

  // Settings & Customization
  private autoAimEnabled: boolean = true;
  private crtOverlayEnabled: boolean = true;
  private touchSize: 'compact' | 'normal' | 'large' = 'normal';
  private touchOpacity: number = 85;

  // Lock-on Target Tracking System
  private lockedEnemy: any = null;
  private lockOnMesh!: THREE.Group;

  constructor() {
    this.sceneManager = new SceneManager();
    this.inputManager = new InputManager();
    this.audioManager = new AudioManager();
    this.hud = new HUD();
    this.clock = new THREE.Clock();

    this.player = new Player(this.sceneManager.scene);
    this.player.onFootstep = () => this.audioManager.playFootstep();
    this.player.onShieldDeflect = () => this.audioManager.playShieldDeflect();
    this.player.onRadioTransmit = () => this.audioManager.playRadioWavePing();
    this.player.onBallBounce = (s) => this.audioManager.playBallBounce(s);
    this.obstacleManager = new ObstacleManager(this.sceneManager.scene);
    this.parallaxLayers = new ParallaxLayers(this.sceneManager.scene);
    this.levelGenerator = new LevelGenerator(this.obstacleManager, this.sceneManager.scene);
    this.meteorManager = new MeteorManager(this.sceneManager.scene);
    this.meteorManager.onSedimentWarning = () => {
      this.audioManager.playRadioCrackleSedimentWarning();
      this.hud.showRadioWarningBanner('WARNING — INCOMING PLANET SEDIMENT');
    };

    this.setupLockOnSystem();
    this.setupUIEvents();
    this.setupMainMenu();
    this.setupSettingsModal();
    this.setupControlsModal();
    this.showMainMenu();

    (window as any).__JETPACK_GAME__ = this;

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupUIEvents() {
    const camSlider = document.getElementById('slider-handheld') as HTMLInputElement;
    const camLabel = document.getElementById('label-handheld');
    if (camSlider && camLabel) {
      camSlider.addEventListener('input', () => {
        const val = parseInt(camSlider.value, 10);
        this.sceneManager.handheldIntensity = val / 100;
        camLabel.textContent = `${val}%`;
      });
    }

    const camBtn = document.getElementById('btn-handheld');
    if (camBtn) {
      camBtn.addEventListener('click', () => {
        const enabled = this.sceneManager.toggleHandheld();
        camBtn.textContent = enabled ? '🎥 ON [H]' : '🎥 OFF [H]';
      });
    }

    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const enabled = this.audioManager.toggle();
        audioBtn.textContent = enabled ? '🔊 SFX ON' : '🔇 SFX OFF';
      });
    }

    const shieldBtn = document.getElementById('btn-shield');
    if (shieldBtn) {
      shieldBtn.addEventListener('click', () => this.toggleForcefield());
    }

    const modeBtn = document.getElementById('btn-forcefield-mode');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => this.toggleForcefieldMode());
    }

    const touchShield = document.getElementById('btn-touch-shield');
    if (touchShield) {
      touchShield.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.toggleForcefield();
      });
    }

    const touchMode = document.getElementById('btn-touch-mode');
    if (touchMode) {
      touchMode.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.toggleForcefieldMode();
      });
    }

    this.updateForcefieldUI();

    const levelBtn = document.getElementById('btn-level');
    if (levelBtn) {
      levelBtn.addEventListener('click', () => {
        const nextLevel = (this.levelGenerator.currentLevel % 3) + 1;
        this.switchLevel(nextLevel);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyL') {
        const nextLevel = (this.levelGenerator.currentLevel % 3) + 1;
        this.switchLevel(nextLevel);
      }
    });

    (window as any).__game = this;
  }

  public showMainMenu() {
    this.state = GameState.START;
    const menuEl = document.getElementById('main-menu-overlay');
    if (menuEl) menuEl.classList.remove('hidden');
    const hudEl = document.getElementById('hud');
    if (hudEl) hudEl.style.display = 'none';
    const topCtrl = document.querySelector('.top-controls') as HTMLElement;
    if (topCtrl) topCtrl.style.display = 'none';
    const touchEl = document.getElementById('touch-controls');
    if (touchEl) touchEl.style.display = 'none';
    const reticleEl = document.getElementById('reticle');
    if (reticleEl) reticleEl.style.display = 'none';
    this.hud.hideOverlay();

    this.player.reset(0, -3.70);
    this.sceneManager.camera.position.set(0, -1.8, this.sceneManager.baseZ);
  }

  public hideMainMenu() {
    const menuEl = document.getElementById('main-menu-overlay');
    if (menuEl) menuEl.classList.add('hidden');
    const hudEl = document.getElementById('hud');
    if (hudEl) hudEl.style.display = '';
    const topCtrl = document.querySelector('.top-controls') as HTMLElement;
    if (topCtrl) topCtrl.style.display = '';
    const touchEl = document.getElementById('touch-controls');
    if (touchEl) touchEl.style.display = '';
    const reticleEl = document.getElementById('reticle');
    if (reticleEl) reticleEl.style.display = '';
  }

  public returnToMainMenu() {
    this.closeSettingsModal();
    this.closeControlsModal();
    this.hud.hideOverlay();
    this.showMainMenu();
  }

  private setupMainMenu() {
    const btnPlay = document.getElementById('menu-btn-play');
    if (btnPlay) {
      const startHandler = (e: Event) => {
        e.preventDefault();
        this.audioManager.playLaser();
        this.startGame();
      };
      btnPlay.addEventListener('click', startHandler);
      btnPlay.addEventListener('touchstart', startHandler, { passive: false });
    }

    const btnOptions = document.getElementById('menu-btn-options');
    if (btnOptions) {
      btnOptions.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSettingsModal();
      });
    }

    const btnControls = document.getElementById('menu-btn-controls');
    if (btnControls) {
      btnControls.addEventListener('click', (e) => {
        e.preventDefault();
        this.openControlsModal();
      });
    }

    const btnExit = document.getElementById('menu-btn-exit');
    if (btnExit) {
      btnExit.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Reboot Jones Navigation System?')) {
          window.location.reload();
        }
      });
    }
  }

  public openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('hidden');
    this.updateSettingsUI();
  }

  public closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
  }

  public openControlsModal() {
    const modal = document.getElementById('controls-modal');
    if (modal) modal.classList.remove('hidden');
  }

  public closeControlsModal() {
    const modal = document.getElementById('controls-modal');
    if (modal) modal.classList.add('hidden');
  }

  private updateSettingsUI() {
    // 1. Audio
    const optAudioToggle = document.getElementById('opt-audio-toggle');
    if (optAudioToggle) {
      optAudioToggle.textContent = this.audioManager.enabled ? '🔊 ENABLED' : '🔇 MUTED';
      optAudioToggle.classList.toggle('active', this.audioManager.enabled);
    }
    const optAudioVol = document.getElementById('opt-audio-volume') as HTMLInputElement;
    const optAudioVolBadge = document.getElementById('opt-audio-volume-badge');
    if (optAudioVol && optAudioVolBadge) {
      const pct = Math.round(this.audioManager.masterVolume * 100);
      optAudioVol.value = pct.toString();
      optAudioVolBadge.textContent = `${pct}%`;
    }

    // 2. Targeting Assist
    const optAutoaim = document.getElementById('opt-autoaim-toggle');
    if (optAutoaim) {
      optAutoaim.textContent = this.autoAimEnabled ? '🎯 ON' : '⭕ OFF';
      optAutoaim.classList.toggle('active', this.autoAimEnabled);
    }

    // 3. Touch Size
    const btnCompact = document.getElementById('opt-touch-size-compact');
    const btnNormal = document.getElementById('opt-touch-size-normal');
    const btnLarge = document.getElementById('opt-touch-size-large');
    if (btnCompact && btnNormal && btnLarge) {
      btnCompact.classList.toggle('active', this.touchSize === 'compact');
      btnNormal.classList.toggle('active', this.touchSize === 'normal');
      btnLarge.classList.toggle('active', this.touchSize === 'large');
    }

    // Touch Opacity
    const optTouchOp = document.getElementById('opt-touch-opacity') as HTMLInputElement;
    const optTouchOpBadge = document.getElementById('opt-touch-opacity-badge');
    if (optTouchOp && optTouchOpBadge) {
      optTouchOp.value = this.touchOpacity.toString();
      optTouchOpBadge.textContent = `${this.touchOpacity}%`;
    }

    // 4. Graphics & Cam
    const optCamToggle = document.getElementById('opt-cam-toggle');
    if (optCamToggle) {
      optCamToggle.textContent = this.sceneManager.handheldEnabled ? '🎥 ON' : '🎥 OFF';
      optCamToggle.classList.toggle('active', this.sceneManager.handheldEnabled);
    }
    const optCamIntensity = document.getElementById('opt-cam-intensity') as HTMLInputElement;
    const optCamIntensityBadge = document.getElementById('opt-cam-intensity-badge');
    if (optCamIntensity && optCamIntensityBadge) {
      const pct = Math.round(this.sceneManager.handheldIntensity * 100);
      optCamIntensity.value = pct.toString();
      optCamIntensityBadge.textContent = `${pct}%`;
    }

    const optCrtToggle = document.getElementById('opt-crt-toggle');
    if (optCrtToggle) {
      optCrtToggle.textContent = this.crtOverlayEnabled ? '📺 ON' : '📺 OFF';
      optCrtToggle.classList.toggle('active', this.crtOverlayEnabled);
    }

    // 5. Level
    const optLevelBtn = document.getElementById('opt-level-btn');
    if (optLevelBtn) {
      const lvl = this.levelGenerator.currentLevel;
      if (lvl === 1) optLevelBtn.textContent = '🏭 LEVEL 1: INDUSTRIAL';
      else if (lvl === 2) optLevelBtn.textContent = '🪐 LEVEL 2: ALIEN WORLD';
      else optLevelBtn.textContent = '🔴 LEVEL 3: DESOLATE MARS';
    }
  }

  private setupSettingsModal() {
    // Top Bar Settings Button
    const btnTopSettings = document.getElementById('btn-top-settings');
    if (btnTopSettings) {
      btnTopSettings.addEventListener('click', () => this.openSettingsModal());
    }

    // Close buttons
    const btnClose = document.getElementById('btn-close-settings');
    if (btnClose) btnClose.addEventListener('click', () => this.closeSettingsModal());
    const btnSaveClose = document.getElementById('opt-btn-save-close');
    if (btnSaveClose) btnSaveClose.addEventListener('click', () => this.closeSettingsModal());

    // Return to main menu
    const btnMainMenu = document.getElementById('opt-btn-main-menu');
    if (btnMainMenu) {
      btnMainMenu.addEventListener('click', () => this.returnToMainMenu());
    }

    // Audio SFX toggle
    const optAudioToggle = document.getElementById('opt-audio-toggle');
    if (optAudioToggle) {
      optAudioToggle.addEventListener('click', () => {
        const enabled = this.audioManager.toggle();
        const topAudio = document.getElementById('btn-audio');
        if (topAudio) topAudio.textContent = enabled ? '🔊 SFX ON' : '🔇 SFX OFF';
        this.updateSettingsUI();
      });
    }

    // Audio volume slider
    const optAudioVol = document.getElementById('opt-audio-volume') as HTMLInputElement;
    if (optAudioVol) {
      optAudioVol.addEventListener('input', () => {
        const val = parseInt(optAudioVol.value, 10);
        this.audioManager.setVolume(val / 100);
        const badge = document.getElementById('opt-audio-volume-badge');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    // Auto-Aim Assist Toggle
    const optAutoaim = document.getElementById('opt-autoaim-toggle');
    if (optAutoaim) {
      optAutoaim.addEventListener('click', () => {
        this.autoAimEnabled = !this.autoAimEnabled;
        this.updateSettingsUI();
      });
    }

    // Touch Button Sizes
    const touchControls = document.getElementById('touch-controls');
    const setTouchSize = (size: 'compact' | 'normal' | 'large') => {
      this.touchSize = size;
      if (touchControls) {
        touchControls.classList.remove('touch-size-compact', 'touch-size-large');
        if (size === 'compact') touchControls.classList.add('touch-size-compact');
        if (size === 'large') touchControls.classList.add('touch-size-large');
      }
      this.updateSettingsUI();
    };

    document.getElementById('opt-touch-size-compact')?.addEventListener('click', () => setTouchSize('compact'));
    document.getElementById('opt-touch-size-normal')?.addEventListener('click', () => setTouchSize('normal'));
    document.getElementById('opt-touch-size-large')?.addEventListener('click', () => setTouchSize('large'));

    // Touch Opacity Slider
    const optTouchOp = document.getElementById('opt-touch-opacity') as HTMLInputElement;
    if (optTouchOp) {
      optTouchOp.addEventListener('input', () => {
        const val = parseInt(optTouchOp.value, 10);
        this.touchOpacity = val;
        if (touchControls) {
          touchControls.style.opacity = (val / 100).toString();
        }
        const badge = document.getElementById('opt-touch-opacity-badge');
        if (badge) badge.textContent = `${val}%`;
      });
    }

    // Handheld Cam Sway Toggle
    const optCamToggle = document.getElementById('opt-cam-toggle');
    if (optCamToggle) {
      optCamToggle.addEventListener('click', () => {
        const enabled = this.sceneManager.toggleHandheld();
        const topCam = document.getElementById('btn-handheld');
        if (topCam) topCam.textContent = enabled ? '🎥 ON [H]' : '🎥 OFF [H]';
        this.updateSettingsUI();
      });
    }

    // Handheld Cam Intensity Slider
    const optCamIntensity = document.getElementById('opt-cam-intensity') as HTMLInputElement;
    if (optCamIntensity) {
      optCamIntensity.addEventListener('input', () => {
        const val = parseInt(optCamIntensity.value, 10);
        this.sceneManager.handheldIntensity = val / 100;
        const badge = document.getElementById('opt-cam-intensity-badge');
        if (badge) badge.textContent = `${val}%`;
        const topSlider = document.getElementById('slider-handheld') as HTMLInputElement;
        const topLabel = document.getElementById('label-handheld');
        if (topSlider) topSlider.value = val.toString();
        if (topLabel) topLabel.textContent = `${val}%`;
      });
    }

    // CRT Scanlines Toggle
    const optCrtToggle = document.getElementById('opt-crt-toggle');
    if (optCrtToggle) {
      optCrtToggle.addEventListener('click', () => {
        this.crtOverlayEnabled = !this.crtOverlayEnabled;
        const crt = document.querySelector('.crt-overlay') as HTMLElement;
        if (crt) crt.style.display = this.crtOverlayEnabled ? 'block' : 'none';
        this.updateSettingsUI();
      });
    }

    // Fullscreen Toggle
    const optFsBtn = document.getElementById('opt-fullscreen-btn');
    if (optFsBtn) {
      optFsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Level Select in Settings
    const optLevelBtn = document.getElementById('opt-level-btn');
    if (optLevelBtn) {
      optLevelBtn.addEventListener('click', () => {
        const next = (this.levelGenerator.currentLevel % 3) + 1;
        this.switchLevel(next);
        this.updateSettingsUI();
      });
    }
  }

  private setupControlsModal() {
    const btnClose = document.getElementById('btn-close-controls');
    if (btnClose) btnClose.addEventListener('click', () => this.closeControlsModal());
    const btnOk = document.getElementById('btn-controls-ok');
    if (btnOk) btnOk.addEventListener('click', () => this.closeControlsModal());
  }

  public switchLevel(lvl: number) {
    this.sceneManager.setLevel(lvl);
    this.levelGenerator.setLevel(lvl);
    this.parallaxLayers.setLevel(lvl);
    this.player.isIsometric = false;
    this.player.reset(0, -3.70, 0);
    this.score = 0;

    const levelBtn = document.getElementById('btn-level');
    if (levelBtn) {
      if (lvl === 1) {
        levelBtn.textContent = '🪐 LEVEL 2: ALIEN [L]';
        levelBtn.style.color = '#39ff14';
        levelBtn.style.borderColor = '#39ff14';
      } else if (lvl === 2) {
        levelBtn.textContent = '🔴 LEVEL 3: MARS [L]';
        levelBtn.style.color = '#ff6633';
        levelBtn.style.borderColor = '#ff6633';
      } else {
        levelBtn.textContent = '🏭 LEVEL 1: COMPLEX [L]';
        levelBtn.style.color = '#ffaa00';
        levelBtn.style.borderColor = '#ffaa00';
      }
    }

    const optLevelBtn = document.getElementById('opt-level-btn');
    if (optLevelBtn) {
      if (lvl === 1) optLevelBtn.textContent = '🏭 LEVEL 1: INDUSTRIAL';
      else if (lvl === 2) optLevelBtn.textContent = '🪐 LEVEL 2: ALIEN WORLD';
      else optLevelBtn.textContent = '🔴 LEVEL 3: DESOLATE MARS';
    }

    let levelName = 'INDUSTRIAL COMPLEX';
    if (lvl === 2) levelName = 'PLANET XYLOS (ALIEN WORLD)';
    if (lvl === 3) levelName = 'DESOLATE MARS (RED PLANET)';
    this.showUpgradeBanner(`★ SWITCHED TO ${levelName} ★`);
  }

  private showUpgradeBanner(msg: string) {
    let banner = document.getElementById('hud-upgrade-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'hud-upgrade-banner';
      banner.style.position = 'fixed';
      banner.style.top = '72px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.background = 'rgba(0, 18, 25, 0.94)';
      banner.style.border = '2px solid #00f5ff';
      banner.style.boxShadow = '0 0 25px rgba(0, 245, 255, 0.7)';
      banner.style.color = '#00f5ff';
      banner.style.padding = '12px 24px';
      banner.style.fontFamily = "'Press Start 2P', monospace";
      banner.style.fontSize = '12px';
      banner.style.zIndex = '250';
      banner.style.borderRadius = '8px';
      banner.style.textAlign = 'center';
      banner.style.pointerEvents = 'none';
      banner.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      document.body.appendChild(banner);
    }
    banner.textContent = msg;
    banner.style.opacity = '1';
    banner.style.transform = 'translateX(-50%) scale(1.05)';
    setTimeout(() => {
      if (banner) {
        banner.style.opacity = '0';
        banner.style.transform = 'translateX(-50%) scale(0.9)';
      }
    }, 3200);
  }

  private startGame() {
    this.hideMainMenu();
    this.state = GameState.PLAYING;
    this.score = 0;
    this.player.reset(0, -3.70); // Start in idle on solid ground
    this.levelGenerator.reset(0);
    this.meteorManager.reset();
  }

  private updateForcefieldUI() {
    const active = this.player.shieldActive;
    const mode = this.player.forcefieldMode;
    const shieldBtn = document.getElementById('btn-shield');
    if (shieldBtn) {
      shieldBtn.textContent = active ? '⚡ FORCEFIELD: ON [B]' : '🛡️ FORCEFIELD: OFF [B]';
      shieldBtn.style.color = active ? '#00f5ff' : '#aaa';
      shieldBtn.style.borderColor = active ? '#00f5ff' : '#666';
    }
    const modeBtn = document.getElementById('btn-forcefield-mode');
    if (modeBtn) {
      modeBtn.textContent = mode === 'ball' ? 'MODE: ⚽ BALL' : 'MODE: 🛡️ BUBBLE';
      modeBtn.style.color = mode === 'ball' ? '#ffaa00' : '#00f5ff';
      modeBtn.style.borderColor = mode === 'ball' ? '#ffaa00' : '#00f5ff';
    }
    const touchShield = document.getElementById('btn-touch-shield');
    if (touchShield) {
      touchShield.style.background = active
        ? 'radial-gradient(circle at 35% 35%, rgba(0, 245, 255, 0.8), rgba(0, 50, 100, 0.9))'
        : '';
      touchShield.style.borderColor = active ? '#00f5ff' : '';
    }
    const touchMode = document.getElementById('btn-touch-mode');
    if (touchMode) {
      const span = touchMode.querySelector('span');
      if (span) span.textContent = mode === 'ball' ? 'BALL' : 'BUBBLE';
    }
  }

  private toggleForcefield() {
    const active = this.player.toggleShield();
    this.audioManager.playShieldToggle(active);
    this.updateForcefieldUI();
  }

  private toggleForcefieldMode() {
    this.player.toggleForcefieldMode();
    this.audioManager.playShieldToggle(this.player.shieldActive);
    this.updateForcefieldUI();
  }

  private onGameOver() {
    this.state = GameState.GAMEOVER;
    this.audioManager.setJetpackThrust(false);
    this.audioManager.playExplosion();
    this.sceneManager.triggerShake(0.5, 0.4);
    this.hud.showGameOver(
      this.score,
      () => this.startGame(),
      () => this.returnToMainMenu()
    );
  }

  private loop(currentTime: number) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const totalTime = this.clock.getElapsedTime();

    this.inputManager.update();
    // Project mouse cursor to 3D world plane
    this.inputManager.updateAimWorldTarget(
      this.sceneManager.camera,
      this.player.position.y
    );
    // Update Smart Target Lock-On System
    this.updateLockOnSystem(dt, totalTime);

    if (this.state === GameState.PLAYING) {
      // 1. Process 360° Shoot Trigger
      if (this.inputManager.consumeShootTrigger()) {
        const fired = this.player.shoot(
          this.autoAimEnabled && this.lockedEnemy
            ? this.inputManager.mouseWorldTarget
            : (this.inputManager.hasMouse ? this.inputManager.mouseWorldTarget : undefined)
        );
        if (fired) {
          this.audioManager.playLaser();
          this.sceneManager.triggerShake(0.08, 0.08); // Satisfying gun recoil shake
        }
      }

      // Handheld Camera Toggle ([H] key)
      if (this.inputManager.consumeHandheldToggleTrigger()) {
        const enabled = this.sceneManager.toggleHandheld();
        const camBtn = document.getElementById('btn-handheld');
        if (camBtn) camBtn.textContent = enabled ? '🎥 CAM: ON [H]' : '🎥 CAM: OFF [H]';
      }

      // Force Field Toggle ([B] key)
      if (this.inputManager.consumeShieldTrigger()) {
        this.toggleForcefield();
      }

      // 2. Audio Jetpack Thruster Sound
      const isJetpacking = this.inputManager.jetpack && this.player.fuel > 0;
      this.audioManager.setJetpackThrust(isJetpacking);

      if (this.player.fuel < 18 && this.player.fuel > 0 && Math.sin(totalTime * 8) > 0.8) {
        this.audioManager.playWarning();
      }

      // 3. Update Player Entity
      const jumpPressed = this.inputManager.consumeJumpTrigger();
      const platforms = this.obstacleManager.getPlatforms();

      // Determine if Jones is under fire or under pressure for antennae radio signals
      const underPressure =
        this.player.life < 55 ||
        this.player.invulnerableTime > 0 ||
        this.obstacleManager.drones.some(
          d => d.active && Math.hypot(d.position.x - this.player.position.x, d.position.y - this.player.position.y) < 10.0
        );

      this.player.update(
        dt,
        this.inputManager.moveX,
        this.inputManager.run,
        jumpPressed,
        this.inputManager.jetpack,
        platforms,
        this.inputManager.mouseWorldTarget,
        this.inputManager.hasMouse,
        this.inputManager.crouch,
        underPressure
      );

      // Update Falling Meteor & Shatter Shrapnel System
      this.meteorManager.update(
        dt,
        this.player,
        this.obstacleManager,
        (type) => this.audioManager.playMeteorShatter(type === MeteorType.CRYSTAL)
      );

      // 4. Update Level & Obstacles & Alien Enemies
      this.levelGenerator.update(this.player.position.x);
      this.obstacleManager.update(dt, totalTime, this.player.position.x, this.player.position.y);
      this.parallaxLayers.update(this.player.position.x, this.player.position.y, totalTime);

      // 5. Collision Checks
      this.checkCollisions(dt);

      // 6. Score tracking
      if (this.player.position.x * 10 > this.score) {
        this.score = Math.floor(this.player.position.x * 10);
      }

      // 7. Check Player Death Animation & Game Over Transition
      if (this.player.isDying) {
        this.audioManager.setJetpackThrust(false);
      }
      if (this.player.isDead) {
        this.onGameOver();
      }
    } else {
      // Idle scene animation on start screen
      this.parallaxLayers.update(0, -3.70, totalTime);
      this.obstacleManager.update(dt, totalTime, 0, 0);
      const platforms = this.obstacleManager.getPlatforms();
      this.player.update(
        dt,
        0,
        false,
        false,
        false,
        platforms,
        this.inputManager.mouseWorldTarget,
        this.inputManager.hasMouse
      );
    }

    // 8. Update Camera with unrestricted tracking & screen shake
    this.sceneManager.updateCamera(this.player.position.x, this.player.position.y, dt);
    this.hud.update(this.score, this.player.life, this.player.fuel);

    // 9. Render Frame
    this.sceneManager.render();
  }

  private checkCollisions(dt: number = 0.016) {
    const pPos = this.player.position;
    const pCenterY = pPos.y + 1.0;
    const pRadius = 0.45;
    const platforms = this.obstacleManager.getPlatforms();

    // A. Player vs Mechanical Obstacles (Gears, Pistons, Tubes)
    for (const obs of this.obstacleManager.obstacles) {
      if (!obs.active) continue;
      if (obs.type === ObstacleType.HAZARD_PLATFORM) continue;

      let hit = false;
      const obsPos = obs.group.position;

      // Cover Barriers are in platforms list (getPlatforms), so player lands & walks on them natively
      if (obs.type === ObstacleType.COVER_BARRIER) {
        continue;
      } else if (obs.type === ObstacleType.LASER_GATE) {
        const half = obs.collider.halfSize || new THREE.Vector2(1.3, 1.2);
        const center = obs.collider.center || new THREE.Vector2(obsPos.x, obsPos.y + 1.2);

        const gateMinX = center.x - half.x;
        const gateMaxX = center.x + half.x;
        const gateMinY = center.y - half.y;
        const gateMaxY = center.y + half.y;

        const playerMinX = pPos.x - 0.30;
        const playerMaxX = pPos.x + 0.30;
        const playerMinY = pPos.y;
        const playerMaxY = pPos.y + 1.85;

        const overlapX = playerMinX <= gateMaxX && playerMaxX >= gateMinX;
        const overlapY = playerMinY <= gateMaxY && playerMaxY >= gateMinY;

        if (overlapX && overlapY) {
          if (this.player.invulnerableTime <= 0) {
            const knockX = pPos.x < center.x ? -1 : 1;
            this.player.takeDamage(20, knockX);
            this.audioManager.playHitImpact();
            this.sceneManager.triggerShake(0.35, 0.20);
          }
          // Wall barrier blocks horizontal walking - force player to fly over!
          if (pPos.x < center.x) {
            pPos.x = gateMinX - 0.32;
            this.player.velocity.x = Math.min(0, this.player.velocity.x);
          } else {
            pPos.x = gateMaxX + 0.32;
            this.player.velocity.x = Math.max(0, this.player.velocity.x);
          }
          continue;
        }
      } else if (obs.type === ObstacleType.PISTON) {
        // ACCURATE PISTON / MECHANICAL PRESS COLLISION
        // Only the downward crushing hammer kills/damages the player; player can land safely on top!
        const half = obs.collider.halfSize || new THREE.Vector2(0.9, 0.45);
        const center = obs.collider.center || new THREE.Vector2(obsPos.x, obsPos.y);

        const hammerMinX = center.x - half.x;
        const hammerMaxX = center.x + half.x;
        const hammerMinY = center.y - half.y;
        const hammerMaxY = center.y + half.y;

        const playerMinX = pPos.x - 0.35;
        const playerMaxX = pPos.x + 0.35;
        const playerMinY = pPos.y;
        const playerMaxY = pPos.y + (this.player.isCrouching ? 1.10 : 1.85);

        const overlapX = playerMinX <= hammerMaxX && playerMaxX >= hammerMinX;
        const overlapY = playerMinY <= hammerMaxY && playerMaxY >= hammerMinY;

        if (overlapX && overlapY) {
          // If player landed safely on top surface of hammer and is not squashed from above
          if (playerMinY >= hammerMaxY - 0.20 && !obs.isCrushing) {
            pPos.y = hammerMaxY;
            this.player.velocity.y = Math.max(0, this.player.velocity.y);
            this.player.isGrounded = true;
            continue;
          }

          if (this.player.invulnerableTime <= 0) {
            const knockX = pPos.x < center.x ? -1 : 1;
            this.player.crushHit(35, knockX);
            this.audioManager.playCrushHit();
            this.sceneManager.triggerShake(0.50, 0.32);
          }
          continue;
        }
      } else if (obs.type === ObstacleType.SKY_MAZE_WALL) {
        // DEADLY SKY MAZE WALL: Instant death upon contact with any maze wall!
        const half = obs.collider.halfSize || new THREE.Vector2(0.5, 0.5);
        const center = obs.collider.center || new THREE.Vector2(obsPos.x, obsPos.y);

        const wallMinX = center.x - half.x;
        const wallMaxX = center.x + half.x;
        const wallMinY = center.y - half.y;
        const wallMaxY = center.y + half.y;

        const playerMinX = pPos.x - 0.32;
        const playerMaxX = pPos.x + 0.32;
        const playerMinY = pPos.y;
        const playerMaxY = pPos.y + (this.player.isCrouching ? 1.10 : 1.85);

        const overlapX = playerMinX <= wallMaxX && playerMaxX >= wallMinX;
        const overlapY = playerMinY <= wallMaxY && playerMaxY >= wallMinY;

        if (overlapX && overlapY) {
          if (!this.player.isDying) {
            this.player.shieldActive = false; // Overwhelms forcefield
            this.player.life = 0;
            const knockX = pPos.x < center.x ? -1 : 1;
            this.player.triggerDeath(knockX);
            this.audioManager.playExplosion();
            this.audioManager.playHitImpact();
            this.sceneManager.triggerShake(0.70, 0.45);
          }
          continue;
        }
      } else if (obs.collider.type === 'circle') {
        const distSq = (pPos.x - obsPos.x) ** 2 + (pCenterY - obsPos.y) ** 2;
        const totalRadius = pRadius + (obs.collider.radius || 1.0);
        if (distSq < totalRadius * totalRadius) {
          hit = true;
        }
      } else if (obs.collider.type === 'box') {
        const half = obs.collider.halfSize || new THREE.Vector2(1, 1);
        const center = obs.collider.center || new THREE.Vector2(obsPos.x, obsPos.y);
        const minX = center.x - half.x;
        const maxX = center.x + half.x;
        const minY = center.y - half.y;
        const maxY = center.y + half.y;

        const closestX = Math.max(minX, Math.min(pPos.x, maxX));
        const closestY = Math.max(minY, Math.min(pCenterY, maxY));
        const distSq = (pPos.x - closestX) ** 2 + (pCenterY - closestY) ** 2;

        if (distSq < pRadius * pRadius) {
          hit = true;
        }
      }

      if (hit) {
        // Push player outside solid obstacle so player CANNOT intersect with it
        if (obs.collider.type === 'box') {
          const half = obs.collider.halfSize || new THREE.Vector2(1, 1);
          const center = obs.collider.center || new THREE.Vector2(obsPos.x, obsPos.y);
          if (pPos.x < center.x) {
            this.player.position.x = center.x - half.x - 0.35;
          } else {
            this.player.position.x = center.x + half.x + 0.35;
          }
          this.player.velocity.x = 0;
        }

        if (this.player.invulnerableTime <= 0) {
          const knockX = obsPos.x > pPos.x ? -1 : 1;
          this.player.takeDamage(25, knockX);
          this.audioManager.playHitImpact();
          this.sceneManager.triggerShake(0.38, 0.28);
        }
      }
    }

    // B. Player vs Alien Blob Enemies & Flying Drones
    for (const enemy of this.obstacleManager.enemies) {
      if (!enemy.active) continue;

      const distSq = (pPos.x - enemy.position.x) ** 2 + (pCenterY - (enemy.position.y + 0.4)) ** 2;
      const combinedRadius = pRadius + enemy.radius;

      if (distSq < combinedRadius * combinedRadius) {
        if (this.player.invulnerableTime <= 0) {
          const knockX = enemy.position.x > pPos.x ? -1 : 1;
          this.player.takeDamage(20, knockX);
          this.audioManager.playHitImpact();
          this.sceneManager.triggerShake(0.32, 0.22);
          enemy.velocity.x = (enemy.position.x > pPos.x ? 1 : -1) * 4.0;
        }
      }
    }

    // Drone Bots vs Player (Body collision & Red Laser Bolts)
    for (const drone of this.obstacleManager.drones) {
      if (!drone.active) continue;

      // Drone Body vs Player
      const distSq = (pPos.x - drone.position.x) ** 2 + (pCenterY - drone.position.y) ** 2;
      if (distSq < (pRadius + drone.radius) ** 2) {
        if (this.player.invulnerableTime <= 0) {
          const knockX = drone.position.x > pPos.x ? -1 : 1;
          this.player.takeDamage(15, knockX);
          this.audioManager.playHitImpact();
          this.sceneManager.triggerShake(0.30, 0.20);
        }
      }

      // Drone Red Lasers vs Platforms, Ground, Crates, Cover Barriers, and Player (Tight Bounding Radius)
      for (const rLaser of drone.lasers) {
        if (!rLaser.active) continue;

        const rR = 0.05; // Tight, accurate bullet radius

        // 1. Check against Solid Platforms
        let hitSolid = false;
        for (const plat of platforms) {
          const platHalfW = plat.width / 2;
          const platHalfH = plat.height / 2;
          if (
            rLaser.position.x + rR >= plat.x - platHalfW &&
            rLaser.position.x - rR <= plat.x + platHalfW &&
            rLaser.position.y + rR >= plat.y - platHalfH &&
            rLaser.position.y - rR <= plat.y + platHalfH
          ) {
            hitSolid = true;
            break;
          }
        }

        // 2. Check against Ground Floor
        if (!hitSolid && rLaser.position.y <= -3.70) {
          hitSolid = true;
        }

        // 3. Check against Supply Crates
        if (!hitSolid) {
          for (const crate of this.obstacleManager.crates) {
            if (!crate.active || crate.isDestroyed) continue;
            if (
              rLaser.position.x + rR >= crate.position.x - crate.halfW &&
              rLaser.position.x - rR <= crate.position.x + crate.halfW &&
              rLaser.position.y + rR >= crate.position.y - crate.halfH &&
              rLaser.position.y - rR <= crate.position.y + crate.halfH
            ) {
              hitSolid = true;
              crate.takeDamage(1, Math.sign(rLaser.velocity.x) || 1);
              break;
            }
          }
        }

        // 4. Check against Cover Barriers & Level Obstacles (Tactical Cover Block)
        if (!hitSolid) {
          for (const obs of this.obstacleManager.obstacles) {
            if (!obs.active) continue;
            if (obs.type === ObstacleType.HAZARD_PLATFORM) continue;
            
            if (obs.type === ObstacleType.GEAR) {
              const gDistSq = (rLaser.position.x - obs.group.position.x) ** 2 + (rLaser.position.y - obs.group.position.y) ** 2;
              const gRadius = obs.collider.radius || 2.2;
              if (gDistSq <= gRadius * gRadius) {
                hitSolid = true;
                break;
              }
            } else if (
              obs.type === ObstacleType.COVER_BARRIER ||
              obs.type === ObstacleType.LASER_GATE ||
              obs.type === ObstacleType.PISTON ||
              obs.type === ObstacleType.SKY_MAZE_WALL
            ) {
              const half = obs.collider.halfSize || new THREE.Vector2(0.8, 0.625);
              const center = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y + half.y);
              if (
                rLaser.position.x + rR >= center.x - half.x &&
                rLaser.position.x - rR <= center.x + half.x &&
                rLaser.position.y + rR >= center.y - half.y &&
                rLaser.position.y - rR <= center.y + half.y
              ) {
                hitSolid = true;
                break;
              }
            }
          }
        }

        if (hitSolid) {
          this.obstacleManager.spawnBulletImpact(rLaser.position.x, rLaser.position.y, drone.isAlien ? 0x39ff14 : 0xff2222);
          this.player.emitSparks(rLaser.position.x, rLaser.position.y, 0, 6);
          rLaser.active = false;
          rLaser.mesh.visible = false;
          continue;
        }

        // 5. Red Laser vs Player (takes crouch height & Bubble Force Field Ricochet into account)
        const playerCurrentHeight = this.player.isCrouching ? 1.10 : 1.85;
        const playerCenterY = pPos.y + playerCurrentHeight / 2;

        // BUBBLE FORCE FIELD: Ricochets & Deflects Bullets Away on Contact!
        if (this.player.shieldActive) {
          const shieldCenterY = pPos.y + (this.player.isCrouching ? 0.70 : 1.05);
          const sDistSq = (pPos.x - rLaser.position.x) ** 2 + (shieldCenterY - rLaser.position.y) ** 2;
          const shieldRadius = 1.65;

          if (sDistSq <= shieldRadius * shieldRadius) {
            // Calculate outward normal from bubble center to impact point
            const dist = Math.sqrt(sDistSq) || 1;
            const normX = (rLaser.position.x - pPos.x) / dist;
            const normY = (rLaser.position.y - shieldCenterY) / dist;

            // Reflect bullet velocity vector: v = v - 2*(v·n)*n with bounce boost
            const dot = rLaser.velocity.x * normX + rLaser.velocity.y * normY;
            rLaser.velocity.x = (rLaser.velocity.x - 2 * dot * normX) * 1.30 + (Math.random() - 0.5) * 3.5;
            rLaser.velocity.y = (rLaser.velocity.y - 2 * dot * normY) * 1.30 + (Math.random() - 0.5) * 3.5;

            // Push bullet outside shield boundary
            rLaser.position.x = pPos.x + normX * (shieldRadius + 0.15);
            rLaser.position.y = shieldCenterY + normY * (shieldRadius + 0.15);
            rLaser.mesh.position.copy(rLaser.position);
            rLaser.mesh.rotation.z = Math.atan2(rLaser.velocity.y, rLaser.velocity.x);

            // Trigger dazzling ricochet sparks and deflect effects
            this.player.takeDamage(0, normX > 0 ? -1 : 1);
            this.player.emitSparks(rLaser.position.x, rLaser.position.y, 0, 8);
            this.obstacleManager.spawnBulletImpact(rLaser.position.x, rLaser.position.y, 0x00ffff);
            this.audioManager.playShieldDeflect();
            this.sceneManager.triggerShake(0.18, 0.12);
            continue;
          }
        }

        const lDistSq = (pPos.x - rLaser.position.x) ** 2 + (playerCenterY - rLaser.position.y) ** 2;
        const hitRadius = this.player.isCrouching ? 0.38 : 0.48;

        if (lDistSq < hitRadius * hitRadius) {
          rLaser.active = false;
          rLaser.mesh.visible = false;

          if (this.player.invulnerableTime <= 0) {
            const knockX = rLaser.velocity.x > 0 ? 1 : -1;
            this.player.takeDamage(20, knockX);
            this.audioManager.playHitImpact();
            this.sceneManager.triggerShake(0.35, 0.24);
          }
        }
      }
    }

    // Interactive Physics Supply Crates vs Player (Smooth Horizontal Push Momentum)
    for (const crate of this.obstacleManager.crates) {
      if (!crate.active || crate.isDestroyed) continue;
      const dx = pPos.x - crate.position.x;
      const overlapX = (pRadius + crate.halfW) - Math.abs(dx);

      // Only push horizontally when beside the crate, never when standing smoothly on top
      if (overlapX > 0 && pPos.y < crate.position.y + crate.halfH - 0.16 && pPos.y + 1.85 > crate.position.y - crate.halfH) {
        const pushDir = Math.sign(dx) || 1;
        if (pushDir < 0) {
          pPos.x = crate.position.x - (pRadius + crate.halfW);
          crate.velocity.x += Math.max(1.8, Math.abs(this.player.velocity.x) * 0.85);
        } else {
          pPos.x = crate.position.x + (pRadius + crate.halfW);
          crate.velocity.x -= Math.max(1.8, Math.abs(this.player.velocity.x) * 0.85);
        }
        this.player.velocity.x *= 0.55;
      }
    }

    // C. Lasers in 360° vs Destructible Obstacles, Alien Blobs & Flying Drones
    for (const laser of this.player.lasers) {
      if (!laser.active) continue;

      // 1. Check against Alien Blob Enemies
      for (const enemy of this.obstacleManager.enemies) {
        if (!enemy.active) continue;

        const distSq = (laser.position.x - enemy.position.x) ** 2 + (laser.position.y - (enemy.position.y + 0.4)) ** 2;
        if (distSq < (enemy.radius + 0.2) ** 2) {
          this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
          laser.active = false;
          laser.mesh.visible = false;
          this.audioManager.playEnemyImpact();
          const died = enemy.takeDamage(1);
          this.sceneManager.triggerShake(0.20, 0.14);

          if (died) {
            this.audioManager.playAlienSquish();
            this.sceneManager.triggerShake(0.35, 0.22);
            this.score += 300;
          }
          break;
        }
      }

      if (!laser.active) continue;

      // 2. Check against Flying Attack Drone Bots
      for (const drone of this.obstacleManager.drones) {
        if (!drone.active) continue;

        const distSq = (laser.position.x - drone.position.x) ** 2 + (laser.position.y - drone.position.y) ** 2;
        if (distSq < (drone.radius + 0.28) ** 2) {
          this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
          laser.active = false;
          laser.mesh.visible = false;
          this.audioManager.playEnemyImpact();
          const died = drone.takeDamage(1);
          this.sceneManager.triggerShake(0.22, 0.16);

          if (died) {
            this.audioManager.playExplosion();
            this.sceneManager.triggerShake(0.38, 0.26);
            this.score += 350;
            if (this.lockedEnemy === drone) {
              this.lockedEnemy = null;
              if (this.lockOnMesh) this.lockOnMesh.visible = false;
              document.getElementById('reticle')?.classList.remove('locked');
            }
          }
          break;
        }
      }

      if (!laser.active) continue;

      // 3. Check against Physics Supply Crates (Tight Bounding Box)
      for (const crate of this.obstacleManager.crates) {
        if (!crate.active || crate.isDestroyed) continue;

        if (
          Math.abs(laser.position.x - crate.position.x) < crate.halfW + 0.05 &&
          Math.abs(laser.position.y - crate.position.y) < crate.halfH + 0.05
        ) {
          this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
          laser.active = false;
          laser.mesh.visible = false;
          this.audioManager.playEnemyImpact();
          const destroyed = crate.takeDamage(1, Math.sign(laser.velocity.x) || 1);
          this.sceneManager.triggerShake(0.18, 0.12);

          if (destroyed) {
            this.audioManager.playExplosion();
            this.sceneManager.triggerShake(0.32, 0.20);
            this.score += 200;
          }
          break;
        }
      }

      if (!laser.active) continue;

      // 4. Check against Destructible Obstacles & Alien Plants (Tight Bounding Box)
      for (const obs of this.obstacleManager.obstacles) {
        if (!obs.active || !obs.destructible) continue;

        const center = obs.collider.center || obs.group.position;
        const half = obs.collider.halfSize || new THREE.Vector2(0.65, 1.7);
        if (
          Math.abs(laser.position.x - center.x) < half.x + 0.08 &&
          Math.abs(laser.position.y - center.y) < half.y + 0.08
        ) {
          this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
          laser.active = false;
          laser.mesh.visible = false;
          obs.health -= 1;
          this.sceneManager.triggerShake(0.14, 0.1);

          if (obs.health <= 0) {
            this.obstacleManager.removeObstacle(obs);
            this.audioManager.playExplosion();
            this.sceneManager.triggerShake(0.3, 0.22);
            this.score += 250;
          }
          break;
        }
      }

      if (!laser.active) continue;

      // 5. Check against Solid Platforms & Ground Floor (Swept ray interval prevents any penetration)
      const bR = 0.08;
      const lx = laser.position.x;
      const ly = laser.position.y;
      const lPrevX = lx - laser.velocity.x * dt * 0.75;
      const lPrevY = ly - laser.velocity.y * dt * 0.75;
      const rayMinX = Math.min(lx, lPrevX) - bR;
      const rayMaxX = Math.max(lx, lPrevX) + bR;
      const rayMinY = Math.min(ly, lPrevY) - bR;
      const rayMaxY = Math.max(ly, lPrevY) + bR;

      for (const plat of platforms) {
        const platHalfW = plat.width / 2;
        const platHalfH = plat.height / 2;
        if (
          rayMaxX >= plat.x - platHalfW &&
          rayMinX <= plat.x + platHalfW &&
          rayMaxY >= plat.y - platHalfH &&
          rayMinY <= plat.y + platHalfH
        ) {
          this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
          this.player.emitSparks(laser.position.x, laser.position.y, 0, 7);
          laser.active = false;
          laser.mesh.visible = false;
          this.audioManager.playEnemyImpact();
          break;
        }
      }

      if (laser.active && laser.position.y <= -3.70) {
        this.obstacleManager.spawnBulletImpact(laser.position.x, -3.70, 0x00f5ff);
        this.player.emitSparks(laser.position.x, -3.70, 0, 7);
        laser.active = false;
        laser.mesh.visible = false;
        this.audioManager.playEnemyImpact();
      }

      // 6. Check against Solid Level Objects & Scene Obstacles (Barriers, Gates, Pistons, Gears, Sky Maze Walls)
      if (laser.active) {
        for (const obs of this.obstacleManager.obstacles) {
          if (!obs.active) continue;
          if (obs.type === ObstacleType.HAZARD_PLATFORM || obs.destructible) continue;

          if (obs.type === ObstacleType.GEAR) {
            const gDistSq = (laser.position.x - obs.group.position.x) ** 2 + (laser.position.y - obs.group.position.y) ** 2;
            const gRadius = obs.collider.radius || 2.2;
            if (gDistSq <= gRadius * gRadius) {
              this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
              this.player.emitSparks(laser.position.x, laser.position.y, 0, 8);
              laser.active = false;
              laser.mesh.visible = false;
              this.audioManager.playEnemyImpact();
              break;
            }
          } else if (
            obs.type === ObstacleType.COVER_BARRIER ||
            obs.type === ObstacleType.LASER_GATE ||
            obs.type === ObstacleType.PISTON ||
            obs.type === ObstacleType.SKY_MAZE_WALL
          ) {
            const half = obs.collider.halfSize || new THREE.Vector2(0.8, 0.625);
            const center = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y + half.y);
            if (
              rayMaxX >= center.x - half.x &&
              rayMinX <= center.x + half.x &&
              rayMaxY >= center.y - half.y &&
              rayMinY <= center.y + half.y
            ) {
              this.obstacleManager.spawnBulletImpact(laser.position.x, laser.position.y, 0x00f5ff);
              this.player.emitSparks(laser.position.x, laser.position.y, 0, 8);
              laser.active = false;
              laser.mesh.visible = false;
              this.audioManager.playEnemyImpact();
              break;
            }
          }
        }
      }
    }

    // D. Player vs Pickups (Fuel & Coins)
    for (const p of this.obstacleManager.pickups) {
      if (!p.active) continue;

      const distSq = (pPos.x - p.position.x) ** 2 + (pCenterY - p.position.y) ** 2;
      const combinedRadius = pRadius + p.radius;

      if (distSq < combinedRadius * combinedRadius) {
        this.obstacleManager.spawnPickupFX(p.position.x, p.position.y, p.type);
        this.obstacleManager.removePickup(p);

        if (p.type === PickupType.FUEL) {
          this.audioManager.playPickup();
          this.player.addFuel(35);
          this.score += 100;
        } else if (p.type === PickupType.COIN) {
          this.audioManager.playCoin();
          this.score += 500;
        } else if (p.type === PickupType.JETPACK_UPGRADE) {
          this.audioManager.playPickup();
          this.audioManager.playShieldToggle(true);
          this.player.upgradeJetpack();
          this.score += 1500;
          this.showUpgradeBanner('★ METALLIC RETRO JETPACK UNLOCKED! BIGGER BLUE FLAME & ULTRA AGILITY! ★');
        }
      }
    }
  }

  /**
   * High-Tech Sci-Fi Lock-On Reticle System
   * Features:
   * - Outer neon amber tracking ring
   * - Inner pulsating diamond reticle
   * - 4 corner targeting brackets
   */
  private setupLockOnSystem() {
    this.lockOnMesh = new THREE.Group();
    this.lockOnMesh.visible = false;
    this.sceneManager.scene.add(this.lockOnMesh);

    // 1. Outer Pulsating Neon Amber Ring
    const outerRingGeo = new THREE.RingGeometry(0.68, 0.74, 32);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.lockOnMesh.add(outerRing);

    // 2. Inner Rapid Pulsing Circle
    const innerRingGeo = new THREE.RingGeometry(0.46, 0.50, 24);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.lockOnMesh.add(innerRing);

    // 3. Four Sci-Fi Crosshair Corner Brackets
    const bracketGeoH = new THREE.BoxGeometry(0.20, 0.035, 0.02);
    const bracketGeoV = new THREE.BoxGeometry(0.035, 0.20, 0.02);
    const bracketMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });

    const bracketPositions = [
      [0.60, 0.60],
      [-0.60, 0.60],
      [0.60, -0.60],
      [-0.60, -0.60],
    ];

    for (const [bx, by] of bracketPositions) {
      const bH = new THREE.Mesh(bracketGeoH, bracketMat);
      bH.position.set(bx, by, 0);
      this.lockOnMesh.add(bH);

      const bV = new THREE.Mesh(bracketGeoV, bracketMat);
      bV.position.set(bx, by, 0);
      this.lockOnMesh.add(bV);
    }
  }

  /**
   * Smart Lock-On Targeting Detection & Position Snapping
   */
  private updateLockOnSystem(dt: number, totalTime: number) {
    if (!this.autoAimEnabled || this.state !== GameState.PLAYING) {
      if (this.lockOnMesh) this.lockOnMesh.visible = false;
      this.lockedEnemy = null;
      document.getElementById('reticle')?.classList.remove('locked');
      return;
    }

    let searchCenter: THREE.Vector3;
    let closestDist: number;

    if (this.inputManager.hasMouse) {
      searchCenter = this.inputManager.mouseWorldTarget;
      closestDist = 2.8; // Lock-on acquisition radius for mouse reticle
    } else {
      // Smart Auto-Aim for Touch / Mobile: scan ahead in player's facing direction
      const lookDir = this.player.facingRight ? 1 : -1;
      searchCenter = new THREE.Vector3(this.player.position.x + lookDir * 4.5, this.player.position.y + 0.5, 0);
      closestDist = 8.5; // Wide assist field for mobile
    }

    let closestEnemy: any = null;

    for (const enemy of this.obstacleManager.enemies) {
      if (!enemy.active) continue;
      const targetPos = new THREE.Vector3(enemy.position.x, enemy.position.y + 0.45, 0);
      const d = searchCenter.distanceTo(targetPos);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = enemy;
      }
    }

    for (const drone of this.obstacleManager.drones) {
      if (!drone.active) continue;
      const targetPos = new THREE.Vector3(drone.position.x, drone.position.y, 0);
      const d = searchCenter.distanceTo(targetPos);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = drone;
      }
    }

    for (const crate of this.obstacleManager.crates) {
      if (!crate.active || crate.isDestroyed) continue;
      const targetPos = new THREE.Vector3(crate.position.x, crate.position.y, 0);
      const d = searchCenter.distanceTo(targetPos);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = crate;
      }
    }

    // Modern Robot Dogs (Alien Cyber Sentinels) Cursor Lock-On
    for (const obs of this.obstacleManager.obstacles) {
      if (!obs.active || obs.type !== ObstacleType.ALIEN_CYBER_SENTINEL) continue;
      const targetPos = new THREE.Vector3(obs.group.position.x, obs.group.position.y + 0.65, 0);
      const d = searchCenter.distanceTo(targetPos);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = obs;
      }
    }

    if (closestEnemy) {
      this.lockedEnemy = closestEnemy;

      const isBlob = !!closestEnemy.slimeTrail;
      const isSentinel = closestEnemy.type === ObstacleType.ALIEN_CYBER_SENTINEL;
      const posX = isSentinel ? closestEnemy.group.position.x : closestEnemy.position.x;
      const posY = isSentinel ? (closestEnemy.group.position.y + 0.65) : (closestEnemy.position.y + (isBlob ? 0.45 : 0));
      const enemyCenter = new THREE.Vector3(posX, posY, 0);

      this.inputManager.mouseWorldTarget.copy(enemyCenter);

      this.lockOnMesh.position.set(enemyCenter.x, enemyCenter.y, 0.40);
      this.lockOnMesh.rotation.z += dt * 2.8;

      this.lockOnMesh.visible = true;
      const pulse = 1.0 + Math.sin(totalTime * 14.0) * 0.12;
      this.lockOnMesh.scale.set(pulse, pulse, 1.0);

      document.getElementById('reticle')?.classList.add('locked');
    } else {
      this.lockedEnemy = null;
      this.lockOnMesh.visible = false;
      document.getElementById('reticle')?.classList.remove('locked');
    }
  }
}

// Robust app initialization
function startApp() {
  const g = new Game();
  (window as any).game = g;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
