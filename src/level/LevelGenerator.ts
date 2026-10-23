import * as THREE from 'three';
import { ObstacleManager } from './Obstacles';
import { MarsOutpost } from './MarsOutpost';

export class LevelGenerator {
  private obstacleManager: ObstacleManager;
  public marsOutpost!: MarsOutpost;
  public currentLevel: number = 1;
  private nextSpawnX: number = 18;
  private spawnInterval: number = 16;

  constructor(obstacleManager: ObstacleManager, scene?: THREE.Scene) {
    this.obstacleManager = obstacleManager;
    if (scene) {
      this.marsOutpost = new MarsOutpost();
      scene.add(this.marsOutpost.group);
      this.marsOutpost.setVisible(false);
    }
  }

  public setLevel(lvl: number) {
    this.currentLevel = lvl;
    if (this.marsOutpost) {
      this.marsOutpost.setVisible(lvl === 3);
    }
    this.reset();
  }

  public reset(startX: number = 0) {
    this.obstacleManager.clear();
    this.nextSpawnX = startX + 18;

    if (this.currentLevel === 3) {
      // ----------------------------------------------------
      // LEVEL 3: DESOLATE MARS OUTPOST (AAA ISOMETRIC)
      // ----------------------------------------------------
      if (this.marsOutpost) this.marsOutpost.setVisible(true);
      // Patrol security drones and sentinels around Mars outpost
      this.obstacleManager.spawnDrone(14, 4.5, 6.0);
      this.obstacleManager.spawnDrone(-8, 8.0, 5.0);
      this.obstacleManager.spawnDrone(24, 2.5, 5.0);
      this.obstacleManager.spawnAlienCyberSentinel(20.0, -3.3);
      this.obstacleManager.spawnFuelPickup(14.0, 1.2);
      this.obstacleManager.spawnFuelPickup(-8.0, 20.5); // High reward on skyscraper tower crown!
      this.obstacleManager.spawnHyperJetpackPickup(8.5, -0.2); // On the canyon bridge
      return;
    }

    if (this.marsOutpost) this.marsOutpost.setVisible(false);

    if (this.currentLevel === 1) {
      // ----------------------------------------------------
      // LEVEL 1: INDUSTRIAL COMPLEX
      // ----------------------------------------------------
      // Initial training catwalk platform (x = 5 to 11)
      this.obstacleManager.spawnPlatform(8, -1.8, 6.0, 0.5);
      this.spawnCoinLine(6, -0.8, 3);
      this.obstacleManager.spawnFuelPickup(11, -0.6);

      // High Sky Fuel Canister to reward early vertical exploration!
      this.obstacleManager.spawnFuelPickup(13, 6.5);
      this.obstacleManager.spawnFuelPickup(15, 12.0);

      // Interactive Physics Supply Crates
      this.obstacleManager.spawnCrate(3.5, -3.2);
      this.obstacleManager.spawnCrate(9.5, -1.3);

      // Tactical Modern Cover Barrier placed safely in open runway (NEVER under platforms!)
      this.obstacleManager.spawnCoverBarrier(13.0, -3.70);

      // Aerial Attack Drone bot in air! (Helmet-styled)
      this.obstacleManager.spawnDrone(16.5, 0.9, 4.0);

      // Hyper-Ion Jetpack Upgrade placed early so player can experience high-thrust flight
      this.obstacleManager.spawnHyperJetpackPickup(20.0, 0.5);
    } else {
      // ----------------------------------------------------
      // LEVEL 2: PLANET XYLOS - BIOLUMINESCENT ALIEN PLANET
      // ----------------------------------------------------
      // Alien Cyber Sentinel: Modern Canine Robotic Stalker
      this.obstacleManager.spawnAlienCyberSentinel(10.5, -3.70);

      // Early Metallic Retro Jetpack Upgrade Pickup!
      this.obstacleManager.spawnHyperJetpackPickup(3.5, -1.8);

      // Floating Alien Crystal Platform guarded by Cyber Sentinel
      this.obstacleManager.spawnPlatform(15.0, -1.2, 5.5, 0.5);
      this.obstacleManager.spawnAlienCyberSentinel(16.5, -0.95);
      this.spawnCoinLine(13.5, -0.2, 3);
      this.obstacleManager.spawnFuelPickup(17.5, 0.2);

      // Alien Drifter Bio-Enemy in flight!
      this.obstacleManager.spawnDrone(15.0, 2.5, 4.5, true);

      // Modern Cover Barrier in open ground (clear of any platforms)
      this.obstacleManager.spawnCoverBarrier(20.0, -3.70);

      // HIGH-ALTITUDE ALIEN SKY MAZE: Lethal Bio-Plasma Walls & Rich Collectibles!
      // Touching any wall of the maze instantly kills the player!
      this.obstacleManager.spawnSkyMaze(23.0, 4.5);
    }
  }

