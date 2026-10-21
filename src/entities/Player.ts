import * as THREE from 'three';

export const GROUND_Y = -3.70;

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

interface BubbleBurstParticle {
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
 * Triple-AAA Articulated 2D Skeletal Character - Jetpack Jones
 * Features:
 * - Hand holds blaster correctly from below on the handle/grip
 * - Cool chunky astronaut space boots with corrugated tread soles & status LEDs
 * - Movement-priority facing direction (no snapping back to right when releasing keys)
 * - Clean rocketman flight pose with proper pelvis alignment (no flames through legs)
 * - Brand-new retro space helmet with flashing LED command pods and dual beacons
 * - 2-joint arm IK with natural elbow flexion & 360° mouse aiming
 * - Authentic 1970s toy jetpack with blinking LEDs, analog dial, and epic multi-tier flames
 * - Satisfying plasma bubble-burst muzzle flash
 */
export class Player {
  public mesh: THREE.Group;
  public state: PlayerState = PlayerState.IDLE;

  // Transform & Physics
  public position: THREE.Vector3 = new THREE.Vector3(0, GROUND_Y, 0);
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

  // Legs & Cool Space Boots
  private frontThighBone: THREE.Group;
  private frontShinBone: THREE.Group;
  private frontFootBone: THREE.Group;

  private backThighBone: THREE.Group;
  private backShinBone: THREE.Group;
  private backFootBone: THREE.Group;

  // Arms (2-Joint Inverse Kinematics / Natural Elbow Flexion)
  private frontArmBone: THREE.Group;
  private frontForearmBone: THREE.Group;
  private frontHandBone: THREE.Group;
  private blasterMesh: THREE.Group;

  private backArmBone: THREE.Group;
  private backForearmBone: THREE.Group;
  private backHandBone: THREE.Group;

  // Satisfying Bubble-Burst Muzzle Flash
  private bubbleBurstGroup: THREE.Group;
  private bubbleSphereMesh: THREE.Mesh;
  private bubbleRingMesh: THREE.Mesh;
  private bubbleBurstTimer: number = 0;
  private bubbleParticles: BubbleBurstParticle[] = [];

  // 1970s Toy-Style Jetpack & Flashing LEDs
  private jetpackBone: THREE.Group;
  private flameConeLeft: THREE.Group;
  private flameConeRight: THREE.Group;
  private flameCoreLeft: THREE.Mesh;
  private flameCoreRight: THREE.Mesh;
  private flameOuterLeft: THREE.Mesh;
  private flameOuterRight: THREE.Mesh;
  private thrusterLight: THREE.PointLight;
  private muzzleLight: THREE.PointLight;

  // 1970s Jetpack Console LEDs & Fuel Gauge
  private jetpackLedMaterials: THREE.MeshBasicMaterial[] = [];
  private fuelGaugeNeedle!: THREE.Mesh;

  // Helmet Flashing LEDs & Beacons
  private helmetLedMaterials: THREE.MeshBasicMaterial[] = [];
  private antennaBeaconMat!: THREE.MeshBasicMaterial;

  // Animation Timers & Physics Smoothing
  private animTimer: number = 0;
  private shootTimer: number = 0;
  private currentAimAngle: number = 0;
  private landSquashTimer: number = 0;
  private wasGroundedLastFrame: boolean = true;
  private headFollowLag: number = 0;

  // VFX Pools
  private vfxGroup: THREE.Group;
  private smokePuffs: SmokePuff[] = [];
  private maxSmoke = 80;
  private sparks: Spark[] = [];
  private maxSparks = 70;
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

    this.muzzleLight = new THREE.PointLight(0x00f5ff, 0, 10, 1.8);
    scene.add(this.muzzleLight);

