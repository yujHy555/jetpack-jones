import * as THREE from 'three';

interface SlimeParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface ShrapnelPiece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

interface SlimePuddle {
  mesh: THREE.Mesh;
  age: number;
  maxLife: number;
  baseScale: number;
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
 * Redesigned Alien Slime Blob
 * Features:
 * - Detailed multi-layered amoebic body with cellular spots and glowing nucleus
 * - 1 Giant tracking center eye + 2 twitching satellite stalk eyes
 * - Dynamic lingering slime puddles / trail left on terrain
 * - Exaggerated cartoon squash & stretch physics
 * - Ultra-satisfying death explosion: 24 juicy slime droplets + 12 hard shell shrapnel shards + expanding slime shockwave ring
 */
export class EnemyBlob {
  public group: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public radius: number = 0.58;
  public health: number = 2;
  public active: boolean = true;
  public isGrounded: boolean = true;

  // Body & Stalks
  private bodyMesh: THREE.Mesh;
  private coreMesh: THREE.Mesh;
  private eyeCenterGroup: THREE.Group;
  private centerPupilMesh: THREE.Mesh;
  private stalkEyeLeft: THREE.Group;
  private stalkEyeRight: THREE.Group;
  private stalkPupilL: THREE.Mesh;
  private stalkPupilR: THREE.Mesh;

  // AI & Physics
  private hopTimer: number = 0;
  private hopCooldown: number = 1.35;
  private patrolDir: number = 1;
  private minX: number;
  private maxX: number;
  public baseY: number;
  private landingSquashTimer: number = 0;