  public update(playerX: number) {
    if (this.currentLevel === 3) return;
    while (this.nextSpawnX < playerX + 65) {
      if (this.currentLevel === 1) {
        this.generateChunkLevel1(this.nextSpawnX);
      } else {
        this.generateChunkLevel2(this.nextSpawnX);
      }
      this.nextSpawnX += this.spawnInterval;
    }
  }

  // --------------------------------------------------------
  // LEVEL 1: INDUSTRIAL COMPLEX GENERATOR
  // --------------------------------------------------------
  private generateChunkLevel1(x: number) {
    const pattern = Math.floor(Math.random() * 8);

    switch (pattern) {
      case 0:
        // MANDATORY FLIGHT ZONE: High-Voltage Laser Barrier Forcefield Gate!
        this.obstacleManager.spawnCoverBarrier(x - 4.5, -3.70);
        this.obstacleManager.spawnLaserGate(x + 2, -3.70);
        this.obstacleManager.spawnFuelPickup(x + 2, 2.2);
        this.obstacleManager.spawnFuelPickup(x + 2, 8.5);
        this.spawnCoinLine(x - 2, 0.8, 4);
        this.obstacleManager.spawnPlatform(x + 7.0, -1.2, 5.0, 0.5);
        this.obstacleManager.spawnDrone(x + 7.0, 1.2, 3.5);
        break;

      case 1:
        // STRATEGIC MECHANICAL PRESS: Slams to ground floor
        this.obstacleManager.spawnCoverBarrier(x - 3.5, -3.70);
        this.obstacleManager.spawnPiston(x, -3.70);
        this.obstacleManager.spawnCoinPickup(x, -3.20);
        this.obstacleManager.spawnCoinPickup(x - 1.2, -3.20);
        this.obstacleManager.spawnCoinPickup(x + 1.2, -3.20);
        this.obstacleManager.spawnCrate(x + 3.0, -3.2);
        this.obstacleManager.spawnFuelPickup(x + 4.5, -3.20);
        this.obstacleManager.spawnDrone(x - 3.5, 0.9, 3.5);
        break;

      case 2:
        // HIGH-ALTITUDE SKY FLIGHT GAUNTLET & SKY FUEL CHAIN
        this.spawnSkyFuelChain(x + 1, 4.5, 4, 6.0);
        this.spawnCoinLine(x - 1, 14.0, 3);
        this.spawnCoinLine(x + 2, 25.0, 3);
        this.obstacleManager.spawnDrone(x, 7.5, 4.5);
        this.obstacleManager.spawnDrone(x + 4, 18.0, 5.0);
        this.obstacleManager.spawnPlatform(x + 2, -1.8, 6.0, 0.5);
        this.obstacleManager.spawnDrone(x + 2, 0.8, 3.5);
        break;

      case 3:
        // DOUBLE AAA SCI-FI GRAV-ROTORS + OVERHEAD CATWALK
        this.obstacleManager.spawnGear(x - 2, -2.5, 2.0, -1.4);
        this.obstacleManager.spawnGear(x + 4, -2.5, 2.0, 1.4);
        this.obstacleManager.spawnPlatform(x + 1, 1.2, 5.5, 0.5);
        // Collectibles safely placed above wheels: zero intersection, easily reachable by jump/flight!
        this.obstacleManager.spawnCoinPickup(x - 2.0, 0.60);
        this.obstacleManager.spawnCoinPickup(x + 4.0, 0.60);
        // Safe running collectibles on top of the catwalk platform (surface at y = 1.45)
        this.spawnCoinLine(x - 0.5, 1.95, 3);
        this.obstacleManager.spawnFuelPickup(x + 1, 3.2);
        this.obstacleManager.spawnFuelPickup(x + 1, 9.0);
        this.obstacleManager.spawnDrone(x + 1, 3.8, 3.5);
        break;

      case 4:
        // STRATEGIC ELEVATED PLATFORM PRESS
        // Cover barrier placed well before the platform out in the open
        this.obstacleManager.spawnCoverBarrier(x - 5.5, -3.70);
        this.obstacleManager.spawnPlatform(x, -1.2, 6.0, 0.5);
        this.obstacleManager.spawnCrate(x - 2.0, -0.7);
        this.obstacleManager.spawnPiston(x + 0.8, -0.95);
        this.obstacleManager.spawnCoinPickup(x + 0.8, -0.45);
        this.obstacleManager.spawnFuelPickup(x + 2.8, -0.45);
        this.obstacleManager.spawnDrone(x - 3.0, 1.2, 3.5);
        this.spawnCoinLine(x - 2, 1.0, 3);
        break;

      case 5:
        // MANDATORY FLIGHT ZONE: Laser Gate with Aerial Attack Drone Patrol
        this.obstacleManager.spawnCoverBarrier(x - 3.5, -3.70);
        this.obstacleManager.spawnLaserGate(x, -3.70);
        this.obstacleManager.spawnDrone(x, 2.8, 4.0);
        this.obstacleManager.spawnFuelPickup(x, 4.2);
        this.obstacleManager.spawnFuelPickup(x + 3, 11.0);
        this.obstacleManager.spawnPlatform(x + 6, 0.2, 5.0, 0.5);
        this.obstacleManager.spawnCrate(x + 7.5, 0.7);
        this.spawnCoinLine(x + 4, 1.2, 3);
        break;

      case 6:
        // DESTRUCTIBLE PLASMA TUBE + DUAL ELEVATED RUNWAYS
        this.obstacleManager.spawnPlatform(x - 2, -0.8, 5.5, 0.5);
        this.obstacleManager.spawnPlasmaTube(x - 2, 0.9);
        this.obstacleManager.spawnPlatform(x + 4, 1.5, 5.0, 0.5);
        this.obstacleManager.spawnCrate(x + 3.2, 2.0);
        this.obstacleManager.spawnDrone(x + 4, 3.2, 3.5);
        this.obstacleManager.spawnFuelPickup(x + 4, 3.0);
        this.obstacleManager.spawnFuelPickup(x + 1, 15.0);
        this.spawnCoinLine(x - 2, -3.2, 3);
        break;

      case 7:
      default:
        // STRATOSPHERE ROCKET LAUNCH CHUTE
        this.obstacleManager.spawnCoverBarrier(x - 6.0, -3.70);
        this.obstacleManager.spawnLaserGate(x + 3, -3.70);
        this.spawnSkyFuelChain(x + 3, 3.2, 5, 7.0);
        this.obstacleManager.spawnPlatform(x - 1, -1.5, 5.0, 0.5);
        this.obstacleManager.spawnDrone(x - 1, 0.8, 3.0);
        this.obstacleManager.spawnCrate(x - 0.5, -1.0);
        this.spawnCoinLine(x + 1, 20.0, 4);
        break;
    }
  }

