import * as THREE from 'three';

interface SlimeParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

export const GROUND_Y = -3.70;

export interface PlatformBound {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Alien Blob Enemy
 * A gelatinous, hopping alien creature with:
 * - Natural squash-and-stretch physics
 * - Real floor & platform boundary awareness (no walking on invisible layers!)
 * - Reactive eye tracking
 * - Slime burst splash particles on defeat
 */
export class EnemyBlob {
  public group: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public radius: number = 0.55;
  public health: number = 2;
  public active: boolean = true;
  public isGrounded: boolean = true;

  private bodyMesh: THREE.Mesh;
  private eyeGroup: THREE.Group;
  private pupilMesh: THREE.Mesh;
  private hopTimer: number = 0;
  private hopCooldown: number = 1.4;
  private patrolDir: number = 1;
  private minX: number;
  private maxX: number;
  public baseY: number;

  // Slime Burst VFX
  private static slimeGeo = new THREE.SphereGeometry(0.08, 6, 6);
  private static slimeMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
  private slimePool: SlimeParticle[] = [];

  constructor(scene: THREE.Scene, startX: number, startY: number, patrolRange: number = 3.0) {
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.set(startX, startY, 0);
    this.baseY = startY;
    this.minX = startX - patrolRange;
    this.maxX = startX + patrolRange;
    this.patrolDir = Math.random() < 0.5 ? 1 : -1;
    this.hopTimer = Math.random() * this.hopCooldown;

    // Gelatinous Alien Slime Body
    const bodyGeo = new THREE.SphereGeometry(0.48, 16, 12);
    bodyGeo.scale(1.1, 0.9, 1.0);
    bodyGeo.translate(0, 0.42, 0); // Pivot firmly at base (y=0 touches ground)

    const slimeMat = new THREE.MeshStandardMaterial({
      color: 0x30e620,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, slimeMat);
    this.group.add(this.bodyMesh);

    // Inner Glowing Nucleus
    const coreGeo = new THREE.SphereGeometry(0.24, 10, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xbb11ee });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.4, 0);
    this.group.add(core);

    // Giant Expressive Alien Eye
    this.eyeGroup = new THREE.Group();
    this.eyeGroup.position.set(0.24, 0.48, 0.15);
    this.group.add(this.eyeGroup);

    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.eyeGroup.add(eyeWhite);

    const pupilGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    this.pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    this.pupilMesh.position.set(0.1, 0, 0);
    this.eyeGroup.add(this.pupilMesh);

    scene.add(this.group);

