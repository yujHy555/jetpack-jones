import * as THREE from 'three';
import { JetpackSmoke } from './JetpackSmoke';

export interface LaserBolt {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  life: number;
}

export class Player {
  public mesh: THREE.Group;
  public smoke: JetpackSmoke;

  // Physics & State
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(6.5, 0, 0); // Forward auto-flight speed
  public radius: number = 0.55; // Collision radius

  public life: number = 100;
  public maxLife: number = 100;
  public fuel: number = 100;
  public maxFuel: number = 100;
  public invulnerableTime: number = 0;

  // Sub-components for animation
  private bodyGroup: THREE.Group;
  private jetpackNozzlePos: THREE.Vector3 = new THREE.Vector3();
  private leftNozzleMesh!: THREE.Mesh;
  private rightNozzleMesh!: THREE.Mesh;
  private blasterMuzzlePos: THREE.Vector3 = new THREE.Vector3();
  private blasterMesh!: THREE.Group;

  // Projectiles
  public lasers: LaserBolt[] = [];
  private laserGeo: THREE.CylinderGeometry;
  private laserMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.mesh.add(this.bodyGroup);
    scene.add(this.mesh);

    this.smoke = new JetpackSmoke(scene);

    // Build the Action Figure 3D Model
    this.buildActionFigureModel();

