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

    // Initial training platforms near spawn
    this.obstacleManager.spawnPlatform(8, -1.8, 5.0, 0.5);
    this.obstacleManager.spawnCoinPickup(8, -0.8);
    this.obstacleManager.spawnFuelPickup(14, 0.5);
  }

  public update(playerX: number) {
    // Generate chunks ahead of player
    while (this.nextSpawnX < playerX + 45) {
      this.generateChunk(this.nextSpawnX);
      this.nextSpawnX += this.spawnInterval;
    }
  }

  private generateChunk(x: number) {
    const pattern = Math.floor(Math.random() * 6);

    switch (pattern) {
      case 0:
        // Stepped Catwalks: Jump from low to high
        this.obstacleManager.spawnPlatform(x, -2.0, 4.5, 0.5);
        this.obstacleManager.spawnPlatform(x + 5.5, 0.0, 4.5, 0.5);
        this.obstacleManager.spawnFuelPickup(x + 5.5, 1.2);
        this.spawnCoinLine(x, -1.2, 3);
        break;

      case 1:
        // Ground Hazard Gear with Overhead Catwalk Bridge
        this.obstacleManager.spawnGear(x + 2, -2.4, 2.0, 1.2);
        this.obstacleManager.spawnPlatform(x + 2, 0.8, 6.0, 0.5);
        this.obstacleManager.spawnCoinPickup(x + 2, 1.8);
        this.obstacleManager.spawnFuelPickup(x - 2, -2.5);
        break;

      case 2:
        // Piston Trap over Catwalk
        this.obstacleManager.spawnPlatform(x, -1.5, 5.0, 0.5);
        this.obstacleManager.spawnPiston(x, 4.8, 4.0);
        this.obstacleManager.spawnCoinPickup(x + 3.5, -0.5);
        break;

      case 3:
        // Destructible Plasma Containment Tube on Platform
        this.obstacleManager.spawnPlatform(x, -1.0, 5.5, 0.5);
        this.obstacleManager.spawnPlasmaTube(x, 0.8);
        this.spawnCoinLine(x - 3, 0.0, 3);
        this.obstacleManager.spawnFuelPickup(x + 3, 0.2);
        break;

      case 4:
        // High Altitude Flight Challenge: Floating Fuel above Double Gears
        this.obstacleManager.spawnGear(x - 2, -2.8, 1.8, -1.2);
        this.obstacleManager.spawnGear(x + 4, -2.8, 1.8, 1.2);
        this.obstacleManager.spawnPlatform(x + 1, 1.8, 4.0, 0.5);
        this.obstacleManager.spawnFuelPickup(x + 1, 3.2);
        this.spawnCoinLine(x - 2, -0.8, 4);
        break;

      case 5:
      default:
        // Elevated Runway with Hydraulic Piston
        this.obstacleManager.spawnPlatform(x, -0.5, 7.0, 0.5);
        this.obstacleManager.spawnPiston(x + 1.5, 4.8, 3.5);
        this.obstacleManager.spawnPlasmaTube(x - 2.5, 1.2);
        this.obstacleManager.spawnFuelPickup(x + 4, 1.0);
        this.spawnCoinLine(x, -2.6, 3);
        break;
    }
  }

  private spawnCoinLine(startX: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.obstacleManager.spawnCoinPickup(startX + i * 1.2, y);
    }
  }
}
