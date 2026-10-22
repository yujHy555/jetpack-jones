import * as THREE from 'three';

export interface CrateDebris {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

/**
 * Interactive Sci-Fi Cargo Crate with Dynamic Rigid-Body Physics
 * Features:
 * - Full physics simulation: gravity, platform collision, ground friction, and tilt bounce
 * - Shootable: reacts to bullet impacts with physical recoil impulse, jiggle, and hit sparks
 * - Destructible: shatters into tumbling 3D debris pieces when health is depleted
 * - Solid to player: can be pushed, climbed on, or used as tactical cover
 */
export class PhysicsCrate {
  public group: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  public angularVelocity: number = 0;
  public width: number = 0.85;
  public height: number = 0.85;
  public depth: number = 0.85;
  public halfW: number;
  public halfH: number;

  public health: number = 2;
  public maxHealth: number = 2;
  public active: boolean = true;
  public isDestroyed: boolean = false;
  public onGround: boolean = false;
  public onDestroy?: (x: number, y: number) => void;

  // Visuals
  private crateMesh: THREE.Group;
  private bodyMesh: THREE.Mesh;
  private shadowMesh: THREE.Mesh;
  private jiggleTimer: number = 0;

  // Debris pool for explosive destruction
  private debrisPool: CrateDebris[] = [];
  private destructionTimer: number = 0;

  constructor(scene: THREE.Scene, startX: number, startY: number) {
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.halfW = this.width / 2;
    this.halfH = this.height / 2;
    this.position.set(startX, startY, 0);

    // 1. Crate Assembly
    this.crateMesh = new THREE.Group();
    this.group.add(this.crateMesh);

    // Main reinforced container box
    const bodyGeo = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xdfd7ca, // Cream sci-fi cargo hull
      roughness: 0.38,
      metalness: 0.20,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.crateMesh.add(this.bodyMesh);

    // Dark steel corner trim & edge brackets
    const frameGeo = new THREE.BoxGeometry(this.width * 1.02, this.height * 1.02, this.depth * 0.25);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.55,
      metalness: 0.65,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.crateMesh.add(frameMesh);

    // Center Hazard / Cargo Amber Accent Band
    const bandGeo = new THREE.BoxGeometry(this.width * 1.01, 0.22, this.depth * 1.01);
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xe58835,
      roughness: 0.35,
      metalness: 0.15,
    });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    this.crateMesh.add(bandMesh);

