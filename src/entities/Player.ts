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
 * Triple-AAA Articulated 2D Skeletal Character
 * Features:
 * - Cool Retro Space Helmet with Amber Visor and Antenna
 * - New Heavy Laser Blaster aligned with 360° Mouse Reticle
 * - Movement Key Facing Direction Priority
 * - Natural Backward-Flexing Knees
 * - High-Impact Muzzle Flash & Screen Recoil
 * - Rich Faux-Volumetric Smoke and Twin Thruster Flame Cones
 */
export class Player {
  public mesh: THREE.Group;
  public state: PlayerState = PlayerState.IDLE;

  // Transform & Physics
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

  // Skeletal Bones Hierarchy
  private rigRoot: THREE.Group;
  private hipBone: THREE.Group;
  private torsoBone: THREE.Group;
  private headBone: THREE.Group;

  // Legs (Strictly backward-bending knee joints)
  private frontThighBone: THREE.Group;
  private frontShinBone: THREE.Group;
  private frontFootBone: THREE.Group;

  private backThighBone: THREE.Group;
  private backShinBone: THREE.Group;
  private backFootBone: THREE.Group;

  // Arms (360° Rotational Aiming)
  private frontArmBone: THREE.Group;
  private frontForearmBone: THREE.Group;
  private frontHandBone: THREE.Group;
  private blasterMesh: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh;

  private backArmBone: THREE.Group;
  private backForearmBone: THREE.Group;
  private backHandBone: THREE.Group;

  // Jetpack & Lights
  private jetpackBone: THREE.Group;
  private flameConeLeft: THREE.Mesh;
  private flameConeRight: THREE.Mesh;
  private thrusterLight: THREE.PointLight;
  private muzzleLight: THREE.PointLight;

  // Animation Timers & Physics Smoothing
  private animTimer: number = 0;
  private shootTimer: number = 0;
  private currentAimAngle: number = 0; // World angle in radians
  private landSquashTimer: number = 0;
  private jumpAnticipateTimer: number = 0;
  private wasGroundedLastFrame: boolean = true;

  // Secondary Motion Follow-Through
  private headFollowLag: number = 0;
  private torsoTiltSmooth: number = 0;

  // VFX Pools
  private vfxGroup: THREE.Group;
  private smokePuffs: SmokePuff[] = [];
  private maxSmoke = 75;
  private sparks: Spark[] = [];
  private maxSparks = 65;
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
    this.thrusterLight = new THREE.PointLight(0xff7700, 0, 16, 1.2);
    scene.add(this.thrusterLight);

    this.muzzleLight = new THREE.PointLight(0xffea00, 0, 8, 1.5);
    scene.add(this.muzzleLight);