    // Laser bolt resources
    this.laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
    this.laserGeo.rotateZ(Math.PI / 2); // Align forward along X
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(this.laserGeo, this.laserMat);
      mesh.visible = false;
      scene.add(mesh);
      this.lasers.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(22, 0, 0),
        active: false,
        life: 0,
      });
    }

    this.reset();
  }

  public reset(startX: number = 0, startY: number = 0) {
    this.position.set(startX, startY, 0);
    this.velocity.set(7.5, 0, 0);
    this.life = 100;
    this.fuel = 100;
    this.invulnerableTime = 0;
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;

    for (const l of this.lasers) {
      l.active = false;
      l.mesh.visible = false;
    }
  }

  /**
   * Procedural Action Figure 3D Construction based on Image 1 & 2
   */
  private buildActionFigureModel() {
    // Shared Materials
    const suitOrange = new THREE.MeshStandardMaterial({
      color: 0xee5505,
      roughness: 0.28,
      metalness: 0.08,
    });

    const creamPlastic = new THREE.MeshStandardMaterial({
      color: 0xf3eee2,
      roughness: 0.35,
      metalness: 0.04,
    });

    const chromeJetpack = new THREE.MeshStandardMaterial({
      color: 0xe6e9ef,
      metalness: 0.95,
      roughness: 0.12,
    });

    const amberVisor = new THREE.MeshPhysicalMaterial({
      color: 0xff7700,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.45,
      opacity: 0.95,
      transparent: true,
      reflectivity: 0.9,
    });

    const darkRubber = new THREE.MeshStandardMaterial({
      color: 0x222225,
      roughness: 0.7,
    });

    const yellowAccent = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.3,
    });

    // 1. Torso
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.26, 0.75, 16);
    const torso = new THREE.Mesh(torsoGeo, suitOrange);
    torso.rotation.z = -Math.PI / 2.3; // Horizontal flying flight posture
    this.bodyGroup.add(torso);

    // Orange/Yellow racing stripes down torso
    const stripeGeo = new THREE.BoxGeometry(0.76, 0.08, 0.5);
    const stripe = new THREE.Mesh(stripeGeo, yellowAccent);
    torso.add(stripe);

    // 2. Chest Control Box ("JJ" Control console)
    const chestBoxGeo = new THREE.BoxGeometry(0.18, 0.32, 0.36);
    const chestBox = new THREE.Mesh(chestBoxGeo, creamPlastic);
    chestBox.position.set(0.18, 0.04, 0);
    torso.add(chestBox);

    // Primary buttons on chest box (Green, Blue, Red, Yellow)
    const buttonColors = [0x00cc44, 0x0088ff, 0xee2222, 0xffcc00];
    const buttonGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10);
    buttonGeo.rotateZ(Math.PI / 2);

    let bIdx = 0;
    for (let bx = -0.06; bx <= 0.06; bx += 0.12) {
      for (let bz = -0.08; bz <= 0.08; bz += 0.16) {
        const bMat = new THREE.MeshStandardMaterial({ color: buttonColors[bIdx % 4], roughness: 0.2 });
        const btn = new THREE.Mesh(buttonGeo, bMat);
        btn.position.set(0.09, bx, bz);
        chestBox.add(btn);
        bIdx++;
      }
    }

    // 3. Helmet & Visor
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0.55, 0.05, 0);
    torso.add(helmetGroup);

    const helmetDomeGeo = new THREE.SphereGeometry(0.33, 20, 20);
    const helmetDome = new THREE.Mesh(helmetDomeGeo, creamPlastic);
    helmetGroup.add(helmetDome);

    // Ribbed collar ring
    const collarGeo = new THREE.TorusGeometry(0.28, 0.06, 12, 24);
    collarGeo.rotateY(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, creamPlastic);
    collar.position.x = -0.15;
    helmetGroup.add(collar);

    // Amber Bubble Visor
    const visorGeo = new THREE.SphereGeometry(0.27, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.6);
    visorGeo.rotateZ(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, amberVisor);
    visor.position.x = 0.1;
    helmetGroup.add(visor);

    // Inner stylized face inside helmet
    const faceGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xdf9b72, roughness: 0.5 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.x = 0.08;
    helmetGroup.add(face);

    // 4. Twin Chrome Rocket Jetpack
    const jetpackGroup = new THREE.Group();
    jetpackGroup.position.set(-0.15, 0.35, 0); // On back of astronaut
    torso.add(jetpackGroup);

    const rocketTankGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.82, 16);
    rocketTankGeo.rotateZ(Math.PI / 2);

    // Left & Right Chrome Tanks
    const leftTank = new THREE.Mesh(rocketTankGeo, chromeJetpack);
    leftTank.position.z = -0.22;
    jetpackGroup.add(leftTank);

    const rightTank = new THREE.Mesh(rocketTankGeo, chromeJetpack);
    rightTank.position.z = 0.22;
    jetpackGroup.add(rightTank);

    // Chrome Manifold connector bridge
    const bridgeGeo = new THREE.BoxGeometry(0.22, 0.12, 0.44);
    const bridge = new THREE.Mesh(bridgeGeo, chromeJetpack);
    jetpackGroup.add(bridge);

    // Chrome Thruster Exhaust Nozzles
    const nozzleGeo = new THREE.ConeGeometry(0.14, 0.26, 16, 1, true);
    nozzleGeo.rotateZ(Math.PI / 2);

    this.leftNozzleMesh = new THREE.Mesh(nozzleGeo, chromeJetpack);
    this.leftNozzleMesh.position.set(-0.46, 0, -0.22);
    jetpackGroup.add(this.leftNozzleMesh);

    this.rightNozzleMesh = new THREE.Mesh(nozzleGeo, chromeJetpack);
    this.rightNozzleMesh.position.set(-0.46, 0, 0.22);
    jetpackGroup.add(this.rightNozzleMesh);

    // Mini chrome stabilizing winglets
    const wingGeo = new THREE.BoxGeometry(0.3, 0.03, 0.24);
    const leftWing = new THREE.Mesh(wingGeo, chromeJetpack);
    leftWing.position.set(-0.15, 0, -0.36);
    leftWing.rotation.x = -0.3;
    jetpackGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, chromeJetpack);
    rightWing.position.set(-0.15, 0, 0.36);
    rightWing.rotation.x = 0.3;
    jetpackGroup.add(rightWing);

    // 5. Arms & Raygun Blaster
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.55, 12);
    armGeo.rotateZ(Math.PI / 2.2);

    // Right arm holding gun outstretched forward
    const rightArm = new THREE.Mesh(armGeo, suitOrange);
    rightArm.position.set(0.28, -0.1, 0.28);
    torso.add(rightArm);

    // Left arm tucked along flight streamline
    const leftArm = new THREE.Mesh(armGeo, suitOrange);
    leftArm.position.set(0.18, -0.05, -0.28);
    leftArm.rotation.z = -0.3;
    torso.add(leftArm);

    // Raygun Blaster
    this.blasterMesh = new THREE.Group();
    this.blasterMesh.position.set(0.35, -0.02, 0);

    const gunBodyGeo = new THREE.BoxGeometry(0.24, 0.1, 0.08);
    const gunBody = new THREE.Mesh(gunBodyGeo, chromeJetpack);
    this.blasterMesh.add(gunBody);

    const gunBarrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10);
    gunBarrelGeo.rotateZ(Math.PI / 2);
    const gunBarrel = new THREE.Mesh(gunBarrelGeo, creamPlastic);
    gunBarrel.position.x = 0.22;
    this.blasterMesh.add(gunBarrel);

    // Gun cooling fin rings
    for (let r = 0.12; r <= 0.26; r += 0.07) {
      const ringGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 12);
      ringGeo.rotateY(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, yellowAccent);
      ring.position.x = r;
      this.blasterMesh.add(ring);
    }

    rightArm.add(this.blasterMesh);

    // 6. Trailing Legs & Action Figure Boots
    const legGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.65, 12);
    legGeo.rotateZ(Math.PI / 2.1);

    const bootGeo = new THREE.BoxGeometry(0.32, 0.18, 0.16);

    // Upper Leg
    const leg1 = new THREE.Mesh(legGeo, suitOrange);
    leg1.position.set(-0.55, 0.08, -0.12);
    torso.add(leg1);

    const boot1 = new THREE.Mesh(bootGeo, creamPlastic);
    boot1.position.set(-0.35, 0, 0);
    leg1.add(boot1);

    // Lower Leg slightly angled
    const leg2 = new THREE.Mesh(legGeo, suitOrange);
    leg2.position.set(-0.55, -0.08, 0.12);
    leg2.rotation.z = 0.15;
    torso.add(leg2);

    const boot2 = new THREE.Mesh(bootGeo, creamPlastic);
    boot2.position.set(-0.35, 0, 0);
    leg2.add(boot2);

    // Scale entire character to tight 1-unit game balance
    this.mesh.scale.set(0.9, 0.9, 0.9);
  }

  /**
   * Fires a retro laser blast forward
   */
  public shoot(): boolean {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

    // Determine world position of blaster muzzle
    this.blasterMesh.getWorldPosition(this.blasterMuzzlePos);
    laser.position.copy(this.blasterMuzzlePos);
    laser.position.x += 0.3;
    laser.active = true;
    laser.life = 1.2;
    laser.mesh.position.copy(laser.position);
    laser.mesh.visible = true;
    return true;
  }

  public takeDamage(amount: number = 25) {
    if (this.invulnerableTime > 0) return;
    this.life = Math.max(0, this.life - amount);
    this.invulnerableTime = 1.4; // 1.4s of invulnerability flashing
  }

  public addFuel(amount: number = 35) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  public addLife(amount: number = 25) {
    this.life = Math.min(this.maxLife, this.life + amount);
  }

  public update(dt: number, inputThrust: boolean, inputDive: boolean) {
    // 1. Invulnerability flash timer
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      // Strobe visibility
      this.mesh.visible = Math.floor(this.invulnerableTime * 14) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 2. Jetpack Fuel & Vertical Thrust
    let isActuallyThrusting = false;
    const gravity = -16.5;
    const thrustAccel = 32.0;

    if (inputThrust && this.fuel > 0) {
      isActuallyThrusting = true;
      this.velocity.y += thrustAccel * dt;
      this.fuel = Math.max(0, this.fuel - 24 * dt); // Depletes fuel while burning
    } else {
      // Natural recovery when not firing thrusters
      this.fuel = Math.min(this.maxFuel, this.fuel + 6.0 * dt);
    }

    // Quick dive input
    if (inputDive) {
      this.velocity.y -= 26.0 * dt;
    }

    // Apply gravity & vertical dampening
    this.velocity.y += gravity * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -12, 11);

    // Apply movement
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Restrict flight arena boundaries
    const floorY = -4.2;
    const ceilingY = 4.2;
    if (this.position.y < floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
    } else if (this.position.y > ceilingY) {
      this.position.y = ceilingY;
      this.velocity.y = 0;
    }

    this.mesh.position.copy(this.position);

    // Dynamic flight pitch tilt based on vertical movement
    const targetTilt = (this.velocity.y / 12) * 0.45;
    this.bodyGroup.rotation.z = THREE.MathUtils.lerp(this.bodyGroup.rotation.z, targetTilt, dt * 10);

    // 3. Emit Faux-Volumetric Jetpack Smoke & Sparks
    // Calculate world position between nozzles
    this.leftNozzleMesh.getWorldPosition(this.jetpackNozzlePos);
    this.jetpackNozzlePos.x -= 0.15; // slightly behind the nozzle rim

    this.smoke.emit(this.jetpackNozzlePos, this.velocity.x, isActuallyThrusting, isActuallyThrusting ? 3 : 1);
    this.smoke.update(dt);

    // 4. Update Laser Projectiles
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
}
