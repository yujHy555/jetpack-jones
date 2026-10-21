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

    // First Alien Blob enemy encounter on ground!
    this.obstacleManager.spawnBlob(14, -3.70, 3.5);
  }

  public update(playerX: number) {
    while (this.nextSpawnX < playerX + 55) {
      this.generateChunk(this.nextSpawnX);
      this.nextSpawnX += this.spawnInterval;
    }
  }

  private generateChunk(x: number) {
    const pattern = Math.floor(Math.random() * 6);

    switch (pattern) {
      case 0:
        // Stepped Catwalks + Alien Blob + High Fuel
        this.obstacleManager.spawnPlatform(x, -2.0, 5.0, 0.5);
        this.obstacleManager.spawnBlob(x, -1.75, 2.0);
        this.obstacleManager.spawnPlatform(x + 6.0, 0.5, 4.5, 0.5);
        this.obstacleManager.spawnFuelPickup(x + 6.0, 1.8);
        this.spawnCoinLine(x, -3.2, 3);
        break;

      case 1:
        // Ground Hazard Gear with Overhead Catwalk Bridge + Alien Blob on ground
        this.obstacleManager.spawnGear(x + 2, -2.3, 2.0, 1.2);
        this.obstacleManager.spawnPlatform(x + 2, 1.0, 6.5, 0.5);
        this.spawnCoinLine(x, 2.0, 3);
        this.obstacleManager.spawnBlob(x + 6, -3.70, 2.5);
        break;

      case 2:
        // Hydraulic Piston over Low Platform + Alien Blob on ground
        this.obstacleManager.spawnPlatform(x, -1.4, 5.5, 0.5);
        this.obstacleManager.spawnPiston(x, 5.2, 4.2);
        this.obstacleManager.spawnBlob(x - 2.5, -3.70, 3.0);
        this.obstacleManager.spawnFuelPickup(x + 3.5, 0.0);
        break;

      case 3:
        // Destructible Plasma Containment Tube + Alien Blob on Catwalk
        this.obstacleManager.spawnPlatform(x, -0.8, 6.0, 0.5);
        this.obstacleManager.spawnPlasmaTube(x, 1.0);
        this.obstacleManager.spawnBlob(x + 2.0, -0.55, 2.0);
        this.spawnCoinLine(x - 3, 0.2, 3);
        this.obstacleManager.spawnFuelPickup(x + 3.5, -3.0);
        break;

      case 4:
        // High Altitude Flight Gauntlet: Floating Fuel above Double Gears
        this.obstacleManager.spawnGear(x - 2, -2.6, 1.8, -1.2);
        this.obstacleManager.spawnGear(x + 4, -2.6, 1.8, 1.2);
        this.obstacleManager.spawnPlatform(x + 1, 2.2, 4.5, 0.5);
        this.obstacleManager.spawnFuelPickup(x + 1, 3.6);
        this.obstacleManager.spawnBlob(x + 1, 2.45, 1.8);
        this.spawnCoinLine(x - 2, -0.8, 4);
        break;

      case 5:
      default:
        // Elevated Dual Runways with Piston & Alien Blob
        this.obstacleManager.spawnPlatform(x - 2, -0.5, 5.0, 0.5);
        this.obstacleManager.spawnPlatform(x + 4, 1.2, 5.0, 0.5);
        this.obstacleManager.spawnPiston(x + 1, 5.4, 3.8);
        this.obstacleManager.spawnBlob(x + 4, 1.45, 2.0);
        this.obstacleManager.spawnFuelPickup(x - 2, 0.8);
        this.spawnCoinLine(x - 1, -3.2, 3);
        break;
    }
  }

  private spawnCoinLine(startX: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.obstacleManager.spawnCoinPickup(startX + i * 1.2, y);
    }
  }
}