  // --------------------------------------------------------
  // LEVEL 2: ALIEN PLANET GENERATOR (PLANET XYLOS)
  // --------------------------------------------------------
  private generateChunkLevel2(x: number) {
    const pattern = Math.floor(Math.random() * 6);

    switch (pattern) {
      case 0:
        // ALIEN CYBER SENTINEL PATROL MEADOW
        this.obstacleManager.spawnCoverBarrier(x - 4.5, -3.70);
        this.obstacleManager.spawnFuelPickup(x + 0.5, -3.20);
        this.obstacleManager.spawnPlatform(x + 7.0, -1.0, 5.5, 0.5);
        this.obstacleManager.spawnAlienCyberSentinel(x + 8.2, -0.75); // Cyber Sentinel guarding platform
        this.obstacleManager.spawnDrone(x + 6.0, 1.8, 4.0, true);
        this.spawnCoinLine(x + 5.5, 0.2, 3);
        break;

      case 1:
        // MANDATORY ALIEN FLIGHT CHASM: High-Voltage Bio-Barrier requires Jetpack flight!
        this.obstacleManager.spawnCoverBarrier(x - 4.0, -3.70);
        this.obstacleManager.spawnLaserGate(x, -3.70); // Energy barrier across ground
        this.obstacleManager.spawnAlienCyberSentinel(x - 2.0, -3.70);
        this.obstacleManager.spawnFuelPickup(x, 2.5); // Mid-air fuel refill
        this.obstacleManager.spawnFuelPickup(x + 4.5, 5.0); // Flight step
        this.obstacleManager.spawnFuelPickup(x + 9.0, 2.5); // Landing approach fuel
        this.spawnCoinLine(x + 1, 3.5, 5);
        this.obstacleManager.spawnDrone(x + 4.5, 3.2, 4.5, true); // Alien Drifter patrolling flight corridor
        this.obstacleManager.spawnPlatform(x + 11.0, -0.6, 5.0, 0.5);
        break;

      case 2:
        // METALLIC RETRO JETPACK UPGRADE PEDESTAL & CYBER STALKERS
        this.obstacleManager.spawnCoverBarrier(x - 4.5, -3.70);
        this.obstacleManager.spawnHyperJetpackPickup(x, -1.2); // Snazzy upgrade pickup!
        this.obstacleManager.spawnAlienCyberSentinel(x + 7.5, -3.70);
        this.obstacleManager.spawnDrone(x + 2.0, 2.8, 4.0, true);
        this.spawnCoinLine(x - 2.0, 0.5, 4);
        break;

      case 3:
        // ELEVATED ALIEN PLATFORMS & CYBER SENTINEL PATROL
        this.obstacleManager.spawnPlatform(x + 1.0, 0.5, 6.0, 0.5);
        this.obstacleManager.spawnAlienCyberSentinel(x + 1.0, 0.75);
        this.obstacleManager.spawnFuelPickup(x + 1.0, 2.8);
        this.obstacleManager.spawnFuelPickup(x + 1.0, 9.5);
        this.obstacleManager.spawnDrone(x + 1.0, 2.2, 3.5, true);
        this.spawnCoinLine(x - 1.5, -0.5, 4);
        break;

      case 4:
        // ALIEN BIO-PLASMA SKY MAZE & HIGH-ALTITUDE GAUNTLET
        // Ground cover barrier and platform approach
        this.obstacleManager.spawnCoverBarrier(x - 5.0, -3.70);
        this.obstacleManager.spawnAlienCyberSentinel(x - 2.0, -3.70);
        this.obstacleManager.spawnPlatform(x + 1.0, -1.2, 5.0, 0.5);
        this.obstacleManager.spawnFuelPickup(x - 1.0, 0.8);
        this.obstacleManager.spawnFuelPickup(x + 1.0, 2.8);
        // The lethal Sky Maze: player dies if he touches any wall of the maze!
        this.obstacleManager.spawnSkyMaze(x + 3.0, 4.5);
        break;

      case 5:
      default:
        // TACTICAL ALIEN COMBAT RUNWAY
        this.obstacleManager.spawnCoverBarrier(x - 3.5, -3.70);
        this.obstacleManager.spawnDrone(x + 1.0, 1.5, 4.0, true);
        this.obstacleManager.spawnDrone(x + 5.5, 2.5, 4.0, true);
        this.obstacleManager.spawnCrate(x + 2.0, -3.2);
        this.obstacleManager.spawnAlienCyberSentinel(x + 7.5, -3.70);
        this.obstacleManager.spawnFuelPickup(x + 4.0, -3.2);
        this.spawnCoinLine(x, -3.2, 3);
        break;
    }
  }

  private spawnCoinLine(startX: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.obstacleManager.spawnCoinPickup(startX + i * 1.2, y);
    }
  }

  private spawnSkyFuelChain(x: number, startY: number, count: number, stepY: number) {
    for (let i = 0; i < count; i++) {
      this.obstacleManager.spawnFuelPickup(x, startY + i * stepY);
    }
  }
}