  // Slime Trail System
  private static puddleGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.02, 10);
  private static puddleMat = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.75,
  });
  private slimePuddles: SlimePuddle[] = [];
  private puddleTimer: number = 0;

  // Juicy Blobby Explosion & Shrapnel Pool
  private static dropletGeo = new THREE.SphereGeometry(0.12, 8, 8);
  private static dropletMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
  private static dropletMatPink = new THREE.MeshBasicMaterial({ color: 0xcc00ff });
  private dropletPool: SlimeParticle[] = [];

  private static shrapnelGeo = new THREE.TetrahedronGeometry(0.14, 0);
  private static shrapnelMat = new THREE.MeshStandardMaterial({
    color: 0x1f0b2b,
    roughness: 0.3,
    metalness: 0.8,
  });
  private shrapnelPool: ShrapnelPiece[] = [];

  // Shockwave Ring
  private shockwaveRing: THREE.Mesh;

  constructor(scene: THREE.Scene, startX: number, startY: number, patrolRange: number = 3.0) {
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.set(startX, startY, 0);
    this.baseY = startY;
    this.minX = startX - patrolRange;
    this.maxX = startX + patrolRange;
    this.patrolDir = Math.random() < 0.5 ? 1 : -1;
    this.hopTimer = Math.random() * this.hopCooldown;

    // 1. Detailed Multi-Layered Gelatinous Slime Body
    const bodyGeo = new THREE.SphereGeometry(0.52, 20, 16);
    bodyGeo.scale(1.15, 0.95, 1.0);
    bodyGeo.translate(0, 0.44, 0); // Pivot firmly at base (y=0 touches surface)

    const slimeMat = new THREE.MeshStandardMaterial({
      color: 0x22ee15,
      roughness: 0.18,
      metalness: 0.12,
      transparent: true,
      opacity: 0.90,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, slimeMat);
    this.group.add(this.bodyMesh);

    // Decorative cellular spots / vacuoles on the membrane
    const spotGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x76ff03 });
    const spotOffsets = [
      [-0.28, 0.35, 0.3],
      [0.25, 0.28, 0.32],
      [-0.15, 0.65, 0.28],
      [0.18, 0.62, 0.26],
      [0.0, 0.22, 0.42],
    ];
    for (const [sx, sy, sz] of spotOffsets) {
      const spot = new THREE.Mesh(spotGeo, spotMat);
      spot.position.set(sx, sy, sz);
      this.bodyMesh.add(spot);
    }

    // 2. Inner Glowing Amoebic Nucleus
    const coreGeo = new THREE.SphereGeometry(0.26, 12, 10);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xd500f9 });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.position.set(0, 0.42, 0);
    this.group.add(this.coreMesh);

    // 3. Giant Expressive Center Eye
    this.eyeCenterGroup = new THREE.Group();
    this.eyeCenterGroup.position.set(0.24, 0.50, 0.18);
    this.group.add(this.eyeCenterGroup);

    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.eyeCenterGroup.add(eyeWhite);

    const pupilGeo = new THREE.SphereGeometry(0.10, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    this.centerPupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    this.centerPupilMesh.position.set(0.12, 0, 0);
    this.eyeCenterGroup.add(this.centerPupilMesh);

    // 4. Dual Twitching Satellite Stalk Eyes
    const createStalkEye = (zSign: number) => {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(-0.05, 0.75, zSign * 0.26);

      // Organic stem
      const stemGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.22, 8);
      stemGeo.translate(0, 0.11, 0);
      const stem = new THREE.Mesh(stemGeo, slimeMat);
      stem.rotation.z = -0.2;
      stalkGroup.add(stem);

      // Little eyeball
      const miniEye = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      miniEye.position.set(-0.04, 0.22, 0);
      stalkGroup.add(miniEye);

      const miniPupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        pupilMat
      );
      miniPupil.position.set(0.05, 0, 0);
      miniEye.add(miniPupil);

      this.group.add(stalkGroup);
      return { stalkGroup, miniPupil };
    };

    const eyeL = createStalkEye(1);
    this.stalkEyeLeft = eyeL.stalkGroup;
    this.stalkPupilL = eyeL.miniPupil;

    const eyeR = createStalkEye(-1);
    this.stalkEyeRight = eyeR.stalkGroup;
    this.stalkPupilR = eyeR.miniPupil;

    scene.add(this.group);

    // 5. Slime Trail Puddles Pool
    for (let i = 0; i < 12; i++) {
      const pMesh = new THREE.Mesh(EnemyBlob.puddleGeo, EnemyBlob.puddleMat);
      pMesh.visible = false;
      scene.add(pMesh);
      this.slimePuddles.push({
        mesh: pMesh,
        age: 0,
        maxLife: 2.2,
        baseScale: 1.0,
        active: false,
      });
    }

    // 6. Juicy Slime Explosion Droplets Pool (24 particles)
    for (let i = 0; i < 24; i++) {
      const mat = i % 3 === 0 ? EnemyBlob.dropletMatPink : EnemyBlob.dropletMat;
      const p = new THREE.Mesh(EnemyBlob.dropletGeo, mat);
      p.visible = false;
      scene.add(p);
      this.dropletPool.push({
        mesh: p,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.65,
        baseScale: 0.8 + Math.random() * 0.5,
        active: false,
      });
    }

    // 7. Chitin Shrapnel Shards Pool (12 pieces)
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(EnemyBlob.shrapnelGeo, EnemyBlob.shrapnelMat);
      s.visible = false;
      scene.add(s);
      this.shrapnelPool.push({
        mesh: s,
        velocity: new THREE.Vector3(),
        rotSpeed: new THREE.Vector3(),
        age: 0,
        maxLife: 0.75,
        active: false,
      });
    }

    // 8. Expanding Slime Shockwave Ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.45, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.visible = false;
    scene.add(this.shockwaveRing);
  }

  public takeDamage(amount: number = 1): boolean {
    this.health -= amount;
    this.explodeBlobbyDeath(false); // Small splatter

    if (this.health <= 0) {
      this.explodeBlobbyDeath(true); // Epic massive splatter & shrapnel!
      this.active = false;
      this.group.visible = false;
      return true;
    }

    // Hit flash
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    setTimeout(() => {
      if (this.active) {
        (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x22ee15);
      }
    }, 90);

    return false;
  }

  private explodeBlobbyDeath(isFatal: boolean) {
    const count = isFatal ? 24 : 8;

    // A. Juicy Slime Droplets
    for (let i = 0; i < count; i++) {
      const dp = this.dropletPool.find(p => !p.active);
      if (!dp) continue;

      dp.active = true;
      dp.age = 0;
      dp.maxLife = 0.45 + Math.random() * 0.35;
      dp.mesh.position.copy(this.position);
      dp.mesh.position.y += 0.4;

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = isFatal ? (6.5 + Math.random() * 8.0) : (4.0 + Math.random() * 4.0);
      dp.velocity.set(
        Math.cos(angle) * speed,
        Math.abs(Math.sin(angle)) * speed * 0.8 + 2.5,
        (Math.random() - 0.5) * 4.0
      );
      dp.mesh.scale.set(dp.baseScale, dp.baseScale, dp.baseScale);
      dp.mesh.visible = true;
    }

    // B. Hard Chitin Shrapnel Shards (only on fatal kill)
    if (isFatal) {
      for (let i = 0; i < 12; i++) {
        const sp = this.shrapnelPool.find(p => !p.active);
        if (!sp) continue;

        sp.active = true;
        sp.age = 0;
        sp.maxLife = 0.55 + Math.random() * 0.35;
        sp.mesh.position.copy(this.position);
        sp.mesh.position.y += 0.4;

        sp.velocity.set(
          (Math.random() - 0.5) * 12.0,
          Math.random() * 9.0 + 3.0,
          (Math.random() - 0.5) * 4.0
        );
        sp.rotSpeed.set(
          (Math.random() - 0.5) * 18.0,
          (Math.random() - 0.5) * 18.0,
          (Math.random() - 0.5) * 18.0
        );
        sp.mesh.visible = true;
      }

      // C. Shockwave Ring
      this.shockwaveRing.position.copy(this.position);
      this.shockwaveRing.position.y += 0.05;
      this.shockwaveRing.scale.set(0.5, 0.5, 0.5);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = 0.9;
      this.shockwaveRing.visible = true;
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
    this.puddleTimer += dt;

    // 1. Reactive Eye Tracking
    const angleToPlayer = Math.atan2(playerY - (this.position.y + 0.4), playerX - this.position.x);
    this.centerPupilMesh.position.set(
      Math.cos(angleToPlayer) * 0.12,
      Math.sin(angleToPlayer) * 0.09,
      0.08
    );

    // Stalk eyes twitch and peer inquisitively
    const twitchL = Math.sin(time * 8.0) * 0.15;
    const twitchR = Math.cos(time * 7.0) * 0.15;
    this.stalkEyeLeft.rotation.z = twitchL;
    this.stalkEyeRight.rotation.z = twitchR;
    this.stalkPupilL.position.set(Math.cos(angleToPlayer) * 0.04, Math.sin(angleToPlayer) * 0.03, 0);
    this.stalkPupilR.position.set(Math.cos(angleToPlayer) * 0.04, Math.sin(angleToPlayer) * 0.03, 0);

    // 2. Identify Current Supporting Surface
    let surfaceY = GROUND_Y;
    let currentPlatform: PlatformBound | null = null;

    for (const plat of platforms) {
      const pTop = plat.y + plat.height / 2;
      const pLeft = plat.x - plat.width / 2;
      const pRight = plat.x + plat.width / 2;

      if (this.position.x >= pLeft - 0.2 && this.position.x <= pRight + 0.2) {
        if (this.position.y >= pTop - 0.4 && pTop > surfaceY) {
          surfaceY = pTop;
          currentPlatform = plat;
        }
      }
    }

    // Confine elevated patrol bounds so it never hops off into thin air
    if (currentPlatform) {
      this.minX = Math.max(this.minX, currentPlatform.x - currentPlatform.width / 2 + 0.35);
      this.maxX = Math.min(this.maxX, currentPlatform.x + currentPlatform.width / 2 - 0.35);
    }

    // 3. EXAGGERATED CARTOON SQUASH & STRETCH
    const distToPlayer = Math.abs(playerX - this.position.x);

    // A. Deep Anticipation Squash before jump (squashes wide and flat!)
    if (this.hopTimer >= this.hopCooldown - 0.25 && this.isGrounded) {
      const squashProg = (this.hopTimer - (this.hopCooldown - 0.25)) / 0.25;
      const sy = 1.0 - squashProg * 0.55; // Compresses down to 0.45
      const sx = 1.0 + squashProg * 0.55; // Bulges out to 1.55
      this.bodyMesh.scale.set(sx, sy, sx);
    }

    // B. Hop Impulse (Stretches tall and thin!)
    if (this.hopTimer >= this.hopCooldown && this.isGrounded) {
      this.hopTimer = 0;
      this.isGrounded = false;

      // Hop towards player if close and within bounds, else patrol
      let hopDir = this.patrolDir;
      if (distToPlayer < 8.5) {
        const toPlayer = playerX > this.position.x ? 1 : -1;
        if (
          (toPlayer > 0 && this.position.x < this.maxX) ||
          (toPlayer < 0 && this.position.x > this.minX)
        ) {
          hopDir = toPlayer;
        }
      }

      this.velocity.x = hopDir * (2.6 + Math.random() * 1.4);
      this.velocity.y = 6.8 + Math.random() * 1.5;

      // High elastic stretch on jump!
      this.bodyMesh.scale.set(0.65, 1.6, 0.65);

      // Deposit a lingering slime trail puddle upon takeoff
      this.spawnSlimePuddle(this.position.x, surfaceY);
    }

    // 4. Air & Ground Physics
    if (!this.isGrounded) {
      this.velocity.y -= 18.0 * dt;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      // In mid-air, stretch dynamically aligns with vertical velocity
      const airStretchY = 1.0 + (this.velocity.y / 14.0) * 0.4;
      const airSquashX = 1.0 - (this.velocity.y / 14.0) * 0.2;
      this.bodyMesh.scale.lerp(new THREE.Vector3(airSquashX, airStretchY, airSquashX), dt * 10);

      // Land on surface
      if (this.position.y <= surfaceY) {
        this.position.y = surfaceY;
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.landingSquashTimer = 0.35;

        // Massive Landing Impact Squash
        this.bodyMesh.scale.set(1.5, 0.5, 1.5);

        // Deposit sticky slime puddle on landing!
        this.spawnSlimePuddle(this.position.x, surfaceY);

        if (this.position.x >= this.maxX) this.patrolDir = -1;
        if (this.position.x <= this.minX) this.patrolDir = 1;
      }
    } else {
      if (Math.abs(this.position.y - surfaceY) < 0.2) {
        this.position.y = surfaceY;
      } else if (this.position.y > surfaceY) {
        this.isGrounded = false;
      }

      // Landing wobble dampening
      if (this.landingSquashTimer > 0) {
        this.landingSquashTimer -= dt;
        const wobble = Math.sin((0.35 - this.landingSquashTimer) * 22.0) * (this.landingSquashTimer / 0.35) * 0.3;
        this.bodyMesh.scale.set(1.0 - wobble, 1.0 + wobble, 1.0 - wobble);
      } else {
        // Subtle gelatinous breathing wobble
        const breathe = Math.sin(time * 5.0) * 0.05;
        this.bodyMesh.scale.set(1.0 - breathe, 1.0 + breathe, 1.0 - breathe);
      }
    }

    // Turn around at patrol boundary
    if (this.position.x >= this.maxX) this.patrolDir = -1;
    if (this.position.x <= this.minX) this.patrolDir = 1;

    // Nucleus gentle pulse
    const corePulse = 1.0 + Math.sin(time * 8.0) * 0.12;
    this.coreMesh.scale.set(corePulse, corePulse, corePulse);

    this.updateParticles(dt);
  }

  private spawnSlimePuddle(x: number, y: number) {
    const puddle = this.slimePuddles.find(p => !p.active);
    if (!puddle) return;

    puddle.active = true;
    puddle.age = 0;
    puddle.maxLife = 2.0 + Math.random() * 0.8;
    puddle.baseScale = 0.85 + Math.random() * 0.35;
    puddle.mesh.position.set(x + (Math.random() - 0.5) * 0.2, y + 0.015, 0);
    puddle.mesh.scale.set(puddle.baseScale, 1.0, puddle.baseScale);
    (puddle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
    puddle.mesh.visible = true;
  }

  private updateParticles(dt: number) {
    // 1. Slime Trail Puddles
    for (const p of this.slimePuddles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const prog = p.age / p.maxLife;
      // Bubbling fade out
      const s = p.baseScale * (1.0 - prog * 0.35);
      p.mesh.scale.set(s, 1.0, s);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - prog) * 0.75;
    }

    // 2. Juicy Slime Droplets
    for (const dp of this.dropletPool) {
      if (!dp.active) continue;
      dp.age += dt;
      if (dp.age >= dp.maxLife) {
        dp.active = false;
        dp.mesh.visible = false;
        continue;
      }

      dp.velocity.y -= 18.0 * dt;
      dp.mesh.position.addScaledVector(dp.velocity, dt);

      // Droplets stretch along flight velocity vector
      const speed = dp.velocity.length();
      const prog = dp.age / dp.maxLife;
      const s = dp.baseScale * (1.0 - prog * 0.7);
      dp.mesh.scale.set(s * 0.7, s * (1.0 + speed * 0.08), s * 0.7);
    }

    // 3. Chitin Shrapnel Pieces
    for (const sp of this.shrapnelPool) {
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.maxLife) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }

      sp.velocity.y -= 22.0 * dt;
      sp.mesh.position.addScaledVector(sp.velocity, dt);
      sp.mesh.rotation.x += sp.rotSpeed.x * dt;
      sp.mesh.rotation.y += sp.rotSpeed.y * dt;
      sp.mesh.rotation.z += sp.rotSpeed.z * dt;
    }

    // 4. Slime Shockwave Ring
    if (this.shockwaveRing.visible) {
      const curScale = this.shockwaveRing.scale.x;
      if (curScale < 4.2) {
        const nextScale = curScale + dt * 14.0;
        this.shockwaveRing.scale.set(nextScale, nextScale, nextScale);
        (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          0.9 * (1.0 - curScale / 4.2)
        );
      } else {
        this.shockwaveRing.visible = false;
      }
    }
  }

  public destroy(scene: THREE.Scene) {
    this.active = false;
    scene.remove(this.group);
    scene.remove(this.shockwaveRing);
    for (const p of this.slimePuddles) scene.remove(p.mesh);
    for (const dp of this.dropletPool) scene.remove(dp.mesh);
    for (const sp of this.shrapnelPool) scene.remove(sp.mesh);
  }
}