    // Stylized PBR Palette
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
      color: 0x00f5ff,
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
    const creamHelmet = new THREE.MeshStandardMaterial({
      color: 0xf6f3eb,
      roughness: 0.28,
      metalness: 0.06,
    });
    const amberVisor = new THREE.MeshPhysicalMaterial({
      color: 0xff7700,
      roughness: 0.05,
      metalness: 0.15,
      transmission: 0.55,
      transparent: true,
      opacity: 0.95,
      reflectivity: 0.9,
    });
    const chromeMetal = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.95,
      roughness: 0.12,
    });

    // 1. Build Bones Hierarchy
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

    // Shoulder Harness
    const harnessL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), darkHarness);
    harnessL.position.set(0, 0.56, 0.16);
    this.torsoBone.add(harnessL);

    const harnessR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), darkHarness);
    harnessR.position.set(0, 0.56, -0.16);
    this.torsoBone.add(harnessR);

    // Dark neck collar
    const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 12), darkHarness);
    collarMesh.position.set(0.02, 0.62, 0);
    this.torsoBone.add(collarMesh);

    // Head Bone
    this.headBone = new THREE.Group();
    this.headBone.position.set(0.02, 0.72, 0);
    this.torsoBone.add(this.headBone);

    // Stylized Face inside helmet
    const faceGeo = new THREE.BoxGeometry(0.24, 0.26, 0.22);
    const face = new THREE.Mesh(faceGeo, fleshTone);
    face.position.set(0.02, 0.14, 0);
    this.headBone.add(face);

    // COOL SPACE HELMET
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0.02, 0.16, 0);
    this.headBone.add(helmetGroup);

    // Outer Aerodynamic Helmet Shell
    const helmetGeo = new THREE.SphereGeometry(0.32, 20, 20);
    const helmetMesh = new THREE.Mesh(helmetGeo, creamHelmet);
    helmetGroup.add(helmetMesh);

    // Mechanical Chin Rim
    const chinRimGeo = new THREE.TorusGeometry(0.27, 0.05, 10, 20);
    chinRimGeo.rotateX(Math.PI / 2);
    const chinRim = new THREE.Mesh(chinRimGeo, darkHarness);
    chinRim.position.y = -0.12;
    helmetGroup.add(chinRim);

    // Translucent Amber Bubble Visor
    const visorGeo = new THREE.SphereGeometry(0.28, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.52);
    visorGeo.rotateZ(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, amberVisor);
    visor.position.set(0.08, 0, 0);
    helmetGroup.add(visor);

    // Side Circular Communicators with Cyan Status Lights
    const commGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
    commGeo.rotateX(Math.PI / 2);

    const commL = new THREE.Mesh(commGeo, darkHarness);
    commL.position.set(0, 0, 0.32);
    helmetGroup.add(commL);

    const commR = new THREE.Mesh(commGeo, darkHarness);
    commR.position.set(0, 0, -0.32);
    helmetGroup.add(commR);

    // Cyan Status Light dots on communicators
    const commLedL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), cyanStripe);
    commLedL.position.set(0, 0, 0.36);
    helmetGroup.add(commLedL);

    const commLedR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), cyanStripe);
    commLedR.position.set(0, 0, -0.36);
    helmetGroup.add(commLedR);

    // Helmet Antenna with glowing golden beacon
    const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8), chromeMetal);
    antennaStem.position.set(-0.15, 0.38, -0.18);
    antennaStem.rotation.z = -0.25;
    helmetGroup.add(antennaStem);

    const antennaBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    antennaBeacon.position.set(-0.19, 0.53, -0.18);
    helmetGroup.add(antennaBeacon);

    // 2. Legs: Back Leg (Z = -0.1) & Front Leg (Z = +0.1)
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

    // 3. Arms: Back Arm (Z = -0.22) & Front Arm (Z = +0.22)
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

    // Front Arm (360° Rotational Aiming)
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

    // BRAND NEW COOL RETRO-FUTURISTIC LASER BLASTER
    // Constructed strictly along forward line of aim (+X)!
    this.blasterMesh = new THREE.Group();
    this.blasterMesh.position.set(0, -0.06, 0);
    this.frontHandBone.add(this.blasterMesh);

    // Tactical Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), darkHarness);
    grip.rotation.z = -0.2;
    grip.position.set(0.02, -0.06, 0);
    this.blasterMesh.add(grip);

    // Main Chrome Receiver Chassis
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.1), chromeMetal);
    receiver.position.set(0.12, 0.03, 0);
    this.blasterMesh.add(receiver);

    // Glowing Cyan Energy Plasma Core in receiver
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.12), cyanStripe);
    coreMesh.position.set(0.1, 0.03, 0);
    this.blasterMesh.add(coreMesh);

    // Precision Forward Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.28, 12), chromeMetal);
    barrel.rotateZ(Math.PI / 2); // Axis along X!
    barrel.position.set(0.36, 0.03, 0);
    this.blasterMesh.add(barrel);

    // Ribbed Cooling Coils
    for (let cx = 0.26; cx <= 0.42; cx += 0.06) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 12), cyanStripe);
      coil.rotateY(Math.PI / 2);
      coil.position.set(cx, 0.03, 0);
      this.blasterMesh.add(coil);
    }

    // Dual Muzzle Prongs at the tip
    const prongTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.03), chromeMetal);
    prongTop.position.set(0.52, 0.05, 0);
    this.blasterMesh.add(prongTop);

    const prongBot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.03), chromeMetal);
    prongBot.position.set(0.52, 0.01, 0);
    this.blasterMesh.add(prongBot);

    // Muzzle Flash Star at the tip
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), flashMat);
    this.muzzleFlashMesh.position.set(0.6, 0.03, 0);
    this.blasterMesh.add(this.muzzleFlashMesh);

    // 4. Back-Mounted Chrome Jetpack
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

    const nozzleGeo = new THREE.ConeGeometry(0.1, 0.18, 16, 1, true);
    nozzleGeo.rotateX(Math.PI);

    const nozL = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozL.position.set(0, -0.36, -0.13);
    this.jetpackBone.add(nozL);

    const nozR = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozR.position.set(0, -0.36, 0.13);
    this.jetpackBone.add(nozR);

    // Dual Animated 3D Flame Cones
    const flameGeo = new THREE.ConeGeometry(0.14, 0.68, 12);
    flameGeo.rotateX(Math.PI);
    flameGeo.translate(0, -0.34, 0);

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

    const innerFlameGeo = new THREE.ConeGeometry(0.07, 0.42, 12);
    innerFlameGeo.rotateX(Math.PI);
    innerFlameGeo.translate(0, -0.21, 0);
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffffbb });

    this.flameConeLeft.add(new THREE.Mesh(innerFlameGeo, innerFlameMat));
    this.flameConeRight.add(new THREE.Mesh(innerFlameGeo, innerFlameMat));

    this.flameConeLeft.visible = false;
    this.flameConeRight.visible = false;

    // 5. VFX Systems
    this.initSmokeSystem();
    this.initSparkSystem();
    this.initDustSystem();

    // 6. Laser Projectiles
    this.laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8);
    this.laserGeo.rotateZ(Math.PI / 2);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff }); // Glowing Cyan Laser

    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.laserGeo, this.laserMat);
      mesh.visible = false;
      scene.add(mesh);
      this.lasers.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(28, 0, 0),
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
    this.headFollowLag = 0;
    this.torsoTiltSmooth = 0;
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
   * Fires a blaster laser bolt in 360° toward target
   */
  public shoot(aimTargetWorld?: THREE.Vector3): boolean {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

    this.shootTimer = 0.28;

    // Calculate aim angle
    let aimAngle = this.facingRight ? 0 : Math.PI;
    const originY = this.position.y + 1.25;
    const originX = this.position.x + (this.facingRight ? 0.4 : -0.4);

    if (aimTargetWorld) {
      aimAngle = Math.atan2(aimTargetWorld.y - originY, aimTargetWorld.x - originX);
    }
    this.currentAimAngle = aimAngle;

    // Spawning location along aim vector
    const muzzleDist = 0.55;
    const spawnX = originX + Math.cos(aimAngle) * muzzleDist;
    const spawnY = originY + Math.sin(aimAngle) * muzzleDist;

    laser.position.set(spawnX, spawnY, this.position.z);
    laser.velocity.set(Math.cos(aimAngle) * 30, Math.sin(aimAngle) * 30, 0);
    laser.active = true;
    laser.life = 1.3;
    laser.mesh.position.copy(laser.position);
    laser.mesh.rotation.z = aimAngle; // Aligns laser cylinder with trajectory
    laser.mesh.visible = true;

    // Muzzle flash light
    this.muzzleLight.position.set(spawnX, spawnY, this.position.z + 0.2);
    this.muzzleLight.intensity = 18;

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
    platforms: { x: number; y: number; width: number; height: number }[],
    aimTargetWorld?: THREE.Vector3,
    hasMouse?: boolean
  ) {
    this.animTimer += dt;

    // 1. Invulnerability flash
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      this.mesh.visible = Math.floor(this.invulnerableTime * 14) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 2. Facing Direction Resolution
    // MOVEMENT KEY TAKES PRECEDENCE: player turns to direction of arrow or movement key when pressed!
    if (moveX !== 0) {
      this.facingRight = moveX > 0;
      this.rigRoot.scale.x = this.facingRight ? 1 : -1;
    } else if (hasMouse && aimTargetWorld) {
      // If stationary: face towards mouse crosshair target
      const lookRight = aimTargetWorld.x >= this.position.x;
      if (this.facingRight !== lookRight) {
        this.facingRight = lookRight;
        this.rigRoot.scale.x = this.facingRight ? 1 : -1;
      }
    }

    // Aim Angle
    const chestY = this.position.y + 1.25;
    if (hasMouse && aimTargetWorld) {
      this.currentAimAngle = Math.atan2(aimTargetWorld.y - chestY, aimTargetWorld.x - this.position.x);
    } else {
      this.currentAimAngle = this.facingRight ? 0 : Math.PI;
    }

    // 3. Smooth Acceleration / Deceleration
    const walkSpeed = 4.6;
    const runSpeed = 8.8;
    const currentSpeed = run ? runSpeed : walkSpeed;

    if (moveX !== 0) {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveX * currentSpeed, dt * 14);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * 16);
    }

    // 4. Jump Anticipation & Leap
    if (jumpPressed && this.isGrounded && this.jumpAnticipateTimer <= 0) {
      this.jumpAnticipateTimer = 0.06;
    }

    if (this.jumpAnticipateTimer > 0) {
      this.jumpAnticipateTimer -= dt;
      if (this.jumpAnticipateTimer <= 0) {
        this.velocity.y = 11.8;
        this.isGrounded = false;
        this.emitDust(this.position.x, this.position.y, 4);
      }
    }

    // 5. Jetpack Flight Mechanics
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

    this.velocity.y += gravity * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -14, 12);

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 6. Floor & Platform Collisions
    const floorY = -3.8;
    this.isGrounded = false;

    if (this.position.y <= floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

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

    // Landing Squash
    if (!this.wasGroundedLastFrame && this.isGrounded) {
      this.landSquashTimer = 0.16;
      this.emitDust(this.position.x, this.position.y, 5);
    }
    this.wasGroundedLastFrame = this.isGrounded;

    this.mesh.position.copy(this.position);

    // 7. State Machine
    if (isActuallyJetpacking) {
      this.state = PlayerState.JETPACK;
    } else if (!this.isGrounded) {
      this.state = this.velocity.y > 0 ? PlayerState.JUMP : PlayerState.FALL;
    } else if (Math.abs(this.velocity.x) > 0.8) {
      this.state = run ? PlayerState.RUN : PlayerState.WALK;
    } else {
      this.state = PlayerState.IDLE;
    }

    // 8. Animate Skeletal Joints with Natural Backward Knees & True Aim Vector
    this.animateSkeletalBones(dt, run, hasMouse);

    // 9. Update Jetpack Flames, Volumetric Smoke & Sparks
    this.updateJetpackVFX(dt, isActuallyJetpacking);

    // 10. Update Lasers
    for (const l of this.lasers) {
      if (!l.active) continue;
      l.life -= dt;
      if (l.life <= 0) {
        l.active = false;
        l.mesh.visible = false;
        continue;
      }
      l.position.addScaledVector(l.velocity, dt);
      l.mesh.position.copy(l.position);
    }
  }

  /**
   * Triple-AAA Skeletal Kinematics
   * Knees bend strictly BACKWARD.
   * Blaster barrel aligns directly with 360° mouse aiming vector!
   */
  private animateSkeletalBones(dt: number, isRunning: boolean, hasMouseTarget?: boolean) {
    const t = this.animTimer;

    this.hipBone.position.y = 0.95;
    this.torsoBone.rotation.set(0, 0, 0);
    this.headBone.rotation.set(0, 0, 0);

    // Squash & Stretch
    if (this.landSquashTimer > 0) {
      this.landSquashTimer -= dt;
      const squash = Math.sin((this.landSquashTimer / 0.16) * Math.PI) * 0.14;
      this.hipBone.position.y -= squash;
      this.hipBone.scale.set(1.0 + squash * 0.9, 1.0 - squash, 1.0);
    } else if (this.jumpAnticipateTimer > 0) {
      this.hipBone.position.y -= 0.15;
      this.hipBone.scale.set(1.1, 0.88, 1.0);
    } else if (!this.isGrounded) {
      const stretch = Math.min(0.08, Math.abs(this.velocity.y) * 0.008);
      this.hipBone.scale.set(1.0 - stretch * 0.5, 1.0 + stretch, 1.0);
    } else {
      this.hipBone.scale.set(1, 1, 1);
    }

    // Torso tilt lag & head follow-through
    const targetTorsoTilt = (this.velocity.x / 8.8) * (isRunning ? 0.32 : 0.08);
    this.torsoTiltSmooth = THREE.MathUtils.lerp(this.torsoTiltSmooth, targetTorsoTilt, dt * 10);
    this.headFollowLag = THREE.MathUtils.lerp(this.headFollowLag, -this.torsoTiltSmooth * 0.5, dt * 8);

    switch (this.state) {
      // ----------------------------------------------------
      // A. IDLE (Soft breathing, backward knees)
      // ----------------------------------------------------
      case PlayerState.IDLE: {
        const breathe = Math.sin(t * 2.8) * 0.035;
        this.torsoBone.position.y = 0.1 + breathe;
        this.torsoBone.rotation.z = Math.sin(t * 1.4) * 0.015;
        this.headBone.rotation.z = -Math.sin(t * 2.8) * 0.02 + this.headFollowLag;

        this.frontThighBone.rotation.z = 0.05;
        this.frontShinBone.rotation.z = -0.08; // BACKWARD
        this.frontFootBone.rotation.z = 0.03;

        this.backThighBone.rotation.z = -0.05;
        this.backShinBone.rotation.z = -0.08; // BACKWARD
        this.backFootBone.rotation.z = 0.03;

        this.backArmBone.rotation.z = Math.sin(t * 2.8) * 0.05 + 0.12;
        this.backForearmBone.rotation.z = 0.25;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -Math.sin(t * 2.8) * 0.05 + 0.15;
          this.frontForearmBone.rotation.z = 0.35;
        }
        break;
      }

      // ----------------------------------------------------
      // B. SIDE WALK CYCLE (Strictly Backward-Bending Knees)
      // ----------------------------------------------------
      case PlayerState.WALK: {
        const walkFreq = 9.0;
        const phase = t * walkFreq;

        const hipBob = Math.abs(Math.sin(phase)) * 0.05;
        this.hipBone.position.y = 0.95 + hipBob;

        this.torsoBone.rotation.z = this.torsoTiltSmooth;
        this.headBone.rotation.z = this.headFollowLag;

        const frontAngle = Math.sin(phase);
        const backAngle = Math.sin(phase + Math.PI);

        // FRONT LEG
        this.frontThighBone.rotation.z = frontAngle * 0.52;
        const frontKneeFlex = frontAngle < 0 ? -Math.abs(frontAngle) * 0.75 : -0.08;
        this.frontShinBone.rotation.z = frontKneeFlex; // BACKWARD
        this.frontFootBone.rotation.z = frontAngle * 0.25;

        // BACK LEG
        this.backThighBone.rotation.z = backAngle * 0.52;
        const backKneeFlex = backAngle < 0 ? -Math.abs(backAngle) * 0.75 : -0.08;
        this.backShinBone.rotation.z = backKneeFlex; // BACKWARD
        this.backFootBone.rotation.z = backAngle * 0.25;

        // Counter-arm Swing
        this.backArmBone.rotation.z = frontAngle * 0.55;
        this.backForearmBone.rotation.z = 0.35 + Math.max(0, -frontAngle) * 0.35;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = backAngle * 0.45 + 0.15;
          this.frontForearmBone.rotation.z = 0.4;
        }

        if (Math.abs(frontAngle) > 0.95 && Math.random() < 0.25) {
          this.emitDust(this.position.x, this.position.y, 1);
        }
        break;
      }

      // ----------------------------------------------------
      // C. RUN CYCLE (High Knee Drive & Backward Heel Kick)
      // ----------------------------------------------------
      case PlayerState.RUN: {
        const runFreq = 14.0;
        const phase = t * runFreq;

        this.torsoBone.rotation.z = 0.34;
        this.headBone.rotation.z = -0.12 + this.headFollowLag;

        const runBob = Math.abs(Math.sin(phase)) * 0.08;
        this.hipBone.position.y = 0.95 + runBob;

        const frontRun = Math.sin(phase);
        const backRun = Math.sin(phase + Math.PI);

        // FRONT LEG
        this.frontThighBone.rotation.z = frontRun * 0.82;
        this.frontShinBone.rotation.z = frontRun < 0 ? -Math.abs(frontRun) * 1.25 : -0.1; // BACKWARD
        this.frontFootBone.rotation.z = frontRun * 0.35;

        // BACK LEG
        this.backThighBone.rotation.z = backRun * 0.82;
        this.backShinBone.rotation.z = backRun < 0 ? -Math.abs(backRun) * 1.25 : -0.1; // BACKWARD
        this.backFootBone.rotation.z = backRun * 0.35;

        // Pumping back arm
        this.backArmBone.rotation.z = frontRun * 0.85;
        this.backForearmBone.rotation.z = 0.85;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = backRun * 0.75 + 0.15;
          this.frontForearmBone.rotation.z = 0.8;
        }

        if (Math.abs(frontRun) > 0.9) {
          this.emitDust(this.position.x, this.position.y, 2);
        }
        break;
      }

      // ----------------------------------------------------
      // D. JUMP & FALL (Natural Backward Knee Tucking)
      // ----------------------------------------------------
      case PlayerState.JUMP: {
        this.torsoBone.rotation.z = 0.08;
        this.headBone.rotation.z = 0.14;

        this.frontThighBone.rotation.z = 0.55;
        this.frontShinBone.rotation.z = -0.85; // BACKWARD underneath
        this.frontFootBone.rotation.z = 0.25;

        this.backThighBone.rotation.z = 0.45;
        this.backShinBone.rotation.z = -0.75; // BACKWARD underneath
        this.backFootBone.rotation.z = 0.25;

        this.backArmBone.rotation.z = -0.4;
        this.backForearmBone.rotation.z = 0.5;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = 0.25;
          this.frontForearmBone.rotation.z = 0.4;
        }
        break;
      }

      case PlayerState.FALL: {
        this.torsoBone.rotation.z = -0.04;
        this.headBone.rotation.z = -0.08;

        this.frontThighBone.rotation.z = 0.12;
        this.frontShinBone.rotation.z = -0.2; // BACKWARD
        this.frontFootBone.rotation.z = -0.25;

        this.backThighBone.rotation.z = -0.08;
        this.backShinBone.rotation.z = -0.2; // BACKWARD
        this.backFootBone.rotation.z = -0.25;

        this.backArmBone.rotation.z = -0.25;
        this.backForearmBone.rotation.z = 0.35;
        break;
      }

      // ----------------------------------------------------
      // E. JETPACK FLIGHT
      // ----------------------------------------------------
      case PlayerState.JETPACK: {
        const flightLean = 0.26 + (this.velocity.x / 9.0) * 0.25;
        this.torsoBone.rotation.z = flightLean;
        this.headBone.rotation.z = 0.15;

        const flutter = Math.sin(t * 12.0) * 0.08;
        this.frontThighBone.rotation.z = -0.42 + flutter;
        this.frontShinBone.rotation.z = -0.32; // Backward trail
        this.frontFootBone.rotation.z = -0.25;

        this.backThighBone.rotation.z = -0.52 - flutter;
        this.backShinBone.rotation.z = -0.38; // Backward trail
        this.backFootBone.rotation.z = -0.25;

        this.backArmBone.rotation.z = -0.55;
        this.backForearmBone.rotation.z = 0.3;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = 0.2;
          this.frontForearmBone.rotation.z = 0.35;
        }
        break;
      }
    }

    // ------------------------------------------------------
    // F. 360° MOUSE RETICLE AIMING & PRECISION BARREL ALIGNMENT
    // ------------------------------------------------------
    if (hasMouseTarget) {
      // Calculate front arm angle directly toward mouse target
      let localAngle = this.currentAimAngle;
      if (!this.facingRight) {
        localAngle = Math.PI - localAngle;
      }
      localAngle = THREE.MathUtils.euclideanModulo(localAngle + Math.PI, Math.PI * 2) - Math.PI;

      // Adjust for torso tilt
      const aimRotation = localAngle - this.torsoBone.rotation.z;

      // Point front arm bone directly at mouse reticle:
      // The upper arm hangs along -Y, forearm along -Y, blaster extends along +X.
      // So rotating frontArmBone by `aimRotation` aligns the blaster barrel strictly along the aim vector!
      this.frontArmBone.rotation.z = THREE.MathUtils.lerp(
        this.frontArmBone.rotation.z,
        aimRotation,
        dt * 26
      );
      this.frontForearmBone.rotation.z = 0.0;
    }

    // Recoil Kickback Shock & Muzzle Flash on firing
    if (this.shootTimer > 0) {
      this.shootTimer -= dt;
      const progress = 1.0 - this.shootTimer / 0.28;

      if (progress < 0.25) {
        // Immediate kickback along gun axis
        const kick = Math.sin((progress / 0.25) * Math.PI);
        this.blasterMesh.position.x = -kick * 0.12;
        this.frontArmBone.rotation.z += 0.08 * kick; // Subtle muzzle climb
        this.torsoBone.rotation.z -= kick * 0.04;

        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
        this.muzzleFlashMesh.scale.set(1.5, 1.5, 1.5);
      } else {
        const returnProg = (progress - 0.25) / 0.75;
        this.blasterMesh.position.x = THREE.MathUtils.lerp(-0.06, 0.0, returnProg);
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        this.muzzleLight.intensity = 0;
      }
    } else {
      this.blasterMesh.position.x = 0;
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

      const flick = 1.0 + Math.random() * 0.45;
      this.flameConeLeft.scale.set(1.0 + Math.random() * 0.2, flick, 1.0);
      this.flameConeRight.scale.copy(this.flameConeLeft.scale);

      this.thrusterLight.intensity = 20 + Math.random() * 8;
      this.thrusterLight.distance = 16;

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

      puff.velocity.x *= 1.0 - dt * 1.5;
      puff.velocity.y *= 1.0 - dt * 1.2;
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
          sp.velocity.x *= 1.0 - dt * 2.5;
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

      const horizontalSpread = this.facingRight ? -(1.5 + Math.random() * 2.5) : 1.5 + Math.random() * 2.5;
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
      const horiz = this.facingRight ? -(3.0 + Math.random() * 5.0) : 3.0 + Math.random() * 5.0;
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
