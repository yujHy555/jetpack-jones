import * as THREE from 'three';

export interface LaserBolt {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  life: number;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
  rotSpeed: number;
  active: boolean;
}

interface Spark {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

interface DustParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

export enum PlayerState {
  IDLE = 'idle',
  WALK = 'walk',
  RUN = 'run',
  JUMP = 'jump',
  FALL = 'fall',
  JETPACK = 'jetpack'
}

/**
 * Triple-AAA Articulated 2D Skeletal Character for Jetpack Jones
 * Faithfully matches reference low-poly character with articulated bones:
 * - Head & Neck with faceted hair sweep & features
 * - Torso with shoulder harness & utility belt
 * - Dual-jointed legs (Thigh, Shin, Boot with toe roll)
 * - Dual-jointed arms (Upper, Forearm, Hand, Blaster)
 * - Muzzle flash & recoil slide on shoot
 * - Back-mounted twin-rocket chrome jetpack with animated flames, smoke, and sparks
 */
export class Player {
  public mesh: THREE.Group;
  public state: PlayerState = PlayerState.IDLE;

  // Physics & Transform
  public position: THREE.Vector3 = new THREE.Vector3(0, -3.8, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = true;
  public facingRight: boolean = true;
  public radius: number = 0.45;
  public height: number = 1.95;

  // Stats
  public life: number = 100;
  public maxLife: number = 100;
  public fuel: number = 100;
  public maxFuel: number = 100;
  public invulnerableTime: number = 0;

  // Skeletal Joint Hierarchy
  private rigRoot: THREE.Group;
  private hipBone: THREE.Group;
  private torsoBone: THREE.Group;
  private headBone: THREE.Group;

  // Front & Back Legs
  private frontThighBone: THREE.Group;
  private frontShinBone: THREE.Group;
  private frontFootBone: THREE.Group;

  private backThighBone: THREE.Group;
  private backShinBone: THREE.Group;
  private backFootBone: THREE.Group;

  // Front & Back Arms
  private frontArmBone: THREE.Group;
  private frontForearmBone: THREE.Group;
  private frontHandBone: THREE.Group;
  private blasterMesh: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh;

  private backArmBone: THREE.Group;
  private backForearmBone: THREE.Group;
  private backHandBone: THREE.Group;

  // Jetpack & Thruster VFX
  private jetpackBone: THREE.Group;
  private flameConeLeft: THREE.Mesh;
  private flameConeRight: THREE.Mesh;
  private thrusterLight: THREE.PointLight;
  private muzzleLight: THREE.PointLight;

  // Animation Timers & State Blending
  private animTimer: number = 0;
  private shootTimer: number = 0;
  private landSquashTimer: number = 0;
  private wasGroundedLastFrame: boolean = true;

  // VFX Pools
  private vfxGroup: THREE.Group;
  private smokePuffs: SmokePuff[] = [];
  private maxSmoke = 70;
  private sparks: Spark[] = [];
  private maxSparks = 60;
  private sparkGeo!: THREE.BufferGeometry;
  private sparkPositions!: Float32Array;
  private sparkColors!: Float32Array;
  private sparkPoints!: THREE.Points;
  private dustPuffs: DustParticle[] = [];
  private maxDust = 30;

  // Projectiles
  public lasers: LaserBolt[] = [];
  private laserGeo: THREE.CylinderGeometry;
  private laserMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    scene.add(this.mesh);

    this.vfxGroup = new THREE.Group();
    scene.add(this.vfxGroup);

    this.rigRoot = new THREE.Group();
    this.mesh.add(this.rigRoot);

    // Dynamic Lights
    this.thrusterLight = new THREE.PointLight(0xff7700, 0, 14, 1.2);
    scene.add(this.thrusterLight);

    this.muzzleLight = new THREE.PointLight(0xffea00, 0, 6, 1.5);
    scene.add(this.muzzleLight);

    // Shared Palette Materials from Reference Art
    const suitOrange = new THREE.MeshStandardMaterial({
      color: 0xee5a08,
      roughness: 0.38,
      metalness: 0.05,
    });
    const suitOrangeDark = new THREE.MeshStandardMaterial({
      color: 0xcc4700,
      roughness: 0.45,
      metalness: 0.05,
    });
    const darkHarness = new THREE.MeshStandardMaterial({
      color: 0x30343e,
      roughness: 0.5,
      metalness: 0.15,
    });
    const cyanStripe = new THREE.MeshBasicMaterial({
      color: 0x82eaf5,
    });
    const gloveBrown = new THREE.MeshStandardMaterial({
      color: 0x352e2c,
      roughness: 0.55,
    });
    const bootBrown = new THREE.MeshStandardMaterial({
      color: 0x6e5c50,
      roughness: 0.6,
      metalness: 0.1,
    });
    const fleshTone = new THREE.MeshStandardMaterial({
      color: 0xf5c2a3,
      roughness: 0.45,
    });
    const darkHair = new THREE.MeshStandardMaterial({
      color: 0x1a1a20,
      roughness: 0.6,
    });
    const chromeMetal = new THREE.MeshStandardMaterial({
      color: 0xe8e8ee,
      metalness: 0.94,
      roughness: 0.14,
    });

    // 1. Build Bones & Meshes Hierarchy
    this.hipBone = new THREE.Group();
    this.hipBone.position.set(0, 0.95, 0);
    this.rigRoot.add(this.hipBone);

    // Belt on hip
    const beltGeo = new THREE.BoxGeometry(0.36, 0.14, 0.32);
    const belt = new THREE.Mesh(beltGeo, darkHarness);
    this.hipBone.add(belt);

    const buckleGeo = new THREE.BoxGeometry(0.12, 0.16, 0.34);
    const buckle = new THREE.Mesh(buckleGeo, darkHarness);
    buckle.position.set(0.12, 0, 0);
    this.hipBone.add(buckle);

    // Torso Bone
    this.torsoBone = new THREE.Group();
    this.torsoBone.position.set(0, 0.1, 0);
    this.hipBone.add(this.torsoBone);

    const torsoGeo = new THREE.BoxGeometry(0.34, 0.55, 0.3);
    const torso = new THREE.Mesh(torsoGeo, suitOrange);
    torso.position.set(0, 0.28, 0);
    this.torsoBone.add(torso);

    // Shoulder Harness Straps
    const harnessL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), darkHarness);
    harnessL.position.set(0, 0.56, 0.16);
    this.torsoBone.add(harnessL);

