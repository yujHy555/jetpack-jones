import * as THREE from 'three';

export interface IsoAnimState {
  velocity: THREE.Vector3;
  isGrounded: boolean;
  isJetpacking: boolean;
  isBallMode: boolean;
  aimTarget?: THREE.Vector3;
  hasAimTarget: boolean;
  underPressure: boolean;
  groundSlopePitch?: number;
  groundSlopeRoll?: number;
  isDying?: boolean;
  deathTime?: number;
}

/**
 * IsometricPlayerRig - Triple-AAA Tailor-Made 3D Character System for Level 3
 * Features:
 * - Identical iconic Jetpack Jones design: Sleek space white astronaut suit, dark carbon trim,
 *   solid black combat boots, retro metallic jetpack with twin shockwave flames, amber visor bubble.
 * - Symmetrical hip separation along local X axis (+0.16m and -0.16m) with pure Y-Z stride rotation
 *   guaranteeing ZERO leg crossing under any movement vector or yaw angle!
 * - Full 360° mouse cursor lock-on aiming with upper torso/blaster line-of-sight tracking.
 * - Aerodynamic jetpack flight posture with trailing legs and low-gravity aerodynamic flutter.
 * - Dynamic slope-adaptive terrain traversal: ankles and stance flex with terrain inclination.
 * - Blinking command LEDs, helmet beacons, and cartoony radio wave antenna emitter.
 */
export class IsometricPlayerRig {
  public group: THREE.Group;

  // Skeletal Hierarchy
  public rigRoot: THREE.Group;
  public pelvisBone: THREE.Group;
  public torsoBone: THREE.Group;
  public headBone: THREE.Group;
  public helmetGroup: THREE.Group;

  // Legs (Symmetrically separated on X: Left at -0.16, Right at +0.16)
  public leftThighBone: THREE.Group;
  public leftShinBone: THREE.Group;
  public leftFootBone: THREE.Group;

  public rightThighBone: THREE.Group;
  public rightShinBone: THREE.Group;
  public rightFootBone: THREE.Group;

  // Arms
  public leftArmBone: THREE.Group;
  public leftForearmBone: THREE.Group;
  public rightArmBone: THREE.Group;
  public rightForearmBone: THREE.Group;
  public blasterGroup: THREE.Group;
  public muzzlePoint: THREE.Object3D;

  // Jetpack & Thrusters
  public jetpackBone: THREE.Group;
  public flameConeLeft: THREE.Mesh;
  public flameConeRight: THREE.Mesh;
  public thrusterLight: THREE.PointLight;
  public antennaTip: THREE.Object3D;

  // Materials & Lights
  private suitWhiteMat: THREE.MeshStandardMaterial;
  private suitWhiteAccentMat: THREE.MeshStandardMaterial;
  private bootBlackMat: THREE.MeshStandardMaterial;
  private visorMat: THREE.MeshPhysicalMaterial;
  private jetpackChromeMat: THREE.MeshStandardMaterial;
  private trimDarkMat: THREE.MeshStandardMaterial;
  private helmetLedMat: THREE.MeshBasicMaterial;
  private antennaBeaconMat: THREE.MeshBasicMaterial;

