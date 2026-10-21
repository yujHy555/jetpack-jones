import * as THREE from 'three';

interface SlimeParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface StylizedBubbleSplat {
  mesh: THREE.Group;
  coreMesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
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

  // Body & Googly Eyes with Pupils
  private bodyMesh: THREE.Mesh;
  private coreMesh: THREE.Mesh;
  private eyeCenterGroup: THREE.Group;
  private centerGooglyPupil: THREE.Group;
  private stalkEyeLeft: THREE.Group;
  private stalkEyeRight: THREE.Group;
  private stalkGooglyPupilL: THREE.Group;
  private stalkGooglyPupilR: THREE.Group;

  // Googly Physics State
  private centerPupilPos = new THREE.Vector2(0, 0);
  private centerPupilVel = new THREE.Vector2(0, 0);
  private stalkPupilPosL = new THREE.Vector2(0, 0);
  private stalkPupilVelL = new THREE.Vector2(0, 0);
  private stalkPupilPosR = new THREE.Vector2(0, 0);
  private stalkPupilVelR = new THREE.Vector2(0, 0);
  private eyeDizzySpin: number = 0;

  // AI & Physics
  private hopTimer: number = 0;
  private hopCooldown: number = 1.35;
  private patrolDir: number = 1;
  private minX: number;
  private maxX: number;
  public baseY: number;
  private landingSquashTimer: number = 0;

