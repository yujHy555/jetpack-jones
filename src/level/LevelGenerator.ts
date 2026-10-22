import { ObstacleManager } from './Obstacles';

export class LevelGenerator {
  private obstacleManager: ObstacleManager;
  private nextSpawnX: number = 18;
  private spawnInterval: number = 16;

  constructor(obstacleManager: ObstacleManager) {
    this.obstacleManager = obstacleManager;
  }

  public reset(startX: number = 0) {
    this.obstacleManager.clear();
    this.nextSpawnX = startX + 18;

    // Initial training catwalk platform
    this.obstacleManager.spawnPlatform(8, -1.8, 6.0, 0.5);
    this.spawnCoinLine(6, -0.8, 3);
    this.obstacleManager.spawnFuelPickup(11, -0.6);

    // High Sky Fuel Canister to reward early vertical exploration!
    this.obstacleManager.spawnFuelPickup(13, 6.5);
    this.obstacleManager.spawnFuelPickup(15, 12.0);

    // Interactive Physics Supply Crates
    this.obstacleManager.spawnCrate(5.0, -3.2);
    this.obstacleManager.spawnCrate(9.2, -1.3);

    // First Alien Blob enemy encounter on ground!
    this.obstacleManager.spawnBlob(14, -3.70, 3.5);

    // First Flying Attack Drone bot in air! (Helmet-styled)
    this.obstacleManager.spawnDrone(11.5, 0.8, 3.5);
  }

  public update(playerX: number) {
    while (this.nextSpawnX < playerX + 65) {
      this.generateChunk(this.nextSpawnX);
      this.nextSpawnX += this.spawnInterval;
    }
  }

  private generateChunk(x: number) {
    const pattern = Math.floor(Math.random() * 8);

    switch (pattern) {
      case 0:
        // MANDATORY FLIGHT ZONE: High-Voltage Laser Barrier Forcefield Gate!
        // Ground is completely blocked, player MUST fire jetpack to soar over the barrier!
        this.obstacleManager.spawnLaserGate(x + 2, -3.70);
        this.obstacleManager.spawnFuelPickup(x + 2, 2.2); // Mid-air fuel refill reward
        this.obstacleManager.spawnFuelPickup(x + 2, 8.5); // Sky fuel pod
        this.spawnCoinLine(x - 2, 0.8, 4);
        this.obstacleManager.spawnPlatform(x + 7.0, -1.2, 5.0, 0.5);
        this.obstacleManager.spawnBlob(x + 7.0, -0.95, 2.0);
        break;

      case 1:
        // STRATEGIC MECHANICAL PRESS: Slams to ground floor (squashes player against ground!)
        this.obstacleManager.spawnPiston(x, -3.70);
        this.obstacleManager.spawnBlob(x - 3.5, -3.70, 2.5);
        this.obstacleManager.spawnCrate(x + 3.0, -3.2);
        this.obstacleManager.spawnFuelPickup(x + 4.5, -2.2);
        this.spawnCoinLine(x - 1.5, -1.5, 3);
        break;

      case 2:
        // HIGH-ALTITUDE SKY FLIGHT GAUNTLET & SKY FUEL CHAIN
        // Player can soar high into the stratosphere / celestial cosmos!
        this.spawnSkyFuelChain(x + 1, 4.5, 4, 6.0); // Spawns fuel at Y = 4.5, 10.5, 16.5, 22.5!
        this.spawnCoinLine(x - 1, 14.0, 3);
        this.spawnCoinLine(x + 2, 25.0, 3);
        this.obstacleManager.spawnDrone(x, 7.5, 4.5);
        this.obstacleManager.spawnDrone(x + 4, 18.0, 5.0);
        this.obstacleManager.spawnPlatform(x + 2, -1.8, 6.0, 0.5);
        this.obstacleManager.spawnBlob(x + 2, -1.55, 2.0);
        break;

      case 3:
        // DOUBLE AAA INDUSTRIAL SAWS + OVERHEAD CATWALK
        this.obstacleManager.spawnGear(x - 2, -2.5, 2.0, -1.4);
        this.obstacleManager.spawnGear(x + 4, -2.5, 2.0, 1.4);
        this.obstacleManager.spawnPlatform(x + 1, 1.2, 5.5, 0.5);
        this.obstacleManager.spawnFuelPickup(x + 1, 2.8);
        this.obstacleManager.spawnFuelPickup(x + 1, 9.0);
        this.obstacleManager.spawnBlob(x + 1, 1.45, 1.8);
        this.spawnCoinLine(x - 2, -0.5, 4);
        break;

      case 4:
        // STRATEGIC ELEVATED PLATFORM PRESS: Slams directly onto platform surface!
        this.obstacleManager.spawnPlatform(x, -1.2, 6.0, 0.5);
        this.obstacleManager.spawnCrate(x - 2.0, -0.7);
        this.obstacleManager.spawnPiston(x + 0.8, -0.95);
        this.obstacleManager.spawnFuelPickup(x + 3.2, 0.2);
        this.obstacleManager.spawnBlob(x - 3.0, -3.70, 3.0);
        this.spawnCoinLine(x - 2, 1.0, 3);
        break;

      case 5:
        // MANDATORY FLIGHT ZONE: Laser Gate with Aerial Attack Drone Patrol
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
        this.obstacleManager.spawnBlob(x + 4, 1.75, 2.0);
        this.obstacleManager.spawnFuelPickup(x + 4, 3.0);
        this.obstacleManager.spawnFuelPickup(x + 1, 15.0);
        this.spawnCoinLine(x - 2, -3.2, 3);
        break;

      case 7:
      default:
        // STRATOSPHERE ROCKET LAUNCH CHUTE: Sky fuel pillars soaring to space
        this.obstacleManager.spawnLaserGate(x + 3, -3.70);
        this.spawnSkyFuelChain(x + 3, 3.2, 5, 7.0); // Y = 3.2, 10.2, 17.2, 24.2, 31.2
        this.obstacleManager.spawnPlatform(x - 2, -1.5, 5.0, 0.5);
        this.obstacleManager.spawnBlob(x - 2, -1.25, 2.0);
        this.obstacleManager.spawnCrate(x - 0.5, -1.0);
        this.spawnCoinLine(x + 1, 20.0, 4);
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