    // Stylized Materials Palette
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
      color: 0x242830,
      roughness: 0.45,
      metalness: 0.25,
    });
    const cyanStripe = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
    });
    const spaceWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5fa,
      roughness: 0.32,
      metalness: 0.12,
    });
    const fleshTone = new THREE.MeshStandardMaterial({
      color: 0xf5c2a3,
      roughness: 0.45,
    });
    const amberVisor = new THREE.MeshPhysicalMaterial({
      color: 0xff8800,
      roughness: 0.04,
      metalness: 0.15,
      transmission: 0.55,
      transparent: true,
      opacity: 0.95,
      reflectivity: 0.95,
    });
    const chromeMetal = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      metalness: 0.95,
      roughness: 0.12,
    });
    const vintageConsoleMat = new THREE.MeshStandardMaterial({
      color: 0x3d4349,
      roughness: 0.5,
      metalness: 0.3,
    });
    const treadMat = new THREE.MeshStandardMaterial({
      color: 0x16181e,
      roughness: 0.85,
      metalness: 0.1,
    });

    // --------------------------------------------------------
    // 1. SKELETAL RIG HIERARCHY
    // --------------------------------------------------------
    // Hip Bone (Height calibrated so soles touch GROUND_Y = -3.70 with 0.000 error)
    this.hipBone = new THREE.Group();
    this.hipBone.position.set(0, 1.05, 0);
    this.rigRoot.add(this.hipBone);

    // Utility belt and chrome buckle
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.32), darkHarness);
    this.hipBone.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.34), chromeMetal);
    buckle.position.set(0.12, 0, 0);
    this.hipBone.add(buckle);

    // Torso Bone
    this.torsoBone = new THREE.Group();
    this.torsoBone.position.set(0, 0.1, 0);
    this.hipBone.add(this.torsoBone);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.3), suitOrange);
    torso.position.set(0, 0.28, 0);
    this.torsoBone.add(torso);

    // Shoulder Harness
    const harnessL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), darkHarness);
    harnessL.position.set(0, 0.56, 0.16);
    this.torsoBone.add(harnessL);

    const harnessR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), darkHarness);
    harnessR.position.set(0, 0.56, -0.16);
    this.torsoBone.add(harnessR);

    // Collar
    const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 12), darkHarness);
    collarMesh.position.set(0.02, 0.62, 0);
    this.torsoBone.add(collarMesh);

    // Head Bone
    this.headBone = new THREE.Group();
    this.headBone.position.set(0.02, 0.72, 0);
    this.torsoBone.add(this.headBone);

    // Stylized Face inside helmet
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), fleshTone);
    face.position.set(0.02, 0.14, 0);
    this.headBone.add(face);

    // --------------------------------------------------------
    // REVISED SPACE HELMET WITH FLASHING COMMAND BUTTONS
    // --------------------------------------------------------
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0.02, 0.16, 0);
    this.headBone.add(helmetGroup);

    // Outer Aerodynamic Pearl Helmet Shell
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 24), spaceWhiteMat);
    helmetGroup.add(helmetMesh);

    // Top Aerodynamic Crest / Fin in dark graphite
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.04), darkHarness);
    crest.position.set(-0.02, 0.33, 0);
    helmetGroup.add(crest);

    // Chin and Visor Outer Seal Rim
    const visorRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 24), darkHarness);
    visorRim.rotation.y = Math.PI / 2;
    visorRim.position.set(0.06, 0, 0);
    helmetGroup.add(visorRim);

    // Panoramic Translucent Amber Bubble Visor
    const visorGeo = new THREE.SphereGeometry(0.29, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.54);
    visorGeo.rotateZ(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, amberVisor);
    visor.position.set(0.08, 0, 0);
    helmetGroup.add(visor);

    // Dual Side Command Pods with FLASHING LED BUTTONS
    for (const zSide of [0.33, -0.33]) {
      const pod = new THREE.Group();
      pod.position.set(0, 0, zSide);
      helmetGroup.add(pod);

      // Pod chassis
      const podHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12),
        darkHarness
      );
      podHousing.rotation.x = Math.PI / 2;
      pod.add(podHousing);

      // Chrome bezel ring
      const bezel = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.015, 8, 16),
        chromeMetal
      );
      bezel.position.z = zSide > 0 ? 0.03 : -0.03;
      pod.add(bezel);

      // 3 Chunky Interactive Flashing LED Buttons on the Pod
      // 0: Red, 1: Cyan, 2: Amber
      const buttonColors = [0xff1133, 0x00f5ff, 0xffaa00];
      for (let b = 0; b < 3; b++) {
        const bMat = new THREE.MeshBasicMaterial({ color: buttonColors[b] });
        this.helmetLedMaterials.push(bMat);

        const btnMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 8, 8),
          bMat
        );
        const bx = -0.04 + b * 0.04;
        const by = 0.01;
        const bz = zSide > 0 ? 0.035 : -0.035;
        btnMesh.position.set(bx, by, bz);
        pod.add(btnMesh);
      }
    }

    // Dual Top Antenna Masts with Flashing Beacons
    this.antennaBeaconMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    for (const zAnt of [0.14, -0.14]) {
      const antennaStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.015, 0.26, 8),
        chromeMetal
      );
      antennaStem.position.set(-0.14, 0.38, zAnt);
      antennaStem.rotation.z = -0.25;
      antennaStem.rotation.x = zAnt > 0 ? 0.15 : -0.15;
      helmetGroup.add(antennaStem);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        this.antennaBeaconMat
      );
      beacon.position.set(-0.18, 0.51, zAnt * 1.15);
      helmetGroup.add(beacon);
    }

    // Rear Dual Oxygen Scrubber Vents
    for (const zVent of [0.12, -0.12]) {
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10),
        darkHarness
      );
      vent.position.set(-0.25, -0.05, zVent);
      helmetGroup.add(vent);

      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.08), cyanStripe);
      grille.position.set(-0.30, -0.05, zVent);
      helmetGroup.add(grille);
    }

    // --------------------------------------------------------
    // 2. LEGS & COOL ASTRONAUT SPACE BOOTS
    // --------------------------------------------------------
    const legGeoThigh = new THREE.BoxGeometry(0.15, 0.44, 0.14);
    const legGeoShin = new THREE.BoxGeometry(0.13, 0.42, 0.13);

    // Back Leg (Z = -0.1)
    this.backThighBone = new THREE.Group();
    this.backThighBone.position.set(-0.02, -0.05, -0.1);
    this.hipBone.add(this.backThighBone);

    const backThighMesh = new THREE.Mesh(legGeoThigh, suitOrangeDark);
    backThighMesh.position.set(0, -0.22, 0);
    this.backThighBone.add(backThighMesh);

    this.backShinBone = new THREE.Group();
    this.backShinBone.position.set(0, -0.44, 0);
    this.backThighBone.add(this.backShinBone);

    const backShinMesh = new THREE.Mesh(legGeoShin, suitOrangeDark);
    backShinMesh.position.set(0, -0.21, 0);
    this.backShinBone.add(backShinMesh);

    this.backFootBone = new THREE.Group();
    this.backFootBone.position.set(0, -0.42, 0);
    this.backShinBone.add(this.backFootBone);

    // Front Leg (Z = +0.1)
    this.frontThighBone = new THREE.Group();
    this.frontThighBone.position.set(0.02, -0.05, 0.1);
    this.hipBone.add(this.frontThighBone);

    const frontThighMesh = new THREE.Mesh(legGeoThigh, suitOrange);
    frontThighMesh.position.set(0, -0.22, 0);
    this.frontThighBone.add(frontThighMesh);

    this.frontShinBone = new THREE.Group();
    this.frontShinBone.position.set(0, -0.44, 0);
    this.frontThighBone.add(this.frontShinBone);

    const frontShinMesh = new THREE.Mesh(legGeoShin, suitOrange);
    frontShinMesh.position.set(0, -0.21, 0);
    this.frontShinBone.add(frontShinMesh);

    this.frontFootBone = new THREE.Group();
    this.frontFootBone.position.set(0, -0.42, 0);
    this.frontShinBone.add(this.frontFootBone);

    // BUILD DETAILED LUNAR SPACE BOOTS ON BOTH FEET
    // Zero-Clip Mathematical Alignment: Bottom of boot sole touches exactly y = 0.000 in player space!
    const createSpaceBoot = (parentFoot: THREE.Group, isFront: boolean) => {
      const bootGroup = new THREE.Group();
      parentFoot.add(bootGroup);

      // Ankle Ribbed Seal Collar
      const ankleCuff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), darkHarness);
      ankleCuff.position.set(0, 0.01, 0);
      bootGroup.add(ankleCuff);

      // Main Reinforced White Space Boot Upper
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.14), spaceWhiteMat);
      upper.position.set(0.05, -0.065, 0);
      bootGroup.add(upper);

      // Dark Armored Front Toe Bumper Cap
      const toeBumper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.15), darkHarness);
      toeBumper.position.set(0.18, -0.07, 0);
      bootGroup.add(toeBumper);

      // Dual Chrome Mechanical Instep Straps
      const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.15), chromeMetal);
      strap1.position.set(0.03, -0.02, 0);
      bootGroup.add(strap1);

      const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.15), chromeMetal);
      strap2.position.set(0.10, -0.03, 0);
      bootGroup.add(strap2);

      // Heavy Corrugated Vulcanized Tread Sole Plate
      // Height = 0.035, Center at -0.1225 -> Bottom at -0.140 (which equals local y = 0.000!)
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.16), treadMat);
      sole.position.set(0.06, -0.1225, 0);
      bootGroup.add(sole);

      // Individual Deep Sole Cleats
      for (const cx of [-0.07, 0.0, 0.07, 0.14]) {
        const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.015, 0.15), treadMat);
        cleat.position.set(cx, -0.135, 0);
        bootGroup.add(cleat);
      }

      // Outer Heel Status LED Indicator (Cyan)
      const heelLedZ = isFront ? 0.085 : -0.085;
      const heelLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), cyanStripe);
      heelLed.position.set(-0.08, -0.065, heelLedZ);
      bootGroup.add(heelLed);
    };

    createSpaceBoot(this.backFootBone, false);
    createSpaceBoot(this.frontFootBone, true);

    // --------------------------------------------------------
    // 3. ARMS WITH RETRO ASTRONAUT GAUNTLET SPACE GLOVES
    // --------------------------------------------------------
    const armGeoUpper = new THREE.BoxGeometry(0.12, 0.35, 0.12);
    const armGeoFore = new THREE.BoxGeometry(0.11, 0.32, 0.11);

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

    // Back Space Glove
    const backGloveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 12), darkHarness);
    backGloveCuff.position.set(0, -0.26, 0);
    this.backForearmBone.add(backGloveCuff);

    this.backHandBone = new THREE.Group();
    this.backHandBone.position.set(0, -0.32, 0);
    this.backForearmBone.add(this.backHandBone);

    const backGloveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), spaceWhiteMat);
    this.backHandBone.add(backGloveMesh);

    // Front Arm (2-Joint Inverse Kinematics)
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

    const frontGloveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 12), darkHarness);
    frontGloveCuff.position.set(0, -0.26, 0);
    this.frontForearmBone.add(frontGloveCuff);

    const gloveStatusLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), cyanStripe);
    gloveStatusLed.position.set(0.07, -0.26, 0);
    this.frontForearmBone.add(gloveStatusLed);

    // Front Hand Bone: represents the center of the hand gripping the handle
    this.frontHandBone = new THREE.Group();
    this.frontHandBone.position.set(0, -0.32, 0);
    this.frontForearmBone.add(this.frontHandBone);

    // --------------------------------------------------------
    // 4. RETRO LASER BLASTER (Hand grips handle from below!)
    // --------------------------------------------------------
    this.blasterMesh = new THREE.Group();
    this.blasterMesh.position.set(0, 0, 0);
    this.frontHandBone.add(this.blasterMesh);

    // A. Tactical Pistol Grip Handle (Centered right where the hand holds it!)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), darkHarness);
    grip.rotation.z = -0.16;
    grip.position.set(0, 0, 0);
    this.blasterMesh.add(grip);

    // B. Astronaut Space Glove Fingers securely wrapped around the handle
    const glovePalm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), spaceWhiteMat);
    glovePalm.position.set(-0.01, 0, 0);
    this.blasterMesh.add(glovePalm);

    // Fingers curled around the front of the grip
    const curledFingers = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.09), spaceWhiteMat);
    curledFingers.position.set(0.04, 0, 0);
    this.blasterMesh.add(curledFingers);

    // Thumb resting on the upper frame
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.04), spaceWhiteMat);
    thumb.position.set(-0.02, 0.05, 0.05);
    this.blasterMesh.add(thumb);

    // C. Gun Receiver & Barrel — PLACED ON TOP OF THE HANDLE!
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.11, 0.09), chromeMetal);
    receiver.position.set(0.10, 0.12, 0);
    this.blasterMesh.add(receiver);

    // Trigger Guard connecting receiver bottom to front of grip
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), darkHarness);
    guard.position.set(0.04, 0.05, 0);
    guard.rotation.z = -Math.PI / 2;
    this.blasterMesh.add(guard);

    // Glowing Cyan Energy Plasma Core in the receiver
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.11), cyanStripe);
    coreMesh.position.set(0.08, 0.12, 0);
    this.blasterMesh.add(coreMesh);

    // Precision Forward Barrel extending out from receiver
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.28, 12), chromeMetal);
    barrel.rotateZ(Math.PI / 2);
    barrel.position.set(0.34, 0.12, 0);
    this.blasterMesh.add(barrel);

    // Ribbed Cooling Coils around the barrel
    for (let cx = 0.24; cx <= 0.40; cx += 0.055) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 12), cyanStripe);
      coil.rotateY(Math.PI / 2);
      coil.position.set(cx, 0.12, 0);
      this.blasterMesh.add(coil);
    }

    // Dual Muzzle Prongs at the tip
    const prongTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.03), chromeMetal);
    prongTop.position.set(0.50, 0.14, 0);
    this.blasterMesh.add(prongTop);

    const prongBot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.03), chromeMetal);
    prongBot.position.set(0.50, 0.10, 0);
    this.blasterMesh.add(prongBot);

    // SATISFYING PLASMA BUBBLE BURST MUZZLE FLASH
    this.bubbleBurstGroup = new THREE.Group();
    this.bubbleBurstGroup.position.set(0.58, 0.12, 0);
    this.blasterMesh.add(this.bubbleBurstGroup);

    // Expanding glowing energy bubble
    const bubbleGeo = new THREE.SphereGeometry(0.26, 16, 16);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.bubbleSphereMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.bubbleBurstGroup.add(this.bubbleSphereMesh);

    // Concentric shockwave ripple ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.35, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff00bb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.bubbleRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.bubbleRingMesh.rotation.y = Math.PI / 2;
    this.bubbleBurstGroup.add(this.bubbleRingMesh);

    // Burst droplet particles
    const dropletGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const dropletMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(dropletGeo, dropletMat);
      drop.visible = false;
      this.bubbleBurstGroup.add(drop);
      this.bubbleParticles.push({
        mesh: drop,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.22,
        active: false,
      });
    }

    // --------------------------------------------------------
    // 5. 1970s TOY JETPACK WITH FLASHING BUTTONS & EPIC FLAMES
    // --------------------------------------------------------
    this.jetpackBone = new THREE.Group();
    this.jetpackBone.position.set(-0.25, 0.34, 0);
    this.torsoBone.add(this.jetpackBone);

    // Vacuum-Metallized Chrome Twin Rocket Cylinders
    const tankGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.58, 16);
    const leftTank = new THREE.Mesh(tankGeo, chromeMetal);
    leftTank.position.z = -0.13;
    this.jetpackBone.add(leftTank);

    const rightTank = new THREE.Mesh(tankGeo, chromeMetal);
    rightTank.position.z = 0.13;
    this.jetpackBone.add(rightTank);

    // Conical Rocket Nose Cones
    const noseGeo = new THREE.ConeGeometry(0.09, 0.14, 16);
    const noseL = new THREE.Mesh(noseGeo, chromeMetal);
    noseL.position.set(0, 0.36, -0.13);
    this.jetpackBone.add(noseL);

    const noseR = new THREE.Mesh(noseGeo, chromeMetal);
    noseR.position.set(0, 0.36, 0.13);
    this.jetpackBone.add(noseR);

    // Ribbed Tank Band Rings
    for (const ty of [-0.15, 0.15]) {
      const bandL = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.015, 8, 16), darkHarness);
      bandL.rotation.x = Math.PI / 2;
      bandL.position.set(0, ty, -0.13);
      this.jetpackBone.add(bandL);

      const bandR = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.015, 8, 16), darkHarness);
      bandR.rotation.x = Math.PI / 2;
      bandR.position.set(0, ty, 0.13);
      this.jetpackBone.add(bandR);
    }

    // 1970s Retro Command Console Box between tanks
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.2), vintageConsoleMat);
    consoleBox.position.set(-0.02, 0.02, 0);
    this.jetpackBone.add(consoleBox);

    // 4 Chunky Vintage Flashing LED Buttons (Red, Green, Amber, Cyan)
    const ledColors = [0xff2222, 0x22ff44, 0xffaa00, 0x00f5ff];
    for (let b = 0; b < 4; b++) {
      const ledMat = new THREE.MeshBasicMaterial({ color: ledColors[b] });
      this.jetpackLedMaterials.push(ledMat);

      const button = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.035), ledMat);
      button.position.set(-0.095, 0.09 - b * 0.06, 0.05);
      this.jetpackBone.add(button);
    }

    // Analog Pressure Gauge Dial with Needle
    const dialRim = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), chromeMetal);
    dialRim.rotateZ(Math.PI / 2);
    dialRim.position.set(-0.09, -0.08, -0.04);
    this.jetpackBone.add(dialRim);

    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.04, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    dialFace.rotateY(-Math.PI / 2);
    dialFace.position.set(-0.102, -0.08, -0.04);
    this.jetpackBone.add(dialFace);

    const needleGeo = new THREE.BoxGeometry(0.005, 0.035, 0.005);
    needleGeo.translate(0, 0.015, 0);
    this.fuelGaugeNeedle = new THREE.Mesh(needleGeo, new THREE.MeshBasicMaterial({ color: 0xcc0000 }));
    this.fuelGaugeNeedle.position.set(-0.104, -0.08, -0.04);
    this.jetpackBone.add(this.fuelGaugeNeedle);

    // Flared Conical Exhaust Bells (Tilted slightly back so flames never touch legs!)
    const nozzleGeo = new THREE.ConeGeometry(0.11, 0.2, 16, 1, true);
    nozzleGeo.rotateX(Math.PI);

    const nozL = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozL.position.set(0, -0.37, -0.13);
    this.jetpackBone.add(nozL);

    const nozR = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozR.position.set(0, -0.37, 0.13);
    this.jetpackBone.add(nozR);

    // EPIC MULTI-TIERED THRUSTER FLAME PLUMES
    this.flameConeLeft = new THREE.Group();
    this.flameConeLeft.position.set(0, -0.42, -0.13);
    this.jetpackBone.add(this.flameConeLeft);

    this.flameConeRight = new THREE.Group();
    this.flameConeRight.position.set(0, -0.42, 0.13);
    this.jetpackBone.add(this.flameConeRight);

    // Outer Roaring Amber Flame Plume
    const outerGeo = new THREE.ConeGeometry(0.16, 0.82, 12);
    outerGeo.rotateX(Math.PI);
    outerGeo.translate(0, -0.41, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.flameOuterLeft = new THREE.Mesh(outerGeo, outerMat);
    this.flameOuterRight = new THREE.Mesh(outerGeo, outerMat);
    this.flameConeLeft.add(this.flameOuterLeft);
    this.flameConeRight.add(this.flameOuterRight);

    // Middle Bright Yellow Plasma Flame
    const midGeo = new THREE.ConeGeometry(0.10, 0.58, 12);
    midGeo.rotateX(Math.PI);
    midGeo.translate(0, -0.29, 0);
    const midMat = new THREE.MeshBasicMaterial({
      color: 0xffbb00,
      blending: THREE.AdditiveBlending,
    });
    this.flameConeLeft.add(new THREE.Mesh(midGeo, midMat));
    this.flameConeRight.add(new THREE.Mesh(midGeo, midMat));

    // Inner White-Hot Plasma Core
    const coreGeo = new THREE.ConeGeometry(0.05, 0.36, 12);
    coreGeo.rotateX(Math.PI);
    coreGeo.translate(0, -0.18, 0);
    const coreFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
    });
    this.flameCoreLeft = new THREE.Mesh(coreGeo, coreFlameMat);
    this.flameCoreRight = new THREE.Mesh(coreGeo, coreFlameMat);
    this.flameConeLeft.add(this.flameCoreLeft);
    this.flameConeRight.add(this.flameCoreRight);

    this.flameConeLeft.visible = false;
    this.flameConeRight.visible = false;

    // --------------------------------------------------------
    // 6. VFX SYSTEMS (Volumetric Smoke, Sparks, Dust)
    // --------------------------------------------------------
    this.initSmokeSystem();
    this.initSparkSystem();
    this.initDustSystem();

    // --------------------------------------------------------
    // 7. LASER BOLTS
    // --------------------------------------------------------
    this.laserGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8);
    this.laserGeo.rotateZ(Math.PI / 2);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });

    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.laserGeo, this.laserMat);
      mesh.visible = false;
      scene.add(mesh);
      this.lasers.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(30, 0, 0),
        active: false,
        life: 0,
      });
    }

    this.reset();
  }

  public reset(startX: number = 0, startY: number = GROUND_Y) {
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
    this.bubbleBurstTimer = 0;
    this.headFollowLag = 0;
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
    for (const bp of this.bubbleParticles) {
      bp.active = false;
      bp.mesh.visible = false;
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
      size: 0.22,
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
    const dustGeo = new THREE.SphereGeometry(0.1, 6, 6);
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
   * Fires a blaster laser bolt in 360° toward target with bubble-burst flash
   */
  public shoot(aimTargetWorld?: THREE.Vector3): boolean {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

    this.shootTimer = 0.28;
    this.bubbleBurstTimer = 0.24;

    // Calculate aim angle
    let aimAngle = this.facingRight ? 0 : Math.PI;
    const originY = this.position.y + 1.25;
    const originX = this.position.x + (this.facingRight ? 0.38 : -0.38);

    if (aimTargetWorld) {
      aimAngle = Math.atan2(aimTargetWorld.y - originY, aimTargetWorld.x - originX);
    }
    this.currentAimAngle = aimAngle;

    // Spawning location along barrel axis
    const muzzleDist = 0.62;
    const spawnX = originX + Math.cos(aimAngle) * muzzleDist;
    const spawnY = originY + Math.sin(aimAngle) * muzzleDist;

    laser.position.set(spawnX, spawnY, this.position.z);
    laser.velocity.set(Math.cos(aimAngle) * 32, Math.sin(aimAngle) * 32, 0);
    laser.active = true;
    laser.life = 1.3;
    laser.mesh.position.copy(laser.position);
    laser.mesh.rotation.z = aimAngle;
    laser.mesh.visible = true;

    // Trigger bubble burst droplets
    for (let i = 0; i < this.bubbleParticles.length; i++) {
      const bp = this.bubbleParticles[i];
      bp.active = true;
      bp.age = 0;
      bp.mesh.position.set(0, 0, 0);
      bp.mesh.visible = true;
      const angle = (i / this.bubbleParticles.length) * Math.PI * 2;
      const speed = 2.0 + Math.random() * 2.5;
      bp.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, 0);
    }

    // Dynamic Muzzle Flash light
    this.muzzleLight.position.set(spawnX, spawnY, this.position.z + 0.2);
    this.muzzleLight.intensity = 22;

    return true;
  }

  public takeDamage(amount: number = 25) {
    if (this.invulnerableTime > 0) return;
    this.life = Math.max(0, this.life - amount);
    this.invulnerableTime = 1.0;
  }

  public addFuel(amount: number = 35) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  public addLife(amount: number = 30) {
    this.life = Math.min(this.maxLife, this.life + amount);
  }

  public update(
    dt: number,
    moveX: number,
    runPressed: boolean,
    jumpPressed: boolean,
    jetpackPressed: boolean,
    platforms: { x: number; y: number; width: number; height: number }[] = [],
    mouseWorldTarget?: THREE.Vector3,
    hasMouseTarget: boolean = false
  ) {
    this.animTimer += dt;
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      this.mesh.visible = Math.floor(this.animTimer * 18) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 1. Aim Tracking
    if (hasMouseTarget && mouseWorldTarget) {
      const originY = this.position.y + 1.25;
      const originX = this.position.x;
      this.currentAimAngle = Math.atan2(
        mouseWorldTarget.y - originY,
        mouseWorldTarget.x - originX
      );
    }

    // 2. Movement-Priority Facing Direction
    // FIXED: Only movement keys change facing direction! When key is released,
    // the player keeps his current facing direction and will NEVER automatically snap back!
    if (moveX > 0.05) {
      this.facingRight = true;
    } else if (moveX < -0.05) {
      this.facingRight = false;
    }

    // Smooth Turn Around
    const targetTurn = this.facingRight ? 0 : Math.PI;
    this.rigRoot.rotation.y = THREE.MathUtils.lerp(
      this.rigRoot.rotation.y,
      targetTurn,
      dt * 24
    );

    // 3. Movement Physics
    const walkSpeed = 6.2;
    const runSpeed = 10.5;
    const targetSpeed = runPressed ? runSpeed : walkSpeed;
    const accel = this.isGrounded ? 45.0 : 22.0;

    const desiredVx = moveX * targetSpeed;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, desiredVx, dt * (accel / 10));

    // 4. Jump & Jetpack
    if (jumpPressed && this.isGrounded) {
      this.velocity.y = 11.5;
      this.isGrounded = false;
      this.emitDust(this.position.x, this.position.y, 6);
    }

    const isActuallyJetpacking = jetpackPressed && this.fuel > 0;
    const gravity = -26.0;
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

    // 5. Floor & Platform Collisions (Exact alignment to GROUND_Y = -3.70)
    const floorY = GROUND_Y;
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

    // 6. Determine State Machine
    if (isActuallyJetpacking) {
      this.state = PlayerState.JETPACK;
    } else if (!this.isGrounded) {
      this.state = this.velocity.y > 0 ? PlayerState.JUMP : PlayerState.FALL;
    } else if (Math.abs(this.velocity.x) > 0.4) {
      this.state = Math.abs(this.velocity.x) > 7.0 ? PlayerState.RUN : PlayerState.WALK;
    } else {
      this.state = PlayerState.IDLE;
    }

    // 7. Update Transforms & Animations
    this.mesh.position.copy(this.position);
    this.animateSkeletalRig(dt, hasMouseTarget);
    this.updateJetpackVFX(dt, isActuallyJetpacking);
    this.updateHelmetLEDs(dt);
    this.updateBubbleBurstVFX(dt);
    this.updateParticles(dt);
    this.updateLasers(dt);
  }

  /**
   * Triple-AAA Skeletal Animation System
   * Features 2-joint arm IK with natural elbow flexion and backward-bending knees
   */
  private animateSkeletalRig(dt: number, hasMouseTarget: boolean) {
    const t = this.animTimer;

    // Secondary Motion / Follow-Through
    const targetHeadLag = -(this.velocity.x / 11.0) * 0.18;
    this.headFollowLag = THREE.MathUtils.lerp(this.headFollowLag, targetHeadLag, dt * 10);

    // Squash on Landing
    if (this.landSquashTimer > 0) {
      this.landSquashTimer -= dt;
      const s = 1.0 - (this.landSquashTimer / 0.16) * 0.18;
      this.hipBone.position.y = 1.05 * s;
    } else {
      this.hipBone.position.y = 1.05;
    }

    switch (this.state) {
      // ----------------------------------------------------
      // A. IDLE
      // ----------------------------------------------------
      case PlayerState.IDLE: {
        const breathe = Math.sin(t * 3.2);
        this.torsoBone.rotation.z = breathe * 0.025;
        this.torsoBone.position.y = 0.1 + breathe * 0.015;
        this.headBone.rotation.z = -breathe * 0.02;
        this.jetpackBone.rotation.z = 0;

        this.frontThighBone.rotation.z = 0.05;
        this.frontShinBone.rotation.z = -0.05;
        this.frontFootBone.rotation.z = 0.0;

        this.backThighBone.rotation.z = -0.05;
        this.backShinBone.rotation.z = -0.05;
        this.backFootBone.rotation.z = 0.0;

        this.backArmBone.rotation.z = breathe * 0.04 - 0.1;
        this.backForearmBone.rotation.z = 0.35;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -breathe * 0.04 + 0.15;
          this.frontForearmBone.rotation.z = 0.4;
        }
        break;
      }

      // ----------------------------------------------------
      // B. WALK
      // ----------------------------------------------------
      case PlayerState.WALK: {
        const walkFreq = 8.5;
        const phase = t * walkFreq;

        this.torsoBone.rotation.z = -0.08;
        this.torsoBone.position.y = 0.1;
        this.headBone.rotation.z = 0.04 + this.headFollowLag;
        this.jetpackBone.rotation.z = 0;

        const bob = Math.abs(Math.sin(phase)) * 0.05;
        this.hipBone.position.y = 1.05 + bob;

        const frontStride = Math.sin(phase);
        const backStride = Math.sin(phase + Math.PI);

        this.frontThighBone.rotation.z = frontStride * 0.55;
        this.frontShinBone.rotation.z = frontStride < 0 ? -Math.abs(frontStride) * 0.85 : -0.1;
        this.frontFootBone.rotation.z = frontStride * 0.2;

        this.backThighBone.rotation.z = backStride * 0.55;
        this.backShinBone.rotation.z = backStride < 0 ? -Math.abs(backStride) * 0.85 : -0.1;
        this.backFootBone.rotation.z = backStride * 0.2;

        this.backArmBone.rotation.z = frontStride * 0.6;
        this.backForearmBone.rotation.z = 0.5;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = backStride * 0.5 + 0.1;
          this.frontForearmBone.rotation.z = 0.45;
        }
        break;
      }

      // ----------------------------------------------------
      // C. RUN
      // ----------------------------------------------------
      case PlayerState.RUN: {
        const runFreq = 14.0;
        const phase = t * runFreq;

        this.torsoBone.rotation.z = -0.22;
        this.torsoBone.position.y = 0.1;
        this.headBone.rotation.z = 0.12 + this.headFollowLag;
        this.jetpackBone.rotation.z = 0;

        const runBob = Math.abs(Math.sin(phase)) * 0.08;
        this.hipBone.position.y = 1.05 + runBob;

        const frontRun = Math.sin(phase);
        const backRun = Math.sin(phase + Math.PI);

        this.frontThighBone.rotation.z = frontRun * 0.82;
        this.frontShinBone.rotation.z = frontRun < 0 ? -Math.abs(frontRun) * 1.25 : -0.1;
        this.frontFootBone.rotation.z = frontRun * 0.35;

        this.backThighBone.rotation.z = backRun * 0.82;
        this.backShinBone.rotation.z = backRun < 0 ? -Math.abs(backRun) * 1.25 : -0.1;
        this.backFootBone.rotation.z = backRun * 0.35;

        this.backArmBone.rotation.z = frontRun * 0.85;
        this.backForearmBone.rotation.z = 0.85;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = backRun * 0.75 + 0.15;
          this.frontForearmBone.rotation.z = 0.6;
        }

        if (Math.abs(frontRun) > 0.9) {
          this.emitDust(this.position.x, this.position.y, 2);
        }
        break;
      }

      // ----------------------------------------------------
      // D. JUMP & FALL
      // ----------------------------------------------------
      case PlayerState.JUMP: {
        this.torsoBone.rotation.z = -0.06;
        this.headBone.rotation.z = 0.12;
        this.jetpackBone.rotation.z = 0;

        this.frontThighBone.rotation.z = 0.55;
        this.frontShinBone.rotation.z = -0.85;
        this.frontFootBone.rotation.z = 0.25;

        this.backThighBone.rotation.z = 0.45;
        this.backShinBone.rotation.z = -0.75;
        this.backFootBone.rotation.z = 0.25;

        this.backArmBone.rotation.z = -0.4;
        this.backForearmBone.rotation.z = 0.5;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = 0.25;
          this.frontForearmBone.rotation.z = 0.45;
        }
        break;
      }

      case PlayerState.FALL: {
        this.torsoBone.rotation.z = 0.05;
        this.headBone.rotation.z = -0.06;
        this.jetpackBone.rotation.z = 0;

        this.frontThighBone.rotation.z = 0.12;
        this.frontShinBone.rotation.z = -0.2;
        this.frontFootBone.rotation.z = -0.25;

        this.backThighBone.rotation.z = -0.08;
        this.backShinBone.rotation.z = -0.2;
        this.backFootBone.rotation.z = -0.25;

        this.backArmBone.rotation.z = -0.25;
        this.backForearmBone.rotation.z = 0.35;
        break;
      }

      // ----------------------------------------------------
      // E. CORRECT JETPACK FLIGHT POSE (Flames clear of legs!)
      // ----------------------------------------------------
      case PlayerState.JETPACK: {
        // Forward flight lean into direction of travel
        const forwardLean = -0.16 - (this.velocity.x / 11.0) * 0.18;
        this.torsoBone.rotation.z = THREE.MathUtils.lerp(
          this.torsoBone.rotation.z,
          forwardLean,
          dt * 12
        );
        this.torsoBone.position.set(0, 0.1, 0);

        // Pelvis stays centered (does NOT jut forward!)
        this.hipBone.position.set(0, 1.05, 0);

        // Head proudly tilts forward and up looking through visor
        this.headBone.rotation.z = 0.24;

        // Jetpack tilts back slightly so exhaust plume fires cleanly away behind
        this.jetpackBone.rotation.z = 0.14;

        // Legs tuck in a natural athletic rocketman posture:
        // Thighs angle forward (+X), shins bend back under the pelvis.
        // This keeps the legs at X >= -0.05, while the jetpack exhaust is at X <= -0.26!
        const windFlutter = Math.sin(t * 14.0) * 0.05;
        this.frontThighBone.rotation.z = 0.34 + windFlutter;
        this.frontShinBone.rotation.z = -0.68;
        this.frontFootBone.rotation.z = 0.22;

        this.backThighBone.rotation.z = 0.44 - windFlutter;
        this.backShinBone.rotation.z = -0.78;
        this.backFootBone.rotation.z = 0.22;

        this.backArmBone.rotation.z = -0.45;
        this.backForearmBone.rotation.z = 0.4;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = 0.28;
          this.frontForearmBone.rotation.z = 0.42;
        }
        break;
      }
    }

    // ------------------------------------------------------
    // F. ADVANCED 2-JOINT ARM IK & RETICLE AIMING
    // ------------------------------------------------------
    if (hasMouseTarget) {
      let localAngle = this.currentAimAngle;
      if (!this.facingRight) {
        localAngle = Math.PI - localAngle;
      }
      localAngle = THREE.MathUtils.euclideanModulo(localAngle + Math.PI, Math.PI * 2) - Math.PI;

      // Adjust for torso tilt
      const aimRotation = localAngle - this.torsoBone.rotation.z;

      // Natural Ergonomic Elbow Flexion (~25 degrees bend)
      // Shoulder + Elbow = Exact Aim Target Angle!
      const elbowBend = 0.44;
      const targetShoulderAngle = aimRotation - elbowBend;

      this.frontArmBone.rotation.z = THREE.MathUtils.lerp(
        this.frontArmBone.rotation.z,
        targetShoulderAngle,
        dt * 26
      );
      this.frontForearmBone.rotation.z = THREE.MathUtils.lerp(
        this.frontForearmBone.rotation.z,
        elbowBend,
        dt * 26
      );
      this.frontHandBone.rotation.z = 0.0;

      // Back arm supports weapon in tactical two-handed combat stance
      const backArmAim = aimRotation * 0.75 + 0.25;
      this.backArmBone.rotation.z = THREE.MathUtils.lerp(
        this.backArmBone.rotation.z,
        backArmAim,
        dt * 20
      );
      this.backForearmBone.rotation.z = THREE.MathUtils.lerp(
        this.backForearmBone.rotation.z,
        0.82,
        dt * 20
      );
    }

    // Recoil Kickback Shock on firing
    if (this.shootTimer > 0) {
      this.shootTimer -= dt;
      const progress = 1.0 - this.shootTimer / 0.28;

      if (progress < 0.25) {
        const kick = Math.sin((progress / 0.25) * Math.PI);
        this.blasterMesh.position.x = -kick * 0.10;
        this.frontArmBone.rotation.z += 0.07 * kick;
        this.torsoBone.rotation.z -= kick * 0.03;
      } else {
        const returnProg = (progress - 0.25) / 0.75;
        this.blasterMesh.position.x = THREE.MathUtils.lerp(-0.05, 0.0, returnProg);
      }
    } else {
      this.blasterMesh.position.x = 0;
    }
  }

  private updateHelmetLEDs(dt: number) {
    const time = this.animTimer;

    // Animate Side Pod LED Buttons:
    // Pod Buttons: [Left Red, Left Cyan, Left Amber, Right Red, Right Cyan, Right Amber]
    for (let p = 0; p < 2; p++) {
      const offset = p * 3;
      // Red: rapid technical pulse
      const redOn = (Math.sin(time * 16.0 + p) + Math.sin(time * 24.0)) > 0.3;
      this.helmetLedMaterials[offset + 0].color.setHex(redOn ? 0xff1133 : 0x440008);

      // Cyan: smooth communications beacon pulse
      const cyanGlow = Math.sin(time * 8.0 + p * 0.5) > -0.1;
      this.helmetLedMaterials[offset + 1].color.setHex(cyanGlow ? 0x00f5ff : 0x002233);

      // Amber: rhythmic chirp flash
      const amberOn = Math.sin(time * 11.0 + p * 1.5) > 0.2;
      this.helmetLedMaterials[offset + 2].color.setHex(amberOn ? 0xffaa00 : 0x331800);
    }

    // Dual Antenna Beacon pulse
    const beaconPulse = Math.sin(time * 10.0) > 0;
    this.antennaBeaconMat.color.setHex(beaconPulse ? 0x00ffff : 0x004455);
  }

  private updateJetpackVFX(dt: number, isJetpacking: boolean) {
    const time = this.animTimer;
    const nozzleX = this.position.x + (this.facingRight ? -0.28 : 0.28);
    const nozzleY = this.position.y + 0.78;
    const nozzleZ = this.position.z;

    this.thrusterLight.position.set(nozzleX, nozzleY, nozzleZ);

    // 1. Animate 1970s Console Blinking LEDs & Fuel Needle
    const led0State = Math.sin(time * 12.0) > 0;
    const led1State = Math.sin(time * 6.0) > -0.2;
    const led2State = Math.sin(time * 18.0) > 0.3;
    const led3State = isJetpacking || Math.sin(time * 8.0) > 0.4;

    this.jetpackLedMaterials[0].color.setHex(led0State ? 0xff2222 : 0x440505);
    this.jetpackLedMaterials[1].color.setHex(led1State ? 0x22ff44 : 0x053308);
    this.jetpackLedMaterials[2].color.setHex(led2State ? 0xffaa00 : 0x442200);
    this.jetpackLedMaterials[3].color.setHex(led3State ? 0x00f5ff : 0x002233);

    // Analog needle tracks fuel gauge ratio
    const fuelRatio = this.fuel / this.maxFuel;
    this.fuelGaugeNeedle.rotation.x = (fuelRatio - 0.5) * 2.2;

    // 2. Multi-Tier Thruster Flames
    if (isJetpacking) {
      this.flameConeLeft.visible = true;
      this.flameConeRight.visible = true;

      const flick = 1.0 + Math.sin(time * 35.0) * 0.2 + Math.random() * 0.25;
      const coreFlick = 1.0 + Math.random() * 0.3;

      this.flameOuterLeft.scale.set(1.0 + Math.random() * 0.2, flick, 1.0);
      this.flameOuterRight.scale.copy(this.flameOuterLeft.scale);

      this.flameCoreLeft.scale.set(1.0, coreFlick, 1.0);
      this.flameCoreRight.scale.copy(this.flameCoreLeft.scale);

      this.thrusterLight.intensity = 22 + Math.random() * 10;
      this.thrusterLight.distance = 18;

      this.emitSmoke(nozzleX, nozzleY, nozzleZ, 2);
      this.emitSparks(nozzleX, nozzleY, nozzleZ, 3);
    } else {
      this.flameConeLeft.visible = false;
      this.flameConeRight.visible = false;
      this.thrusterLight.intensity = 0;
    }
  }

  private updateBubbleBurstVFX(dt: number) {
    if (this.bubbleBurstTimer > 0) {
      this.bubbleBurstTimer -= dt;
      const prog = 1.0 - this.bubbleBurstTimer / 0.24;

      if (prog < 0.45) {
        // Phase 1: Rapid swelling energy bubble
        const bubbleProg = prog / 0.45;
        const scale = 0.2 + bubbleProg * 1.5;
        this.bubbleSphereMesh.scale.set(scale, scale, scale);
        (this.bubbleSphereMesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - bubbleProg * 0.2;
        (this.bubbleSphereMesh.material as THREE.MeshBasicMaterial).color.setHex(
          bubbleProg > 0.5 ? 0xff00bb : 0x00f5ff
        );

        this.bubbleRingMesh.scale.set(scale * 1.2, scale * 1.2, scale * 1.2);
        (this.bubbleRingMesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
      } else {
        // Phase 2: Bubble POP!
        const popProg = (prog - 0.45) / 0.55;
        (this.bubbleSphereMesh.material as THREE.MeshBasicMaterial).opacity = 0;

        // Shockwave ring violently expands and fades
        const ringScale = 1.8 + popProg * 2.5;
        this.bubbleRingMesh.scale.set(ringScale, ringScale, ringScale);
        (this.bubbleRingMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          1.0 - popProg * 1.8
        );
        this.muzzleLight.intensity = Math.max(0, 22 * (1.0 - popProg));
      }
    } else {
      (this.bubbleSphereMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      (this.bubbleRingMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      this.muzzleLight.intensity = 0;
    }

    // Update bursting droplets
    for (const bp of this.bubbleParticles) {
      if (!bp.active) continue;
      bp.age += dt;
      if (bp.age >= bp.maxLife) {
        bp.active = false;
        bp.mesh.visible = false;
        continue;
      }
      bp.mesh.position.addScaledVector(bp.velocity, dt);
      const s = 1.0 - bp.age / bp.maxLife;
      bp.mesh.scale.set(s, s, s);
    }
  }

  private emitSmoke(x: number, y: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const sp = this.smokePuffs.find(p => !p.active);
      if (!sp) continue;

      sp.active = true;
      sp.age = 0;
      sp.maxLife = 0.55 + Math.random() * 0.45;
      sp.baseScale = 0.38 + Math.random() * 0.25;
      sp.rotSpeed = (Math.random() - 0.5) * 5.0;

      sp.mesh.position.set(
        x + (Math.random() - 0.5) * 0.15,
        y - 0.1,
        z + (Math.random() - 0.5) * 0.15
      );
      sp.velocity.set(
        (Math.random() - 0.5) * 1.2,
        -(3.8 + Math.random() * 4.2),
        (Math.random() - 0.5) * 0.8
      );
      sp.mesh.rotation.z = Math.random() * Math.PI * 2;
      sp.mesh.scale.set(sp.baseScale, sp.baseScale, sp.baseScale);
      sp.mesh.visible = true;
    }
  }

  private emitSparks(x: number, y: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const sk = this.sparks.find(p => !p.active);
      if (!sk) continue;

      sk.active = true;
      sk.age = 0;
      sk.maxLife = 0.25 + Math.random() * 0.35;
      sk.position.set(
        x + (Math.random() - 0.5) * 0.1,
        y - 0.1,
        z + (Math.random() - 0.5) * 0.1
      );
      sk.velocity.set(
        (Math.random() - 0.5) * 4.5,
        -(6.5 + Math.random() * 7.5),
        (Math.random() - 0.5) * 2.5
      );
    }
  }

  private emitDust(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const d = this.dustPuffs.find(p => !p.active);
      if (!d) continue;

      d.active = true;
      d.age = 0;
      d.maxLife = 0.3 + Math.random() * 0.2;
      d.mesh.position.set(x + (Math.random() - 0.5) * 0.4, y, 0.1);
      d.velocity.set(
        (Math.random() - 0.5) * 3.5,
        Math.random() * 2.2 + 0.5,
        0
      );
      d.mesh.scale.set(1, 1, 1);
      d.mesh.visible = true;
    }
  }

  private updateParticles(dt: number) {
    // 1. Smoke
    for (const sp of this.smokePuffs) {
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.maxLife) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }

      sp.mesh.position.addScaledVector(sp.velocity, dt);
      sp.velocity.y *= 0.94;
      sp.velocity.x += 0.2 * dt;
      sp.mesh.rotation.z += sp.rotSpeed * dt;

      const prog = sp.age / sp.maxLife;
      const s = sp.baseScale * (1.0 + prog * 3.2);
      sp.mesh.scale.set(s, s, s);
      (sp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1.0 - prog) * 0.85);
    }

    // 2. Sparks
    let activeSparkCount = 0;
    for (let i = 0; i < this.maxSparks; i++) {
      const sk = this.sparks[i];
      if (!sk.active) {
        this.sparkPositions[i * 3 + 1] = -9999;
        continue;
      }
      sk.age += dt;
      if (sk.age >= sk.maxLife) {
        sk.active = false;
        this.sparkPositions[i * 3 + 1] = -9999;
        continue;
      }

      sk.position.addScaledVector(sk.velocity, dt);
      sk.velocity.y -= 15.0 * dt;

      this.sparkPositions[i * 3 + 0] = sk.position.x;
      this.sparkPositions[i * 3 + 1] = sk.position.y;
      this.sparkPositions[i * 3 + 2] = sk.position.z;

      const prog = sk.age / sk.maxLife;
      const r = 1.0;
      const g = Math.max(0, 0.9 - prog * 0.8);
      const b = Math.max(0, 0.2 - prog * 0.2);
      this.sparkColors[i * 3 + 0] = r;
      this.sparkColors[i * 3 + 1] = g;
      this.sparkColors[i * 3 + 2] = b;

      activeSparkCount++;
    }

    if (this.sparkPoints) {
      this.sparkGeo.attributes.position.needsUpdate = true;
      this.sparkGeo.attributes.color.needsUpdate = true;
      this.sparkPoints.visible = activeSparkCount > 0;
    }

    // 3. Ground Dust
    for (const d of this.dustPuffs) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }

      d.mesh.position.addScaledVector(d.velocity, dt);
      d.velocity.x *= 0.9;
      d.velocity.y -= 9.8 * dt;

      const prog = d.age / d.maxLife;
      const s = 1.0 + prog * 1.8;
      d.mesh.scale.set(s, s, s);
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - prog) * 0.6;
    }
  }

  private updateLasers(dt: number) {
    for (const laser of this.lasers) {
      if (!laser.active) continue;
      laser.life -= dt;
      if (laser.life <= 0) {
        laser.active = false;
        laser.mesh.visible = false;
        continue;
      }

      laser.position.addScaledVector(laser.velocity, dt);
      laser.mesh.position.copy(laser.position);
    }
  }
}