  // Slime Trail System (Cleaned up completely on death!)
  private static puddleGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.02, 10);
  private static puddleMat = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.75,
  });
  private slimePuddles: SlimePuddle[] = [];
  private puddleTimer: number = 0;

  // 2D Stylized Comic Bubble Splat FX Pool (Zero remains left behind!)
  private bubbleSplatPool: StylizedBubbleSplat[] = [];
  private comicSplatBurstMesh: THREE.Mesh;
  private comicSplatBurstTimer: number = 0;

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

    // Large Glossy White Sclera
    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.05,
      })
    );
    this.eyeCenterGroup.add(eyeWhite);

    // Googly Pupil Group (Sitting proudly on front surface facing camera Z > 0!)
    this.centerGooglyPupil = new THREE.Group();
    this.centerGooglyPupil.position.set(0, 0, 0.202);
    this.eyeCenterGroup.add(this.centerGooglyPupil);

    const mainPupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Deep Solid Pure Black Googly Pupil Disc
    const centerPupilDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
      mainPupilMat
    );
    centerPupilDisc.rotation.x = Math.PI / 2; // Face forward towards camera!
    this.centerGooglyPupil.add(centerPupilDisc);

    // Cute White Specular Reflection Pips on Googly Eye
    const centerShinePip = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      shineMat
    );
    centerShinePip.position.set(0.035, 0.035, 0.04);
    this.centerGooglyPupil.add(centerShinePip);

    const centerShinePipSmall = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 6, 6),
      shineMat
    );
    centerShinePipSmall.position.set(-0.028, -0.028, 0.03);
    this.centerGooglyPupil.add(centerShinePipSmall);

    // 4. Dual Twitching Satellite Stalk Eyes with Googly Pupils
    const createStalkEye = (zSign: number) => {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(-0.05, 0.75, zSign * 0.26);

      // Organic stem
      const stemGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.22, 8);
      stemGeo.translate(0, 0.11, 0);
      const stem = new THREE.Mesh(stemGeo, slimeMat);
      stem.rotation.z = -0.2;
      stalkGroup.add(stem);

      // Eyeball Sclera
      const miniEye = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 14, 14),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.1,
        })
      );
      miniEye.position.set(-0.04, 0.22, 0);
      stalkGroup.add(miniEye);

      // Stalk Googly Pupil Group (Facing camera!)
      const stalkPupilGroup = new THREE.Group();
      stalkPupilGroup.position.set(0, 0, 0.082);
      miniEye.add(stalkPupilGroup);

      const miniPupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
        mainPupilMat
      );
      miniPupil.rotation.x = Math.PI / 2;
      stalkPupilGroup.add(miniPupil);

      const miniPip = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 6, 6),
        shineMat
      );
      miniPip.position.set(0.015, 0.015, 0.02);
      stalkPupilGroup.add(miniPip);

      this.group.add(stalkGroup);
      return { stalkGroup, stalkPupilGroup };
    };

    const eyeL = createStalkEye(1);
    this.stalkEyeLeft = eyeL.stalkGroup;
    this.stalkGooglyPupilL = eyeL.stalkPupilGroup;

    const eyeR = createStalkEye(-1);
    this.stalkEyeRight = eyeR.stalkGroup;
    this.stalkGooglyPupilR = eyeR.stalkPupilGroup;

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

    // 6. 2D STYLIZED AAA COMIC BUBBLE SPLAT FX (Zero remains left behind!)
    const colors = [0x39ff14, 0x00f5ff, 0xff00aa, 0xffff00];
    for (let i = 0; i < 22; i++) {
      const bubbleGroup = new THREE.Group();

      // Cartoon Dark Rim
      const rim = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x050505 })
      );
      bubbleGroup.add(rim);

      // Bright Candy Core
      const coreColor = colors[i % colors.length];
      const coreMat = new THREE.MeshBasicMaterial({ color: coreColor });
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 10, 10),
        coreMat
      );
      bubbleGroup.add(core);

      // Specular Shine Pip
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 6),
        shineMat
      );
      pip.position.set(0.04, 0.04, 0.05);
      bubbleGroup.add(pip);

      bubbleGroup.visible = false;
      scene.add(bubbleGroup);

      this.bubbleSplatPool.push({
        mesh: bubbleGroup,
        coreMesh: core,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.32 + Math.random() * 0.12,
        baseScale: 0.85 + Math.random() * 0.45,
        active: false,
      });
    }

    // 7. Stylized Comic Pop Starburst Splat Ring
    const splatShape = new THREE.Shape();
    const points = 10;
    for (let p = 0; p < points * 2; p++) {
      const r = p % 2 === 0 ? 0.65 : 0.28;
      const a = (p / (points * 2)) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (p === 0) splatShape.moveTo(px, py);
      else splatShape.lineTo(px, py);
    }
    splatShape.closePath();

    const starburstGeo = new THREE.ShapeGeometry(splatShape);
    const starburstMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.comicSplatBurstMesh = new THREE.Mesh(starburstGeo, starburstMat);
    this.comicSplatBurstMesh.visible = false;
    scene.add(this.comicSplatBurstMesh);
  }

  public takeDamage(amount: number = 1): boolean {
    this.health -= amount;

    // Googly eyes spin violently on hit!
    this.eyeDizzySpin += 6.0;
    this.centerPupilVel.x += (Math.random() - 0.5) * 3.5;
    this.centerPupilVel.y += (Math.random() - 0.5) * 3.5;

    // Hit squash impulse
    this.bodyMesh.scale.set(1.4, 0.65, 1.4);

    if (this.health <= 0) {
      // Clean up ALL slime trail puddles immediately: NO REMAINS LEFT BEHIND!
      for (const p of this.slimePuddles) {
        p.active = false;
        p.mesh.visible = false;
      }

      // Awesome 2D Stylized Bubble Splat Burst
      this.triggerStylizedBubbleSplat();
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

  /**
   * 2D Stylized Bubble Splat Burst FX (Snappy, juicy AAA comic pop with ZERO remains!)
   */
  private triggerStylizedBubbleSplat() {
    const origin = this.position.clone();
    origin.y += 0.45;

    // 1. Comic Pop Starburst Splat Flash
    this.comicSplatBurstMesh.position.copy(origin);
    this.comicSplatBurstMesh.position.z += 0.08;
    this.comicSplatBurstMesh.scale.set(0.3, 0.3, 0.3);
    (this.comicSplatBurstMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.comicSplatBurstMesh.visible = true;
    this.comicSplatBurstTimer = 0.28;

    // 2. Stylized Bubble Splat Droplets
    const count = this.bubbleSplatPool.length;
    for (let i = 0; i < count; i++) {
      const b = this.bubbleSplatPool[i];
      b.active = true;
      b.age = 0;
      b.maxLife = 0.28 + Math.random() * 0.12; // Snappy AAA pop
      b.mesh.position.copy(origin);

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 7.0 + Math.random() * 8.5;
      b.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.9 + 2.0,
        (Math.random() - 0.5) * 3.0
      );
      b.mesh.scale.set(b.baseScale, b.baseScale, b.baseScale);
      b.mesh.visible = true;
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

    // ----------------------------------------------------
    // 1. GOOGLY EYES WITH PUPIL PHYSICS & INERTIA
    // ----------------------------------------------------
    const dx = playerX - this.position.x;
    const dy = playerY - (this.position.y + 0.5);
    const lookAngle = Math.atan2(dy, dx);
    const lookDist = Math.min(1.0, Math.hypot(dx, dy) / 6.0);

    // Target pupil look position (soft pull towards player)
    let targetPx = Math.cos(lookAngle) * 0.065 * lookDist;
    let targetPy = Math.sin(lookAngle) * 0.065 * lookDist - 0.02; // Soft gravity sag

    // Inertial displacement from blob acceleration (hops, landings)
    const accelX = -this.velocity.x * 0.035;
    const accelY = -this.velocity.y * 0.025;

    // Crazy dizzy spin oscillation if hit
    if (this.eyeDizzySpin > 0.01) {
      this.eyeDizzySpin = THREE.MathUtils.damp(this.eyeDizzySpin, 0, 5.0, dt);
      const spinAngle = time * 26.0;
      targetPx += Math.cos(spinAngle) * 0.065 * (this.eyeDizzySpin / 6.0);
      targetPy += Math.sin(spinAngle) * 0.065 * (this.eyeDizzySpin / 6.0);
    }

    // Spring-Damper simulation for loose googly pupil
    const kSpring = 90.0;
    const kDamp = 10.0;
    const fx = -kSpring * (this.centerPupilPos.x - targetPx) + accelX * 35.0;
    const fy = -kSpring * (this.centerPupilPos.y - targetPy) + accelY * 35.0;

    this.centerPupilVel.x = (this.centerPupilVel.x + fx * dt) / (1.0 + kDamp * dt);
    this.centerPupilVel.y = (this.centerPupilVel.y + fy * dt) / (1.0 + kDamp * dt);

    this.centerPupilPos.x += this.centerPupilVel.x * dt;
    this.centerPupilPos.y += this.centerPupilVel.y * dt;

    // Clamp inside spherical googly eye casing and bounce
    const rMax = 0.085;
    const curDist = Math.hypot(this.centerPupilPos.x, this.centerPupilPos.y);
    if (curDist > rMax) {
      this.centerPupilPos.x = (this.centerPupilPos.x / curDist) * rMax;
      this.centerPupilPos.y = (this.centerPupilPos.y / curDist) * rMax;
      this.centerPupilVel.x *= -0.55;
      this.centerPupilVel.y *= -0.55;
    }

    // Position center googly pupil on the outer visible hemisphere (Z > 0)
    const px = this.centerPupilPos.x;
    const py = this.centerPupilPos.y;
    const pz = Math.sqrt(Math.max(0.02, 0.205 * 0.205 - px * px - py * py));
    this.centerGooglyPupil.position.set(px, py, pz);

    // Stalk Eyes loose spring wobble
    const twitchL = Math.sin(time * 7.5) * 0.18 + Math.cos(time * 13.0) * 0.08;
    const twitchR = Math.cos(time * 6.5) * 0.18 + Math.sin(time * 11.0) * 0.08;
    this.stalkEyeLeft.rotation.z = twitchL;
    this.stalkEyeRight.rotation.z = twitchR;

    this.stalkPupilPosL.x = THREE.MathUtils.lerp(this.stalkPupilPosL.x, targetPx * 0.45, dt * 14);
    this.stalkPupilPosL.y = THREE.MathUtils.lerp(this.stalkPupilPosL.y, targetPy * 0.45, dt * 14);
    const stalkZ_L = Math.sqrt(Math.max(0.005, 0.084 * 0.084 - this.stalkPupilPosL.x ** 2 - this.stalkPupilPosL.y ** 2));
    this.stalkGooglyPupilL.position.set(this.stalkPupilPosL.x, this.stalkPupilPosL.y, stalkZ_L);

    this.stalkPupilPosR.x = THREE.MathUtils.lerp(this.stalkPupilPosR.x, targetPx * 0.45, dt * 14);
    this.stalkPupilPosR.y = THREE.MathUtils.lerp(this.stalkPupilPosR.y, targetPy * 0.45, dt * 14);
    const stalkZ_R = Math.sqrt(Math.max(0.005, 0.084 * 0.084 - this.stalkPupilPosR.x ** 2 - this.stalkPupilPosR.y ** 2));
    this.stalkGooglyPupilR.position.set(this.stalkPupilPosR.x, this.stalkPupilPosR.y, stalkZ_R);

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
    // 1. Slime Trail Puddles (only active while alive)
    for (const p of this.slimePuddles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const prog = p.age / p.maxLife;
      const s = p.baseScale * (1.0 - prog * 0.35);
      p.mesh.scale.set(s, 1.0, s);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - prog) * 0.75;
    }

    // 2. 2D Stylized Comic Bubble Splats (Zero remains left behind!)
    for (const b of this.bubbleSplatPool) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.maxLife) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }

      b.velocity.y -= 14.0 * dt;
      b.mesh.position.addScaledVector(b.velocity, dt);

      // AAA Snappy Pop: bubble stretches along motion then pops to zero scale!
      const prog = b.age / b.maxLife;
      const popProg = Math.max(0, (prog - 0.65) / 0.35); // Rapid collapse in final 35% of life
      const scaleMultiplier = (1.0 - popProg * popProg);
      const speed = b.velocity.length();
      const s = b.baseScale * scaleMultiplier;

      // Stretch along velocity vector
      b.mesh.scale.set(s * 0.8, s * (1.0 + Math.min(1.2, speed * 0.07)), s * 0.8);
      b.mesh.rotation.z = Math.atan2(b.velocity.y, b.velocity.x) - Math.PI / 2;
    }

    // 3. Comic Starburst Splat Ring
    if (this.comicSplatBurstMesh.visible && this.comicSplatBurstTimer > 0) {
      this.comicSplatBurstTimer -= dt;
      const prog = 1.0 - (this.comicSplatBurstTimer / 0.28);
      const curScale = 0.3 + Math.sin(prog * Math.PI * 0.5) * 2.2;
      this.comicSplatBurstMesh.scale.set(curScale, curScale, curScale);
      this.comicSplatBurstMesh.rotation.z += dt * 4.0;
      (this.comicSplatBurstMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1.0 - prog * prog
      );

      if (this.comicSplatBurstTimer <= 0) {
        this.comicSplatBurstMesh.visible = false;
      }
    }
  }

  public destroy(scene: THREE.Scene) {
    this.active = false;
    scene.remove(this.group);
    scene.remove(this.comicSplatBurstMesh);
    for (const p of this.slimePuddles) scene.remove(p.mesh);
    for (const b of this.bubbleSplatPool) scene.remove(b.mesh);
  }
}