    // Particle pool for slime bursts
    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(EnemyBlob.slimeGeo, EnemyBlob.slimeMat);
      p.visible = false;
      scene.add(p);
      this.slimePool.push({
        mesh: p,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.5,
        active: false,
      });
    }
  }

  public takeDamage(amount: number = 1): boolean {
    this.health -= amount;
    this.explodeSlime(6);

    if (this.health <= 0) {
      this.explodeSlime(14);
      this.active = false;
      this.group.visible = false;
      return true; // Defeated!
    }

    // Flash white on hit
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    setTimeout(() => {
      if (this.active) {
        (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x30e620);
      }
    }, 90);

    return false;
  }

  private explodeSlime(count: number) {
    for (let i = 0; i < count; i++) {
      const sp = this.slimePool.find(p => !p.active);
      if (!sp) continue;

      sp.active = true;
      sp.age = 0;
      sp.maxLife = 0.35 + Math.random() * 0.3;
      sp.mesh.position.copy(this.position);
      sp.mesh.position.y += 0.4;
      sp.velocity.set(
        (Math.random() - 0.5) * 8.0,
        Math.random() * 6.0 + 1.0,
        (Math.random() - 0.5) * 2.0
      );
      sp.mesh.visible = true;
    }
  }

  public update(
    dt: number,
    time: number,
    playerX: number,
    playerY: number,
    platforms: PlatformBound[] = []
  ) {
    if (!this.active) {
      this.updateParticles(dt);
      return;
    }

    this.hopTimer += dt;

    // 1. Eye tracks player location
    const angleToPlayer = Math.atan2(playerY - (this.position.y + 0.4), playerX - this.position.x);
    this.pupilMesh.position.set(
      Math.cos(angleToPlayer) * 0.1,
      Math.sin(angleToPlayer) * 0.08,
      0.08
    );

    // 2. Identify Current Supporting Surface
    // Check if directly over any platform
    let surfaceY = GROUND_Y;
    let currentPlatform: PlatformBound | null = null;

    for (const plat of platforms) {
      const pTop = plat.y + plat.height / 2;
      const pLeft = plat.x - plat.width / 2;
      const pRight = plat.x + plat.width / 2;

      if (this.position.x >= pLeft - 0.2 && this.position.x <= pRight + 0.2) {
        // Platform is beneath or at blob height
        if (this.position.y >= pTop - 0.4 && pTop > surfaceY) {
          surfaceY = pTop;
          currentPlatform = plat;
        }
      }
    }

    // Restrict patrol boundary so the blob never walks off an elevated platform into thin air
    if (currentPlatform) {
      this.minX = Math.max(this.minX, currentPlatform.x - currentPlatform.width / 2 + 0.35);
      this.maxX = Math.min(this.maxX, currentPlatform.x + currentPlatform.width / 2 - 0.35);
    }

    // 3. Hopping AI Behavior
    const distToPlayer = Math.abs(playerX - this.position.x);

    // Squash anticipation before hop
    if (this.hopTimer >= this.hopCooldown - 0.2 && this.isGrounded) {
      const squashFactor = 1.0 - ((this.hopCooldown - this.hopTimer) / 0.2) * 0.4;
      this.bodyMesh.scale.set(1.0 + (1.0 - squashFactor) * 0.5, squashFactor, 1.0 + (1.0 - squashFactor) * 0.5);
    }

    // Hop impulse
    if (this.hopTimer >= this.hopCooldown && this.isGrounded) {
      this.hopTimer = 0;
      this.isGrounded = false;

      // Hop towards player if in range and within boundary, else patrol
      let hopDir = this.patrolDir;
      if (distToPlayer < 8.0) {
        const toPlayer = playerX > this.position.x ? 1 : -1;
        if (
          (toPlayer > 0 && this.position.x < this.maxX) ||
          (toPlayer < 0 && this.position.x > this.minX)
        ) {
          hopDir = toPlayer;
        }
      }

      this.velocity.x = hopDir * (2.4 + Math.random() * 1.2);
      this.velocity.y = 6.2 + Math.random() * 1.4;

      // Stretch on jump
      this.bodyMesh.scale.set(0.78, 1.35, 0.78);
    }

    // 4. Air & Ground Physics
    if (!this.isGrounded) {
      this.velocity.y -= 18.0 * dt;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      // Land on supporting surface (platform top or ground floor)
      if (this.position.y <= surfaceY) {
        this.position.y = surfaceY;
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;

        // Landing squash
        this.bodyMesh.scale.set(1.3, 0.65, 1.3);

        // Turn around if at or beyond patrol boundary
        if (this.position.x >= this.maxX) this.patrolDir = -1;
        if (this.position.x <= this.minX) this.patrolDir = 1;
      }
    } else {
      // If already grounded, ensure position tracks surface exactly
      if (Math.abs(this.position.y - surfaceY) < 0.2) {
        this.position.y = surfaceY;
      } else if (this.position.y > surfaceY) {
        // Walked off an edge, fall naturally!
        this.isGrounded = false;
      }

      // Elastic recovery to normal shape
      this.bodyMesh.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 10);
    }

    // Turn around if walked past patrol bounds
    if (this.position.x >= this.maxX) this.patrolDir = -1;
    if (this.position.x <= this.minX) this.patrolDir = 1;

    // Gentle gelatinous breathing wobble
    const wobble = Math.sin(time * 6.0) * 0.04;
    this.bodyMesh.scale.y += wobble;

    this.updateParticles(dt);
  }

  private updateParticles(dt: number) {
    for (const p of this.slimePool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 16.0 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      const prog = p.age / p.maxLife;
      const s = 1.0 - prog;
      p.mesh.scale.set(s, s, s);
    }
  }

  public destroy(scene: THREE.Scene) {
    this.active = false;
    scene.remove(this.group);
    for (const p of this.slimePool) {
      scene.remove(p.mesh);
    }
  }
}
