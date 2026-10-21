import { ObstacleManager } from './Obstacles';

export class LevelGenerator {
  private obstacleManager: ObstacleManager;
  private nextSpawnX: number = 28;
  private spawnInterval: number = 15;

  constructor(obstacleManager: ObstacleManager) {
    this.obstacleManager = obstacleManager;
  }

  public reset(startX: number = 0) {
    this.obstacleManager.clear();
    this.nextSpawnX = startX + 28;
  }

  public update(playerX: number) {
    // Generate ahead of the player
    while (this.nextSpawnX < playerX + 45) {
      this.generateChunk(this.nextSpawnX);
      this.nextSpawnX += this.spawnInterval;
    }
  }

  private generateChunk(x: number) {
    const pattern = Math.floor(Math.random() * 6);

    switch (pattern) {
      case 0:
        // Giant Lower Cog with Fuel Cell floating above it
        this.obstacleManager.spawnGear(x, -2.5, 2.2, 1.2);
        this.obstacleManager.spawnFuelPickup(x, 1.2);
        this.spawnCoinArc(x + 4, -1, 3);
        break;

      case 1:
        // Hydraulic Crushing Piston + Lower Platform
        this.obstacleManager.spawnPiston(x, 5.0, 4.2);
        this.obstacleManager.spawnPlatform(x, -4.0, 4.0, 0.6);
        this.obstacleManager.spawnCoinPickup(x + 2, 0.5);
        break;

      case 2:
        // High & Low Interlocking Cogs with Narrow Flight Gap
        this.obstacleManager.spawnGear(x, -3.2, 2.0, -1.4);
        this.obstacleManager.spawnGear(x + 3.5, 3.2, 2.0, 1.4);
        this.obstacleManager.spawnFuelPickup(x + 1.8, 0);
        break;

      case 3:
        // Destructible Plasma Containment Tube on Catwalk
        this.obstacleManager.spawnPlatform(x, -2.5, 5.0, 0.5);
        this.obstacleManager.spawnPlasmaTube(x, -0.7);
        this.spawnCoinArc(x - 3, 1.5, 4);
        break;

      case 4:
        // Double Piston gauntlet with high-value coin cluster
        this.obstacleManager.spawnPiston(x, 5.0, 3.8);
        this.obstacleManager.spawnPiston(x + 5, 5.0, 4.2);
        this.obstacleManager.spawnFuelPickup(x + 2.5, -2.0);
        break;

      case 5:
      default:
        // Upper Hazard Catwalk + Plasma Tube + Lower Coin Line
        this.obstacleManager.spawnPlatform(x, 1.8, 4.5, 0.5);
        this.obstacleManager.spawnPlasmaTube(x, 3.3);
        this.obstacleManager.spawnFuelPickup(x + 3, -1.5);
        this.spawnCoinArc(x, -2.5, 3);
        break;
    }
  }

  private spawnCoinArc(startX: number, baseY: number, count: number) {
    for (let i = 0; i < count; i++) {
      const cx = startX + i * 1.5;
      const cy = baseY + Math.sin((i / (count - 1)) * Math.PI) * 1.2;
      this.obstacleManager.spawnCoinPickup(cx, cy);
    }
  }
}
