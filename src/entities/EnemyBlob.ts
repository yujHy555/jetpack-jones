import * as THREE from 'three';

interface SlimeParticle {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface PuffCloud {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface SparkleStar {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
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
 * - Detailed gelatinous amoebic body with cellular spots and glowing nucleus
 * - 1 Giant tracking center eye + 2 satellite stalk eyes with prominent black googly pupils
 * - Exaggerated cartoon squash & stretch physics
 * - Epic stylized cartoon death animation:
 *   Micro hit-stop freeze -> dramatic squish & neon flash -> explosive detonation
 *   with comic starburst spike ring, dual expanding shockwave rings, 28 velocity-stretched candy droplets,
 *   billowing cartoon puff clouds, and twinkling cross sparkles!
 * - Zero lingering remains left behind (clean environment, no black blobs/puddles).
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
  public patrolDir: number = 1;
  private minX: number;
  private maxX: number;
  public baseY: number;
  private landingSquashTimer: number = 0;

  // Epic Death Sequence State
  private isDying: boolean = false;
  private deathFreezeTimer: number = 0;
  private jiggleTimer: number = 0;
  private shadowMesh: THREE.Mesh;

  // Epic Stylized Comic Death FX Pools (ZERO remains left behind!)
  private dropletPool: SlimeParticle[] = [];
  private puffPool: PuffCloud[] = [];
  private sparklePool: SparkleStar[] = [];
  private comicStarburstMesh: THREE.Mesh;
  private comicShockRing1: THREE.Mesh;
  private comicShockRing2: THREE.Mesh;
  private fxTimer: number = 0;

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
    bodyGeo.translate(0, 0.44, 0); // Pivot firmly at base

    const slimeMat = new THREE.MeshStandardMaterial({
      color: 0x22ee15,
      roughness: 0.18,
      metalness: 0.12,
      transparent: true,
      opacity: 0.90,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, slimeMat);
    this.group.add(this.bodyMesh);

    // Simple Round Toon Style Shadow Decal
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

    // Decorative cellular spots on the membrane
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

    // Glossy White Sclera
    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.05,
      })
    );
    this.eyeCenterGroup.add(eyeWhite);