    // Corner rivet bolts
    const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 6);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = new THREE.MeshStandardMaterial({ color: 0x9099a5, metalness: 0.85 });
    for (const bx of [-this.halfW + 0.08, this.halfW - 0.08]) {
      for (const by of [-this.halfH + 0.08, this.halfH - 0.08]) {
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(bx, by, this.depth / 2 + 0.015);
        this.crateMesh.add(bolt);
      }
    }

    scene.add(this.group);

    // 2. Simple Round Toon Style Shadow Decal
    const shadowGeo = new THREE.CircleGeometry(0.50, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x111622,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(this.shadowMesh);

    // 3. Destruction Debris Pieces
    const pieceGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    for (let i = 0; i < 8; i++) {
      const pMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xe58835 : 0xdfd7ca,
        roughness: 0.4,
        metalness: 0.3,
      });
      const pMesh = new THREE.Mesh(pieceGeo, pMat);
      pMesh.visible = false;
      scene.add(pMesh);

      this.debrisPool.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        active: false,
      });
    }
  }

  /**
   * Shoot reaction: takes bullet damage, applies physics impulse, and jiggles
   */
  public takeDamage(amount: number = 1, impulseDirX: number = 1): boolean {
    if (!this.active || this.isDestroyed) return false;

    this.health -= amount;
    this.jiggleTimer = 0.28;

    // Bullet physics momentum transfer
    this.velocity.x += impulseDirX * (3.8 + Math.random() * 1.5);
    this.velocity.y += 2.0;
    this.angularVelocity += -impulseDirX * (4.0 + Math.random() * 2.0);
    this.onGround = false;

    // Hit flash
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    setTimeout(() => {
      if (this.active && !this.isDestroyed) {
        (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xdfd7ca);
      }
    }, 80);

    if (this.health <= 0) {
      this.shatter();
      return true;
    }

    return false;
  }

  /**
   * Shatters crate into physics debris chunks flying outward
   */
  private shatter() {
    this.isDestroyed = true;
    this.active = false;
    this.crateMesh.visible = false;
    if (this.shadowMesh) this.shadowMesh.visible = false;
    this.destructionTimer = 1.0;

    const origin = this.position.clone();
    if (this.onDestroy) {
      this.onDestroy(origin.x, origin.y);
    }
    for (const d of this.debrisPool) {
      d.active = true;
      d.age = 0;
      d.mesh.position.copy(origin);
      d.mesh.position.x += (Math.random() - 0.5) * 0.3;
      d.mesh.position.y += (Math.random() - 0.5) * 0.3;
      d.mesh.visible = true;

      const angle = Math.random() * Math.PI * 2;
      const spd = 4.5 + Math.random() * 5.0;
      d.velocity.set(
        Math.cos(angle) * spd,
        Math.abs(Math.sin(angle)) * spd + 3.0,
        (Math.random() - 0.5) * 3.0
      );
      d.angularVelocity.set(
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0
      );
    }
  }

  public update(
    dt: number,
    time: number,
    platforms: { x: number; y: number; width: number; height: number }[],
    groundY: number = -3.70
  ) {
    // --------------------------------------------------------
    // A. Debris Simulation after Destruction
    // --------------------------------------------------------
    if (this.isDestroyed) {
      if (this.destructionTimer > 0) {
        this.destructionTimer -= dt;
        for (const d of this.debrisPool) {
          if (!d.active) continue;
          d.age += dt;
          if (d.age >= d.maxLife) {
            d.active = false;
            d.mesh.visible = false;
            continue;
          }

          d.velocity.y -= 22.0 * dt;
          d.mesh.position.addScaledVector(d.velocity, dt);
          d.mesh.rotation.x += d.angularVelocity.x * dt;
          d.mesh.rotation.y += d.angularVelocity.y * dt;
          d.mesh.rotation.z += d.angularVelocity.z * dt;

          // Bounce off ground
          if (d.mesh.position.y <= groundY + 0.12) {
            d.mesh.position.y = groundY + 0.12;
            d.velocity.y = Math.abs(d.velocity.y) * 0.3;
            d.velocity.x *= 0.8;
          }
        }

        if (this.destructionTimer <= 0) {
          for (const d of this.debrisPool) {
            d.active = false;
            d.mesh.visible = false;
          }
        }
      }
      return;
    }

    if (!this.active) return;

    // --------------------------------------------------------
    // B. Gravity & Translation Physics
    // --------------------------------------------------------
    this.velocity.y -= 24.0 * dt;
    if (this.velocity.y < -18.0) this.velocity.y = -18.0;

    // Move X first
    this.position.x += this.velocity.x * dt;

    // Horizontal Platform Side Collision
    for (const plat of platforms) {
      if (Math.abs(plat.x - this.position.x) < 0.05 && Math.abs(plat.y - this.position.y) < 0.05) continue;
      const platHalfW = plat.width / 2;
      const platHalfH = plat.height / 2;
      const platLeft = plat.x - platHalfW;
      const platRight = plat.x + platHalfW;
      const platBottom = plat.y - platHalfH;
      const platTop = plat.y + platHalfH;

      // Vertical overlap check
      if (this.position.y + this.halfH > platBottom + 0.05 && this.position.y - this.halfH < platTop - 0.05) {
        if (this.position.x + this.halfW > platLeft && this.position.x < plat.x) {
          this.position.x = platLeft - this.halfW;
          this.velocity.x = -this.velocity.x * 0.25;
        } else if (this.position.x - this.halfW < platRight && this.position.x > plat.x) {
          this.position.x = platRight + this.halfW;
          this.velocity.x = -this.velocity.x * 0.25;
        }
      }
    }

    // Move Y second
    this.position.y += this.velocity.y * dt;

    // Vertical Landing: Platforms
    let landed = false;
    let currentSupportY = groundY;

    for (const plat of platforms) {
      if (Math.abs(plat.x - this.position.x) < 0.05 && Math.abs(plat.y - this.position.y) < 0.05) continue;
      const platHalfW = plat.width / 2;
      const platHalfH = plat.height / 2;
      const platLeft = plat.x - platHalfW;
      const platRight = plat.x + platHalfW;
      const platTop = plat.y + platHalfH;

      if (this.position.x + this.halfW * 0.7 > platLeft && this.position.x - this.halfW * 0.7 < platRight) {
        if (this.position.y - this.halfH <= platTop && this.position.y - this.halfH >= platTop - 0.45 && this.velocity.y <= 0) {
          this.position.y = platTop + this.halfH;
          if (this.velocity.y < -1.5) {
            this.velocity.y = -this.velocity.y * 0.25;
          } else {
            this.velocity.y = 0;
            landed = true;
          }
          currentSupportY = platTop;
          break;
        }
      }
    }

    // Vertical Landing: Ground
    if (!landed && this.position.y - this.halfH <= groundY) {
      this.position.y = groundY + this.halfH;
      if (this.velocity.y < -1.5) {
        this.velocity.y = -this.velocity.y * 0.25;
      } else {
        this.velocity.y = 0;
        landed = true;
      }
      currentSupportY = groundY;
    }

    this.onGround = landed;

    // Ground Friction & Settling
    if (this.onGround) {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * 7.5);
      if (Math.abs(this.velocity.x) < 0.05) this.velocity.x = 0;

      // Settle tilt rotation upright on solid surface
      this.crateMesh.rotation.z = THREE.MathUtils.lerp(this.crateMesh.rotation.z, 0, dt * 8.0);
      this.angularVelocity = 0;
    } else {
      this.crateMesh.rotation.z += this.angularVelocity * dt;
      this.angularVelocity = THREE.MathUtils.lerp(this.angularVelocity, 0, dt * 1.5);
    }

    // --------------------------------------------------------
    // C. Bullet Hit Jiggle Reaction
    // --------------------------------------------------------
    if (this.jiggleTimer > 0) {
      this.jiggleTimer -= dt;
      const prog = this.jiggleTimer / 0.28;
      const wobble = Math.sin(time * 38.0) * prog * 0.22;
      this.crateMesh.scale.set(1.0 + wobble, 1.0 - wobble, 1.0 + wobble * 0.5);
    } else {
      this.crateMesh.scale.set(1, 1, 1);
    }

    // --------------------------------------------------------
    // D. Ground Contact Shadow
    // --------------------------------------------------------
    if (this.shadowMesh) {
      this.shadowMesh.position.set(this.position.x, currentSupportY + 0.015, 0);
      const heightAbove = Math.max(0, (this.position.y - this.halfH) - currentSupportY);
      const sScale = Math.max(0.3, 1.0 - heightAbove * 0.25);
      this.shadowMesh.scale.set(sScale, sScale, sScale);
      (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.35 - heightAbove * 0.12);
    }
  }

  public destroy(scene: THREE.Scene) {
    this.active = false;
    scene.remove(this.group);
    if (this.shadowMesh) scene.remove(this.shadowMesh);
    for (const d of this.debrisPool) {
      scene.remove(d.mesh);
    }
  }
}
