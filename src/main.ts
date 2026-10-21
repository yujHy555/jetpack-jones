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

  constructor() {
    this.sceneManager = new SceneManager();
    this.inputManager = new InputManager();
    this.audioManager = new AudioManager();
    this.hud = new HUD();
    this.clock = new THREE.Clock();

    this.player = new Player(this.sceneManager.scene);
    this.obstacleManager = new ObstacleManager(this.sceneManager.scene);
    this.parallaxLayers = new ParallaxLayers(this.sceneManager.scene);
    this.levelGenerator = new LevelGenerator(this.obstacleManager);

    this.setupUIEvents();
    this.hud.showStartScreen(() => this.startGame());

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupUIEvents() {
    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const enabled = this.audioManager.toggle();
        audioBtn.textContent = enabled ? '🔊 SFX ON' : '🔇 SFX OFF';
      });
    }
  }

  private startGame() {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.player.reset(0, -3.8); // Start in idle on solid ground
    this.levelGenerator.reset(0);
  }

  private onGameOver() {
    this.state = GameState.GAMEOVER;
    this.audioManager.setJetpackThrust(false);
    this.audioManager.playExplosion();
    this.hud.showGameOver(this.score, () => this.startGame());
  }

  private loop(currentTime: number) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const totalTime = this.clock.getElapsedTime();

    this.inputManager.update();

    if (this.state === GameState.PLAYING) {
      // 1. Process Shoot Trigger
      if (this.inputManager.consumeShootTrigger()) {
        const fired = this.player.shoot();
        if (fired) {
          this.audioManager.playLaser();
        }
      }

      // 2. Audio Jetpack Thruster Sound
      const isJetpacking = this.inputManager.jetpack && this.player.fuel > 0;
      this.audioManager.setJetpackThrust(isJetpacking);

      if (this.player.fuel < 18 && this.player.fuel > 0 && Math.sin(totalTime * 8) > 0.8) {
        this.audioManager.playWarning();
      }

      // 3. Update Player Entity (Walk, Run, Jump, Jetpack)
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
        platforms
      );

      // 4. Update Level & Obstacles
      this.levelGenerator.update(this.player.position.x);
      this.obstacleManager.update(dt, totalTime, this.player.position.x);
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
      this.obstacleManager.update(dt, totalTime, 0);
      const platforms = this.obstacleManager.obstacles
        .filter(o => o.active && o.type === ObstacleType.HAZARD_PLATFORM && o.collider && o.collider.halfSize)
        .map(o => ({
          x: o.group.position.x,
          y: o.group.position.y,
          width: o.collider.halfSize!.x * 2,
          height: o.collider.halfSize!.y * 2,
        }));
      this.player.update(dt, 0, false, false, false, platforms); // Idle
    }

    // 8. Update Camera & UI
    this.sceneManager.updateCamera(this.player.position.x, this.player.position.y, dt);
    this.hud.update(this.score, this.player.life, this.player.fuel);

    // 9. Render Frame
    this.sceneManager.render();
  }

  private checkCollisions() {
    const pPos = this.player.position;
    const pCenterY = pPos.y + 1.0; // Center of 2D character
    const pRadius = 0.45;

    // A. Player vs Obstacles (Gears, Pistons, Tubes)
    for (const obs of this.obstacleManager.obstacles) {
      if (!obs.active) continue;
      if (obs.type === ObstacleType.HAZARD_PLATFORM) continue; // Platforms are handled for landing

      let hit = false;
      const obsPos = obs.group.position;

      if (obs.collider.type === 'circle') {
        const distSq = (pPos.x - obsPos.x) ** 2 + (pCenterY - obsPos.y) ** 2;
        const totalRadius = pRadius + (obs.collider.radius || 1.0);
        if (distSq < totalRadius * totalRadius) {
          hit = true;
        }
      } else if (obs.collider.type === 'box') {
        const half = obs.collider.halfSize || new THREE.Vector2(1, 1);
        const minX = obsPos.x - half.x;
        const maxX = obsPos.x + half.x;
        const minY = obsPos.y - half.y;
        const maxY = obsPos.y + half.y;

        const closestX = Math.max(minX, Math.min(pPos.x, maxX));
        const closestY = Math.max(minY, Math.min(pCenterY, maxY));
        const distSq = (pPos.x - closestX) ** 2 + (pCenterY - closestY) ** 2;

        if (distSq < pRadius * pRadius) {
          hit = true;
        }
      }

      if (hit && this.player.invulnerableTime <= 0) {
        this.player.takeDamage(25);
        this.audioManager.playExplosion();
      }
    }

    // B. Lasers vs Destructible Obstacles (Plasma Tubes)
    for (const laser of this.player.lasers) {
      if (!laser.active) continue;

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
          if (obs.health <= 0) {
            this.obstacleManager.removeObstacle(obs);
            this.audioManager.playExplosion();
            this.score += 250;
          }
          break;
        }
      }
    }

    // C. Player vs Pickups (Fuel & Coins)
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
}

// Robust app initialization (handles DOMContentLoaded already fired)
function startApp() {
  new Game();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