    const harnessR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), darkHarness);
    harnessR.position.set(0, 0.56, -0.16);
    this.torsoBone.add(harnessR);

    // High dark collar
    const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 8), darkHarness);
    collarMesh.position.set(0.02, 0.62, 0);
    this.torsoBone.add(collarMesh);

    // Head Bone
    this.headBone = new THREE.Group();
    this.headBone.position.set(0.02, 0.7, 0);
    this.torsoBone.add(this.headBone);

    // Faceted Face
    const faceGeo = new THREE.BoxGeometry(0.24, 0.28, 0.22);
    const face = new THREE.Mesh(faceGeo, fleshTone);
    face.position.set(0.04, 0.14, 0);
    this.headBone.add(face);

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), fleshTone);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(0.18, 0.14, 0);
    this.headBone.add(nose);

    // Hair Sweep
    const hairGeo = new THREE.BoxGeometry(0.28, 0.18, 0.26);
    const hair = new THREE.Mesh(hairGeo, darkHair);
    hair.position.set(0.02, 0.3, 0);
    this.headBone.add(hair);

    const hairSpike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), darkHair);
    hairSpike.rotation.z = -0.4;
    hairSpike.position.set(0.1, 0.36, 0);
    this.headBone.add(hairSpike);

    // 2. Legs: Back Leg (Z = -0.1) and Front Leg (Z = +0.1)
    const legGeoThigh = new THREE.BoxGeometry(0.15, 0.44, 0.14);
    const legGeoShin = new THREE.BoxGeometry(0.13, 0.42, 0.13);
    const bootGeo = new THREE.BoxGeometry(0.28, 0.16, 0.14);

    // Back Leg
    this.backThighBone = new THREE.Group();
    this.backThighBone.position.set(-0.02, -0.05, -0.1);
    this.hipBone.add(this.backThighBone);

    const backThighMesh = new THREE.Mesh(legGeoThigh, suitOrangeDark);
    backThighMesh.position.set(0, -0.22, 0);
    this.backThighBone.add(backThighMesh);

    this.backShinBone = new THREE.Group();
    this.backShinBone.position.set(0, -0.42, 0);
    this.backThighBone.add(this.backShinBone);

    const backShinMesh = new THREE.Mesh(legGeoShin, suitOrangeDark);
    backShinMesh.position.set(0, -0.2, 0);
    this.backShinBone.add(backShinMesh);

    // Boot & Cuff
    this.backFootBone = new THREE.Group();
    this.backFootBone.position.set(0, -0.4, 0);
    this.backShinBone.add(this.backFootBone);

    const backCuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.15), darkHarness);
    this.backFootBone.add(backCuff);

    const backStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), cyanStripe);
    backStripe.position.y = -0.05;
    this.backFootBone.add(backStripe);

    const backBoot = new THREE.Mesh(bootGeo, bootBrown);
    backBoot.position.set(0.06, -0.12, 0);
    this.backFootBone.add(backBoot);

    // Front Leg
    this.frontThighBone = new THREE.Group();
    this.frontThighBone.position.set(0.02, -0.05, 0.1);
    this.hipBone.add(this.frontThighBone);

    const frontThighMesh = new THREE.Mesh(legGeoThigh, suitOrange);
    frontThighMesh.position.set(0, -0.22, 0);
    this.frontThighBone.add(frontThighMesh);

    this.frontShinBone = new THREE.Group();
    this.frontShinBone.position.set(0, -0.42, 0);
    this.frontThighBone.add(this.frontShinBone);

    const frontShinMesh = new THREE.Mesh(legGeoShin, suitOrange);
    frontShinMesh.position.set(0, -0.2, 0);
    this.frontShinBone.add(frontShinMesh);

    this.frontFootBone = new THREE.Group();
    this.frontFootBone.position.set(0, -0.4, 0);
    this.frontShinBone.add(this.frontFootBone);

    const frontCuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.15), darkHarness);
    this.frontFootBone.add(frontCuff);

    const frontStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), cyanStripe);
    frontStripe.position.y = -0.05;
    this.frontFootBone.add(frontStripe);

    const frontBoot = new THREE.Mesh(bootGeo, bootBrown);
    frontBoot.position.set(0.06, -0.12, 0);
    this.frontFootBone.add(frontBoot);

    // 3. Arms: Back Arm (Z = -0.22) & Front Arm with Blaster (Z = +0.22)
    const armGeoUpper = new THREE.BoxGeometry(0.12, 0.35, 0.12);
    const armGeoFore = new THREE.BoxGeometry(0.11, 0.32, 0.11);
    const handGeo = new THREE.BoxGeometry(0.12, 0.14, 0.12);

    // Back Arm
    this.backArmBone = new THREE.Group();
    this.backArmBone.position.set(-0.02, 0.5, -0.22);
    this.torsoBone.add(this.backArmBone);

    const backUpperMesh = new THREE.Mesh(armGeoUpper, suitOrangeDark);
    backUpperMesh.position.set(0, -0.16, 0);
    this.backArmBone.add(backUpperMesh);

    this.backForearmBone = new THREE.Group();
    this.backForearmBone.position.set(0, -0.32, 0);
    this.backArmBone.add(this.backForearmBone);

    const backForeMesh = new THREE.Mesh(armGeoFore, suitOrangeDark);
    backForeMesh.position.set(0, -0.14, 0);
    this.backForearmBone.add(backForeMesh);

    this.backHandBone = new THREE.Group();
    this.backHandBone.position.set(0, -0.28, 0);
    this.backForearmBone.add(this.backHandBone);

    const backHand = new THREE.Mesh(handGeo, gloveBrown);
    this.backHandBone.add(backHand);

    // Front Arm (with Blaster)
    this.frontArmBone = new THREE.Group();
    this.frontArmBone.position.set(0.02, 0.5, 0.22);
    this.torsoBone.add(this.frontArmBone);

    const frontUpperMesh = new THREE.Mesh(armGeoUpper, suitOrange);
    frontUpperMesh.position.set(0, -0.16, 0);
    this.frontArmBone.add(frontUpperMesh);

    this.frontForearmBone = new THREE.Group();
    this.frontForearmBone.position.set(0, -0.32, 0);
    this.frontArmBone.add(this.frontForearmBone);

    const frontForeMesh = new THREE.Mesh(armGeoFore, suitOrange);
    frontForeMesh.position.set(0, -0.14, 0);
    this.frontForearmBone.add(frontForeMesh);

    const frontWristStripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.13), cyanStripe);
    frontWristStripe.position.set(0, -0.24, 0);
    this.frontForearmBone.add(frontWristStripe);

    this.frontHandBone = new THREE.Group();
    this.frontHandBone.position.set(0, -0.3, 0);
    this.frontForearmBone.add(this.frontHandBone);

    const frontHand = new THREE.Mesh(handGeo, gloveBrown);
    this.frontHandBone.add(frontHand);

    // Blaster in hand
    this.blasterMesh = new THREE.Group();
    this.blasterMesh.position.set(0.12, -0.04, 0);
    this.frontHandBone.add(this.blasterMesh);

    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.08), chromeMetal);
    this.blasterMesh.add(gunBody);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 8), chromeMetal);
    gunBarrel.rotateZ(Math.PI / 2);
    gunBarrel.position.set(0.18, 0.02, 0);
    this.blasterMesh.add(gunBarrel);

    // Muzzle Flash Effect (4-point star)
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), flashMat);
    this.muzzleFlashMesh.position.set(0.35, 0.02, 0);
    this.blasterMesh.add(this.muzzleFlashMesh);

    // 4. Back-Mounted Jetpack
    this.jetpackBone = new THREE.Group();
    this.jetpackBone.position.set(-0.24, 0.34, 0);
    this.torsoBone.add(this.jetpackBone);

    const tankGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.58, 16);
    const leftTank = new THREE.Mesh(tankGeo, chromeMetal);
    leftTank.position.z = -0.13;
    this.jetpackBone.add(leftTank);

    const rightTank = new THREE.Mesh(tankGeo, chromeMetal);
    rightTank.position.z = 0.13;
    this.jetpackBone.add(rightTank);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.28), chromeMetal);
    this.jetpackBone.add(bridge);

    // Exhaust Nozzles pointing down
    const nozzleGeo = new THREE.ConeGeometry(0.1, 0.18, 16, 1, true);
    nozzleGeo.rotateX(Math.PI);

    const nozL = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozL.position.set(0, -0.36, -0.13);
    this.jetpackBone.add(nozL);

    const nozR = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozR.position.set(0, -0.36, 0.13);
    this.jetpackBone.add(nozR);

    // Dual Animated 3D Flame Cones
    const flameGeo = new THREE.ConeGeometry(0.14, 0.65, 12);
    flameGeo.rotateX(Math.PI);
    flameGeo.translate(0, -0.32, 0);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });

    this.flameConeLeft = new THREE.Mesh(flameGeo, flameMat);
    this.flameConeLeft.position.set(0, -0.38, -0.13);
    this.jetpackBone.add(this.flameConeLeft);

    this.flameConeRight = new THREE.Mesh(flameGeo, flameMat);
    this.flameConeRight.position.set(0, -0.38, 0.13);
    this.jetpackBone.add(this.flameConeRight);

    const innerFlameGeo = new THREE.ConeGeometry(0.07, 0.4, 12);
    innerFlameGeo.rotateX(Math.PI);
    innerFlameGeo.translate(0, -0.2, 0);
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffffbb });

    this.flameConeLeft.add(new THREE.Mesh(innerFlameGeo, innerFlameMat));
    this.flameConeRight.add(new THREE.Mesh(innerFlameGeo, innerFlameMat));

    this.flameConeLeft.visible = false;
    this.flameConeRight.visible = false;

    // 5. Initialize VFX Systems
    this.initSmokeSystem();
    this.initSparkSystem();
    this.initDustSystem();

    // 6. Laser Projectiles
    this.laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
    this.laserGeo.rotateZ(Math.PI / 2);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(this.laserGeo, this.laserMat);
      mesh.visible = false;
      scene.add(mesh);
      this.lasers.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(26, 0, 0),
        active: false,
        life: 0,
      });
    }

    this.reset();
  }

  public reset(startX: number = 0, startY: number = -3.8) {
    this.position.set(startX, startY, 0);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.facingRight = true;
    this.state = PlayerState.IDLE;
    this.life = 100;
    this.fuel = 100;
    this.invulnerableTime = 0;
    this.animTimer = 0;
    this.shootTimer = 0;
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;

    for (const l of this.lasers) {
      l.active = false;
      l.mesh.visible = false;
    }
    for (const sp of this.smokePuffs) {
      sp.active = false;
      sp.mesh.visible = false;
    }
    for (const sk of this.sparks) {
      sk.active = false;
    }
    for (const d of this.dustPuffs) {
      d.active = false;
      d.mesh.visible = false;
    }
  }

  private initSmokeSystem() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.25, 'rgba(255, 170, 70, 0.85)');
    grad.addColorStop(0.65, 'rgba(160, 100, 70, 0.5)');
    grad.addColorStop(1.0, 'rgba(30, 25, 22, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();

    const smokeTex = new THREE.CanvasTexture(canvas);
    const smokeGeo = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < this.maxSmoke; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: smokeTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      this.vfxGroup.add(mesh);

      this.smokePuffs.push({
        mesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 1.0,
        baseScale: 0.45,
        rotSpeed: 0,
        active: false,
      });
    }
  }

  private initSparkSystem() {
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);

    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    this.vfxGroup.add(this.sparkPoints);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparks.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.5,
        active: false,
      });
    }
  }

  private initDustSystem() {
    const dustGeo = new THREE.CircleGeometry(0.12, 8);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0x998877,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    for (let i = 0; i < this.maxDust; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat);
      mesh.visible = false;
      this.vfxGroup.add(mesh);
      this.dustPuffs.push({
        mesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  /**
   * Fires a blaster laser bolt with recoil animation and muzzle flash
   */
  public shoot(): boolean {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

    // Trigger shoot animation timer
    this.shootTimer = 0.28;

    // Laser muzzle origin
    const originX = this.position.x + (this.facingRight ? 0.65 : -0.65);
    const originY = this.position.y + 1.25;

    laser.position.set(originX, originY, this.position.z);
    laser.velocity.set(this.facingRight ? 26 : -26, 0, 0);
    laser.active = true;
    laser.life = 1.2;
    laser.mesh.position.copy(laser.position);
    laser.mesh.visible = true;

    // Flash light at muzzle
    this.muzzleLight.position.set(originX, originY, this.position.z + 0.2);
    this.muzzleLight.intensity = 15;

    return true;
  }

  public takeDamage(amount: number = 25) {
    if (this.invulnerableTime > 0) return;
    this.life = Math.max(0, this.life - amount);
    this.invulnerableTime = 1.4;
  }

  public addFuel(amount: number = 35) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  public update(
    dt: number,
    moveX: number,
    run: boolean,
    jumpPressed: boolean,
    jetpackHold: boolean,
    platforms: { x: number; y: number; width: number; height: number }[]
  ) {
    this.animTimer += dt;

    // 1. Invulnerability flash
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      this.mesh.visible = Math.floor(this.invulnerableTime * 14) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 2. Horizontal Movement: Walk vs Run
    const walkSpeed = 4.6;
    const runSpeed = 8.8;
    const currentSpeed = run ? runSpeed : walkSpeed;

    if (moveX !== 0) {
      this.facingRight = moveX > 0;
      this.rigRoot.scale.x = this.facingRight ? 1 : -1;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveX * currentSpeed, dt * 14);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * 16);
    }

    // 3. Jump from Ground
    if (jumpPressed && this.isGrounded) {
      this.velocity.y = 11.5;
      this.isGrounded = false;
      this.emitDust(this.position.x, this.position.y, 4);
    }

    // 4. Jetpack Flight
    const isActuallyJetpacking = jetpackHold && this.fuel > 0;
    const gravity = -17.5;
    const jetpackLift = 34.0;

    if (isActuallyJetpacking) {
      this.velocity.y += jetpackLift * dt;
      this.fuel = Math.max(0, this.fuel - 24 * dt);
      this.isGrounded = false;
    } else {
      this.fuel = Math.min(this.maxFuel, this.fuel + 8.0 * dt);
    }

    // Apply gravity
    this.velocity.y += gravity * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -14, 12);

    // Apply movement
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 5. Floor & Platform Collisions
    const floorY = -3.8;
    this.isGrounded = false;

    if (this.position.y <= floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Elevated Catwalks
    for (const plat of platforms) {
      const platTop = plat.y + plat.height / 2;
      const platLeft = plat.x - plat.width / 2;
      const platRight = plat.x + plat.width / 2;

      if (
        this.position.x >= platLeft &&
        this.position.x <= platRight &&
        this.position.y >= platTop - 0.25 &&
        this.position.y <= platTop + 0.35 &&
        this.velocity.y <= 0
      ) {
        this.position.y = platTop;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }

    // Landing squash detection
    if (!this.wasGroundedLastFrame && this.isGrounded) {
      this.landSquashTimer = 0.16;
      this.emitDust(this.position.x, this.position.y, 5);
    }
    this.wasGroundedLastFrame = this.isGrounded;

    this.mesh.position.copy(this.position);

    // 6. State Machine
    if (isActuallyJetpacking) {
      this.state = PlayerState.JETPACK;
    } else if (!this.isGrounded) {
      this.state = this.velocity.y > 0 ? PlayerState.JUMP : PlayerState.FALL;
    } else if (Math.abs(this.velocity.x) > 0.8) {
      this.state = run ? PlayerState.RUN : PlayerState.WALK;
    } else {
      this.state = PlayerState.IDLE;
    }

    // 7. TRIPLE-AAA PROCEDURAL SKELETAL ANIMATION
    this.animateSkeletalBones(dt, run);

    // 8. Update Jetpack Flames, Volumetric Smoke & Sparks
    this.updateJetpackVFX(dt, isActuallyJetpacking);

    // 9. Update Lasers
    for (const l of this.lasers) {
      if (!l.active) continue;
      l.life -= dt;
      if (l.life <= 0) {
        l.active = false;
        l.mesh.visible = false;
        continue;
      }
      l.position.x += l.velocity.x * dt;
      l.mesh.position.copy(l.position);
    }
  }

  /**
   * Professional Skeletal Kinematics & Animation Controller
   */
  private animateSkeletalBones(dt: number, isRunning: boolean) {
    const t = this.animTimer;

    // Reset base transforms
    this.hipBone.position.y = 0.95;
    this.torsoBone.rotation.set(0, 0, 0);
    this.headBone.rotation.set(0, 0, 0);

    // Landing Squash
    if (this.landSquashTimer > 0) {
      this.landSquashTimer -= dt;
      const squash = Math.sin((this.landSquashTimer / 0.16) * Math.PI) * 0.12;
      this.hipBone.position.y -= squash;
      this.hipBone.scale.set(1.0 + squash * 0.8, 1.0 - squash, 1.0);
    } else {
      this.hipBone.scale.set(1, 1, 1);
    }

    switch (this.state) {
      // ----------------------------------------------------
      // A. IDLE ANIMATION (Organic breathing, subtle weight shift)
      // ----------------------------------------------------
      case PlayerState.IDLE: {
        const breathe = Math.sin(t * 3.0) * 0.03;
        this.torsoBone.position.y = 0.1 + breathe;
        this.torsoBone.rotation.z = Math.sin(t * 1.5) * 0.02;
        this.headBone.rotation.z = -Math.sin(t * 3.0) * 0.02;

        // Grounded feet
        this.frontThighBone.rotation.z = 0.04;
        this.frontShinBone.rotation.z = 0.02;
        this.frontFootBone.rotation.z = -0.06;

        this.backThighBone.rotation.z = -0.04;
        this.backShinBone.rotation.z = 0.03;
        this.backFootBone.rotation.z = 0.01;

        // Arms resting relaxed at sides
        this.backArmBone.rotation.z = Math.sin(t * 3.0) * 0.05 + 0.1;
        this.backForearmBone.rotation.z = 0.2;

        // If not shooting, front arm holds gun lowered in ready position
        if (this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -Math.sin(t * 3.0) * 0.05 + 0.15;
          this.frontForearmBone.rotation.z = 0.45;
        }
        break;
      }

      // ----------------------------------------------------
      // B. SIDE WALK CYCLE (Professional 8-Phase Double Pendulum)
      // ----------------------------------------------------
      case PlayerState.WALK: {
        const walkFreq = 9.0;
        const phase = t * walkFreq;

        // Hip vertical bounce on passing steps
        const hipBob = Math.abs(Math.sin(phase)) * 0.05;
        this.hipBone.position.y = 0.95 + hipBob;

        // Slight forward torso step tilt
        this.torsoBone.rotation.z = 0.06 + Math.sin(phase) * 0.02;
        this.headBone.rotation.z = -0.04;

        // Dual Leg Swing (180 deg out of phase)
        const frontLegAngle = Math.sin(phase);
        const backLegAngle = Math.sin(phase + Math.PI);

        // Front Leg Kinematics
        this.frontThighBone.rotation.z = frontLegAngle * 0.55;
        this.frontShinBone.rotation.z = frontLegAngle < 0 ? Math.abs(frontLegAngle) * 0.75 : 0.05;
        this.frontFootBone.rotation.z = -frontLegAngle * 0.3;

        // Back Leg Kinematics
        this.backThighBone.rotation.z = backLegAngle * 0.55;
        this.backShinBone.rotation.z = backLegAngle < 0 ? Math.abs(backLegAngle) * 0.75 : 0.05;
        this.backFootBone.rotation.z = -backLegAngle * 0.3;

        // Counter-arm Swing
        this.backArmBone.rotation.z = frontLegAngle * 0.55;
        this.backForearmBone.rotation.z = 0.3 + Math.max(0, -frontLegAngle) * 0.4;

        if (this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = backLegAngle * 0.45 + 0.1;
          this.frontForearmBone.rotation.z = 0.4;
        }

        // Footstep dust on contact
        if (Math.abs(frontLegAngle) > 0.95 && Math.random() < 0.25) {
          this.emitDust(this.position.x, this.position.y, 1);
        }
        break;
      }

      // ----------------------------------------------------
      // C. RUN CYCLE (High-Energy Sprint, Lean, High Knee Lift)
      // ----------------------------------------------------
      case PlayerState.RUN: {
        const runFreq = 14.0;
        const phase = t * runFreq;

        // Athletic forward lean (18 degrees)
        this.torsoBone.rotation.z = 0.32;
        this.headBone.rotation.z = -0.12;

        // Deep vertical bounce
        const runBob = Math.abs(Math.sin(phase)) * 0.08;
        this.hipBone.position.y = 0.95 + runBob;

        const frontRun = Math.sin(phase);
        const backRun = Math.sin(phase + Math.PI);

        // High knee lift and deep heel kickback
        this.frontThighBone.rotation.z = frontRun * 0.85;
        this.frontShinBone.rotation.z = frontRun < 0 ? Math.abs(frontRun) * 1.15 : 0.1;
        this.frontFootBone.rotation.z = -frontRun * 0.4;

        this.backThighBone.rotation.z = backRun * 0.85;
        this.backShinBone.rotation.z = backRun < 0 ? Math.abs(backRun) * 1.15 : 0.1;
        this.backFootBone.rotation.z = -backRun * 0.4;

        // Pumping arms in 90 degree bends
        this.backArmBone.rotation.z = frontRun * 0.85;
        this.backForearmBone.rotation.z = 0.85;

        if (this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = backRun * 0.75 + 0.15;
          this.frontForearmBone.rotation.z = 0.8;
        }

        // Running dust spray
        if (Math.abs(frontRun) > 0.9) {
          this.emitDust(this.position.x, this.position.y, 2);
        }
        break;
      }

      // ----------------------------------------------------
      // D. JUMP & FALL (Anticipation, Tuck, Apex, Fall Reach)
      // ----------------------------------------------------
      case PlayerState.JUMP: {
        // Upward leap: legs tuck up toward body
        this.torsoBone.rotation.z = 0.08;
        this.headBone.rotation.z = 0.12; // Looking up

        this.frontThighBone.rotation.z = 0.65;
        this.frontShinBone.rotation.z = 0.85; // bent knee
        this.frontFootBone.rotation.z = -0.2;

        this.backThighBone.rotation.z = 0.45;
        this.backShinBone.rotation.z = 0.75;
        this.backFootBone.rotation.z = -0.2;

        this.backArmBone.rotation.z = -0.4; // reaching back for balance
        this.backForearmBone.rotation.z = 0.5;

        if (this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = 0.3;
          this.frontForearmBone.rotation.z = 0.4;
        }
        break;
      }

      case PlayerState.FALL: {
        // Downward fall: legs extend to prepare for landing
        this.torsoBone.rotation.z = -0.04;
        this.headBone.rotation.z = -0.08; // Looking down

        this.frontThighBone.rotation.z = 0.15;
        this.frontShinBone.rotation.z = 0.15;
        this.frontFootBone.rotation.z = 0.25; // toes pointing down

        this.backThighBone.rotation.z = -0.1;
        this.backShinBone.rotation.z = 0.2;
        this.backFootBone.rotation.z = 0.25;

        this.backArmBone.rotation.z = -0.2;
        this.backForearmBone.rotation.z = 0.3;
        break;
      }

      // ----------------------------------------------------
      // E. JETPACK FLIGHT (Streamline, Trailing Leg Physics)
      // ----------------------------------------------------
      case PlayerState.JETPACK: {
        // Flight lean in direction of horizontal speed
        const flightLean = 0.25 + (this.velocity.x / 9.0) * 0.25;
        this.torsoBone.rotation.z = flightLean;
        this.headBone.rotation.z = 0.15; // Focused forward

        // Legs dynamically trailing behind in aerodynamic flight
        const legSway = Math.sin(t * 12.0) * 0.08;
        this.frontThighBone.rotation.z = -0.45 + legSway;
        this.frontShinBone.rotation.z = 0.35;
        this.frontFootBone.rotation.z = 0.4;

        this.backThighBone.rotation.z = -0.55 - legSway;
        this.backShinBone.rotation.z = 0.45;
        this.backFootBone.rotation.z = 0.4;

        this.backArmBone.rotation.z = -0.6; // tucked streamline
        this.backForearmBone.rotation.z = 0.3;

        if (this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = 0.2;
          this.frontForearmBone.rotation.z = 0.35;
        }
        break;
      }
    }

    // ------------------------------------------------------
    // F. PROFESSIONAL SHOOT OVERRIDE (Draw, Recoil Kick, Flash)
    // ------------------------------------------------------
    if (this.shootTimer > 0) {
      this.shootTimer -= dt;
      const progress = 1.0 - (this.shootTimer / 0.28); // 0.0 to 1.0

      // Front arm snaps into horizontal aim
      this.frontArmBone.rotation.z = 1.45; // Level forward
      this.frontForearmBone.rotation.z = 0.05;

      // Recoil shock on the blaster slide and arm
      if (progress < 0.25) {
        // Immediate kickback
        const kick = Math.sin((progress / 0.25) * Math.PI);
        this.blasterMesh.position.x = 0.12 - kick * 0.09;
        this.frontArmBone.rotation.z += kick * 0.12; // Muzzle climbs
        this.torsoBone.rotation.z -= kick * 0.05; // Torso absorbs shock

        // Muzzle flash visibility
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
        this.muzzleFlashMesh.scale.set(1.4, 1.4, 1.4);
      } else {
        // Smooth recovery to ready position
        const returnProgress = (progress - 0.25) / 0.75;
        this.blasterMesh.position.x = THREE.MathUtils.lerp(0.03, 0.12, returnProgress);
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    } else {
      this.blasterMesh.position.x = 0.12;
      (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      this.muzzleLight.intensity = 0;
    }
  }

  private updateJetpackVFX(dt: number, isJetpacking: boolean) {
    const nozzleX = this.position.x + (this.facingRight ? -0.28 : 0.28);
    const nozzleY = this.position.y + 0.78;
    const nozzleZ = this.position.z;

    this.thrusterLight.position.set(nozzleX, nozzleY, nozzleZ);

    if (isJetpacking) {
      this.flameConeLeft.visible = true;
      this.flameConeRight.visible = true;

      // Scale flicker
      const flick = 1.0 + Math.random() * 0.45;
      this.flameConeLeft.scale.set(1.0 + Math.random() * 0.2, flick, 1.0);
      this.flameConeRight.scale.copy(this.flameConeLeft.scale);

      this.thrusterLight.intensity = 18 + Math.random() * 8;
      this.thrusterLight.distance = 15;

      // Emit volumetric smoke puffs & sparks
      this.emitSmoke(nozzleX, nozzleY, nozzleZ, 2);
      this.emitSparks(nozzleX, nozzleY, nozzleZ, 2);
    } else {
      this.flameConeLeft.visible = false;
      this.flameConeRight.visible = false;
      this.thrusterLight.intensity = 0;
    }

    // Update Smoke Puffs
    for (const puff of this.smokePuffs) {
      if (!puff.active) continue;

      puff.age += dt;
      if (puff.age >= puff.maxLife) {
        puff.active = false;
        puff.mesh.visible = false;
        continue;
      }

      puff.velocity.x *= (1.0 - dt * 1.5);
      puff.velocity.y *= (1.0 - dt * 1.2);
      puff.mesh.position.addScaledVector(puff.velocity, dt);

      const progress = puff.age / puff.maxLife;
      const currentScale = puff.baseScale + progress * 2.2;
      puff.mesh.scale.set(currentScale, currentScale, 1);
      puff.mesh.rotation.z += puff.rotSpeed * dt;

      const mat = puff.mesh.material as THREE.MeshBasicMaterial;
      if (progress < 0.25) {
        const t = progress / 0.25;
        mat.color.setRGB(1.0, THREE.MathUtils.lerp(0.8, 0.45, t), 0.1);
        mat.opacity = 0.85;
      } else if (progress < 0.65) {
        const t = (progress - 0.25) / 0.4;
        mat.color.setRGB(
          THREE.MathUtils.lerp(1.0, 0.42, t),
          THREE.MathUtils.lerp(0.45, 0.26, t),
          THREE.MathUtils.lerp(0.1, 0.18, t)
        );
        mat.opacity = 0.75 - t * 0.2;
      } else {
        const t = (progress - 0.65) / 0.35;
        mat.color.setRGB(0.25, 0.22, 0.2);
        mat.opacity = (1.0 - t) * 0.5;
      }
    }

    // Update Sparks
    let pIdx = 0;
    let cIdx = 0;

    for (const sp of this.sparks) {
      if (sp.active) {
        sp.age += dt;
        if (sp.age >= sp.maxLife) {
          sp.active = false;
        } else {
          sp.velocity.x *= (1.0 - dt * 2.5);
          sp.position.addScaledVector(sp.velocity, dt);
        }
      }

      if (sp.active) {
        this.sparkPositions[pIdx] = sp.position.x;
        this.sparkPositions[pIdx + 1] = sp.position.y;
        this.sparkPositions[pIdx + 2] = sp.position.z;

        const progress = sp.age / sp.maxLife;
        this.sparkColors[cIdx] = 1.0;
        this.sparkColors[cIdx + 1] = 0.85 - progress * 0.6;
        this.sparkColors[cIdx + 2] = 0.2 * (1.0 - progress);
      } else {
        this.sparkPositions[pIdx] = 0;
        this.sparkPositions[pIdx + 1] = -9999;
        this.sparkPositions[pIdx + 2] = 0;
      }

      pIdx += 3;
      cIdx += 3;
    }

    this.sparkGeo.getAttribute('position').needsUpdate = true;
    this.sparkGeo.getAttribute('color').needsUpdate = true;

    // Update Dust Puffs
    for (const d of this.dustPuffs) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.mesh.position.addScaledVector(d.velocity, dt);
      const prog = d.age / d.maxLife;
      const s = 0.5 + prog * 1.5;
      d.mesh.scale.set(s, s, 1);
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.5;
    }
  }

  private emitSmoke(x: number, y: number, z: number, count: number) {
    for (let c = 0; c < count; c++) {
      const puff = this.smokePuffs.find(p => !p.active);
      if (!puff) return;

      puff.active = true;
      puff.age = 0;
      puff.maxLife = 0.75 + Math.random() * 0.45;
      puff.baseScale = 0.4 + Math.random() * 0.2;
      puff.rotSpeed = (Math.random() - 0.5) * 4.0;

      puff.mesh.position.set(
        x + (Math.random() - 0.5) * 0.2,
        y - 0.1 + (Math.random() - 0.5) * 0.1,
        z + (Math.random() - 0.5) * 0.2
      );

      const horizontalSpread = this.facingRight ? -(1.5 + Math.random() * 2.5) : (1.5 + Math.random() * 2.5);
      puff.velocity.set(
        horizontalSpread - this.velocity.x * 0.3,
        -(3.5 + Math.random() * 3.5),
        (Math.random() - 0.5) * 0.6
      );

      puff.mesh.scale.set(puff.baseScale, puff.baseScale, 1);
      puff.mesh.visible = true;

      const mat = puff.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(1.0, 0.75, 0.3);
      mat.opacity = 0.85;
    }
  }

  private emitSparks(x: number, y: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const spark = this.sparks.find(s => !s.active);
      if (!spark) return;

      spark.active = true;
      spark.age = 0;
      spark.maxLife = 0.22 + Math.random() * 0.25;
      spark.position.set(x, y - 0.1, z);
      const horiz = this.facingRight ? -(3.0 + Math.random() * 5.0) : (3.0 + Math.random() * 5.0);
      spark.velocity.set(
        horiz - this.velocity.x * 0.3,
        -(5.0 + Math.random() * 5.0),
        (Math.random() - 0.5) * 1.5
      );
    }
  }

  private emitDust(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const d = this.dustPuffs.find(dp => !dp.active);
      if (!d) return;

      d.active = true;
      d.age = 0;
      d.mesh.position.set(x + (Math.random() - 0.5) * 0.3, y + 0.05, 0.1);
      d.velocity.set((Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 0.6, 0);
      d.mesh.scale.set(0.5, 0.5, 1);
      d.mesh.visible = true;
    }
  }
}
