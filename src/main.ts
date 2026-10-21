import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager';
import { InputManager } from './engine/InputManager';
import { AudioManager } from './engine/AudioManager';
import { Player } from './entities/Player';
import { ObstacleManager, ObstacleType, PickupType } from './level/Obstacles';
import { ParallaxLayers } from './level/ParallaxLayers';
import { LevelGenerator } from './level/LevelGenerator';
import { HUD } from './ui/HUD';

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

  private state: GameState = GameState.START;
  private score: number = 0;
  private clock: THREE.Clock;

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
    this.obstacleManager = new ObstacleManager(this.sceneManager.scene);
    this.parallaxLayers = new ParallaxLayers(this.sceneManager.scene);
    this.levelGenerator = new LevelGenerator(this.obstacleManager);

    this.setupLockOnSystem();
    this.setupUIEvents();
    (window as any).__JETPACK_GAME__ = this;
    this.hud.showStartScreen(() => this.startGame());

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupUIEvents() {
    const camBtn = document.getElementById('btn-handheld');
    if (camBtn) {
      camBtn.addEventListener('click', () => {
        const enabled = this.sceneManager.toggleHandheld();
        camBtn.textContent = enabled ? '🎥 CAM: ON [H]' : '🎥 CAM: OFF [H]';
      });
    }

    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const enabled = this.audioManager.toggle();
        audioBtn.textContent = enabled ? '🔊 SFX ON' : '🔇 SFX OFF';
      });
    }

    const stuntBtn = document.getElementById('btn-stunt');
    if (stuntBtn) {
      stuntBtn.addEventListener('click', () => {
        if (this.state === GameState.PLAYING) {
          this.player.triggerStuntRagdoll();
          this.sceneManager.triggerShake(0.12, 0.12);
          this.audioManager.playHitImpact();
        }
      });
    }
  }

  private startGame() {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.player.reset(0, -3.70); // Start in idle on solid ground
    this.levelGenerator.reset(0);
  }

  private onGameOver() {
    this.state = GameState.GAMEOVER;
    this.audioManager.setJetpackThrust(false);
    this.audioManager.playExplosion();
    this.sceneManager.triggerShake(0.5, 0.4);
    this.hud.showGameOver(this.score, () => this.startGame());
  }

  private loop(currentTime: number) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const totalTime = this.clock.getElapsedTime();

    this.inputManager.update();
    // Project mouse cursor to 3D world plane Z=0 for 360° aiming
    this.inputManager.updateAimWorldTarget(this.sceneManager.camera);
    // Update Smart Target Lock-On System
    this.updateLockOnSystem(dt, totalTime);

    if (this.state === GameState.PLAYING) {
      // 1. Process 360° Shoot Trigger
      if (this.inputManager.consumeShootTrigger()) {
        const fired = this.player.shoot(
          this.inputManager.hasMouse ? this.inputManager.mouseWorldTarget : undefined
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

      // Ragdoll Stunt Trigger ([R] key)
      if (this.inputManager.consumeRagdollTrigger()) {
        this.player.triggerStuntRagdoll();
        this.sceneManager.triggerShake(0.12, 0.12);
        this.audioManager.playHitImpact();
      }

      // 2. Audio Jetpack Thruster Sound
      const isJetpacking = this.inputManager.jetpack && this.player.fuel > 0;
      this.audioManager.setJetpackThrust(isJetpacking);

      if (this.player.fuel < 18 && this.player.fuel > 0 && Math.sin(totalTime * 8) > 0.8) {
        this.audioManager.playWarning();
      }

      // 3. Update Player Entity
      const jumpPressed = this.inputManager.consumeJumpTrigger();
      const platforms = this.obstacleManager.obstacles
        .filter(o => o.active && o.type === ObstacleType.HAZARD_PLATFORM && o.collider && o.collider.halfSize)
        .map(o => ({
          x: o.group.position.x,
          y: o.group.position.y,
          width: o.collider.halfSize!.x * 2,
          height: o.collider.halfSize!.y * 2,
        }));

      this.player.update(
        dt,
        this.inputManager.moveX,
        this.inputManager.run,
        jumpPressed,
        this.inputManager.jetpack,
        platforms,
        this.inputManager.mouseWorldTarget,
        this.inputManager.hasMouse
      );

      // 4. Update Level & Obstacles & Alien Blobs
      this.levelGenerator.update(this.player.position.x);
      this.obstacleManager.update(dt, totalTime, this.player.position.x, this.player.position.y);
      this.parallaxLayers.update(this.player.position.x, totalTime);

      // 5. Collision Checks
      this.checkCollisions();

      // 6. Score tracking
      if (this.player.position.x * 10 > this.score) {
        this.score = Math.floor(this.player.position.x * 10);
      }

      // 7. Check Game Over
      if (this.player.life <= 0) {
        this.onGameOver();
      }
    } else {
      // Idle scene animation on start screen
      this.parallaxLayers.update(0, totalTime);
      this.obstacleManager.update(dt, totalTime, 0, 0);
      const platforms = this.obstacleManager.obstacles
        .filter(o => o.active && o.type === ObstacleType.HAZARD_PLATFORM && o.collider && o.collider.halfSize)
        .map(o => ({
          x: o.group.position.x,
          y: o.group.position.y,
          width: o.collider.halfSize!.x * 2,
          height: o.collider.halfSize!.y * 2,
        }));
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

  private checkCollisions() {
    const pPos = this.player.position;
    const pCenterY = pPos.y + 1.0;
    const pRadius = 0.45;

    // A. Player vs Mechanical Obstacles (Gears, Pistons, Tubes)
    for (const obs of this.obstacleManager.obstacles) {
      if (!obs.active) continue;
      if (obs.type === ObstacleType.HAZARD_PLATFORM) continue;

      let hit = false;
      const obsPos = obs.group.position;

      if (obs.type === ObstacleType.PISTON) {
        // ACCURATE PISTON / MECHANICAL PRESS COLLISION TAKING PLAYER'S FULL SIZE INTO ACCOUNT:
        // Player Bounding Box: Width [pPos.x - 0.35, pPos.x + 0.35], Height [pPos.y, pPos.y + 1.85] (boots to helmet)
        const half = obs.collider.halfSize || new THREE.Vector2(0.9, 0.45);
        const center = obs.collider.center || new THREE.Vector2(obsPos.x, obsPos.y);

        const hammerMinX = center.x - half.x;
        const hammerMaxX = center.x + half.x;
        const hammerMinY = center.y - half.y;
        const hammerMaxY = center.y + half.y;

        const playerMinX = pPos.x - 0.35;
        const playerMaxX = pPos.x + 0.35;
        const playerMinY = pPos.y;
        const playerMaxY = pPos.y + 1.85;

        const overlapX = playerMinX <= hammerMaxX && playerMaxX >= hammerMinX;
        const overlapY = playerMinY <= hammerMaxY && playerMaxY >= hammerMinY;

        if (overlapX && overlapY) {
          if (this.player.invulnerableTime <= 0) {
            const knockX = pPos.x < center.x ? -1 : 1;
            this.player.crushHit(35, knockX);
            this.audioManager.playCrushHit();
            this.sceneManager.triggerShake(0.50, 0.32);
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

      if (hit && this.player.invulnerableTime <= 0) {
        const knockX = obsPos.x > pPos.x ? -1 : 1;
        this.player.takeDamage(25, knockX);
        this.audioManager.playHitImpact();
        this.sceneManager.triggerShake(0.38, 0.28);
      }
    }

    // B. Player vs Alien Blob Enemies
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

    // C. Lasers in 360° vs Destructible Obstacles & Alien Blobs
    for (const laser of this.player.lasers) {
      if (!laser.active) continue;

      // 1. Check against Alien Blob Enemies
      for (const enemy of this.obstacleManager.enemies) {
        if (!enemy.active) continue;

        const distSq = (laser.position.x - enemy.position.x) ** 2 + (laser.position.y - (enemy.position.y + 0.4)) ** 2;
        if (distSq < (enemy.radius + 0.2) ** 2) {
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

      // 2. Check against Plasma Tubes
      for (const obs of this.obstacleManager.obstacles) {
        if (!obs.active || !obs.destructible) continue;

        const obsPos = obs.group.position;
        const half = obs.collider.halfSize || new THREE.Vector2(0.65, 1.7);
        if (
          Math.abs(laser.position.x - obsPos.x) < half.x + 0.35 &&
          Math.abs(laser.position.y - obsPos.y) < half.y + 0.35
        ) {
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
    }

    // D. Player vs Pickups (Fuel & Coins)
    for (const p of this.obstacleManager.pickups) {
      if (!p.active) continue;

      const distSq = (pPos.x - p.position.x) ** 2 + (pCenterY - p.position.y) ** 2;
      const combinedRadius = pRadius + p.radius;

      if (distSq < combinedRadius * combinedRadius) {
        this.obstacleManager.removePickup(p);
        this.audioManager.playPickup();

        if (p.type === PickupType.FUEL) {
          this.player.addFuel(35);
          this.score += 100;
        } else if (p.type === PickupType.COIN) {
          this.score += 500;
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
    if (this.state !== GameState.PLAYING || !this.inputManager.hasMouse) {
      if (this.lockOnMesh) this.lockOnMesh.visible = false;
      this.lockedEnemy = null;
      document.getElementById('reticle')?.classList.remove('locked');
      return;
    }

    const mousePos = this.inputManager.mouseWorldTarget;
    let closestEnemy: any = null;
    let closestDist = 2.5; // Lock-on acquisition radius

    for (const enemy of this.obstacleManager.enemies) {
      if (!enemy.active) continue;
      const targetPos = new THREE.Vector3(enemy.position.x, enemy.position.y + 0.45, 0);
      const d = mousePos.distanceTo(targetPos);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      this.lockedEnemy = closestEnemy;
      const enemyCenter = new THREE.Vector3(closestEnemy.position.x, closestEnemy.position.y + 0.45, 0);

      // Snap mouse aiming target directly to locked enemy center!
      this.inputManager.mouseWorldTarget.copy(enemyCenter);

      // Position and animate pulsating lock-on circle
      this.lockOnMesh.position.set(enemyCenter.x, enemyCenter.y, 0.40);
      this.lockOnMesh.visible = true;

      const pulse = 1.0 + Math.sin(totalTime * 14.0) * 0.12;
      this.lockOnMesh.scale.set(pulse, pulse, 1.0);
      this.lockOnMesh.rotation.z += dt * 2.8;

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
  new Game();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