    // Deep Solid Pure Black Googly Pupil Disc (Front facing Z > 0)
    this.centerGooglyPupil = new THREE.Group();
    const mainPupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pupilDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.02, 16),
      mainPupilMat
    );
    pupilDisc.rotation.x = Math.PI / 2;
    this.centerGooglyPupil.add(pupilDisc);

    // Specular Glint Reflection Pips
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pipBig = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), shineMat);
    pipBig.position.set(0.032, 0.032, 0.015);
    this.centerGooglyPupil.add(pipBig);

    const pipSmall = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), shineMat);
    pipSmall.position.set(-0.025, -0.025, 0.015);
    this.centerGooglyPupil.add(pipSmall);

    this.centerGooglyPupil.position.set(0.0, 0.0, 0.198);
    this.eyeCenterGroup.add(this.centerGooglyPupil);

    // 4. Dual Twitching Satellite Eyestalks
    const createStalkEye = (side: number) => {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(side * 0.32, 0.72, 0.05);
      this.group.add(stalkGroup);

      const stalkMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.065, 0.28, 8),
        slimeMat
      );
      stalkMesh.position.y = 0.14;
      stalkMesh.rotation.z = side * -0.22;
      stalkGroup.add(stalkMesh);

      const stalkEyeGroup = new THREE.Group();
      stalkEyeGroup.position.set(side * -0.04, 0.28, 0.04);
      stalkGroup.add(stalkEyeGroup);

      const sWhite = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
      );
      stalkEyeGroup.add(sWhite);

      const stalkPupilGroup = new THREE.Group();
      const sPupilDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.015, 14),
        mainPupilMat
      );
      sPupilDisc.rotation.x = Math.PI / 2;
      stalkPupilGroup.add(sPupilDisc);

      const sPip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), shineMat);
      sPip.position.set(0.018, 0.018, 0.01);
      stalkPupilGroup.add(sPip);

      stalkPupilGroup.position.set(0.0, 0.0, 0.118);
      stalkEyeGroup.add(stalkPupilGroup);

      return { stalkGroup, stalkPupilGroup };
    };

    const eyeL = createStalkEye(1);
    this.stalkEyeLeft = eyeL.stalkGroup;
    this.stalkGooglyPupilL = eyeL.stalkPupilGroup;

    const eyeR = createStalkEye(-1);
    this.stalkEyeRight = eyeR.stalkGroup;
    this.stalkGooglyPupilR = eyeR.stalkPupilGroup;

    scene.add(this.group);

    // -----------------------------------------------------------
    // 5. EPIC STYLIZED COMIC DEATH FX POOL (Zero remains left behind!)
    // -----------------------------------------------------------

    // A. 28 Juicy Stretched Candy Slime Droplets
    const dropletColors = [0x39ff14, 0x00f5ff, 0xff007f, 0xffea00];
    for (let i = 0; i < 28; i++) {
      const dropGroup = new THREE.Group();
      const col = dropletColors[i % dropletColors.length];
      const dropMat = new THREE.MeshBasicMaterial({ color: col });

      // Core elongated sphere
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), dropMat);
      dropGroup.add(core);

      // White shine pip
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), shineMat);
      pip.position.set(0.035, 0.035, 0.04);
      dropGroup.add(pip);

      dropGroup.visible = false;
      scene.add(dropGroup);

      this.dropletPool.push({
        mesh: dropGroup,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.35 + Math.random() * 0.18,
        baseScale: 0.85 + Math.random() * 0.45,
        active: false,
      });
    }

    // B. 8 Cartoon Smoke Puff Clouds
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 8; i++) {
      const puffGroup = new THREE.Group();
      // Multi-bubble cluster
      for (let b = 0; b < 4; b++) {
        const rad = 0.12 + Math.random() * 0.08;
        const bMesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 8, 8), puffMat);
        bMesh.position.set(
          (Math.random() - 0.5) * 0.18,
          (Math.random() - 0.5) * 0.18,
          (Math.random() - 0.5) * 0.12
        );
        puffGroup.add(bMesh);
      }
      puffGroup.visible = false;
      scene.add(puffGroup);

      this.puffPool.push({
        mesh: puffGroup,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.40 + Math.random() * 0.15,
        baseScale: 0.9 + Math.random() * 0.5,
        active: false,
      });
    }

    // C. 8 Comic 4-Pointed Cross Star Sparkles
    const starShape = new THREE.Shape();
    const starPts = 4;
    for (let p = 0; p < starPts * 2; p++) {
      const r = p % 2 === 0 ? 0.35 : 0.06;
      const a = (p / (starPts * 2)) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (p === 0) starShape.moveTo(px, py);
      else starShape.lineTo(px, py);
    }
    starShape.closePath();
    const starGeo = new THREE.ShapeGeometry(starShape);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      side: THREE.DoubleSide,
      transparent: true,
    });

    for (let i = 0; i < 8; i++) {
      const sMesh = new THREE.Mesh(starGeo, starMat);
      sMesh.visible = false;
      scene.add(sMesh);

      this.sparklePool.push({
        mesh: sMesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.32 + Math.random() * 0.12,
        baseScale: 0.7 + Math.random() * 0.5,
        active: false,
      });
    }

    // D. Comic Starburst Spike Ring
    const burstShape = new THREE.Shape();
    const burstSpikes = 14;
    for (let p = 0; p < burstSpikes * 2; p++) {
      const r = p % 2 === 0 ? 0.85 : 0.32;
      const a = (p / (burstSpikes * 2)) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (p === 0) burstShape.moveTo(px, py);
      else burstShape.lineTo(px, py);
    }
    burstShape.closePath();
    const burstGeo = new THREE.ShapeGeometry(burstShape);
    const burstMat = new THREE.MeshBasicMaterial({
      color: 0xff0088,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.comicStarburstMesh = new THREE.Mesh(burstGeo, burstMat);
    this.comicStarburstMesh.visible = false;
    scene.add(this.comicStarburstMesh);

    // E. Dual Expanding Shockwave Rings
    const ringGeo1 = new THREE.RingGeometry(0.35, 0.48, 32);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.comicShockRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    this.comicShockRing1.visible = false;
    scene.add(this.comicShockRing1);

    const ringGeo2 = new THREE.RingGeometry(0.20, 0.32, 28);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.comicShockRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.comicShockRing2.visible = false;
    scene.add(this.comicShockRing2);
  }

  /**
   * Triggers damage or initiates the epic dying sequence
   */
  public takeDamage(amount: number = 1): boolean {
    if (!this.active || this.isDying) return false;

    this.health -= amount;

    // Bullet hit jiggle reaction & eye spin
    this.jiggleTimer = 0.38;
    this.eyeDizzySpin += 6.0;
    this.centerPupilVel.x += (Math.random() - 0.5) * 4.0;
    this.centerPupilVel.y += (Math.random() - 0.5) * 4.0;

    // Hit squash impulse
    this.bodyMesh.scale.set(1.4, 0.65, 1.4);

    if (this.health <= 0) {
      // ENTER EPIC DYING STATE: micro-freeze squish -> detonation
      this.isDying = true;
      this.deathFreezeTimer = 0.08;

      // Micro-freeze squash & neon flash
      this.group.scale.set(1.55, 0.42, 1.55);
      (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
      (this.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x00ffff);
      (this.bodyMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.0;
      this.eyeDizzySpin = 14.0;
      return true;
    }

    // Standard hit flash
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    setTimeout(() => {
      if (this.active && !this.isDying) {
        (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(0x22ee15);
      }
    }, 90);

    return false;
  }

  /**
   * Trigger the full epic comic detonation sequence
   */
  private triggerEpicDetonation() {
    this.active = false;
    this.group.visible = false;

    const origin = this.position.clone();
    origin.y += 0.45;

    // 1. Comic Starburst Spike Ring
    this.comicStarburstMesh.position.copy(origin);
    this.comicStarburstMesh.position.z += 0.12;
    this.comicStarburstMesh.scale.set(0.3, 0.3, 0.3);
    (this.comicStarburstMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.comicStarburstMesh.visible = true;

    // 2. Dual Concentric Shockwave Rings
    this.comicShockRing1.position.copy(origin);
    this.comicShockRing1.position.z += 0.09;
    this.comicShockRing1.scale.set(0.2, 0.2, 0.2);
    (this.comicShockRing1.material as THREE.MeshBasicMaterial).opacity = 0.95;
    this.comicShockRing1.visible = true;

    this.comicShockRing2.position.copy(origin);
    this.comicShockRing2.position.z += 0.06;
    this.comicShockRing2.scale.set(0.1, 0.1, 0.1);
    (this.comicShockRing2.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.comicShockRing2.visible = true;

    this.fxTimer = 0.38;

    // 3. 28 Stretched Candy Slime Droplets
    const dropCount = this.dropletPool.length;
    for (let i = 0; i < dropCount; i++) {
      const d = this.dropletPool[i];
      d.active = true;
      d.age = 0;
      d.mesh.position.copy(origin);

      const angle = (i / dropCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 7.5 + Math.random() * 9.5;
      d.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.95 + 2.5,
        (Math.random() - 0.5) * 2.8
      );
      d.mesh.scale.set(d.baseScale, d.baseScale, d.baseScale);
      d.mesh.visible = true;
    }

    // 4. 8 Cartoon Puff Clouds
    const puffCount = this.puffPool.length;
    for (let i = 0; i < puffCount; i++) {
      const p = this.puffPool[i];
      p.active = true;
      p.age = 0;
      p.mesh.position.copy(origin);

      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 2.5 + Math.random() * 3.5;
      p.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed + 1.2,
        (Math.random() - 0.5) * 1.5
      );
      p.mesh.scale.set(0.2, 0.2, 0.2);
      p.mesh.visible = true;
    }

    // 5. 8 Twinkling Cross Stars
    const starCount = this.sparklePool.length;
    for (let i = 0; i < starCount; i++) {
      const s = this.sparklePool[i];
      s.active = true;
      s.age = 0;
      s.mesh.position.copy(origin);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 5.0;
      s.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed + 1.8,
        0.1
      );
      s.mesh.scale.set(s.baseScale, s.baseScale, s.baseScale);
      s.mesh.visible = true;
    }
  }

  public update(
    dt: number,
    time: number,
    playerX: number,
    playerY: number,
    platforms: PlatformBound[] = []
  ) {
    // A. Handle Epic Death Sequence Micro-Freeze
    if (this.isDying) {
      if (this.deathFreezeTimer > 0) {
        this.deathFreezeTimer -= dt;
        // Jiggle and vibrate in cartoon shock!
        this.group.position.x = this.position.x + (Math.random() - 0.5) * 0.08;
        this.group.position.y = this.position.y + (Math.random() - 0.5) * 0.08;
        if (this.deathFreezeTimer <= 0) {
          this.triggerEpicDetonation();
        }
      }
      this.updateParticles(dt);
      return;
    }

    if (!this.active) {
      this.updateParticles(dt);
      return;
    }

    this.hopTimer += dt;

    // ----------------------------------------------------
    // 1. GOOGLY EYES WITH HIGH-CONTRAST BLACK PUPIL PHYSICS
    // ----------------------------------------------------
    const dx = playerX - this.position.x;
    const dy = playerY - (this.position.y + 0.5);
    const lookAngle = Math.atan2(dy, dx);
    const lookDist = Math.min(1.0, Math.hypot(dx, dy) / 6.0);

    // Target pupil look position (soft pull towards player)
    let targetPx = Math.cos(lookAngle) * 0.065 * lookDist;
    let targetPy = Math.sin(lookAngle) * 0.065 * lookDist - 0.02;

    const accelX = -this.velocity.x * 0.035;
    const accelY = -this.velocity.y * 0.025;

    if (this.eyeDizzySpin > 0.01) {
      this.eyeDizzySpin = THREE.MathUtils.damp(this.eyeDizzySpin, 0, 5.0, dt);
      const spinAngle = time * 26.0;
      targetPx += Math.cos(spinAngle) * 0.065 * (this.eyeDizzySpin / 6.0);
      targetPy += Math.sin(spinAngle) * 0.065 * (this.eyeDizzySpin / 6.0);
    }

    const kSpring = 90.0;
    const kDamp = 10.0;
    const fx = -kSpring * (this.centerPupilPos.x - targetPx) + accelX * 35.0;
    const fy = -kSpring * (this.centerPupilPos.y - targetPy) + accelY * 35.0;

    this.centerPupilVel.x = (this.centerPupilVel.x + fx * dt) / (1.0 + kDamp * dt);
    this.centerPupilVel.y = (this.centerPupilVel.y + fy * dt) / (1.0 + kDamp * dt);

    this.centerPupilPos.x = THREE.MathUtils.clamp(
      this.centerPupilPos.x + this.centerPupilVel.x * dt,
      -0.08,
      0.08
    );
    this.centerPupilPos.y = THREE.MathUtils.clamp(
      this.centerPupilPos.y + this.centerPupilVel.y * dt,
      -0.08,
      0.08
    );

    // Surface hemisphere projection
    const mainR = 0.205;
    const px2 = this.centerPupilPos.x;
    const py2 = this.centerPupilPos.y;
    const pz2 = Math.sqrt(Math.max(0.005, mainR * mainR - px2 * px2 - py2 * py2));
    this.centerGooglyPupil.position.set(px2, py2, pz2);

    // Stalk pupil physics
    const updateStalkPupil = (
      pos: THREE.Vector2,
      vel: THREE.Vector2,
      pupilGroup: THREE.Group,
      offsetPhase: number
    ) => {
      const sTargetX = targetPx * 0.6 + Math.sin(time * 5.0 + offsetPhase) * 0.02;
      const sTargetY = targetPy * 0.6 + Math.cos(time * 4.0 + offsetPhase) * 0.02;
      const sfx = -80.0 * (pos.x - sTargetX) + accelX * 25.0;
      const sfy = -80.0 * (pos.y - sTargetY) + accelY * 25.0;

      vel.x = (vel.x + sfx * dt) / (1.0 + 9.0 * dt);
      vel.y = (vel.y + sfy * dt) / (1.0 + 9.0 * dt);

      pos.x = THREE.MathUtils.clamp(pos.x + vel.x * dt, -0.055, 0.055);
      pos.y = THREE.MathUtils.clamp(pos.y + vel.y * dt, -0.055, 0.055);

      const stalkR = 0.125;
      const spz = Math.sqrt(Math.max(0.003, stalkR * stalkR - pos.x * pos.x - pos.y * pos.y));
      pupilGroup.position.set(pos.x, pos.y, spz);
    };

    updateStalkPupil(this.stalkPupilPosL, this.stalkPupilVelL, this.stalkGooglyPupilL, 0);
    updateStalkPupil(this.stalkPupilPosR, this.stalkPupilVelR, this.stalkGooglyPupilR, 2.5);

    // Subtle eyestalk twitching
    this.stalkEyeLeft.rotation.z = Math.sin(time * 3.5) * 0.12 - 0.15;
    this.stalkEyeRight.rotation.z = Math.sin(time * 3.5 + 1.2) * 0.12 + 0.15;

    // ----------------------------------------------------
    // 2. AMBLING SLIME AI (Hops, Patrol, Terrain Collisions)
    // ----------------------------------------------------
    let currentGroundY = this.baseY;
    for (const plat of platforms) {
      const pTop = plat.y + plat.height / 2;
      const pBottom = plat.y - plat.height / 2;
      const pLeft = plat.x - plat.width / 2;
      const pRight = plat.x + plat.width / 2;

      // 1. Horizontal wall collision: reverse patrol and stay outside if bumping into side of platform
      if (this.position.y < pTop - 0.15 && this.position.y + 0.8 > pBottom) {
        if (this.position.x + this.radius >= pLeft && this.position.x < plat.x && this.patrolDir > 0) {
          this.position.x = pLeft - this.radius;
          this.patrolDir = -1;
          this.velocity.x = -Math.abs(this.velocity.x);
        } else if (this.position.x - this.radius <= pRight && this.position.x > plat.x && this.patrolDir < 0) {
          this.position.x = pRight + this.radius;
          this.patrolDir = 1;
          this.velocity.x = Math.abs(this.velocity.x);
        }
      }

      // 2. Standing or landing on top of platform
      if (this.position.x >= pLeft - 0.15 && this.position.x <= pRight + 0.15) {
        if (this.position.y >= pTop - 0.45 && pTop > currentGroundY) {
          currentGroundY = pTop;
        }
      }
    }

    const surfaceY = Math.max(GROUND_Y, currentGroundY);

    if (this.position.x <= this.minX) this.patrolDir = 1;
    if (this.position.x >= this.maxX) this.patrolDir = -1;

    const timeUntilHop = this.hopCooldown - this.hopTimer;

    // Bullet Hit Jiggle Reaction
    if (this.jiggleTimer > 0) {
      this.jiggleTimer -= dt;
      const jiggleFreq = 34.0;
      const jiggleAmp = (this.jiggleTimer / 0.38) * 0.45;
      const jiggleY = 1.0 + Math.sin(time * jiggleFreq) * jiggleAmp;
      const jiggleXZ = 1.0 - Math.sin(time * jiggleFreq) * jiggleAmp * 0.55;
      this.bodyMesh.scale.set(jiggleXZ, jiggleY, jiggleXZ);
    } else if (this.isGrounded && timeUntilHop < 0.28 && timeUntilHop > 0) {
      const squashProg = 1.0 - timeUntilHop / 0.28;
      const sy = 1.0 - squashProg * 0.55;
      const sx = 1.0 + squashProg * 0.45;
      this.bodyMesh.scale.set(sx, sy, sx);
    } else if (this.isGrounded && this.landingSquashTimer <= 0) {
      const idleBreathing = 1.0 + Math.sin(time * 4.0) * 0.05;
      this.bodyMesh.scale.set(
        1.0 / Math.sqrt(idleBreathing),
        idleBreathing,
        1.0 / Math.sqrt(idleBreathing)
      );
    }

    // Update dynamic ground shadow decal
    if (this.shadowMesh) {
      this.shadowMesh.position.set(this.position.x, surfaceY + 0.015, 0);
      const heightAbove = Math.max(0, this.position.y - surfaceY);
      const shadowScale = Math.max(0.3, 1.0 - heightAbove * 0.15);
      this.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
      (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.35 - heightAbove * 0.08);
      this.shadowMesh.visible = this.active && !this.isDying;
    }

    // B. Hop Launch
    if (this.hopTimer >= this.hopCooldown && this.isGrounded) {
      this.hopTimer = 0;
      this.isGrounded = false;

      const hopVelY = 5.2 + Math.random() * 1.5;
      const hopVelX = this.patrolDir * (1.8 + Math.random() * 0.8);
      this.velocity.set(hopVelX, hopVelY, 0);

      this.bodyMesh.scale.set(0.75, 1.45, 0.75);
    }

    // C. Airborne Flight & Gravity
    if (!this.isGrounded) {
      this.velocity.y -= 18.0 * dt;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      const stretchY = THREE.MathUtils.clamp(1.0 + this.velocity.y * 0.05, 0.7, 1.4);
      const stretchXZ = 1.0 / Math.sqrt(stretchY);
      this.bodyMesh.scale.set(stretchXZ, stretchY, stretchXZ);

      // Touchdown check
      if (this.position.y <= surfaceY && this.velocity.y <= 0) {
        this.position.y = surfaceY;
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;

        this.landingSquashTimer = 0.22;
        this.bodyMesh.scale.set(1.45, 0.52, 1.45);
      }
    } else {
      this.position.y = surfaceY;
    }

    // D. Landing Recovery
    if (this.landingSquashTimer > 0) {
      this.landingSquashTimer -= dt;
      const tNorm = this.landingSquashTimer / 0.22;
      const sy = THREE.MathUtils.lerp(1.0, 0.52, tNorm);
      const sx = THREE.MathUtils.lerp(1.0, 1.45, tNorm);
      this.bodyMesh.scale.set(sx, sy, sx);
    }

    // E. Slime Face Orientation
    const targetRotY = this.patrolDir > 0 ? 0.35 : -0.35;
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotY, dt * 6.0);

    // Inner Amoebic Nucleus Pulsing
    const corePulse = 1.0 + Math.sin(time * 8.0) * 0.12;
    this.coreMesh.scale.set(corePulse, corePulse, corePulse);

    this.updateParticles(dt);
  }

  private updateParticles(dt: number) {
    // 1. 28 Candy Slime Droplets
    for (const d of this.dropletPool) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }

      d.velocity.y -= 16.0 * dt; // Gravity arc
      d.velocity.x *= 0.98; // Air resistance
      d.mesh.position.addScaledVector(d.velocity, dt);

      const prog = d.age / d.maxLife;
      const popProg = Math.max(0, (prog - 0.65) / 0.35);
      const scaleMultiplier = 1.0 - popProg * popProg;
      const speed = d.velocity.length();
      const s = d.baseScale * scaleMultiplier;

      // Elongate along direction of travel
      d.mesh.scale.set(s * 0.8, s * (1.0 + Math.min(1.5, speed * 0.08)), s * 0.8);
      d.mesh.rotation.z = Math.atan2(d.velocity.y, d.velocity.x) - Math.PI / 2;
    }

    // 2. 8 Cartoon Smoke Puff Clouds
    for (const p of this.puffPool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.velocity.y += 0.8 * dt; // Gentle float
      p.velocity.x *= 0.94;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const prog = p.age / p.maxLife;
      const curScale = p.baseScale * (0.3 + Math.sin(prog * Math.PI * 0.5) * 1.5);
      p.mesh.scale.set(curScale, curScale, curScale);

      // Fade out opacity
      const opacity = Math.max(0, (1.0 - prog) * 0.9);
      for (const child of p.mesh.children) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat) mat.opacity = opacity;
      }
    }

    // 3. 8 Twinkling Cross Stars
    for (const s of this.sparklePool) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.maxLife) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }

      s.mesh.position.addScaledVector(s.velocity, dt);
      s.velocity.multiplyScalar(0.95);
      s.mesh.rotation.z += dt * 8.0; // Rapid twinkle spin

      const prog = s.age / s.maxLife;
      const curScale = s.baseScale * Math.sin(prog * Math.PI);
      s.mesh.scale.set(curScale, curScale, curScale);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - prog;
    }

    // 4. Comic Starburst Spike Ring & Shockwaves
    if (this.comicStarburstMesh.visible && this.fxTimer > 0) {
      this.fxTimer -= dt;
      const prog = 1.0 - this.fxTimer / 0.38;

      // Starburst expands and rotates
      const curScale = 0.3 + Math.sin(prog * Math.PI * 0.5) * 2.8;
      this.comicStarburstMesh.scale.set(curScale, curScale, curScale);
      this.comicStarburstMesh.rotation.z += dt * 4.5;
      (this.comicStarburstMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1.0 - prog * prog
      );

      // Shockwave 1 (Cyan)
      const ring1Scale = 0.2 + prog * 4.2;
      this.comicShockRing1.scale.set(ring1Scale, ring1Scale, ring1Scale);
      (this.comicShockRing1.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1.0 - prog) * 0.95
      );

      // Shockwave 2 (Gold)
      const ring2Scale = 0.1 + Math.pow(prog, 0.8) * 3.5;
      this.comicShockRing2.scale.set(ring2Scale, ring2Scale, ring2Scale);
      (this.comicShockRing2.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1.0 - prog) * 0.9
      );

      if (this.fxTimer <= 0) {
        this.comicStarburstMesh.visible = false;
        this.comicShockRing1.visible = false;
        this.comicShockRing2.visible = false;
      }
    }

    // Complete death cycle when all burst particles have faded away
    const anyParticleActive =
      this.dropletPool.some(d => d.active) ||
      this.puffPool.some(p => p.active) ||
      this.sparklePool.some(s => s.active) ||
      this.comicStarburstMesh.visible;

    if (!anyParticleActive && this.deathFreezeTimer <= 0) {
      this.isDying = false;
      this.active = false;
    }
  }

  public destroy(scene: THREE.Scene) {
    this.active = false;
    scene.remove(this.group);
    scene.remove(this.comicStarburstMesh);
    scene.remove(this.comicShockRing1);
    scene.remove(this.comicShockRing2);
    if (this.shadowMesh) scene.remove(this.shadowMesh);
    for (const d of this.dropletPool) scene.remove(d.mesh);
    for (const p of this.puffPool) scene.remove(p.mesh);
    for (const s of this.sparklePool) scene.remove(s.mesh);
  }
}
