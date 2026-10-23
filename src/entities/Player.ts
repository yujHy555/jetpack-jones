import * as THREE from 'three';
import { IsometricPlayerRig } from './IsometricPlayerRig';

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

export interface RadioWave {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
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
  JETPACK = 'jetpack',
  CROUCH = 'crouch',
  CROUCH_WALK = 'crouch_walk'
}

/**
 * Triple-AAA Articulated 2D Skeletal Character - Jetpack Jones
 * Features:
 * - Proper pistol-holding stance: arm straightens along aim vector, barrel collinear with line of sight
 * - Hand holds pistol grip from below, chassis and barrel sit firmly on top
 * - Solid pure black space combat boots with strong, definable angular silhouettes
 * - No flashing on hit: reacts with physical ragdoll recoil and joint flailing
 * - Footstep sound triggers synchronized with walk and run gait cycles
 * - Redesigned space helmet with flashing command pod buttons and twin beacon tips
 * - 1970s toy-style chrome jetpack with blinking LEDs, analog dial, and diamond shockwave flames
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

  public get isCrouching(): boolean {
    return this.state === PlayerState.CROUCH || this.state === PlayerState.CROUCH_WALK;
  }

  // Triple-AAA Multi-Layer Bubble Force Field System
  public shieldActive: boolean = false;
  private shieldGroup!: THREE.Group;
  private shieldSphereMesh!: THREE.Mesh;
  private shieldGridMesh!: THREE.LineSegments;
  private shieldRingMesh1!: THREE.Mesh;
  private shieldRingMesh2!: THREE.Mesh;
  private shieldNodes: THREE.Mesh[] = [];
  private shieldMat!: THREE.MeshPhysicalMaterial;
  private shieldGridMat!: THREE.LineBasicMaterial;
  public shieldWobbleTimer: number = 0;
  public shieldWobbleImpulse: THREE.Vector2 = new THREE.Vector2();
  public onShieldDeflect?: () => void;
  // Bubble Force Field Ball Mode & Bouncy Ball Physics
  public forcefieldMode: 'ball' | 'shield' = 'ball';
  public isBallMode: boolean = false;
  public ballAngularVelocity: number = 0;
  public ballRotationZ: number = 0;
  public ballRotationX: number = 0;
  public ballRotationY: number = 0;
  public ballBounceSquash: number = 1.0;
  public ballInternalOffset: THREE.Vector2 = new THREE.Vector2();
  public onBallBounce?: (strength: number) => void;
  public toggleBallMode(): boolean {
    return this.toggleShield();
  }
  public toggleForcefieldMode(): 'ball' | 'shield' {
    this.forcefieldMode = this.forcefieldMode === 'ball' ? 'shield' : 'ball';
    this.isBallMode = this.shieldActive && (this.forcefieldMode === 'ball');
    return this.forcefieldMode;
  }
  public setForcefieldMode(mode: 'ball' | 'shield'): void {
    this.forcefieldMode = mode;
    this.isBallMode = this.shieldActive && (this.forcefieldMode === 'ball');
  }

  // Hyper-Ion Quantum Jetpack Upgrade
  public hasHyperJetpack: boolean = false;
  private hyperJetpackGroup!: THREE.Group;
  private hyperWingtipLeft!: THREE.Mesh;
  private hyperWingtipRight!: THREE.Mesh;
  private hyperCoreDisc!: THREE.Mesh;

  // Stats
  public life: number = 100;
  public maxLife: number = 100;
  public fuel: number = 100;
  public maxFuel: number = 100;
  public invulnerableTime: number = 0;

  // Death Animation State
  public isDying: boolean = false;
  public isDead: boolean = false;
  public deathTimer: number = 0;
  public groundedDeathTimer: number = 0;
  public maxDeathTime: number = 3.5;
  public deathHasLanded: boolean = false;
  public deathLandingSurfaceY: number = GROUND_Y;
  public deathTumbleAngle: number = 0;

  // Ragdoll Physics Hit Reaction
  public ragdollTimer: number = 0;
  public ragdollImpulseX: number = -1;

  // Cartoony Helmet Antenna Radio Wave Signal System
  public onRadioTransmit?: () => void;
  public radioWaves: RadioWave[] = [];
  private radioWaveTimer: number = 4.0;
  private isBroadcastingBurst: boolean = false;
  private burstCount: number = 0;
  private burstIntervalTimer: number = 0;
  private antennaBeaconMesh1!: THREE.Mesh;
  private antennaBeaconMesh2!: THREE.Mesh;

  // Flame Material References for Blue Upgraded vs Red/Orange Default Flames
  private flameAuraMatLeft!: THREE.MeshBasicMaterial;
  private flameAuraMatRight!: THREE.MeshBasicMaterial;
  private flameMidMatLeft!: THREE.MeshBasicMaterial;
  private flameMidMatRight!: THREE.MeshBasicMaterial;

  // Footstep Sound Callback
  public onFootstep?: () => void;
  private prevStridePhase: number = 0;

  // Skeletal Bones Hierarchy
  private rigRoot: THREE.Group;
  private hipBone: THREE.Group;
  private torsoBone: THREE.Group;
  private headBone: THREE.Group;

  // Legs & Solid Black Space Combat Boots
  private frontThighBone: THREE.Group;
  private frontShinBone: THREE.Group;
  private frontFootBone: THREE.Group;

  private backThighBone: THREE.Group;
  private backShinBone: THREE.Group;
  private backFootBone: THREE.Group;

  // Arms (Pistol Holding Stance & Line-of-Sight Aiming)
  private frontArmBone: THREE.Group;
  private frontForearmBone: THREE.Group;
  private frontHandBone: THREE.Group;
  private blasterMesh: THREE.Group;

  // Dropped Blaster Weapon on Death
  private droppedGunMesh!: THREE.Group;
  private droppedGunPos: THREE.Vector3 = new THREE.Vector3();
  private droppedGunVel: THREE.Vector3 = new THREE.Vector3();
  private droppedGunRotZ: number = 0;
  private droppedGunRotVel: number = 0;
  private hasDroppedGun: boolean = false;

  // Suit Materials
  public suitMat!: THREE.MeshStandardMaterial;
  public suitDarkMat!: THREE.MeshStandardMaterial;
  public isIsometric: boolean = false;

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

  // Utility Belt Flashing LEDs
  private beltLedMaterials: THREE.MeshBasicMaterial[] = [];

  // Animation Timers & Physics Smoothing
  private animTimer: number = 0;
  private shootTimer: number = 0;
  private currentAimAngle: number = 0;
  private landSquashTimer: number = 0;
  private wasGroundedLastFrame: boolean = true;
  private headFollowLag: number = 0;

  // Idle Impatient Pose & Foot Tap State
  private idleTimer: number = 0;
  private prevTapPhase: number = 0;

  // Dynamic Contact Shadow
  private shadowMesh!: THREE.Mesh;
  public isoShadowMesh!: THREE.Mesh;
  private isoShadowMat!: THREE.MeshBasicMaterial;

  // Tailor-Made AAA 3D Isometric Character Rig (Level 3)
  public isoPlayerRig!: IsometricPlayerRig;

  // Enhanced Procedural Landing Suspension & Knee Flexion Physics
  private landingSuspension: number = 0;
  private prevVelocityY: number = 0;
  private crushSquashTimer: number = 0;

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

    // Dynamic Lights: Soft vibrant cyan-blue thruster wash
    this.thrusterLight = new THREE.PointLight(0x00bbff, 0, 18, 1.2);
    scene.add(this.thrusterLight);

    this.muzzleLight = new THREE.PointLight(0x00f5ff, 0, 10, 1.8);
    scene.add(this.muzzleLight);

    // Stylized Materials Palette - Sleek Space White Astronaut Suit
    const suitOrange = new THREE.MeshStandardMaterial({
      color: 0xf5f7fb, // Pristine space white suit
      roughness: 0.35,
      metalness: 0.10,
    });
    const suitOrangeDark = new THREE.MeshStandardMaterial({
      color: 0xd6d9e4, // High-tech shaded space white for suit folds & joint liners
      roughness: 0.45,
      metalness: 0.10,
    });
    this.suitMat = suitOrange;
    this.suitDarkMat = suitOrangeDark;
    const darkHarness = new THREE.MeshStandardMaterial({
      color: 0x22262e,
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

    // SOLID PURE BLACK SPACE COMBAT BOOTS MATERIAL (Bold, strong definable silhouette)
    const solidBlackBootMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.55,
      metalness: 0.25,
    });
    const darkSoleTreadMat = new THREE.MeshStandardMaterial({
      color: 0x050507,
      roughness: 0.90,
      metalness: 0.10,
    });

    // CRISP WHITE STRIPES WITH THIN BLACK STROKES ON SUIT DESIGN
    const thinBlackStrokeMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.65,
      metalness: 0.20,
    });
    const stripeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.10,
    });

    const createStripeWithBorder = (
      width: number,
      height: number,
      depth: number,
      borderPx: number = 0.008
    ): THREE.Group => {
      const g = new THREE.Group();
      const blackBack = new THREE.Mesh(
        new THREE.BoxGeometry(width + borderPx * 2, height, depth),
        thinBlackStrokeMat
      );
      g.add(blackBack);
      const whiteFore = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth + 0.002),
        stripeWhiteMat
      );
      g.add(whiteFore);
      return g;
    };

    // --------------------------------------------------------
    // 1. SKELETAL RIG HIERARCHY
    // --------------------------------------------------------
    this.hipBone = new THREE.Group();
    this.hipBone.position.set(0, 1.05, 0);
    this.rigRoot.add(this.hipBone);

    // --------------------------------------------------------
    // UTILITY BELT & CONSOLE WITH FLASHING LED LIGHTS
    // --------------------------------------------------------
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.32), darkHarness);
    this.hipBone.add(belt);

    // Chrome Buckle Frame
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.18), chromeMetal);
    buckle.position.set(0.185, 0, 0);
    this.hipBone.add(buckle);

    // Dark Inner Console Panel on Buckle
    const consolePanel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.14), vintageConsoleMat);
    consolePanel.position.set(0.20, 0, 0);
    this.hipBone.add(consolePanel);

    // 4 Flashing LED Lights on Buckle Console (Cyan, Emerald, Amber, Crimson)
    const beltLedColors = [0x00f5ff, 0x39ff14, 0xffaa00, 0xff1144];
    const ledPositions = [
      [0.032, 0.04],   // Top-Left (Cyan)
      [0.032, -0.04],  // Top-Right (Emerald)
      [-0.032, 0.04],  // Bottom-Left (Amber)
      [-0.032, -0.04], // Bottom-Right (Crimson)
    ];

    for (let i = 0; i < 4; i++) {
      const ledMat = new THREE.MeshBasicMaterial({ color: beltLedColors[i] });
      this.beltLedMaterials.push(ledMat);

      const ledMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 8, 8),
        ledMat
      );
      const [ly, lz] = ledPositions[i];
      ledMesh.position.set(0.212, ly, lz);
      this.hipBone.add(ledMesh);

      // Subtle metallic bezel around each LED
      const bezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.020, 0.020, 0.006, 8),
        chromeMetal
      );
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(0.208, ly, lz);
      this.hipBone.add(bezel);
    }

    // Segmented Side Utility Cargo Pouches with Chrome Clasps
    for (const zSide of [0.18, -0.18]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.07), darkHarness);
      pouch.position.set(0.02, -0.01, zSide);
      this.hipBone.add(pouch);

      // Flap with white stripe detail
      const flap = createStripeWithBorder(0.022, 0.08, 0.008, 0.005);
      flap.rotation.y = zSide > 0 ? Math.PI / 2 : -Math.PI / 2;
      flap.position.set(0.02, 0.02, zSide + (zSide > 0 ? 0.038 : -0.038));
      this.hipBone.add(flap);

      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.02), chromeMetal);
      clasp.position.set(0.02, -0.025, zSide + (zSide > 0 ? 0.04 : -0.04));
      this.hipBone.add(clasp);
    }

    // Rear Cylindrical Plasma Energy Canisters
    for (const zCanister of [0.13, -0.13]) {
      const canister = new THREE.Group();
      canister.position.set(-0.19, -0.02, zCanister);
      this.hipBone.add(canister);

      const canBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10),
        chromeMetal
      );
      canister.add(canBody);

      // Glowing Cyan Plasma Core Window
      const canCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.027, 0.027, 0.05, 10),
        cyanStripe
      );
      canister.add(canCore);
    }

    // Torso Bone
    this.torsoBone = new THREE.Group();
    this.torsoBone.position.set(0, 0.1, 0);
    this.hipBone.add(this.torsoBone);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.3), suitOrange);
    torso.position.set(0, 0.28, 0);
    this.torsoBone.add(torso);

    // Front Chest Dual White Stripes with Thin Black Borders
    const stripeChestL = createStripeWithBorder(0.026, 0.48, 0.010, 0.007);
    stripeChestL.position.set(0.171, 0.28, 0.055);
    this.torsoBone.add(stripeChestL);

    const stripeChestR = createStripeWithBorder(0.026, 0.48, 0.010, 0.007);
    stripeChestR.position.set(0.171, 0.28, -0.055);
    this.torsoBone.add(stripeChestR);

    // Torso Side Seam White Stripes with Thin Black Borders
    const stripeSideL = createStripeWithBorder(0.032, 0.46, 0.010, 0.007);
    stripeSideL.rotation.y = Math.PI / 2;
    stripeSideL.position.set(0, 0.28, 0.151);
    this.torsoBone.add(stripeSideL);

    const stripeSideR = createStripeWithBorder(0.032, 0.46, 0.010, 0.007);
    stripeSideR.rotation.y = -Math.PI / 2;
    stripeSideR.position.set(0, 0.28, -0.151);
    this.torsoBone.add(stripeSideR);

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

    // Face
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), fleshTone);
    face.position.set(0.02, 0.14, 0);
    this.headBone.add(face);

    // SPACE HELMET WITH FLASHING COMMAND POD BUTTONS
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0.02, 0.16, 0);
    this.headBone.add(helmetGroup);

    // Outer Aerodynamic Pearl Helmet Shell
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 24), spaceWhiteMat);
    helmetGroup.add(helmetMesh);

    // Top Crest Fin
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

    // THIN BLACK STRIP / GASKET ROUNDING AROUND THE HELMET WHERE ORANGE VISOR CIRCLE MEETS THE HELMET
    const visorGasketMat = new THREE.MeshBasicMaterial({ color: 0x050507 });
    const visorGasketStrip = new THREE.Mesh(
      new THREE.TorusGeometry(0.294, 0.015, 12, 36),
      visorGasketMat
    );
    visorGasketStrip.rotation.y = Math.PI / 2;
    visorGasketStrip.position.set(0.082, 0, 0);
    helmetGroup.add(visorGasketStrip);

    // Dual Side Command Pods with 3 FLASHING LED BUTTONS on each side
    for (const zSide of [0.33, -0.33]) {
      const pod = new THREE.Group();
      pod.position.set(0, 0, zSide);
      helmetGroup.add(pod);

      const podHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12),
        darkHarness
      );
      podHousing.rotation.x = Math.PI / 2;
      pod.add(podHousing);

      const bezel = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.015, 8, 16),
        chromeMetal
      );
      bezel.position.z = zSide > 0 ? 0.03 : -0.03;
      pod.add(bezel);

      // Buttons: 0=Red, 1=Cyan, 2=Amber
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

      if (zAnt > 0) this.antennaBeaconMesh1 = beacon;
      else this.antennaBeaconMesh2 = beacon;
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
    // 2. LEGS & SOLID BLACK SPACE COMBAT BOOTS
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

    // Outer Thigh Racing Stripe with Thin Black Borders
    const thighStripeBack = createStripeWithBorder(0.028, 0.40, 0.010, 0.007);
    thighStripeBack.rotation.y = -Math.PI / 2;
    thighStripeBack.position.set(0, -0.22, -0.071);
    this.backThighBone.add(thighStripeBack);

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

    // Outer Thigh Racing Stripe with Thin Black Borders
    const thighStripeFront = createStripeWithBorder(0.028, 0.40, 0.010, 0.007);
    thighStripeFront.rotation.y = Math.PI / 2;
    thighStripeFront.position.set(0, -0.22, 0.071);
    this.frontThighBone.add(thighStripeFront);

    this.frontShinBone = new THREE.Group();
    this.frontShinBone.position.set(0, -0.44, 0);
    this.frontThighBone.add(this.frontShinBone);

    const frontShinMesh = new THREE.Mesh(legGeoShin, suitOrange);
    frontShinMesh.position.set(0, -0.21, 0);
    this.frontShinBone.add(frontShinMesh);

    this.frontFootBone = new THREE.Group();
    this.frontFootBone.position.set(0, -0.42, 0);
    this.frontShinBone.add(this.frontFootBone);

    // BUILD SOLID BLACK DEFINABLE SPACE BOOTS
    // Mathematical zero-clip: bottom of tread sole touches exactly y = 0.000 in player local space!
    const createSolidBlackBoot = (parentFoot: THREE.Group) => {
      const bootGroup = new THREE.Group();
      parentFoot.add(bootGroup);

      // Deep Black Ribbed Ankle Cuff
      const ankleCuff = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.17), solidBlackBootMat);
      ankleCuff.position.set(0, 0.01, 0);
      bootGroup.add(ankleCuff);

      // Chunky Solid Black Armored Boot Upper
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.10, 0.15), solidBlackBootMat);
      upper.position.set(0.05, -0.065, 0);
      bootGroup.add(upper);

      // Strong Pronounced Toe Cap Box
      const toeBox = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.155), solidBlackBootMat);
      toeBox.position.set(0.18, -0.07, 0);
      bootGroup.add(toeBox);

      // Angular Heel Counter
      const heelCounter = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.155), solidBlackBootMat);
      heelCounter.position.set(-0.08, -0.07, 0);
      bootGroup.add(heelCounter);

      // Dual Mechanical Black Clasps
      for (const sx of [0.03, 0.10]) {
        const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.165), solidBlackBootMat);
        clasp.position.set(sx, -0.025, 0);
        bootGroup.add(clasp);
      }

      // Heavy Corrugated Solid Black Tread Sole Plate
      // Height = 0.035, Center at -0.1225 -> Bottom is at -0.140, matching y = 0.000 in player space!
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.17), darkSoleTreadMat);
      sole.position.set(0.06, -0.1225, 0);
      bootGroup.add(sole);

      // Thick Rugged Sole Cleats
      for (const cx of [-0.07, 0.0, 0.07, 0.14]) {
        const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.165), darkSoleTreadMat);
        cleat.position.set(cx, -0.135, 0);
        bootGroup.add(cleat);
      }
    };

    createSolidBlackBoot(this.backFootBone);
    createSolidBlackBoot(this.frontFootBone);

    // --------------------------------------------------------
    // 3. ARMS & PISTOL HOLDING STANCE (Straightened Line-of-Sight Aiming)
    // --------------------------------------------------------
    // Front Arm: Root at shoulder (0.04, 0.48, 0.20) on torsoBone
    this.frontArmBone = new THREE.Group();
    this.frontArmBone.position.set(0.04, 0.48, 0.20);
    this.torsoBone.add(this.frontArmBone);

    // Upper Arm extends forward along +X
    const frontUpperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.11, 0.11), suitOrange);
    frontUpperMesh.position.set(0.15, 0, 0);
    this.frontArmBone.add(frontUpperMesh);

    // Outer Arm Racing Stripe with Thin Black Borders
    const armStripeFront = createStripeWithBorder(0.024, 0.26, 0.010, 0.006);
    armStripeFront.rotation.y = Math.PI / 2;
    armStripeFront.rotation.z = Math.PI / 2;
    armStripeFront.position.set(0.15, 0, 0.056);
    this.frontArmBone.add(armStripeFront);

    // Elbow joint at (0.30, 0, 0) in frontArmBone
    this.frontForearmBone = new THREE.Group();
    this.frontForearmBone.position.set(0.30, 0, 0);
    this.frontArmBone.add(this.frontForearmBone);

    // Forearm extends forward along +X
    const frontForeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.10), suitOrange);
    frontForeMesh.position.set(0.13, 0, 0);
    this.frontForearmBone.add(frontForeMesh);

    // Glove Gauntlet Cuff
    const frontGloveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 12), darkHarness);
    frontGloveCuff.rotation.z = Math.PI / 2;
    frontGloveCuff.position.set(0.22, 0, 0);
    this.frontForearmBone.add(frontGloveCuff);

    // Hand Bone at (0.26, 0, 0)
    this.frontHandBone = new THREE.Group();
    this.frontHandBone.position.set(0.26, 0, 0);
    this.frontForearmBone.add(this.frontHandBone);

    // BLASTER MESH (Held firmly by the handle, barrel pointing along +X line of sight)
    this.blasterMesh = new THREE.Group();
    this.blasterMesh.position.set(0, 0, 0);
    this.frontHandBone.add(this.blasterMesh);

    // 1. Pistol Grip Handle hangs down from hand
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.07), darkHarness);
    grip.rotation.z = -0.16;
    grip.position.set(0, -0.06, 0);
    this.blasterMesh.add(grip);

    // 2. Astronaut Space Glove Fingers wrapped around the handle
    const glovePalm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), spaceWhiteMat);
    glovePalm.position.set(-0.01, -0.05, 0);
    this.blasterMesh.add(glovePalm);

    const curledFingers = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.085), spaceWhiteMat);
    curledFingers.position.set(0.04, -0.06, 0);
    this.blasterMesh.add(curledFingers);

    // 3. Receiver Chassis sits firmly ON TOP of the handle
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.10, 0.085), chromeMetal);
    receiver.position.set(0.10, 0.04, 0);
    this.blasterMesh.add(receiver);

    // Trigger Guard
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), darkHarness);
    guard.position.set(0.04, -0.015, 0);
    guard.rotation.z = -Math.PI / 2;
    this.blasterMesh.add(guard);

    // Glowing Cyan Energy Plasma Core
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.09), cyanStripe);
    coreMesh.position.set(0.08, 0.04, 0);
    this.blasterMesh.add(coreMesh);

    // Precision Forward Barrel strictly collinear with arm line of sight!
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.28, 12), chromeMetal);
    barrel.rotateZ(Math.PI / 2);
    barrel.position.set(0.34, 0.04, 0);
    this.blasterMesh.add(barrel);

    // Cooling Coils
    for (let cx = 0.24; cx <= 0.40; cx += 0.055) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 8, 12), cyanStripe);
      coil.rotateY(Math.PI / 2);
      coil.position.set(cx, 0.04, 0);
      this.blasterMesh.add(coil);
    }

    // Muzzle Prongs
    const prongTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.025), chromeMetal);
    prongTop.position.set(0.48, 0.06, 0);
    this.blasterMesh.add(prongTop);

    const prongBot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.025), chromeMetal);
    prongBot.position.set(0.48, 0.02, 0);
    this.blasterMesh.add(prongBot);

    // PLASMA BUBBLE BURST MUZZLE FLASH
    this.bubbleBurstGroup = new THREE.Group();
    this.bubbleBurstGroup.position.set(0.54, 0.04, 0);
    this.blasterMesh.add(this.bubbleBurstGroup);

    const bubbleGeo = new THREE.SphereGeometry(0.26, 16, 16);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.bubbleSphereMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.bubbleBurstGroup.add(this.bubbleSphereMesh);

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

    // Physical World Dropped Blaster for Death Sequence
    this.droppedGunMesh = this.blasterMesh.clone(true);
    this.droppedGunMesh.visible = false;
    scene.add(this.droppedGunMesh);

    // BACK ARM (Supports in Two-Handed Tactical Pistol Stance)
    this.backArmBone = new THREE.Group();
    this.backArmBone.position.set(-0.04, 0.48, -0.20);
    this.torsoBone.add(this.backArmBone);

    const backUpperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.11, 0.11), suitOrangeDark);
    backUpperMesh.position.set(0.15, 0, 0);
    this.backArmBone.add(backUpperMesh);

    // Outer Arm Racing Stripe with Thin Black Borders
    const armStripeBack = createStripeWithBorder(0.024, 0.26, 0.010, 0.006);
    armStripeBack.rotation.y = -Math.PI / 2;
    armStripeBack.rotation.z = Math.PI / 2;
    armStripeBack.position.set(0.15, 0, -0.056);
    this.backArmBone.add(armStripeBack);

    this.backForearmBone = new THREE.Group();
    this.backForearmBone.position.set(0.30, 0, 0);
    this.backArmBone.add(this.backForearmBone);

    const backForeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.10), suitOrangeDark);
    backForeMesh.position.set(0.13, 0, 0);
    this.backForearmBone.add(backForeMesh);

    this.backHandBone = new THREE.Group();
    this.backHandBone.position.set(0.26, 0, 0);
    this.backForearmBone.add(this.backHandBone);

    const backGloveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), spaceWhiteMat);
    this.backHandBone.add(backGloveMesh);

    // --------------------------------------------------------
    // 4. 1970s TOY JETPACK WITH DIAMOND SHOCKWAVE FLAMES
    // --------------------------------------------------------
    this.jetpackBone = new THREE.Group();
    this.jetpackBone.position.set(-0.25, 0.34, 0);
    this.torsoBone.add(this.jetpackBone);

    const tankGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.58, 16);
    const leftTank = new THREE.Mesh(tankGeo, chromeMetal);
    leftTank.position.z = -0.13;
    this.jetpackBone.add(leftTank);

    const rightTank = new THREE.Mesh(tankGeo, chromeMetal);
    rightTank.position.z = 0.13;
    this.jetpackBone.add(rightTank);

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

    // 1970s Command Console Box
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.2), vintageConsoleMat);
    consoleBox.position.set(-0.02, 0.02, 0);
    this.jetpackBone.add(consoleBox);

    // 4 Chunky Flashing LED Buttons
    const ledColors = [0xff2222, 0x22ff44, 0xffaa00, 0x00f5ff];
    for (let b = 0; b < 4; b++) {
      const ledMat = new THREE.MeshBasicMaterial({ color: ledColors[b] });
      this.jetpackLedMaterials.push(ledMat);

      const button = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.035), ledMat);
      button.position.set(-0.095, 0.09 - b * 0.06, 0.05);
      this.jetpackBone.add(button);
    }

    // Analog Gauge Needle
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

    // Flared Conical Exhaust Bells
    const nozzleGeo = new THREE.ConeGeometry(0.11, 0.2, 16, 1, true);
    nozzleGeo.rotateX(Math.PI);

    const nozL = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozL.position.set(0, -0.37, -0.13);
    this.jetpackBone.add(nozL);

    const nozR = new THREE.Mesh(nozzleGeo, chromeMetal);
    nozR.position.set(0, -0.37, 0.13);
    this.jetpackBone.add(nozR);

    // EPIC ROUNDED RED AND ORANGE JETPACK FLAME PLUMES
    this.flameConeLeft = new THREE.Group();
    this.flameConeLeft.position.set(0, -0.42, -0.13);
    this.jetpackBone.add(this.flameConeLeft);

    this.flameConeRight = new THREE.Group();
    this.flameConeRight.position.set(0, -0.42, 0.13);
    this.jetpackBone.add(this.flameConeRight);

    // ROUNDED RED AND ORANGE FLAME WITH SMOOTH CLOSED BULBOUS CONTOURS (ZERO FLAT INTERSECTING PLANES)
    // 1. Soft-Edge Outer Glowing Scarlet-Red Plume
    const auraGeo = new THREE.SphereGeometry(0.24, 24, 24);
    auraGeo.scale(1.0, 2.5, 1.0);
    auraGeo.translate(0, -0.55, 0);
    this.flameAuraMatLeft = new THREE.MeshBasicMaterial({
      color: 0xff1a00,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flameAuraMatRight = this.flameAuraMatLeft.clone();
    this.flameConeLeft.add(new THREE.Mesh(auraGeo, this.flameAuraMatLeft));
    this.flameConeRight.add(new THREE.Mesh(auraGeo, this.flameAuraMatRight));

    // 2. Volumetric Middle Molten Orange Flame Sheath
    const outerGeo = new THREE.SphereGeometry(0.18, 24, 24);
    outerGeo.scale(1.0, 2.2, 1.0);
    outerGeo.translate(0, -0.45, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.80,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flameOuterLeft = new THREE.Mesh(outerGeo, outerMat);
    this.flameOuterRight = new THREE.Mesh(outerGeo, outerMat.clone());
    this.flameConeLeft.add(this.flameOuterLeft);
    this.flameConeRight.add(this.flameOuterRight);

    // 3. Radiant Golden-Amber Combustion Core
    const midGeo = new THREE.SphereGeometry(0.12, 20, 20);
    midGeo.scale(1.0, 1.8, 1.0);
    midGeo.translate(0, -0.32, 0);
    this.flameMidMatLeft = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flameMidMatRight = this.flameMidMatLeft.clone();
    this.flameConeLeft.add(new THREE.Mesh(midGeo, this.flameMidMatLeft));
    this.flameConeRight.add(new THREE.Mesh(midGeo, this.flameMidMatRight));

    // 4. Inner Incandescent White-Hot Ignition Seed
    const coreGeo = new THREE.SphereGeometry(0.065, 16, 16);
    coreGeo.scale(1.0, 1.4, 1.0);
    coreGeo.translate(0, -0.18, 0);
    const coreFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flameCoreLeft = new THREE.Mesh(coreGeo, coreFlameMat);
    this.flameCoreRight = new THREE.Mesh(coreGeo, coreFlameMat.clone());
    this.flameConeLeft.add(this.flameCoreLeft);
    this.flameConeRight.add(this.flameCoreRight);

    // --------------------------------------------------------
    // METALLIC RETRO STYLE JETPACK UPGRADE RIG (Vintage Sci-Fi Polished Chrome & Brass)
    // --------------------------------------------------------
    this.hyperJetpackGroup = new THREE.Group();
    this.hyperJetpackGroup.visible = false;
    this.jetpackBone.add(this.hyperJetpackGroup);

    // Vintage Retro Sci-Fi Materials Palette (Mirror Chrome & Brushed Brass)
    const retroChromeMat = new THREE.MeshStandardMaterial({
      color: 0xf5f8fb,
      metalness: 0.96,
      roughness: 0.08,
    });
    const retroBrassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a035,
      metalness: 0.90,
      roughness: 0.18,
    });
    const retroCopperMat = new THREE.MeshStandardMaterial({
      color: 0xba6032,
      metalness: 0.88,
      roughness: 0.22,
    });
    const vacuumTubeGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ddff,
      transmission: 0.88,
      transparent: true,
      opacity: 0.82,
      roughness: 0.06,
      metalness: 0.05,
    });
    const neonBlueFilamentMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
    });

    // Dual Heavy Mirror-Chrome Cylindrical Rocket Canisters
    const retroTankGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.64, 20);
    const tankL = new THREE.Mesh(retroTankGeo, retroChromeMat);
    tankL.position.set(-0.02, 0, -0.14);
    this.hyperJetpackGroup.add(tankL);

    const tankR = new THREE.Mesh(retroTankGeo, retroChromeMat);
    tankR.position.set(-0.02, 0, 0.14);
    this.hyperJetpackGroup.add(tankR);

    // Polished Brass Hemispherical Top Domes with Vintage Antenna Finials
    const domeGeo = new THREE.SphereGeometry(0.12, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeL = new THREE.Mesh(domeGeo, retroBrassMat);
    domeL.position.set(-0.02, 0.32, -0.14);
    this.hyperJetpackGroup.add(domeL);

    const domeR = new THREE.Mesh(domeGeo, retroBrassMat);
    domeR.position.set(-0.02, 0.32, 0.14);
    this.hyperJetpackGroup.add(domeR);

    // Brass Acorn Finials on Top of Domes
    const finialGeo = new THREE.CylinderGeometry(0.015, 0.035, 0.09, 10);
    const finialL = new THREE.Mesh(finialGeo, retroBrassMat);
    finialL.position.set(-0.02, 0.46, -0.14);
    this.hyperJetpackGroup.add(finialL);

    const finialR = new THREE.Mesh(finialGeo, retroBrassMat);
    finialR.position.set(-0.02, 0.46, 0.14);
    this.hyperJetpackGroup.add(finialR);

    // Heavy Brass Riveted Reinforcement Bands around both tanks
    for (const by of [-0.18, 0.16]) {
      const bandL = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.018, 8, 24), retroBrassMat);
      bandL.rotation.x = Math.PI / 2;
      bandL.position.set(-0.02, by, -0.14);
      this.hyperJetpackGroup.add(bandL);

      const bandR = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.018, 8, 24), retroBrassMat);
      bandR.rotation.x = Math.PI / 2;
      bandR.position.set(-0.02, by, 0.14);
      this.hyperJetpackGroup.add(bandR);

      // 3D Rivet Studs around the bands
      for (let r = 0; r < 6; r++) {
        const ang = (r / 6) * Math.PI * 2;
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), retroCopperMat);
        rivet.position.set(-0.02 + Math.cos(ang) * 0.13, by, -0.14 + Math.sin(ang) * 0.13);
        this.hyperJetpackGroup.add(rivet);

        const rivet2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), retroCopperMat);
        rivet2.position.set(-0.02 + Math.cos(ang) * 0.13, by, 0.14 + Math.sin(ang) * 0.13);
        this.hyperJetpackGroup.add(rivet2);
      }
    }

    // Central Glowing Retro Glass Vacuum Tube Plasma Chamber
    const tubeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.40, 16);
    const vacuumTube = new THREE.Mesh(tubeGeo, vacuumTubeGlassMat);
    vacuumTube.position.set(-0.06, 0.02, 0);
    this.hyperJetpackGroup.add(vacuumTube);

    // Glowing Helical Neon Blue Plasma Coils inside the vacuum tube
    for (let c = 0; c < 4; c++) {
      const coilGeo = new THREE.TorusGeometry(0.048, 0.009, 8, 20);
      const coil = new THREE.Mesh(coilGeo, neonBlueFilamentMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(-0.06, -0.12 + c * 0.08, 0);
      this.hyperJetpackGroup.add(coil);
    }

    // Copper Crossover Manifold Conduits Connecting Canisters
    for (const my of [-0.10, 0.12]) {
      const manifold = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.28, 10),
        retroCopperMat
      );
      manifold.rotation.x = Math.PI / 2;
      manifold.position.set(-0.04, my, 0);
      this.hyperJetpackGroup.add(manifold);
    }

    // Retro Brass Analog Pressure Dial on Center Housing
    const dialHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.03, 16),
      retroBrassMat
    );
    dialHousing.rotateZ(Math.PI / 2);
    dialHousing.position.set(-0.13, 0.02, 0);
    this.hyperJetpackGroup.add(dialHousing);

    const dialGlass = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    dialGlass.rotateY(-Math.PI / 2);
    dialGlass.position.set(-0.146, 0.02, 0);
    this.hyperJetpackGroup.add(dialGlass);

    const dialNeedle = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.042, 0.006),
      new THREE.MeshBasicMaterial({ color: 0xee1122 })
    );
    dialNeedle.position.set(-0.148, 0.02, 0);
    this.hyperJetpackGroup.add(dialNeedle);

    // Flared Retro Chrome Rocket Bell Nozzles
    const bellGeo = new THREE.ConeGeometry(0.13, 0.22, 18, 1, false);
    bellGeo.rotateX(Math.PI);
    const bellL = new THREE.Mesh(bellGeo, retroChromeMat);
    bellL.position.set(-0.02, -0.38, -0.14);
    this.hyperJetpackGroup.add(bellL);

    const bellR = new THREE.Mesh(bellGeo, retroChromeMat);
    bellR.position.set(-0.02, -0.38, 0.14);
    this.hyperJetpackGroup.add(bellR);

    this.flameConeLeft.visible = false;
    this.flameConeRight.visible = false;

    // --------------------------------------------------------
    // 5. VFX SYSTEMS
    // --------------------------------------------------------
    this.initSmokeSystem();
    this.initSparkSystem();
    this.initDustSystem();

    // --------------------------------------------------------
    // 6. LASER BOLTS
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

    // Dynamic Contact Shadow Decal
    const shadowGeo = new THREE.CircleGeometry(0.48, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0a0d14,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(this.shadowMesh);

    // Dedicated AAA 3D Contact Shadow Decal for Level 3
    const isoShadowGeo = new THREE.CircleGeometry(0.70, 24);
    isoShadowGeo.rotateX(-Math.PI / 2);
    this.isoShadowMat = new THREE.MeshBasicMaterial({
      color: 0x110502,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.isoShadowMesh = new THREE.Mesh(isoShadowGeo, this.isoShadowMat);
    this.isoShadowMesh.visible = false;
    scene.add(this.isoShadowMesh);

    // Tailor-Made AAA 3D Character Rig for Level 3 (Space white suit, non-crossing legs, 360° aiming)
    this.isoPlayerRig = new IsometricPlayerRig();
    this.isoPlayerRig.onFootstep = () => this.onFootstep?.();
    this.mesh.add(this.isoPlayerRig.group);
    this.isoPlayerRig.group.visible = false;

    // Cast shadows on player meshes
    this.mesh.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
      }
    });

    this.initRadioWaveSystem(scene);
    this.initShieldForceField(scene);
    this.reset();
  }

  private initRadioWaveSystem(scene: THREE.Scene) {
    // Handdrawn squiggly cartoon broadcast waves (doodle line with organic wiggles)
    function createSquigglyArcGeo(seed: number): THREE.TubeGeometry {
      const pts: THREE.Vector3[] = [];
      const numPts = 32;
      const baseR = 0.42;
      for (let i = 0; i <= numPts; i++) {
        const t = i / numPts;
        const angle = -Math.PI * 0.48 + t * (Math.PI * 0.96);
        // Handdrawn squiggly doodle wiggles
        const squiggle = Math.sin(t * Math.PI * 7.5 + seed) * 0.048
                       + Math.cos(t * Math.PI * 13.0 + seed * 1.6) * 0.025
                       + Math.sin(t * Math.PI * 21.0) * 0.012;
        const r = baseR + squiggle;
        const x = r * Math.sin(angle);
        const y = r * Math.cos(angle);
        pts.push(new THREE.Vector3(x, y, 0));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.TubeGeometry(curve, 42, 0.022, 6, false);
    }

    const geos = [
      createSquigglyArcGeo(0.2),
      createSquigglyArcGeo(2.4),
      createSquigglyArcGeo(4.8),
    ];

    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geos[i % geos.length], mat);
      mesh.visible = false;
      scene.add(mesh);

      this.radioWaves.push({
        mesh,
        position: new THREE.Vector3(),
        age: 0,
        maxLife: 0.88,
        active: false,
      });
    }
  }

  private updateRadioWaves(dt: number, underPressure: boolean = false) {
    this.radioWaveTimer -= dt;

    // Normal base interval ~26 to 32 seconds; under fire/pressure: 3.5 to 5.5 seconds!
    const targetCooldown = underPressure ? (3.2 + Math.random() * 2.2) : (26.0 + Math.random() * 8.0);

    if (this.radioWaveTimer <= 0 && !this.isBroadcastingBurst && !this.isDying) {
      this.isBroadcastingBurst = true;
      this.burstCount = 0;
      this.burstIntervalTimer = 0;
      this.radioWaveTimer = targetCooldown;
    }

    if (this.isBroadcastingBurst) {
      this.burstIntervalTimer -= dt;
      if (this.burstIntervalTimer <= 0) {
        this.burstIntervalTimer = 0.15; // 150ms staggered packet
        this.burstCount++;

        const beaconPos = new THREE.Vector3();
        if (this.antennaBeaconMesh1) {
          this.antennaBeaconMesh1.getWorldPosition(beaconPos);
        } else {
          beaconPos.set(this.position.x, this.position.y + 1.95, 0);
        }

        this.emitRadioWave(beaconPos);

        // Flash antenna beacons bright cyan-white
        if (this.antennaBeaconMat) {
          this.antennaBeaconMat.color.setHex(0xffffff);
        }

        if (this.onRadioTransmit) {
          this.onRadioTransmit();
        }

        if (this.burstCount >= 3) {
          this.isBroadcastingBurst = false;
        }
      }
    }

    // Animate active expanding cartoon wave arcs
    for (const rw of this.radioWaves) {
      if (!rw.active) continue;

      rw.age += dt;
      if (rw.age >= rw.maxLife) {
        rw.active = false;
        rw.mesh.visible = false;
        continue;
      }

      const prog = rw.age / rw.maxLife; // 0 to 1
      const scale = 0.35 + prog * 2.2; // Expanding outward
      rw.mesh.scale.set(scale, scale, scale);

      // Floats gracefully upward and slightly forward
      rw.position.y += 1.6 * dt;
      rw.position.x += (this.facingRight ? 0.35 : -0.35) * dt;
      rw.mesh.position.copy(rw.position);

      const alpha = (1.0 - prog) * 0.90;
      (rw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, alpha);
    }
  }

  private emitRadioWave(originPos: THREE.Vector3) {
    const rw = this.radioWaves.find(w => !w.active);
    if (!rw) return;

    rw.active = true;
    rw.age = 0;
    rw.maxLife = 0.90;
    rw.position.copy(originPos);
    rw.position.z = 0.1;
    rw.mesh.position.copy(rw.position);
    rw.mesh.scale.set(0.35, 0.35, 0.35);
    (rw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
    rw.mesh.visible = true;
  }

  private initShieldForceField(scene: THREE.Scene) {
    this.shieldGroup = new THREE.Group();

    // 1. Triple-AAA Ultra-Clear Iridescent Plasma Bubble (Radius 1.65m completely envelopes Jones including helmet)
    const sphereGeo = new THREE.SphereGeometry(1.65, 36, 28);
    this.shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f5ff,
      emissive: 0x001525,
      roughness: 0.01,
      metalness: 0.02,
      transmission: 0.98,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.shieldSphereMesh = new THREE.Mesh(sphereGeo, this.shieldMat);
    this.shieldGroup.add(this.shieldSphereMesh);

    // 2. Geodesic Energy Lattice Grid (Hexagonal Sci-Fi Shield Mesh)
    const icosaGeo = new THREE.IcosahedronGeometry(1.68, 2);
    const wireGeo = new THREE.WireframeGeometry(icosaGeo);
    this.shieldGridMat = new THREE.LineBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    this.shieldGridMesh = new THREE.LineSegments(wireGeo, this.shieldGridMat);
    this.shieldGroup.add(this.shieldGridMesh);

    // 3. Dual Counter-Rotating Orbital Energy Rings
    // Ring 1: Glowing Cyan Equatorial Gyro Ring
    const ringGeo1 = new THREE.TorusGeometry(1.70, 0.022, 10, 48);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.shieldRingMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    this.shieldGroup.add(this.shieldRingMesh1);

    // Ring 2: Tilted Emerald Green / Azure Meridian Orbital Ring
    const ringGeo2 = new THREE.TorusGeometry(1.71, 0.018, 10, 48);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.60,
      blending: THREE.AdditiveBlending,
    });
    this.shieldRingMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.shieldRingMesh2.rotation.x = Math.PI / 3;
    this.shieldRingMesh2.rotation.y = Math.PI / 6;
    this.shieldGroup.add(this.shieldRingMesh2);

    // 4. Orbiting Deflector Energy Micro-Nodes
    const nodeGeo = new THREE.OctahedronGeometry(0.065, 0);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 4; i++) {
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      this.shieldNodes.push(node);
      this.shieldGroup.add(node);
    }

    this.shieldGroup.visible = false;
    scene.add(this.shieldGroup);
  }

  public upgradeJetpack() {
    this.hasHyperJetpack = true;
    if (this.hyperJetpackGroup) {
      this.hyperJetpackGroup.visible = true;
    }
    this.fuel = this.maxFuel;
    this.emitSparks(this.position.x, this.position.y + 1.0, 0, 24);
  }

  public toggleShield(): boolean {
    this.shieldActive = !this.shieldActive;
    this.isBallMode = this.shieldActive && (this.forcefieldMode === 'ball');
    if (this.shieldGroup) {
      this.shieldGroup.visible = this.shieldActive;
    }
    if (this.shieldActive) {
      this.shieldWobbleTimer = 0.32;
      this.shieldWobbleImpulse.set(0, 1);
    }
    return this.shieldActive;
  }

  public reset(startX: number = 0, startY: number = GROUND_Y, startZ: number = 0) {
    this.position.set(startX, startY, startZ);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.facingRight = true;
    this.state = PlayerState.IDLE;
    this.life = 100;
    this.fuel = 100;
    this.invulnerableTime = 0;
    this.ragdollTimer = 0;
    this.isDying = false;
    this.isDead = false;
    this.deathTimer = 0;
    this.groundedDeathTimer = 0;
    this.deathHasLanded = false;
    this.deathLandingSurfaceY = GROUND_Y;
    this.deathTumbleAngle = 0;
    this.animTimer = 0;
    this.shootTimer = 0;
    this.bubbleBurstTimer = 0;
    this.headFollowLag = 0;
    this.hasDroppedGun = false;
    this.hasHyperJetpack = false;
    if (this.hyperJetpackGroup) this.hyperJetpackGroup.visible = false;
    this.shieldActive = false;
    if (this.shieldGroup) this.shieldGroup.visible = false;
    if (this.droppedGunMesh) this.droppedGunMesh.visible = false;
    if (this.shadowMesh) this.shadowMesh.visible = !this.isIsometric;
    if (this.isoShadowMesh) this.isoShadowMesh.visible = this.isIsometric;
    if (this.isoPlayerRig) {
      this.isoPlayerRig.group.visible = this.isIsometric;
      this.rigRoot.visible = !this.isIsometric;
    }
    this.blasterMesh.visible = true;
    this.rigRoot.rotation.set(0, 0, 0);
    this.rigRoot.position.set(0, 0, 0);
    this.torsoBone.rotation.set(0, 0, 0);
    this.headBone.rotation.set(0, 0, 0);
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
    for (const rw of this.radioWaves) {
      rw.active = false;
      rw.mesh.visible = false;
    }
    this.isBroadcastingBurst = false;
    this.radioWaveTimer = 4.0;
  }

  private initSmokeSystem() {
    const smokeGeo = new THREE.SphereGeometry(0.18, 8, 8);

    for (let i = 0; i < this.maxSmoke; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8833,
        transparent: true,
        opacity: 0.70,
        blending: THREE.AdditiveBlending,
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
   * Fires a blaster laser bolt straight along the arm's line of sight
   */
  public shoot(aimTargetWorld?: THREE.Vector3): boolean {
    if (this.isDying) return false;
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

    this.shootTimer = 0.28;
    this.bubbleBurstTimer = 0.24;

    // Calculate aim angle from shoulder / chest height within 180° forward arc
    let aimAngle = this.facingRight ? 0 : Math.PI;
    const originY = this.position.y + 1.55; // Shoulder height!
    const originX = this.position.x + (this.facingRight ? 0.04 : -0.04);

    if (aimTargetWorld) {
      const rawAngle = Math.atan2(aimTargetWorld.y - originY, aimTargetWorld.x - originX);
      let relAngle = rawAngle;
      if (!this.facingRight) {
        relAngle = Math.PI - relAngle;
      }
      relAngle = THREE.MathUtils.euclideanModulo(relAngle + Math.PI, Math.PI * 2) - Math.PI;

      // Aim limits: rotated slightly less up (~45° to stay comfortably clear of helmet), generous downward (~-72°)
      const maxUpwardAngle = Math.PI * 0.25;
      const maxDownwardAngle = -Math.PI * 0.40;
      const clampedRel = THREE.MathUtils.clamp(relAngle, maxDownwardAngle, maxUpwardAngle);

      aimAngle = this.facingRight ? clampedRel : (Math.PI - clampedRel);
    }
    this.currentAimAngle = aimAngle;

    // Calculate exact muzzle position from the physical blaster barrel tip
    this.mesh.updateWorldMatrix(true, true);
    const muzzlePos = new THREE.Vector3();
    this.bubbleBurstGroup.getWorldPosition(muzzlePos);

    // Dedicated 3D Isometric Blaster Fire (Line of sight along 3D ray)
    if (this.isIsometric && this.isoPlayerRig) {
      const muzzlePos = this.isoPlayerRig.getMuzzleWorldPosition();
      laser.position.copy(muzzlePos);
      let dir: THREE.Vector3;
      if (aimTargetWorld) {
        dir = new THREE.Vector3().subVectors(aimTargetWorld, muzzlePos).normalize();
      } else {
        const yaw = this.isoPlayerRig.rigRoot.rotation.y;
        dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      }
      laser.velocity.copy(dir).multiplyScalar(42);
      laser.active = true;
      laser.life = 1.4;
      laser.mesh.position.copy(laser.position);
      laser.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      laser.mesh.visible = true;
      return true;
    }
    laser.velocity.set(Math.cos(aimAngle) * 34, Math.sin(aimAngle) * 34, 0);
    laser.active = true;
    laser.life = 1.3;
    laser.mesh.position.copy(laser.position);
    laser.mesh.rotation.set(0, 0, aimAngle);
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

    this.muzzleLight.position.copy(muzzlePos);
    this.muzzleLight.position.z += 0.2;
    this.muzzleLight.intensity = 22;

    return true;
  }

  /**
   * Dramatic Death Animation with Jetpack Meltdown & Ground Collapse
   */
  public triggerDeath(knockbackDirX: number = -1) {
    if (this.isDying) return;
    this.isDying = true;
    this.isDead = false;
    this.deathTimer = 0;
    this.groundedDeathTimer = 0;
    this.deathHasLanded = false;
    this.deathLandingSurfaceY = GROUND_Y;
    this.deathTumbleAngle = this.rigRoot.rotation.z;
    this.invulnerableTime = 999;
    this.shieldActive = false;
    if (this.shieldGroup) this.shieldGroup.visible = false;
    // Dramatic death impulse: Jones reels backward
    const dir = knockbackDirX !== 0 ? knockbackDirX : (this.facingRight ? -1 : 1);
    if (!this.isGrounded) {
      // In air death: retain downward falling momentum under gravity for center-of-mass tumble
      this.velocity.x = dir * 3.8;
      this.velocity.y = Math.min(this.velocity.y, 2.0);
    } else {
      // Ground death: reel back and pop slightly off floor
      this.velocity.x = dir * 5.2;
      this.velocity.y = 5.0;
    }
    this.isGrounded = false;

    // Jetpack blowout sparks & smoke burst
    this.emitSparks(this.position.x, this.position.y + 0.8, dir * 3.0, 18);
    this.emitSmoke(this.position.x - 0.25, this.position.y + 0.9, 0, 4);
    this.emitSmoke(this.position.x + 0.25, this.position.y + 0.9, 0, 4);

    // Drop blaster gun: pops out of hand and tumbles dynamically onto floor
    this.hasDroppedGun = true;
    this.blasterMesh.visible = false;
    const handWorldPos = new THREE.Vector3();
    this.frontHandBone.getWorldPosition(handWorldPos);
    this.droppedGunPos.copy(handWorldPos);
    this.droppedGunVel.set((this.facingRight ? 2.8 : -2.8) + (Math.random() - 0.5), 4.2 + Math.random(), 0);
    this.droppedGunRotZ = this.facingRight ? 0.4 : -0.4;
    this.droppedGunRotVel = this.facingRight ? -12.0 : 12.0;
    this.droppedGunMesh.position.copy(this.droppedGunPos);
    this.droppedGunMesh.rotation.z = this.droppedGunRotZ;
    this.droppedGunMesh.visible = true;
    this.emitSparks(handWorldPos.x, handWorldPos.y, 0, 6);
  }

  /**
   * Ragdoll hit reaction with physical knockback (NO FLASHING!)
   */
  public takeDamage(amount: number = 25, knockbackDirX: number = -1): boolean {
    if (this.isDying || this.invulnerableTime > 0) return false;

    // Bubble Force Field Negates All Damage!
    if (this.shieldActive) {
      // Zero wobble distortion: forcefield maintains stable spherical geometry!
      this.shieldWobbleTimer = 0.22;
      this.shieldWobbleImpulse.set(0, 0);
      this.velocity.x += knockbackDirX * 1.5;
      this.onShieldDeflect?.();
      return false;
    }

    this.life = Math.max(0, this.life - amount);

    if (this.life <= 0) {
      this.triggerDeath(knockbackDirX);
      return true;
    }

    this.invulnerableTime = 0.55;

    // Trigger physical ragdoll flail & knockback impulse
    this.ragdollTimer = 0.45;
    this.ragdollImpulseX = knockbackDirX;
    this.velocity.x = knockbackDirX * 7.5;
    this.velocity.y = 7.0;
    this.isGrounded = false;
    return true;
  }

  /**
   * Heavy mechanical press crushing reaction
   * Squashes player down with intense ragdoll reaction, dust blast, and grounded impact
   */
  public crushHit(amount: number = 30, knockbackDirX: number = 0) {
    if (this.isDying || this.invulnerableTime > 0) return;

    if (this.shieldActive) {
      this.shieldWobbleTimer = 0.22;
      this.shieldWobbleImpulse.set(0, 0);
      this.velocity.x += knockbackDirX * 2.0;
      this.onShieldDeflect?.();
      return;
    }

    this.life = Math.max(0, this.life - amount);

    if (this.life <= 0) {
      this.triggerDeath(knockbackDirX);
      return;
    }

    this.invulnerableTime = 0.65;

    this.ragdollTimer = 0.55;
    this.ragdollImpulseX = knockbackDirX;
    this.velocity.x = knockbackDirX * 5.0;
    this.velocity.y = -10.0; // Slammed downward
    this.landingSuspension = 1.0; // Heavy crouch & flex
    this.crushSquashTimer = 0.35; // Visual squash

    this.emitDust(this.position.x, this.position.y, 14);
    this.emitSparks(this.position.x, this.position.y + 0.8, 0, 10);
  }

  public triggerStuntRagdoll() {
    // Stunt functionality removed per user request
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
    hasMouseTarget: boolean = false,
    crouchPressed: boolean = false,
    underPressure: boolean = false,
    moveZ: number = 0,
    marsSurfaceHeight?: (x: number, z: number) => number,
    marsSurfaceNormal?: (x: number, z: number) => THREE.Vector3,
    marsCollisionResolver?: (currPos: THREE.Vector3, nextPos: THREE.Vector3, radius?: number) => THREE.Vector3
  ) {
    this.animTimer += dt;
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
    }
    // ALWAYS visible — NO FLASHING!
    this.mesh.visible = true;

    // Dedicated Death Physics & Ragdoll Execution (Bypasses living player controls & collision fighting)
    if (this.isDying) {
      this.updateDeath(dt, platforms);
      return;
    }

    // Dedicated AAA 3D Isometric Navigation for Level 3
    if (this.isIsometric) {
      this.updateIsometric(
        dt,
        moveX,
        moveZ,
        runPressed,
        jumpPressed,
        jetpackPressed,
        mouseWorldTarget,
        hasMouseTarget,
        underPressure,
        marsSurfaceHeight,
        marsSurfaceNormal,
        marsCollisionResolver
      );
      return;
    }

    // 1. Aim Tracking with Arc Limits (clears helmet dome cleanly)
    if (hasMouseTarget && mouseWorldTarget) {
      const originY = this.position.y + 1.55; // Shoulder height
      const originX = this.position.x;
      const rawAngle = Math.atan2(
        mouseWorldTarget.y - originY,
        mouseWorldTarget.x - originX
      );

      let relAngle = rawAngle;
      if (!this.facingRight) {
        relAngle = Math.PI - relAngle;
      }
      relAngle = THREE.MathUtils.euclideanModulo(relAngle + Math.PI, Math.PI * 2) - Math.PI;

      // Stops comfortably below helmet dome (~45°), generous downward (~-72°)
      const maxUpwardAngle = Math.PI * 0.25;
      const maxDownwardAngle = -Math.PI * 0.40;
      const clampedRel = THREE.MathUtils.clamp(relAngle, maxDownwardAngle, maxUpwardAngle);

      this.currentAimAngle = this.facingRight ? clampedRel : (Math.PI - clampedRel);
    }

    // 2. Movement-Priority Facing Direction
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
    const halfWidth = 0.32;

    // Check if an overhead platform ceiling blocks Jones from standing up
    // Evaluated for any player under a platform whose bottom is lower than Jones's standing height (1.95m)
    let ceilingBlocked = false;
    if (!this.isDying && this.isBallMode) {
      // ----------------------------------------------------
      // BALL MODE: INFLUENCED BY BOUNCE & ROTATION OF THE BALL
      // Whole body tilts and dips with the ball, while shooting arm
      // remains steady and aims/shoots cleanly without moving up and down
      // ----------------------------------------------------
      const squashDip = (1.0 - this.ballBounceSquash) * 0.55;

      this.rigRoot.position.x = THREE.MathUtils.lerp(this.rigRoot.position.x, -this.velocity.x * 0.025, dt * 10.0);
      this.rigRoot.position.y = THREE.MathUtils.lerp(this.rigRoot.position.y, 0.42 - squashDip, dt * 14.0);

      // Jones' body tilts with the angular roll and centrifugal spin of the bouncy ball
      const targetRollTilt = THREE.MathUtils.clamp(-this.ballAngularVelocity * 0.08, -0.60, 0.60);
      this.rigRoot.rotation.z = THREE.MathUtils.lerp(this.rigRoot.rotation.z, targetRollTilt, dt * 8.0);

      // Stabilized head and torso orientation
      this.headBone.rotation.z = -targetRollTilt * 0.20;
      this.torsoBone.rotation.z = targetRollTilt * 0.15;

      // Natural leg tuck & suspension reaction inside the ball
      this.frontThighBone.rotation.z = 0.38 + squashDip * 0.4;
      this.frontShinBone.rotation.z = -0.70 - squashDip * 0.5;
      this.backThighBone.rotation.z = 0.28 + squashDip * 0.4;
      this.backShinBone.rotation.z = -0.58 - squashDip * 0.5;

      // Back arm balances naturally
      this.backArmBone.rotation.z = -0.35;
      this.backForearmBone.rotation.z = 0.65;
      // Front shooting arm is NOT moved up and down; it stays as it was to aim and shoot cleanly
    } else if (!this.isDying) {
      for (const plat of platforms) {
        const platBottom = plat.y - plat.height / 2;
        const platLeft = plat.x - plat.width / 2;
        const platRight = plat.x + plat.width / 2;
        const horizOverlap =
          this.position.x + halfWidth > platLeft + 0.02 &&
          this.position.x - halfWidth < platRight - 0.02;

        // If standing up would collide with platform ceiling
        if (horizOverlap && platBottom > this.position.y + 0.30 && platBottom < this.position.y + 1.95) {
          ceilingBlocked = true;
          break;
        }
      }
    }

    const isActuallyCrouching = (this.isGrounded || ceilingBlocked) && (crouchPressed || ceilingBlocked) && !this.isDying;
    const walkSpeed = this.hasHyperJetpack ? 8.2 : 6.2;
    const runSpeed = this.hasHyperJetpack ? 14.0 : 10.5;
    const crouchSpeed = 2.8;
    const targetSpeed = isActuallyCrouching ? crouchSpeed : (runPressed ? runSpeed : walkSpeed);
    
    // Air acceleration and lateral control (Ultra-responsive retro upgrade: 64.0 airControl!)
    const airControl = this.hasHyperJetpack ? 64.0 : 36.0;
    const accel = this.isGrounded ? 45.0 : airControl;

    const desiredVx = moveX * targetSpeed;
    if (this.isDying && !this.isGrounded) {
      // Retain lateral momentum during death tumble off platform edges
      this.velocity.x *= 0.985;
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, desiredVx, dt * (accel / 10));
    }

    // 4. Jump & Jetpack (STRICTLY DISABLED when crouching or under low ceiling!)
    if (jumpPressed && this.isGrounded && !isActuallyCrouching && !ceilingBlocked) {
      this.velocity.y = 11.5;
      this.isGrounded = false;
      this.emitDust(this.position.x, this.position.y, 6);
    }

    const isActuallyJetpacking = jetpackPressed && this.fuel > 0 && !isActuallyCrouching && !ceilingBlocked;
    const gravity = -24.0;
    const jetpackLift = this.hasHyperJetpack ? 46.0 : 32.0;
    const maxClampedVy = this.hasHyperJetpack ? 12.5 : 10.0;
    const fuelConsumptionRate = this.hasHyperJetpack ? 10.0 : 20.0;

    if (isActuallyJetpacking) {
      this.velocity.y += jetpackLift * dt;
      this.fuel = Math.max(0, this.fuel - fuelConsumptionRate * dt);
      this.isGrounded = false;
      // Gentle vertical hover dampening to prevent uncontrolled vertical slingshotting in tight spaces
      if (this.velocity.y > maxClampedVy * 0.65) {
        this.velocity.y *= 0.96;
      }
    } else {
      this.fuel = Math.min(this.maxFuel, this.fuel + (this.hasHyperJetpack ? 16.0 : 9.0) * dt);
      // Gentle air braking / gliding resistance when releasing jetpack in flight
      if (!this.isGrounded && this.velocity.y < 0) {
        this.velocity.y *= (this.hasHyperJetpack ? 0.98 : 0.99); // Prevents sudden uncontrolled plummeting
      }
    }

    if (ceilingBlocked || isActuallyCrouching) {
      // Crucial: When crouched under platform, lock vertical velocity <= 0 and force grounded!
      this.velocity.y = Math.min(0, this.velocity.y);
      this.isGrounded = true;
    } else {
      this.velocity.y += gravity * dt;
      this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -12.5, maxClampedVy);
    }

    const playerHeight = isActuallyCrouching ? 1.10 : 1.85;

    // 1. Ball Mode Physics & Dynamic Dimensions
    const ballRadius = 1.25;
    const isBall = this.isBallMode && !this.isDying;
    const effHalfWidth = isBall ? ballRadius : (this.isDying ? Math.sqrt((0.95 * Math.sin(this.rigRoot.rotation.z))**2 + (0.35 * Math.cos(this.rigRoot.rotation.z))**2) : 0.32);

    // 1. Horizontal Movement & Solid Wall Collisions (Player & Bouncy Ball CANNOT intersect with platforms)
    const prevX = this.position.x;
    this.position.x += this.velocity.x * dt;

    for (const plat of platforms) {
      const platTop = plat.y + plat.height / 2;
      const platBottom = plat.y - plat.height / 2;
      const platLeft = plat.x - plat.width / 2;
      const platRight = plat.x + plat.width / 2;

      const pHeight = isBall ? (ballRadius * 2) : playerHeight;
      const vertOverlap =
        this.position.y + pHeight > platBottom + 0.05 &&
        this.position.y < platTop - 0.05;

      if (vertOverlap) {
        if (prevX + effHalfWidth <= platLeft && this.position.x + effHalfWidth > platLeft) {
          this.position.x = platLeft - effHalfWidth;
          if (isBall && Math.abs(this.velocity.x) > 0.8) {
            this.velocity.x = -this.velocity.x * 0.88; // Highly responsive bouncy wall rebound!
            this.ballBounceSquash = 0.55;
            // Wall impact imparts vertical rolling spin based on vertical velocity
            const spinDir = this.velocity.y >= 0 ? -1 : 1;
            this.ballAngularVelocity = spinDir * (Math.abs(this.velocity.y) * 2.8 + 8.0);
            this.velocity.y += spinDir * 1.6; // Wall rebound hop
            if (this.onBallBounce) this.onBallBounce(Math.abs(this.velocity.x));
            this.emitSparks(platLeft, this.position.y + 0.8, -1, 8);
          } else {
            this.velocity.x = 0;
          }
        } else if (prevX - effHalfWidth >= platRight && this.position.x - effHalfWidth < platRight) {
          this.position.x = platRight + effHalfWidth;
          if (isBall && Math.abs(this.velocity.x) > 0.8) {
            this.velocity.x = -this.velocity.x * 0.88; // Highly responsive bouncy wall rebound!
            this.ballBounceSquash = 0.55;
            const spinDir = this.velocity.y >= 0 ? 1 : -1;
            this.ballAngularVelocity = spinDir * (Math.abs(this.velocity.y) * 2.8 + 8.0);
            this.velocity.y += spinDir * 1.6;
            if (this.onBallBounce) this.onBallBounce(Math.abs(this.velocity.x));
            this.emitSparks(platRight, this.position.y + 0.8, 1, 8);
          } else {
            this.velocity.x = 0;
          }
        }
      }
    }

    // 2. Vertical Movement & Solid Platform Collisions (Bottom Ceiling & Top Landing)
    const prevVy = this.velocity.y;
    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;
    this.isGrounded = false;

    const H = 0.95; // Center of mass height
    const theta = this.rigRoot.rotation.z;
    const dDown = this.isDying ? Math.sqrt((0.95 * Math.cos(theta))**2 + (0.35 * Math.sin(theta))**2) : 0.95;

    // Ground Floor Boundary (ZERO Penetration & High Bouncy Ball Restitution)
    if (isBall) {
      if (this.position.y <= GROUND_Y) {
        this.position.y = GROUND_Y;
        if (prevVy < -1.0) {
          this.velocity.y = -prevVy * 0.92; // Much bouncier restitution (0.92)!
          this.ballBounceSquash = 0.50; // Dynamic squash
          // Ground impact spins the ball based on forward roll speed
          const targetRoll = -this.velocity.x / ballRadius;
          this.ballAngularVelocity = THREE.MathUtils.lerp(this.ballAngularVelocity, targetRoll * 1.5, 0.70);
          this.isGrounded = false;
          if (this.onBallBounce) this.onBallBounce(Math.abs(prevVy));
          this.emitDust(this.position.x, GROUND_Y, 8);
          this.emitSparks(this.position.x, GROUND_Y + 0.1, 0, 6);
        } else {
          this.velocity.y = 0;
          this.isGrounded = true;
        }
      }
    } else if (this.isDying) {
      if (this.position.y + H - dDown <= GROUND_Y) {
        this.position.y = GROUND_Y - H + dDown;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    } else {
      if (this.position.y <= GROUND_Y) {
        this.position.y = GROUND_Y;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }

    // Solid Platform Collisions (ZERO Penetration from bottom or top!)
    for (const plat of platforms) {
      const platTop = plat.y + plat.height / 2;
      const platBottom = plat.y - plat.height / 2;
      const platLeft = plat.x - plat.width / 2;
      const platRight = plat.x + plat.width / 2;

      const horizOverlap =
        this.position.x + effHalfWidth > platLeft + 0.02 &&
        this.position.x - effHalfWidth < platRight - 0.02;

      if (horizOverlap) {
        // A. CEILING COLLISION
        if (this.velocity.y > 0) {
          const headY = isBall ? (this.position.y + ballRadius * 2) : (this.position.y + playerHeight);
          if (this.position.y < platBottom && headY >= platBottom) {
            this.position.y = isBall ? (platBottom - ballRadius * 2) : (platBottom - playerHeight);
            if (isBall) {
              this.velocity.y = -this.velocity.y * 0.88; // Vigorous ceiling bounce!
              this.ballBounceSquash = 0.58;
              this.ballAngularVelocity -= (this.velocity.x / ballRadius) * 0.85;
              if (this.onBallBounce) this.onBallBounce(Math.abs(this.velocity.y));
            } else {
              this.velocity.y = 0;
            }
            this.emitDust(this.position.x, platBottom - 0.05, 3);
          }
        }

        // B. TOP LANDING & SOLID PLATFORM BOUNCE / STANDING
        if (this.velocity.y <= 0) {
          if (isBall) {
            if (prevY >= platTop - 0.35 && this.position.y <= platTop + 0.35) {
              this.position.y = platTop;
              if (prevVy < -1.0) {
                this.velocity.y = -prevVy * 0.92; // High-restitution bouncy platform rebound!
                this.ballBounceSquash = 0.50;
                const targetRoll = -this.velocity.x / ballRadius;
                this.ballAngularVelocity = THREE.MathUtils.lerp(this.ballAngularVelocity, targetRoll * 1.5, 0.70);
                this.isGrounded = false;
                if (this.onBallBounce) this.onBallBounce(Math.abs(prevVy));
                this.emitDust(this.position.x, platTop, 8);
              } else {
                this.velocity.y = 0;
                this.isGrounded = true;
              }
            }
          } else if (this.isDying) {
            // Strictly check physical bottom of dying player: ZERO penetration!
            const prevBottom = prevY + H - dDown;
            const curBottom = this.position.y + H - dDown;
            if (prevBottom >= platTop - 0.25 && curBottom <= platTop + 0.40) {
              this.position.y = platTop - H + dDown;
              this.velocity.y = 0;
              this.isGrounded = true;
            }
          } else {
            if (prevY >= platTop - 0.25 && this.position.y <= platTop + 0.25) {
              this.position.y = platTop;
              this.velocity.y = 0;
              this.isGrounded = true;
            }
          }
        }
      }
    }

    // Enhanced Procedural Landing Suspension & Knee Flexion Physics
    if (!this.wasGroundedLastFrame && this.isGrounded) {
      const impactForce = THREE.MathUtils.clamp(-prevVy / 13.0, 0.25, 1.0);
      this.landingSuspension = impactForce;
      this.emitDust(this.position.x, this.position.y, Math.floor(4 + impactForce * 6));
    }
    this.prevVelocityY = this.velocity.y;
    this.wasGroundedLastFrame = this.isGrounded;

        // 6. State Machine
    if (isActuallyJetpacking) {
      this.state = PlayerState.JETPACK;
    } else if (!this.isGrounded) {
      this.state = this.velocity.y > 0 ? PlayerState.JUMP : PlayerState.FALL;
    } else if (isActuallyCrouching) {
      this.state = Math.abs(this.velocity.x) > 0.2 ? PlayerState.CROUCH_WALK : PlayerState.CROUCH;
    } else if (Math.abs(this.velocity.x) > 0.4) {
      this.state = Math.abs(this.velocity.x) > 7.0 ? PlayerState.RUN : PlayerState.WALK;
    } else {
      this.state = PlayerState.IDLE;
    }

    // 7. Update Transforms & Animations
    this.mesh.position.copy(this.position);

    // Update Bubble Force Field / Ball Mode Transform
    this.updateForcefieldSystem(dt, isActuallyCrouching);

    // Update Dynamic Contact Shadow Decal
    if (this.shadowMesh) {
      let surfaceY = GROUND_Y;
      for (const plat of platforms) {
        const platTop = plat.y + plat.height / 2;
        const platLeft = plat.x - plat.width / 2;
        const platRight = plat.x + plat.width / 2;
        if (this.position.x >= platLeft && this.position.x <= platRight) {
          if (platTop <= this.position.y + 0.25 && platTop > surfaceY) {
            surfaceY = platTop;
          }
        }
      }
      const heightAbove = this.position.y - surfaceY;

      // CRITICAL: Shadow is strictly visible on solid ground or platform surface only, NEVER when flying or in the air
      // Completely prevents any plane intersection when flying or turning around left/right!
      const isTurning = Math.abs(this.rigRoot.rotation.y - targetTurn) > 0.08;
      if (
        this.isGrounded &&
        !isActuallyJetpacking &&
        this.state !== PlayerState.JETPACK &&
        this.state !== PlayerState.JUMP &&
        this.state !== PlayerState.FALL &&
        !isTurning &&
        Math.abs(this.velocity.y) < 0.02 &&
        heightAbove < 0.08
      ) {
        this.shadowMesh.visible = true;
        this.shadowMesh.position.set(this.position.x, surfaceY + 0.015, 0);
        this.shadowMesh.scale.set(1.0, 1.0, 1.0);
        (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.38;
      } else {
        this.shadowMesh.visible = false;
      }
    }
    this.animateSkeletalRig(dt, hasMouseTarget);
    this.updateJetpackVFX(dt, isActuallyJetpacking);
    this.updateHelmetLEDs(dt);
    this.updateBeltLEDs(dt);
    this.updateBubbleBurstVFX(dt);
    this.updateParticles(dt);
    this.updateLasers(dt);
    this.updateDroppedGun(dt, platforms);
    this.updateRadioWaves(dt, underPressure);
  }

  /**
   * Universal Forcefield & Ball Mode Transform & Shader Animation Update
   */
  private updateForcefieldSystem(dt: number, isActuallyCrouching: boolean) {
    if (!this.shieldGroup) return;
    this.shieldGroup.visible = this.shieldActive && !this.isDying;
    if (!this.shieldActive) return;

    const isBall = this.isBallMode && !this.isDying;
    const shieldCenterY = this.position.y + (isBall ? 1.25 : (isActuallyCrouching ? 0.70 : 1.05));
    this.shieldGroup.position.set(this.position.x, shieldCenterY, this.position.z);

    const time = this.animTimer;

    if (this.shieldWobbleTimer > 0) {
      this.shieldWobbleTimer -= dt;
      this.shieldMat.emissive.setHex(0x55ffff);
      this.shieldMat.opacity = isBall ? 0.24 : 0.28;
      this.shieldGridMat.opacity = isBall ? 0.30 : 0.35;
    } else {
      this.shieldMat.emissive.setHex(isBall ? 0x002233 : 0x001525);
      this.shieldMat.opacity = isBall ? 0.10 : 0.14; // Crystal clear transparent bubble
      this.shieldGridMat.opacity = isBall ? 0.15 : 0.18;
    }

    // Dynamic Squash and Stretch Bouncy Ball scaling
    if (isBall) {
      this.ballBounceSquash = THREE.MathUtils.lerp(this.ballBounceSquash, 1.0, dt * 8.0);
      const sqY = this.ballBounceSquash;
      const stX = 1.0 / Math.sqrt(Math.max(0.2, sqY));
      this.shieldGroup.scale.set(stX * 0.76, sqY * 0.76, stX * 0.76); // Bouncy sphere of 1.25m radius

      // Physical 3D ball rotation when rolling and bouncing off surfaces
      const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (this.isGrounded) {
        const rollRate = (-horizSpeed / 1.25);
        this.ballAngularVelocity = THREE.MathUtils.lerp(this.ballAngularVelocity, rollRate, dt * 12.0);
      } else {
        this.ballAngularVelocity *= (1.0 - 0.15 * dt);
      }
      this.ballRotationZ += this.ballAngularVelocity * dt;
      this.ballRotationX += Math.abs(this.ballAngularVelocity) * 0.35 * dt;
      this.ballRotationY += this.ballAngularVelocity * 0.25 * dt;

      // Apply 3D sphere tumble and spin
      this.shieldSphereMesh.rotation.set(this.ballRotationX, this.ballRotationY, this.ballRotationZ);
      this.shieldGridMesh.rotation.set(this.ballRotationX * 0.8, this.ballRotationY * 0.8, this.ballRotationZ);
      this.shieldRingMesh1.rotation.set(this.ballRotationX * 1.2, this.ballRotationY * 1.2, this.ballRotationZ * 1.2);
      this.shieldRingMesh2.rotation.set(-this.ballRotationX * 0.9, -this.ballRotationY * 0.9, -this.ballRotationZ * 0.9);
    } else {
      this.shieldGroup.scale.set(1.0, 1.0, 1.0);
      this.shieldSphereMesh.rotation.set(0, 0, 0);
    }

    // Rotate geodesic shield grid and counter-rotating rings
    this.shieldGridMesh.rotation.y += 0.8 * dt;
    this.shieldGridMesh.rotation.x += 0.5 * dt;

    this.shieldRingMesh1.rotation.z += 2.8 * dt;
    this.shieldRingMesh1.rotation.y += 1.6 * dt;

    this.shieldRingMesh2.rotation.z -= 2.2 * dt;
    this.shieldRingMesh2.rotation.x += 1.9 * dt;

    // Orbit the 4 deflector micro-nodes
    for (let i = 0; i < this.shieldNodes.length; i++) {
      const node = this.shieldNodes[i];
      const nodeAngle = time * 3.2 + (i * Math.PI / 2);
      const nodeRad = 1.70;
      const tilt = (i % 2 === 0 ? 0.4 : -0.4);
      node.position.set(
        Math.cos(nodeAngle) * nodeRad,
        Math.sin(nodeAngle) * nodeRad * Math.cos(tilt),
        Math.sin(nodeAngle) * nodeRad * Math.sin(tilt)
      );
      node.rotation.x += dt * 4.0;
      node.rotation.y += dt * 5.0;
    }
  }

  /**
   * Triple AAA 3D Isometric Navigation & Low Martian Gravity Traversal
   * Powered by tailor-made IsometricPlayerRig (space white suit, independent non-crossing legs,
   * 360° aiming, dynamic contact shadow decal, terrain slope climbing, and 3D forcefield ball mode).
   */
  private updateIsometric(
    dt: number,
    moveX: number,
    moveZ: number,
    runPressed: boolean,
    jumpPressed: boolean,
    jetpackPressed: boolean,
    mouseWorldTarget?: THREE.Vector3,
    hasMouseTarget: boolean = false,
    underPressure: boolean = false,
    marsSurfaceHeight?: (x: number, z: number) => number,
    marsSurfaceNormal?: (x: number, z: number) => THREE.Vector3,
    marsCollisionResolver?: (currPos: THREE.Vector3, nextPos: THREE.Vector3, radius?: number) => THREE.Vector3
  ) {
    // 1. Rig & Shadow Visibility
    this.rigRoot.visible = false;
    this.isoPlayerRig.group.visible = true;
    if (this.shadowMesh) this.shadowMesh.visible = false;
    this.isoShadowMesh.visible = true;

    // 2. 8-Directional Screen-Relative Isometric Axes
    const inputDirX = (moveX - moveZ) * 0.7071;
    const inputDirZ = (moveZ + moveX) * 0.7071;

    const walkSpeed = this.hasHyperJetpack ? 8.5 : 6.8;
    const runSpeed = this.hasHyperJetpack ? 14.5 : 11.2;
    const targetSpeed = runPressed ? runSpeed : walkSpeed;

    const desiredVx = inputDirX * targetSpeed;
    const desiredVz = inputDirZ * targetSpeed;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, desiredVx, dt * 12.0);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, desiredVz, dt * 12.0);

    // 3. Next Position & Solid Structure Collision Resolution
    let nextPos = new THREE.Vector3(
      this.position.x + this.velocity.x * dt,
      this.position.y,
      this.position.z + this.velocity.z * dt
    );

    if (marsCollisionResolver) {
      nextPos = marsCollisionResolver(this.position, nextPos, 0.45);
    }

    this.position.x = nextPos.x;
    this.position.z = nextPos.z;

    // 4. Sample Surface Elevation & Normal for Slope Traversal
    const surfaceY = marsSurfaceHeight ? marsSurfaceHeight(this.position.x, this.position.z) : -3.70;
    const normal = marsSurfaceNormal ? marsSurfaceNormal(this.position.x, this.position.z) : new THREE.Vector3(0, 1, 0);

    const slopePitch = Math.atan2(-normal.z, normal.y);
    const slopeRoll = Math.atan2(normal.x, normal.y);

    // 5. Mars Low Gravity & Vertical Jetpack Traversal
    const marsGravity = -14.0;
    const marsJumpVel = 10.5;
    const marsJetpackLift = this.hasHyperJetpack ? 46.0 : 34.0;
    const isActuallyJetpacking = jetpackPressed && this.fuel > 0;

    if (jumpPressed && this.isGrounded) {
      this.velocity.y = marsJumpVel;
      this.isGrounded = false;
      this.emitDust(this.position.x, this.position.y, 6);
    }

    if (isActuallyJetpacking) {
      this.velocity.y += marsJetpackLift * dt;
      this.fuel = Math.max(0, this.fuel - 12.0 * dt);
      this.isGrounded = false;
    } else {
      this.fuel = Math.min(this.maxFuel, this.fuel + 14.0 * dt);
    }

    this.velocity.y += marsGravity * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -14.0, 14.0);
    this.position.y += this.velocity.y * dt;

    // 6. Slope Traversal & Ground Attachment
    if (this.isGrounded) {
      const heightDiff = surfaceY - this.position.y;
      if (heightDiff > -0.65 && heightDiff < 0.65) {
        this.position.y = surfaceY;
        this.velocity.y = 0;
      } else if (this.position.y < surfaceY) {
        this.position.y = surfaceY;
        this.velocity.y = 0;
      } else {
        this.isGrounded = false;
      }
    } else if (this.position.y <= surfaceY) {
      this.position.y = surfaceY;
      this.velocity.y = 0;
      this.isGrounded = true;

      if (this.isBallMode) {
        const inSpeed = Math.abs(this.velocity.y);
        if (inSpeed > 1.5) {
          this.onBallBounce?.(inSpeed);
          this.ballBounceSquash = 0.55;
          const dot = this.velocity.dot(normal);
          this.velocity.addScaledVector(normal, -1.85 * dot);
          this.isGrounded = false;
        }
      }
    }

    // 7. Dynamic Contact Shadow Beneath Player (Rotated to match terrain slope)
    this.isoShadowMesh.position.set(this.position.x, surfaceY + 0.02, this.position.z);
    this.isoShadowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

    const heightAbove = Math.max(0, this.position.y - surfaceY);
    const shadowScale = 1.0 + Math.min(1.5, heightAbove * 0.15);
    this.isoShadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
    this.isoShadowMat.opacity = Math.max(0.12, 0.60 - heightAbove * 0.045);

    // 8. Update Multi-Layer Bubble Forcefield (Z correctly set!)
    this.updateForcefieldSystem(dt, false);

    // 9. Update Tailor-Made 3D Isometric Character Rig & Animations
    this.mesh.position.copy(this.position);
    this.isoPlayerRig.update(dt, {
      velocity: this.velocity,
      isGrounded: this.isGrounded,
      isJetpacking: isActuallyJetpacking,
      isBallMode: this.isBallMode,
      aimTarget: mouseWorldTarget,
      hasAimTarget: hasMouseTarget,
      underPressure,
      groundSlopePitch: slopePitch,
      groundSlopeRoll: slopeRoll,
    });

    // 10. Smoke VFX from Jetpack Nozzles
    if (isActuallyJetpacking) {
      const thrusters = this.isoPlayerRig.getThrusterWorldPositions();
      this.emitSmoke(thrusters.left.x, thrusters.left.y, thrusters.left.z, 1);
      this.emitSmoke(thrusters.right.x, thrusters.right.y, thrusters.right.z, 1);
    }

    // 11. Generic Particle & Weapon VFX
    this.updateParticles(dt);
    this.updateBubbleBurstVFX(dt);
    this.updateLasers(dt);
    this.updateRadioWaves(dt, underPressure);
  }

  /**
   * Dedicated Full-Ragdoll Death Physics & Surface Collapse
   * Ensures realistic in-air center-of-mass tumbling, single-trigger surface impact,
   * elevated head clearance above ground (zero head penetration!), and smooth Game Over transition.
   */
  private updateDeath(dt: number, platforms: { x: number; y: number; width: number; height: number }[]) {
    this.deathTimer += dt;
    this.invulnerableTime = 999;
    this.mesh.visible = true;
    if (this.shadowMesh) this.shadowMesh.visible = !this.isIsometric;
    if (this.isoShadowMesh) this.isoShadowMesh.visible = this.isIsometric;
    if (this.isoPlayerRig) {
      this.isoPlayerRig.group.visible = this.isIsometric;
      this.rigRoot.visible = !this.isIsometric;
    }
    if (this.flameConeLeft) this.flameConeLeft.visible = false;
    if (this.flameConeRight) this.flameConeRight.visible = false;
    if (this.thrusterLight) this.thrusterLight.intensity = 0;
    if (this.shieldGroup) this.shieldGroup.visible = false;

    // Electrical sparks & smoke early during jetpack blowout
    if (this.deathTimer < 1.0) {
      if (Math.random() < 0.35) {
        const sparkDir = (Math.random() - 0.5) * 4.0;
        this.emitSparks(this.position.x, this.position.y + 0.8, sparkDir, 2);
      }
      if (Math.random() < 0.20) {
        this.emitSmoke(this.position.x - 0.15, this.position.y + 0.85, 0, 1);
      }
    }

    const H = 0.95; // Waist / Center of mass height above feet

    if (!this.deathHasLanded) {
      // 1. FREE-FALL & CENTER-OF-MASS TUMBLE IN AIR
      this.velocity.y -= 22.0 * dt;
      this.velocity.x *= 0.985;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      // Continuous angular tumble in mid-air
      const tumbleDir = this.facingRight ? -1 : 1;
      this.deathTumbleAngle += tumbleDir * 4.2 * dt;
      this.rigRoot.rotation.z = this.deathTumbleAngle;

      // Center-of-mass anchor so hips remain at rotation pivot
      const theta = this.deathTumbleAngle;
      this.rigRoot.position.x = H * Math.sin(theta);
      this.rigRoot.position.y = H * (1.0 - Math.cos(theta));

      // Limbs flail and drag naturally in the air with loose ragdoll physics
      this.headBone.rotation.z = Math.sin(this.deathTimer * 8.0) * 0.35 - 0.20;
      this.torsoBone.rotation.z = Math.cos(this.deathTimer * 6.0) * 0.25;

      this.frontArmBone.rotation.z = -1.2 + Math.sin(this.deathTimer * 9.0) * 0.5;
      this.frontForearmBone.rotation.z = 0.7 + Math.cos(this.deathTimer * 8.0) * 0.3;
      this.backArmBone.rotation.z = 1.0 + Math.cos(this.deathTimer * 8.0) * 0.4;
      this.backForearmBone.rotation.z = 0.4;

      this.frontThighBone.rotation.z = 0.5 + Math.sin(this.deathTimer * 7.0) * 0.4;
      this.frontShinBone.rotation.z = -0.7 + Math.cos(this.deathTimer * 7.0) * 0.3;
      this.backThighBone.rotation.z = -0.4 + Math.sin(this.deathTimer * 6.5) * 0.3;
      this.backShinBone.rotation.z = -0.4;

      // Check collision with solid ground and elevated platforms
      let highestSurfaceBelow = GROUND_Y;
      const pLeft = this.position.x - 0.32;
      const pRight = this.position.x + 0.32;
      for (const plat of platforms) {
        const platTop = plat.y + plat.height / 2;
        const platLeft = plat.x - plat.width / 2;
        const platRight = plat.x + plat.width / 2;
        if (pRight > platLeft && pLeft < platRight) {
          if (platTop <= this.position.y + 0.45 && platTop > highestSurfaceBelow) {
            highestSurfaceBelow = platTop;
          }
        }
      }

      // Detect landing
      if (this.position.y <= highestSurfaceBelow + 0.15 && this.velocity.y <= 0) {
        this.deathHasLanded = true;
        this.deathLandingSurfaceY = highestSurfaceBelow;
        this.position.y = highestSurfaceBelow;
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;

        // Emit landing impact dust and sparks EXACTLY ONCE
        this.emitDust(this.position.x, highestSurfaceBelow, 14);
        this.emitSparks(this.position.x, highestSurfaceBelow + 0.1, 0, 8);
      }
    } else {
      // 2. RESTING ON SURFACE: ZERO PENETRATION & NATURAL LIMP RAGDOLL COLLAPSE
      this.position.y = this.deathLandingSurfaceY;
      this.velocity.set(0, 0, 0);
      this.isGrounded = true;
      this.groundedDeathTimer += dt;

      // Rotate body flat onto back or front on the ground
      const targetCollapse = this.facingRight ? -Math.PI / 2 : Math.PI / 2;
      this.rigRoot.rotation.z = THREE.MathUtils.lerp(this.rigRoot.rotation.z, targetCollapse, dt * 10.0);

      // Resting offset: Elevates body pivot so helmet and torso rest safely +0.22m above ground (ZERO ground penetration!)
      this.rigRoot.position.set(0, 0.22, 0);

      // Limbs rest limp on the floor
      this.headBone.rotation.z = THREE.MathUtils.lerp(this.headBone.rotation.z, (this.facingRight ? 0.08 : -0.08), dt * 8.0);
      this.torsoBone.rotation.z = THREE.MathUtils.lerp(this.torsoBone.rotation.z, 0, dt * 8.0);
      this.frontArmBone.rotation.z = THREE.MathUtils.lerp(this.frontArmBone.rotation.z, -0.35, dt * 8.0);
      this.frontForearmBone.rotation.z = THREE.MathUtils.lerp(this.frontForearmBone.rotation.z, 0.15, dt * 8.0);
      this.backArmBone.rotation.z = THREE.MathUtils.lerp(this.backArmBone.rotation.z, 0.25, dt * 8.0);
      this.backForearmBone.rotation.z = THREE.MathUtils.lerp(this.backForearmBone.rotation.z, 0.05, dt * 8.0);
      this.frontThighBone.rotation.z = THREE.MathUtils.lerp(this.frontThighBone.rotation.z, 0.10, dt * 8.0);
      this.frontShinBone.rotation.z = THREE.MathUtils.lerp(this.frontShinBone.rotation.z, 0.05, dt * 8.0);
      this.backThighBone.rotation.z = THREE.MathUtils.lerp(this.backThighBone.rotation.z, -0.08, dt * 8.0);
      this.backShinBone.rotation.z = THREE.MathUtils.lerp(this.backShinBone.rotation.z, 0.05, dt * 8.0);

      // Trigger Game Over after full rest
      if (this.groundedDeathTimer >= 1.2 || this.deathTimer >= 3.5) {
        this.isDead = true;
      }
    }

    this.mesh.position.copy(this.position);
    this.updateDroppedGun(dt, platforms);
    this.updateParticles(dt);
  }

  private updateDroppedGun(dt: number, platforms: { x: number; y: number; width: number; height: number }[]) {
    if (!this.hasDroppedGun || !this.droppedGunMesh) return;

    this.droppedGunVel.y -= 22.0 * dt;
    this.droppedGunPos.addScaledVector(this.droppedGunVel, dt);

    // Surface detection beneath gun
    let gunSurfaceY = GROUND_Y;
    for (const plat of platforms) {
      const platTop = plat.y + plat.height / 2;
      const platLeft = plat.x - plat.width / 2;
      const platRight = plat.x + plat.width / 2;
      if (this.droppedGunPos.x >= platLeft && this.droppedGunPos.x <= platRight) {
        if (platTop <= this.droppedGunPos.y + 0.35 && platTop > gunSurfaceY) {
          gunSurfaceY = platTop;
        }
      }
    }

    const gunRestY = gunSurfaceY + 0.08;
    if (this.droppedGunPos.y <= gunRestY) {
      this.droppedGunPos.y = gunRestY;
      if (Math.abs(this.droppedGunVel.y) > 1.0) {
        this.droppedGunVel.y = -this.droppedGunVel.y * 0.35;
        this.droppedGunVel.x *= 0.6;
        this.droppedGunRotVel *= 0.5;
      } else {
        this.droppedGunVel.set(0, 0, 0);
        this.droppedGunRotVel = 0;
      }
    } else {
      this.droppedGunRotZ += this.droppedGunRotVel * dt;
    }

    this.droppedGunMesh.position.copy(this.droppedGunPos);
    this.droppedGunMesh.position.z = 0.05; // slightly in front of catwalk
    this.droppedGunMesh.rotation.z = this.droppedGunRotZ;
  }

  /**
   * Triple-AAA Skeletal Animation System
   * Features:
   * - Straightened pistol-holding arm aimed at cursor
   * - Ragdoll recoil physics on damage
   * - Footstep sound sync
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
      // A. IDLE & IMPATIENT FOOT TAP / LOOK AROUND POSE
      // ----------------------------------------------------
      case PlayerState.IDLE: {
        this.idleTimer += dt;
        const breathe = Math.sin(t * 3.2);
        this.torsoBone.rotation.z = breathe * 0.025;
        this.torsoBone.position.y = 0.1 + breathe * 0.015;
        this.headBone.rotation.z = -breathe * 0.02;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        this.jetpackBone.rotation.z = 0;

        this.frontThighBone.rotation.z = 0.05;
        this.frontShinBone.rotation.z = -0.05;
        this.frontFootBone.rotation.z = 0.0;

        this.backThighBone.rotation.z = -0.05;
        this.backShinBone.rotation.z = -0.05;
        this.backFootBone.rotation.z = 0.0;

        // Left arm hangs relaxed and natural BY HIS SIDE by default!
        this.backArmBone.rotation.z = -1.45 + Math.sin(t * 2.5) * 0.03;
        this.backForearmBone.rotation.z = 0.14;

        // IMPATIENT IDLE PERSONALITY: Taps foot & looks around after 2 seconds!
        if (this.idleTimer > 2.0) {
          const impT = (this.idleTimer - 2.0) % 4.2;

          // Phase 1 (0 to 1.6s): Rhythmic Impatient Foot Tapping
          if (impT < 1.6) {
            const tapFreq = 3.0 * Math.PI * 2; // ~3 taps/sec
            const tapSin = Math.sin(impT * tapFreq);
            const tapLift = Math.max(0, tapSin);
            this.frontFootBone.rotation.z = tapLift * 0.45; // Toe snaps up and down
            this.frontShinBone.rotation.z = -0.05 - tapLift * 0.08;
            this.frontThighBone.rotation.z = 0.05 + tapLift * 0.04;
            this.hipBone.position.x = -0.02; // Weight shift onto back foot

            // Visual boot tap on down-stroke (silent during idle)
            this.prevTapPhase = tapSin;
          } else {
            this.prevTapPhase = 1;
            this.hipBone.position.x = 0;
          }

          // Phase 2 (1.6 to 3.4s): Impatient Look Around (Where are the aliens?)
          if (impT >= 1.6 && impT < 3.4) {
            const lookProg = (impT - 1.6) / 1.8;
            const lookAngle = Math.sin(lookProg * Math.PI * 2) * 0.55;
            this.headBone.rotation.y = lookAngle; // Head turns left then right
            this.headBone.rotation.z = 0.10 + Math.sin(lookProg * Math.PI * 4) * 0.08;
            this.torsoBone.rotation.y = lookAngle * 0.25;
          } else if (impT >= 3.4) {
            this.headBone.rotation.y = 0;
            this.torsoBone.rotation.y = 0;
          }
        }

        if (!hasMouseTarget && this.shootTimer <= 0) {
          // Right shooting arm rests naturally by his side with pistol carried at hip and bent athletic elbow
          this.frontArmBone.rotation.z = -1.15;
          this.frontForearmBone.rotation.z = 0.72;
        }
        break;
      }

      // ----------------------------------------------------
      // CROUCH & CROUCH WALK (AAA Tactical Low-Profile Stance)
      // ----------------------------------------------------
      case PlayerState.CROUCH: {
        this.idleTimer = 0;
        this.hipBone.position.y = 0.52; // Low hips!
        this.torsoBone.rotation.z = -0.32; // Lean forward
        this.torsoBone.position.y = -0.06;
        this.headBone.rotation.z = 0.28; // Head up, vigilant
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        this.jetpackBone.rotation.z = 0;

        // Deep knee fold & flat boot contact
        this.frontThighBone.rotation.z = 1.18;
        this.frontShinBone.rotation.z = -1.98;
        this.frontFootBone.rotation.z = 0.82;

        this.backThighBone.rotation.z = 1.08;
        this.backShinBone.rotation.z = -1.88;
        this.backFootBone.rotation.z = 0.80;

        this.backArmBone.rotation.z = -0.45;
        this.backForearmBone.rotation.z = 0.85;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -0.35;
          this.frontForearmBone.rotation.z = 0.75;
        }
        break;
      }

      case PlayerState.CROUCH_WALK: {
        this.idleTimer = 0;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        this.jetpackBone.rotation.z = 0;

        const crawlFreq = 9.0;
        const phase = t * crawlFreq;

        // Trigger footstep sound on creeping steps
        if (this.isGrounded) {
          if (Math.sin(phase) * Math.sin(this.prevStridePhase) <= 0 && phase !== this.prevStridePhase) {
            this.onFootstep?.();
          }
        }
        this.prevStridePhase = phase;

        const bob = Math.abs(Math.sin(phase)) * 0.05;
        this.hipBone.position.y = 0.52 + bob;
        this.torsoBone.rotation.z = -0.34 + Math.sin(phase * 2) * 0.03;
        this.torsoBone.position.y = -0.06;
        this.headBone.rotation.z = 0.28 + this.headFollowLag;

        const crawlFront = Math.sin(phase);
        const crawlBack = Math.sin(phase + Math.PI);

        this.frontThighBone.rotation.z = 1.15 + crawlFront * 0.35;
        this.frontShinBone.rotation.z = -1.90 - Math.max(0, crawlFront) * 0.40;
        this.frontFootBone.rotation.z = 0.80;

        this.backThighBone.rotation.z = 1.15 + crawlBack * 0.35;
        this.backShinBone.rotation.z = -1.90 - Math.max(0, crawlBack) * 0.40;
        this.backFootBone.rotation.z = 0.80;

        this.backArmBone.rotation.z = -0.55 + crawlFront * 0.30;
        this.backForearmBone.rotation.z = 0.85;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -0.45 + crawlBack * 0.30;
          this.frontForearmBone.rotation.z = 0.75;
        }
        break;
      }

      // ----------------------------------------------------
      // B. WALK
      // ----------------------------------------------------
      case PlayerState.WALK: {
        this.idleTimer = 0;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        const walkFreq = 8.5;
        const phase = t * walkFreq;

        // Trigger footstep sound on foot contact
        if (this.isGrounded) {
          if (Math.sin(phase) * Math.sin(this.prevStridePhase) <= 0 && phase !== this.prevStridePhase) {
            this.onFootstep?.();
          }
        }
        this.prevStridePhase = phase;

        this.torsoBone.rotation.z = -0.08;
        this.torsoBone.position.y = 0.1;
        this.headBone.rotation.z = 0.04 + this.headFollowLag;
        this.jetpackBone.rotation.z = 0;

        const bob = Math.abs(Math.sin(phase)) * 0.05;
        this.hipBone.position.y = 1.05 + bob;

        const frontStride = Math.sin(phase);
        const backStride = Math.sin(phase + Math.PI);

        // Enhanced leg & knee bend kinematics
        this.frontThighBone.rotation.z = frontStride * 0.55;
        this.frontShinBone.rotation.z = frontStride < 0 ? -Math.abs(frontStride) * 0.95 : -0.08;
        this.frontFootBone.rotation.z = frontStride * 0.22;

        this.backThighBone.rotation.z = backStride * 0.55;
        this.backShinBone.rotation.z = backStride < 0 ? -Math.abs(backStride) * 0.95 : -0.08;
        this.backFootBone.rotation.z = backStride * 0.22;

        // Left arm has full natural walking animation (centered by his side)
        this.backArmBone.rotation.z = -1.42 + frontStride * 0.45;
        this.backForearmBone.rotation.z = 0.18 + Math.abs(frontStride) * 0.20;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -1.10 + backStride * 0.35;
          this.frontForearmBone.rotation.z = 0.65;
        }
        break;
      }

      // ----------------------------------------------------
      // C. RUN
      // ----------------------------------------------------
      case PlayerState.RUN: {
        this.idleTimer = 0;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        const runFreq = 14.0;
        const phase = t * runFreq;

        // Trigger footstep sound on foot contact
        if (this.isGrounded) {
          if (Math.sin(phase) * Math.sin(this.prevStridePhase) <= 0 && phase !== this.prevStridePhase) {
            this.onFootstep?.();
          }
        }
        this.prevStridePhase = phase;

        this.torsoBone.rotation.z = -0.22;
        this.torsoBone.position.y = 0.1;
        this.headBone.rotation.z = 0.12 + this.headFollowLag;
        this.jetpackBone.rotation.z = 0;

        const runBob = Math.abs(Math.sin(phase)) * 0.08;
        this.hipBone.position.y = 1.05 + runBob;

        const frontRun = Math.sin(phase);
        const backRun = Math.sin(phase + Math.PI);

        // Athletic sprinting knee bend & push-off
        this.frontThighBone.rotation.z = frontRun * 0.82;
        this.frontShinBone.rotation.z = frontRun < 0 ? -Math.abs(frontRun) * 1.35 : -0.1;
        this.frontFootBone.rotation.z = frontRun * 0.35;

        this.backThighBone.rotation.z = backRun * 0.82;
        this.backShinBone.rotation.z = backRun < 0 ? -Math.abs(backRun) * 1.35 : -0.1;
        this.backFootBone.rotation.z = backRun * 0.35;

        // Left arm has full natural running pump (centered at his side)
        this.backArmBone.rotation.z = -1.18 + frontRun * 0.65;
        this.backForearmBone.rotation.z = 0.65;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -1.15 + backRun * 0.45;
          this.frontForearmBone.rotation.z = 0.55;
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
        this.idleTimer = 0;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        this.torsoBone.rotation.z = -0.06;
        this.headBone.rotation.z = 0.12;
        this.jetpackBone.rotation.z = 0;

        this.frontThighBone.rotation.z = 0.55;
        this.frontShinBone.rotation.z = -0.85;
        this.frontFootBone.rotation.z = 0.25;

        this.backThighBone.rotation.z = 0.45;
        this.backShinBone.rotation.z = -0.75;
        this.backFootBone.rotation.z = 0.25;

        // Left arm dynamic stabilization (by side)
        this.backArmBone.rotation.z = -1.30;
        this.backForearmBone.rotation.z = 0.28;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -1.25;
          this.frontForearmBone.rotation.z = 0.30;
        }
        break;
      }

      case PlayerState.FALL: {
        this.idleTimer = 0;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        this.torsoBone.rotation.z = 0.05;
        this.headBone.rotation.z = -0.06;
        this.jetpackBone.rotation.z = 0;

        this.frontThighBone.rotation.z = 0.12;
        this.frontShinBone.rotation.z = -0.25;
        this.frontFootBone.rotation.z = -0.25;

        this.backThighBone.rotation.z = -0.08;
        this.backShinBone.rotation.z = -0.25;
        this.backFootBone.rotation.z = -0.25;

        // Left arm dynamic stabilization (by side)
        this.backArmBone.rotation.z = -1.30;
        this.backForearmBone.rotation.z = 0.28;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -1.25;
          this.frontForearmBone.rotation.z = 0.30;
        }
        break;
      }

      // ----------------------------------------------------
      // E. JETPACK FLIGHT POSE (Flames shoot safely clear of legs)
      // ----------------------------------------------------
      case PlayerState.JETPACK: {
        this.idleTimer = 0;
        this.headBone.rotation.y = 0;
        this.torsoBone.rotation.y = 0;
        const forwardLean = -0.16 - (this.velocity.x / 11.0) * 0.18;
        this.torsoBone.rotation.z = THREE.MathUtils.lerp(
          this.torsoBone.rotation.z,
          forwardLean,
          dt * 12
        );
        this.torsoBone.position.set(0, 0.1, 0);

        this.hipBone.position.set(0, 1.05, 0);
        this.headBone.rotation.z = 0.24;
        this.jetpackBone.rotation.z = 0.14;

        const windFlutter = Math.sin(t * 14.0) * 0.05;
        this.frontThighBone.rotation.z = 0.34 + windFlutter;
        this.frontShinBone.rotation.z = -0.68;
        this.frontFootBone.rotation.z = 0.22;

        this.backThighBone.rotation.z = 0.44 - windFlutter;
        this.backShinBone.rotation.z = -0.78;
        this.backFootBone.rotation.z = 0.22;

        // Left arm flight stabilization (by side)
        this.backArmBone.rotation.z = -1.35;
        this.backForearmBone.rotation.z = 0.35;

        if (!hasMouseTarget && this.shootTimer <= 0) {
          this.frontArmBone.rotation.z = -1.25;
          this.frontForearmBone.rotation.z = 0.35;
        }
        break;
      }
    }

    // ------------------------------------------------------
    // PROCEDURAL LANDING SUSPENSION & KNEE FLEXION KINEMATICS
    // ------------------------------------------------------
    if (this.landingSuspension > 0.001) {
      this.landingSuspension = THREE.MathUtils.damp(this.landingSuspension, 0, 10.0, dt);
      const crouch = this.landingSuspension;
      // Dynamic pelvis dip
      this.hipBone.position.y -= crouch * 0.22;
      // Inverse kinematic knee shock absorption:
      this.frontThighBone.rotation.z += crouch * 0.52;
      this.frontShinBone.rotation.z -= crouch * 1.05;
      this.frontFootBone.rotation.z += crouch * 0.53;

      this.backThighBone.rotation.z += crouch * 0.52;
      this.backShinBone.rotation.z -= crouch * 1.05;
      this.backFootBone.rotation.z += crouch * 0.53;
    }

    // ------------------------------------------------------
    // F. RIGHT SHOOTING ARM ARC CLAMP & NATURAL ELBOW FLEXION
    // ------------------------------------------------------
    if (hasMouseTarget || this.shootTimer > 0) {
      let localAngle = this.currentAimAngle;
      if (!this.facingRight) {
        localAngle = Math.PI - localAngle;
      }
      localAngle = THREE.MathUtils.euclideanModulo(localAngle + Math.PI, Math.PI * 2) - Math.PI;

      // Safe forward arc limit: rotated slightly less up (~45° to stay comfortably clear of helmet), generous downward (~-72°)
      const maxUpwardAngle = Math.PI * 0.25;
      const maxDownwardAngle = -Math.PI * 0.40;
      const clampedLocal = THREE.MathUtils.clamp(localAngle, maxDownwardAngle, maxUpwardAngle);

      // Adjust for torso lean
      const aimRotation = clampedLocal - this.torsoBone.rotation.z;

      // Natural human elbow flexion:
      // When arm goes lower by the side of the player (negative aimRotation), increase elbow bend significantly!
      const downwardness = Math.max(0, -aimRotation) / (Math.PI * 0.40); // 0 to 1 as arm lowers
      const dynamicElbowFlex = 0.18 + downwardness * 0.68; // Bends up to 0.86 rad (~50 deg elbow bend)
      this.frontArmBone.rotation.z = THREE.MathUtils.lerp(
        this.frontArmBone.rotation.z,
        aimRotation - dynamicElbowFlex * 0.42,
        dt * 28
      );
      this.frontForearmBone.rotation.z = THREE.MathUtils.lerp(
        this.frontForearmBone.rotation.z,
        dynamicElbowFlex,
        dt * 28
      );
    }

    // Recoil Kickback Shock on firing
    if (this.shootTimer > 0) {
      this.shootTimer -= dt;
      const progress = 1.0 - this.shootTimer / 0.28;

      if (progress < 0.25) {
        const kick = Math.sin((progress / 0.25) * Math.PI);
        this.blasterMesh.position.x = -kick * 0.08;
        this.frontArmBone.rotation.z += 0.06 * kick;
      } else {
        const returnProg = (progress - 0.25) / 0.75;
        this.blasterMesh.position.x = THREE.MathUtils.lerp(-0.04, 0.0, returnProg);
      }
    } else {
      this.blasterMesh.position.x = 0;
    }

    // ------------------------------------------------------
    // G. PHYSICAL RAGDOLL HIT REACTION & DRAMATIC DEATH ANIMATION
    // ------------------------------------------------------
    if (!this.isDying) {
      this.rigRoot.rotation.z = 0; // Rig root stays firmly upright during normal gameplay
      this.rigRoot.position.set(0, 0, 0);

      // Crushing mechanical press squash & stretch
      if (this.crushSquashTimer > 0) {
        this.crushSquashTimer -= dt;
        const crushT = this.crushSquashTimer / 0.35;
        const squashY = 1.0 - Math.sin(crushT * Math.PI) * 0.32;
        const stretchX = 1.0 + Math.sin(crushT * Math.PI) * 0.22;
        this.rigRoot.scale.set(stretchX, squashY, stretchX);
      } else {
        this.rigRoot.scale.set(1, 1, 1);
      }

      if (this.ragdollTimer > 0) {
        this.ragdollTimer -= dt;
        const prog = this.ragdollTimer / 0.45;

        // Head snaps back with neck-whip
        this.headBone.rotation.z = -0.55 * prog;

        // Torso recoils and twists naturally from center
        this.torsoBone.rotation.z += (this.ragdollImpulseX > 0 ? -0.45 : 0.45) * prog;

        // Arms fling outwards erratically
        this.frontArmBone.rotation.z += -0.75 * prog;
        this.frontForearmBone.rotation.z += 0.50 * prog;
        this.backArmBone.rotation.z += 0.85 * prog;

        // Legs kick and buckle
        this.frontThighBone.rotation.z += 0.65 * prog;
        this.frontShinBone.rotation.z -= 0.55 * prog;
        this.backThighBone.rotation.z += -0.45 * prog;
      }
    }
  }

  private updateBeltLEDs(dt: number) {
    if (this.beltLedMaterials.length < 4) return;
    const time = this.animTimer;

    // 0: Pulsing Cyan Plasma LED (high-tech sensor scan)
    const cyanOn = Math.sin(time * 14.0) > 0.0;
    this.beltLedMaterials[0].color.setHex(cyanOn ? 0x00f5ff : 0x002233);

    // 1: Heartbeat Emerald Green LED (life support / fuel pressure)
    const greenPulse = Math.sin(time * 7.5) > 0.2;
    this.beltLedMaterials[1].color.setHex(greenPulse ? 0x39ff14 : 0x073303);

    // 2: Double-strobe Amber LED (shield battery status)
    const amberBlink = (Math.sin(time * 18.0) + Math.sin(time * 9.0)) > 0.35;
    this.beltLedMaterials[2].color.setHex(amberBlink ? 0xffaa00 : 0x331a00);

    // 3: Alternating Crimson LED (hazard proximity tracker)
    const redAlert = Math.sin(time * 11.0 + Math.PI * 0.5) > 0.15;
    this.beltLedMaterials[3].color.setHex(redAlert ? 0xff1144 : 0x330008);
  }

  private updateHelmetLEDs(dt: number) {
    const time = this.animTimer;

    for (let p = 0; p < 2; p++) {
      const offset = p * 3;
      const redOn = (Math.sin(time * 16.0 + p) + Math.sin(time * 24.0)) > 0.3;
      this.helmetLedMaterials[offset + 0].color.setHex(redOn ? 0xff1133 : 0x440008);

      const cyanGlow = Math.sin(time * 8.0 + p * 0.5) > -0.1;
      this.helmetLedMaterials[offset + 1].color.setHex(cyanGlow ? 0x00f5ff : 0x002233);

      const amberOn = Math.sin(time * 11.0 + p * 1.5) > 0.2;
      this.helmetLedMaterials[offset + 2].color.setHex(amberOn ? 0xffaa00 : 0x331800);
    }

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

    const fuelRatio = this.fuel / this.maxFuel;
    this.fuelGaugeNeedle.rotation.x = (fuelRatio - 0.5) * 2.2;

    // Animate Hyper-Ion Quantum Jetpack features
    if (this.hasHyperJetpack && this.hyperCoreDisc) {
      this.hyperCoreDisc.rotation.x += 18.0 * dt;
      const wingtipScale = 1.0 + Math.sin(time * 12.0) * 0.25;
      this.hyperWingtipLeft.scale.set(wingtipScale, wingtipScale, wingtipScale);
      this.hyperWingtipRight.scale.set(wingtipScale, wingtipScale, wingtipScale);
    }

    // 2. JETPACK FLAMES: BIGGER BLUE FLAME for Retro Upgrade, RED/ORANGE for Default!
    if (isJetpacking && !this.isDying) {
      this.flameConeLeft.visible = true;
      this.flameConeRight.visible = true;

      if (this.hasHyperJetpack) {
        // BIGGER BLUE FLAME
        this.flameAuraMatLeft.color.setHex(0x0044ff);
        this.flameAuraMatRight.color.setHex(0x0044ff);
        (this.flameOuterLeft.material as THREE.MeshBasicMaterial).color.setHex(0x00aaff);
        (this.flameOuterRight.material as THREE.MeshBasicMaterial).color.setHex(0x00aaff);
        this.flameMidMatLeft.color.setHex(0x00f5ff);
        this.flameMidMatRight.color.setHex(0x00f5ff);
        (this.flameCoreLeft.material as THREE.MeshBasicMaterial).color.setHex(0xf0ffff);
        (this.flameCoreRight.material as THREE.MeshBasicMaterial).color.setHex(0xf0ffff);

        this.thrusterLight.color.setHex(0x00c8ff);
        this.thrusterLight.intensity = 55 + Math.sin(time * 24.0) * 8;
        this.thrusterLight.distance = 32;

        const scaleBoost = 1.85; // Much bigger flame!
        const flick = (1.0 + Math.sin(time * 30.0) * 0.16 + Math.cos(time * 44.0) * 0.12) * scaleBoost;
        const coreFlick = (1.0 + Math.sin(time * 36.0) * 0.18 + Math.random() * 0.12) * scaleBoost;

        this.flameOuterLeft.scale.set(1.15 + Math.sin(time * 16.0) * 0.10, flick * 1.15, 1.15);
        this.flameOuterRight.scale.copy(this.flameOuterLeft.scale);

        this.flameCoreLeft.scale.set(1.1, coreFlick * 1.12, 1.1);
        this.flameCoreRight.scale.copy(this.flameCoreLeft.scale);

        // Emits MORE smoke for retro upgrade (3 puffs per tick!)
        this.emitSmoke(nozzleX, nozzleY, nozzleZ, 3);
        this.emitSparks(nozzleX, nozzleY, nozzleZ, 8);
      } else {
        // DEFAULT RED & ORANGE ROUNDED FLAMES
        this.flameAuraMatLeft.color.setHex(0xff1a00);
        this.flameAuraMatRight.color.setHex(0xff1a00);
        (this.flameOuterLeft.material as THREE.MeshBasicMaterial).color.setHex(0xff6600);
        (this.flameOuterRight.material as THREE.MeshBasicMaterial).color.setHex(0xff6600);
        this.flameMidMatLeft.color.setHex(0xffaa00);
        this.flameMidMatRight.color.setHex(0xffaa00);
        (this.flameCoreLeft.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
        (this.flameCoreRight.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);

        this.thrusterLight.color.setHex(0xff5500);
        this.thrusterLight.intensity = 28 + Math.sin(time * 24.0) * 6;
        this.thrusterLight.distance = 22;

        const scaleBoost = 1.0;
        const flick = (1.0 + Math.sin(time * 30.0) * 0.16 + Math.cos(time * 44.0) * 0.12) * scaleBoost;
        const coreFlick = (1.0 + Math.sin(time * 36.0) * 0.18 + Math.random() * 0.12) * scaleBoost;

        this.flameOuterLeft.scale.set(1.0 + Math.sin(time * 16.0) * 0.08, flick * 1.10, 1.0);
        this.flameOuterRight.scale.copy(this.flameOuterLeft.scale);

        this.flameCoreLeft.scale.set(1.0, coreFlick * 1.05, 1.0);
        this.flameCoreRight.scale.copy(this.flameCoreLeft.scale);

        this.emitSmoke(nozzleX, nozzleY, nozzleZ, 1);
        this.emitSparks(nozzleX, nozzleY, nozzleZ, 4);
      }
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
        const popProg = (prog - 0.45) / 0.55;
        (this.bubbleSphereMesh.material as THREE.MeshBasicMaterial).opacity = 0;

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

  public emitSparks(x: number, y: number, z: number = 0, count: number = 6) {
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