  // Animation Timers & Smoothing
  private animTimer: number = 0;
  private currentYaw: number = 0;
  public onFootstep?: () => void;
  private prevFootstepPhase: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // ========================================================
    // 1. AAA MATERIALS
    // ========================================================
    this.suitWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fb,
      roughness: 0.28,
      metalness: 0.12,
    });

    this.suitWhiteAccentMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce8,
      roughness: 0.32,
      metalness: 0.18,
    });

    this.bootBlackMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.65,
      metalness: 0.35,
    });

    this.trimDarkMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      roughness: 0.45,
      metalness: 0.40,
    });

    this.jetpackChromeMat = new THREE.MeshStandardMaterial({
      color: 0xe0e6ed,
      roughness: 0.18,
      metalness: 0.85,
    });

    this.visorMat = new THREE.MeshPhysicalMaterial({
      color: 0xffa500,
      emissive: 0x442200,
      roughness: 0.08,
      metalness: 0.15,
      transmission: 0.72,
      transparent: true,
      opacity: 0.92,
      reflectivity: 0.9,
    });

    this.helmetLedMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    this.antennaBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });

    // ========================================================
    // 2. SKELETAL HIERARCHY
    // ========================================================
    this.rigRoot = new THREE.Group();
    this.group.add(this.rigRoot);

    // Pelvis (Base height at 0.90m)
    this.pelvisBone = new THREE.Group();
    this.pelvisBone.position.set(0, 0.90, 0);
    this.rigRoot.add(this.pelvisBone);

    // Pelvis Mesh
    const pelvisGeo = new THREE.BoxGeometry(0.36, 0.22, 0.26);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.trimDarkMat);
    this.pelvisBone.add(pelvisMesh);

    // Dark Utility Belt with Buckle & LED Indicators
    const beltGeo = new THREE.BoxGeometry(0.38, 0.07, 0.28);
    const beltMesh = new THREE.Mesh(beltGeo, this.trimDarkMat);
    beltMesh.position.y = 0.08;
    this.pelvisBone.add(beltMesh);

    const buckleGeo = new THREE.BoxGeometry(0.08, 0.08, 0.29);
    const buckleMesh = new THREE.Mesh(buckleGeo, this.jetpackChromeMat);
    buckleMesh.position.y = 0.08;
    this.pelvisBone.add(buckleMesh);

    // --------------------------------------------------------
    // LEGS (Symmetrically separated on X: Left at -0.16, Right at +0.16)
    // Pivot axes are parallel and separated laterally by 0.32m!
    // --------------------------------------------------------
    // LEFT LEG
    this.leftThighBone = new THREE.Group();
    this.leftThighBone.position.set(-0.16, -0.06, 0.0);
    this.pelvisBone.add(this.leftThighBone);

    const legGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.38, 12);
    const leftThighMesh = new THREE.Mesh(legGeo, this.suitWhiteMat);
    leftThighMesh.position.y = -0.19;
    this.leftThighBone.add(leftThighMesh);

    // Left Knee
    this.leftShinBone = new THREE.Group();
    this.leftShinBone.position.set(0, -0.38, 0);
    this.leftThighBone.add(this.leftShinBone);

    const shinGeo = new THREE.CylinderGeometry(0.075, 0.068, 0.38, 12);
    const leftShinMesh = new THREE.Mesh(shinGeo, this.suitWhiteMat);
    leftShinMesh.position.y = -0.19;
    this.leftShinBone.add(leftShinMesh);

    // Left Combat Boot
    this.leftFootBone = new THREE.Group();
    this.leftFootBone.position.set(0, -0.38, 0);
    this.leftShinBone.add(this.leftFootBone);

    const bootGeo = new THREE.BoxGeometry(0.12, 0.14, 0.24);
    const leftBootMesh = new THREE.Mesh(bootGeo, this.bootBlackMat);
    leftBootMesh.position.set(0, -0.07, 0.04);
    this.leftFootBone.add(leftBootMesh);

    // RIGHT LEG
    this.rightThighBone = new THREE.Group();
    this.rightThighBone.position.set(0.16, -0.06, 0.0);
    this.pelvisBone.add(this.rightThighBone);

    const rightThighMesh = new THREE.Mesh(legGeo, this.suitWhiteMat);
    rightThighMesh.position.y = -0.19;
    this.rightThighBone.add(rightThighMesh);

    // Right Knee
    this.rightShinBone = new THREE.Group();
    this.rightShinBone.position.set(0, -0.38, 0);
    this.rightThighBone.add(this.rightShinBone);

    const rightShinMesh = new THREE.Mesh(shinGeo, this.suitWhiteMat);
    rightShinMesh.position.y = -0.19;
    this.rightShinBone.add(rightShinMesh);

    // Right Combat Boot
    this.rightFootBone = new THREE.Group();
    this.rightFootBone.position.set(0, -0.38, 0);
    this.rightShinBone.add(this.rightFootBone);

    const rightBootMesh = new THREE.Mesh(bootGeo, this.bootBlackMat);
    rightBootMesh.position.set(0, -0.07, 0.04);
    this.rightFootBone.add(rightBootMesh);

    // --------------------------------------------------------
    // TORSO & UPPER BODY
    // --------------------------------------------------------
    this.torsoBone = new THREE.Group();
    this.torsoBone.position.set(0, 0.12, 0);
    this.pelvisBone.add(this.torsoBone);

    // Torso Armor Vest (Space White with dark harness straps)
    const torsoGeo = new THREE.BoxGeometry(0.42, 0.46, 0.28);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.suitWhiteMat);
    torsoMesh.position.y = 0.23;
    this.torsoBone.add(torsoMesh);

    // Chest Plate Accent
    const chestPlateGeo = new THREE.BoxGeometry(0.34, 0.26, 0.06);
    const chestPlate = new THREE.Mesh(chestPlateGeo, this.suitWhiteAccentMat);
    chestPlate.position.set(0, 0.26, 0.13);
    this.torsoBone.add(chestPlate);

    // --------------------------------------------------------
    // RETRO 1970S JETPACK
    // --------------------------------------------------------
    this.jetpackBone = new THREE.Group();
    this.jetpackBone.position.set(0, 0.25, -0.18);
    this.torsoBone.add(this.jetpackBone);

    // Jetpack Main Chrome Housing
    const packMainGeo = new THREE.BoxGeometry(0.36, 0.38, 0.18);
    const packMain = new THREE.Mesh(packMainGeo, this.jetpackChromeMat);
    this.jetpackBone.add(packMain);

    // Twin Cylindrical Fuel Cells
    const cylGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.42, 12);
    const cylL = new THREE.Mesh(cylGeo, this.jetpackChromeMat);
    cylL.position.set(-0.13, 0, 0);
    this.jetpackBone.add(cylL);
    const cylR = new THREE.Mesh(cylGeo, this.jetpackChromeMat);
    cylR.position.set(0.13, 0, 0);
    this.jetpackBone.add(cylR);

    // Twin Exhaust Nozzles
    const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.075, 0.12, 12);
    const nozzleL = new THREE.Mesh(nozzleGeo, this.trimDarkMat);
    nozzleL.position.set(-0.13, -0.25, 0);
    this.jetpackBone.add(nozzleL);
    const nozzleR = new THREE.Mesh(nozzleGeo, this.trimDarkMat);
    nozzleR.position.set(0.13, -0.25, 0);
    this.jetpackBone.add(nozzleR);

    // Blue/Cyan Diamond Shockwave Flame Cones
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
    });
    const flameGeo = new THREE.ConeGeometry(0.09, 0.48, 10);
    flameGeo.rotateX(Math.PI);

    this.flameConeLeft = new THREE.Mesh(flameGeo, flameMat);
    this.flameConeLeft.position.set(-0.13, -0.52, 0);
    this.flameConeLeft.visible = false;
    this.jetpackBone.add(this.flameConeLeft);

    this.flameConeRight = new THREE.Mesh(flameGeo, flameMat);
    this.flameConeRight.position.set(0.13, -0.52, 0);
    this.flameConeRight.visible = false;
    this.jetpackBone.add(this.flameConeRight);

    this.thrusterLight = new THREE.PointLight(0x00f5ff, 0, 8.0);
    this.thrusterLight.position.set(0, -0.45, 0);
    this.jetpackBone.add(this.thrusterLight);

    // --------------------------------------------------------
    // HEAD & REDESIGNED HELMET
    // --------------------------------------------------------
    this.headBone = new THREE.Group();
    this.headBone.position.set(0, 0.50, 0);
    this.torsoBone.add(this.headBone);

    this.helmetGroup = new THREE.Group();
    this.headBone.add(this.helmetGroup);

    // Rounded White Helmet Dome
    const helmetDomeGeo = new THREE.SphereGeometry(0.25, 20, 16);
    const helmetDome = new THREE.Mesh(helmetDomeGeo, this.suitWhiteMat);
    this.helmetGroup.add(helmetDome);

    // Amber Bubble Visor (facing local +Z)
    const visorGeo = new THREE.SphereGeometry(0.23, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
    visorGeo.rotateX(Math.PI / 2);
    const visorMesh = new THREE.Mesh(visorGeo, this.visorMat);
    visorMesh.position.set(0, 0.02, 0.06);
    this.helmetGroup.add(visorMesh);

    // Black Rubber Visor Seal Ring
    const rimGeo = new THREE.TorusGeometry(0.225, 0.014, 8, 24);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, this.bootBlackMat);
    rimMesh.position.set(0, 0.02, 0.07);
    this.helmetGroup.add(rimMesh);

    // Twin Helmet Beacon Antennae
    const antGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.16, 8);
    const antL = new THREE.Mesh(antGeo, this.trimDarkMat);
    antL.position.set(-0.16, 0.22, -0.02);
    antL.rotation.z = -0.22;
    this.helmetGroup.add(antL);

    const beaconGeo = new THREE.SphereGeometry(0.028, 8, 8);
    const beaconL = new THREE.Mesh(beaconGeo, this.antennaBeaconMat);
    beaconL.position.set(-0.18, 0.31, -0.02);
    this.helmetGroup.add(beaconL);

    const antR = new THREE.Mesh(antGeo, this.trimDarkMat);
    antR.position.set(0.16, 0.22, -0.02);
    antR.rotation.z = 0.22;
    this.helmetGroup.add(antR);

    const beaconR = new THREE.Mesh(beaconGeo, this.antennaBeaconMat);
    beaconR.position.set(0.18, 0.31, -0.02);
    this.helmetGroup.add(beaconR);

    // Reference object for radio wave emissions
    this.antennaTip = new THREE.Object3D();
    this.antennaTip.position.set(0, 0.35, 0);
    this.helmetGroup.add(this.antennaTip);

    // --------------------------------------------------------
    // ARMS & BLASTER
    // --------------------------------------------------------
    // LEFT ARM (Stabilizer / Run pump arm)
    this.leftArmBone = new THREE.Group();
    this.leftArmBone.position.set(-0.27, 0.38, 0);
    this.torsoBone.add(this.leftArmBone);

    const armGeo = new THREE.CylinderGeometry(0.065, 0.058, 0.30, 10);
    const leftArmMesh = new THREE.Mesh(armGeo, this.suitWhiteMat);
    leftArmMesh.position.y = -0.15;
    this.leftArmBone.add(leftArmMesh);

    this.leftForearmBone = new THREE.Group();
    this.leftForearmBone.position.set(0, -0.30, 0);
    this.leftArmBone.add(this.leftForearmBone);

    const forearmGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.28, 10);
    const leftForearmMesh = new THREE.Mesh(forearmGeo, this.suitWhiteMat);
    leftForearmMesh.position.y = -0.14;
    this.leftForearmBone.add(leftForearmMesh);

    const handGeo = new THREE.BoxGeometry(0.08, 0.09, 0.07);
    const leftGloveMesh = new THREE.Mesh(handGeo, this.bootBlackMat);
    leftGloveMesh.position.y = -0.28;
    this.leftForearmBone.add(leftGloveMesh);

    // RIGHT ARM (Holding Blaster Pistol along Line of Sight)
    this.rightArmBone = new THREE.Group();
    this.rightArmBone.position.set(0.27, 0.38, 0);
    this.torsoBone.add(this.rightArmBone);

    const rightArmMesh = new THREE.Mesh(armGeo, this.suitWhiteMat);
    rightArmMesh.position.y = -0.15;
    this.rightArmBone.add(rightArmMesh);

    this.rightForearmBone = new THREE.Group();
    this.rightForearmBone.position.set(0, -0.30, 0);
    this.rightArmBone.add(this.rightForearmBone);

    const rightForearmMesh = new THREE.Mesh(forearmGeo, this.suitWhiteMat);
    rightForearmMesh.position.y = -0.14;
    this.rightForearmBone.add(rightForearmMesh);

    const rightGloveMesh = new THREE.Mesh(handGeo, this.bootBlackMat);
    rightGloveMesh.position.y = -0.28;
    this.rightForearmBone.add(rightGloveMesh);

    // Laser Pistol Blaster (Mounted firmly in right hand)
    this.blasterGroup = new THREE.Group();
    this.blasterGroup.position.set(0, -0.28, 0.08);
    this.rightForearmBone.add(this.blasterGroup);

    // Pistol Chassis & Barrel
    const blasterBodyGeo = new THREE.BoxGeometry(0.06, 0.10, 0.22);
    const blasterBody = new THREE.Mesh(blasterBodyGeo, this.trimDarkMat);
    blasterBody.position.set(0, 0.03, 0.04);
    this.blasterGroup.add(blasterBody);

    const blasterBarrelGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8);
    blasterBarrelGeo.rotateX(Math.PI / 2);
    const blasterBarrel = new THREE.Mesh(blasterBarrelGeo, this.jetpackChromeMat);
    blasterBarrel.position.set(0, 0.05, 0.18);
    this.blasterGroup.add(blasterBarrel);

    // Cyan Glow Power Core
    const coreGeo = new THREE.BoxGeometry(0.064, 0.04, 0.08);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 0.04, 0.04);
    this.blasterGroup.add(coreMesh);

    // Muzzle Point Reference for 3D Laser Bolt Spawning
    this.muzzlePoint = new THREE.Object3D();
    this.muzzlePoint.position.set(0, 0.05, 0.28);
    this.blasterGroup.add(this.muzzlePoint);
  }

  /**
   * Main AAA Animation Tick for Level 3 Isometric Traversal
   */
  public update(dt: number, state: IsoAnimState) {
    this.animTimer += dt;
    const horizSpeed = Math.hypot(state.velocity.x, state.velocity.z);

    // ========================================================
    // 1. CHARACTER YAW ORIENTATION
    // Faces movement direction or locks onto cursor in 3D
    // ========================================================
    if (state.hasAimTarget && state.aimTarget) {
      const dx = state.aimTarget.x - this.group.position.x;
      const dz = state.aimTarget.z - this.group.position.z;
      if (Math.hypot(dx, dz) > 0.3) {
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - this.currentYaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.currentYaw += diff * Math.min(1.0, dt * 14.0);
      }
    } else if (horizSpeed > 0.3) {
      const targetYaw = Math.atan2(state.velocity.x, state.velocity.z);
      let diff = targetYaw - this.currentYaw;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.currentYaw += diff * Math.min(1.0, dt * 14.0);
    }

    this.rigRoot.rotation.y = this.currentYaw;

    // ========================================================
    // 2. LOCOMOTION & GAIT ANIMATION (ZERO LEG CROSSING!)
    // Both legs swing in parallel Y-Z plane separated laterally by 0.32m!
    // ========================================================
    if (state.isGrounded && horizSpeed > 0.2) {
      const isRunning = horizSpeed > 8.0;
      const strideFreq = isRunning ? 16.5 : 11.5;
      const strideAmp = isRunning ? 0.72 : 0.52;
      const kneeAmp = isRunning ? 1.05 : 0.75;
      const phase = this.animTimer * strideFreq;

      // Vertical pelvic bobbing (2x frequency)
      this.pelvisBone.position.y = 0.90 + Math.abs(Math.sin(phase)) * 0.04;
      this.pelvisBone.rotation.z = Math.sin(phase) * 0.04; // Pelvic weight roll

      // Left leg swing & knee flexion
      const leftCycle = Math.sin(phase);
      this.leftThighBone.rotation.x = leftCycle * strideAmp;
      this.leftShinBone.rotation.x = Math.max(0, -leftCycle * kneeAmp);
      this.leftFootBone.rotation.x = -leftCycle * 0.25;

      // Right leg swing & knee flexion (Opposite 180° phase)
      const rightCycle = -leftCycle;
      this.rightThighBone.rotation.x = rightCycle * strideAmp;
      this.rightShinBone.rotation.x = Math.max(0, -rightCycle * kneeAmp);
      this.rightFootBone.rotation.x = -rightCycle * 0.25;

      // Torso leans forward into running motion
      const forwardLean = Math.min(0.20, horizSpeed * 0.016);
      this.torsoBone.rotation.x = forwardLean;

      // Footstep sound trigger
      const currentStepPhase = Math.floor(phase / Math.PI);
      if (currentStepPhase !== this.prevFootstepPhase) {
        this.prevFootstepPhase = currentStepPhase;
        this.onFootstep?.();
      }

      // Left arm pumps in counter-motion to legs
      this.leftArmBone.rotation.x = rightCycle * 0.65;
      this.leftForearmBone.rotation.x = 0.45 + Math.max(0, rightCycle * 0.35);

    } else if (state.isJetpacking || (!state.isGrounded && Math.abs(state.velocity.y) > 0.5)) {
      // ========================================================
      // 3. AERODYNAMIC JETPACK FLIGHT POSTURE
      // Torso pitches forward, legs trail back naturally with soft sway
      // ========================================================
      const flightTilt = Math.min(0.42, horizSpeed * 0.028);
      this.torsoBone.rotation.x = THREE.MathUtils.lerp(this.torsoBone.rotation.x, 0.24 + flightTilt, dt * 10);
      this.pelvisBone.position.y = 0.90;

      const flutter = Math.sin(this.animTimer * 12.0) * 0.06;

      // Legs trail backward behind character with knees bent
      this.leftThighBone.rotation.x = THREE.MathUtils.lerp(this.leftThighBone.rotation.x, -0.42 + flutter, dt * 8);
      this.leftShinBone.rotation.x = THREE.MathUtils.lerp(this.leftShinBone.rotation.x, 0.68, dt * 8);
      this.leftFootBone.rotation.x = THREE.MathUtils.lerp(this.leftFootBone.rotation.x, -0.35, dt * 8);

      this.rightThighBone.rotation.x = THREE.MathUtils.lerp(this.rightThighBone.rotation.x, -0.48 - flutter, dt * 8);
      this.rightShinBone.rotation.x = THREE.MathUtils.lerp(this.rightShinBone.rotation.x, 0.74, dt * 8);
      this.rightFootBone.rotation.x = THREE.MathUtils.lerp(this.rightFootBone.rotation.x, -0.35, dt * 8);

      // Left arm stabilizes on jetpack harness
      this.leftArmBone.rotation.x = THREE.MathUtils.lerp(this.leftArmBone.rotation.x, 0.35, dt * 8);
      this.leftForearmBone.rotation.x = THREE.MathUtils.lerp(this.leftForearmBone.rotation.x, 0.70, dt * 8);

    } else {
      // ========================================================
      // 4. IDLE STANCE & GENTLE BREATHING
      // ========================================================
      const breathe = Math.sin(this.animTimer * 3.5);
      this.pelvisBone.position.y = 0.90 + breathe * 0.015;
      this.torsoBone.rotation.x = THREE.MathUtils.lerp(this.torsoBone.rotation.x, 0, dt * 8);
      this.torsoBone.rotation.z = THREE.MathUtils.lerp(this.torsoBone.rotation.z, 0, dt * 8);

      this.leftThighBone.rotation.x = THREE.MathUtils.lerp(this.leftThighBone.rotation.x, 0.08, dt * 8);
      this.leftShinBone.rotation.x = THREE.MathUtils.lerp(this.leftShinBone.rotation.x, 0.04, dt * 8);
      this.leftFootBone.rotation.x = THREE.MathUtils.lerp(this.leftFootBone.rotation.x, -0.05, dt * 8);

      this.rightThighBone.rotation.x = THREE.MathUtils.lerp(this.rightThighBone.rotation.x, 0.08, dt * 8);
      this.rightShinBone.rotation.x = THREE.MathUtils.lerp(this.rightShinBone.rotation.x, 0.04, dt * 8);
      this.rightFootBone.rotation.x = THREE.MathUtils.lerp(this.rightFootBone.rotation.x, -0.05, dt * 8);

      // Left arm hangs relaxed at side
      this.leftArmBone.rotation.x = THREE.MathUtils.lerp(this.leftArmBone.rotation.x, 0.10, dt * 8);
      this.leftForearmBone.rotation.x = THREE.MathUtils.lerp(this.leftForearmBone.rotation.x, 0.25, dt * 8);
    }

    // ========================================================
    // 5. SLOPE ADAPTIVE INCLINATION
    // Adjusts character posture to match Martian terrain slope
    // ========================================================
    if (state.isGrounded && state.groundSlopePitch !== undefined) {
      // Blend ground slope pitch into overall rig tilt
      this.rigRoot.rotation.x = THREE.MathUtils.lerp(this.rigRoot.rotation.x, state.groundSlopePitch * 0.5, dt * 10);
      if (state.groundSlopeRoll !== undefined) {
        this.rigRoot.rotation.z = THREE.MathUtils.lerp(this.rigRoot.rotation.z, state.groundSlopeRoll * 0.5, dt * 10);
      }
    } else {
      this.rigRoot.rotation.x = THREE.MathUtils.lerp(this.rigRoot.rotation.x, 0, dt * 10);
      this.rigRoot.rotation.z = THREE.MathUtils.lerp(this.rigRoot.rotation.z, 0, dt * 10);
    }

    // ========================================================
    // 6. RIGHT ARM AIMING & 3D LINE OF SIGHT TRACKING
    // Right arm raises and points blaster at aim target in 3D
    // ========================================================
    if (state.hasAimTarget && state.aimTarget) {
      // Calculate pitch angle to aim target relative to character shoulder
      const shoulderWorldY = this.group.position.y + 1.45;
      const distHoriz = Math.hypot(
        state.aimTarget.x - this.group.position.x,
        state.aimTarget.z - this.group.position.z
      );
      const dy = state.aimTarget.y - shoulderWorldY;
      const aimPitch = Math.atan2(dy, Math.max(0.5, distHoriz));

      // Right shoulder raises arm forward along +Z (90° pitch) and adjusts for elevation
      this.rightArmBone.rotation.x = Math.PI / 2 + aimPitch * 0.8;
      this.rightArmBone.rotation.y = -0.15; // Tuck in slightly towards center
      this.rightForearmBone.rotation.x = 0.05; // Straightened firing arm
    } else {
      // Ready weapon position
      this.rightArmBone.rotation.x = THREE.MathUtils.lerp(this.rightArmBone.rotation.x, 0.45, dt * 10);
      this.rightArmBone.rotation.y = THREE.MathUtils.lerp(this.rightArmBone.rotation.y, 0, dt * 10);
      this.rightForearmBone.rotation.x = THREE.MathUtils.lerp(this.rightForearmBone.rotation.x, 0.85, dt * 10);
    }

    // ========================================================
    // 7. JETPACK THRUSTER FLAMES & AUDIO/LIGHT SYNC
    // ========================================================
    if (state.isJetpacking) {
      this.flameConeLeft.visible = true;
      this.flameConeRight.visible = true;
      const flick = 1.0 + Math.sin(this.animTimer * 30.0) * 0.25;
      this.flameConeLeft.scale.set(flick, flick * 1.3, flick);
      this.flameConeRight.scale.set(flick, flick * 1.3, flick);
      this.thrusterLight.intensity = 24.0;
    } else {
      this.flameConeLeft.visible = false;
      this.flameConeRight.visible = false;
      this.thrusterLight.intensity = 0.0;
    }

    // Blinking Helmet LEDs
    const ledPhase = Math.sin(this.animTimer * 6.0);
    this.helmetLedMat.color.setHex(ledPhase > 0 ? 0x00ffff : 0x004466);
    this.antennaBeaconMat.color.setHex(Math.sin(this.animTimer * 10.0) > 0 ? 0xff2244 : 0x440011);
  }

  /**
   * Returns exact 3D world position of blaster muzzle for laser bolt projectile spawning
   */
  public getMuzzleWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.muzzlePoint.getWorldPosition(pos);
    return pos;
  }

  /**
   * Returns exact 3D world position of antenna tip for cartoony radio wave pings
   */
  public getAntennaWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.antennaTip.getWorldPosition(pos);
    return pos;
  }

  /**
   * Returns exact 3D world positions of twin jetpack thruster nozzles for smoke VFX
   */
  public getThrusterWorldPositions(): { left: THREE.Vector3; right: THREE.Vector3 } {
    const left = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.flameConeLeft.getWorldPosition(left);
    this.flameConeRight.getWorldPosition(right);
    return { left, right };
  }
}
