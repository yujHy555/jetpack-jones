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

export class Player {
  public mesh: THREE.Group;
  public bodyGroup: THREE.Group;

  // Physics & State
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(7.0, 0, 0); // Forward flight speed
  public radius: number = 0.55;

  public life: number = 100;
  public maxLife: number = 100;
  public fuel: number = 100;
  public maxFuel: number = 100;
  public invulnerableTime: number = 0;

  // Sub-components
  private leftFlameCone!: THREE.Mesh;
  private rightFlameCone!: THREE.Mesh;
  private leftInnerFlame!: THREE.Mesh;
  private rightInnerFlame!: THREE.Mesh;
  private blasterMuzzlePos: THREE.Vector3 = new THREE.Vector3();
  private blasterMesh!: THREE.Group;
  private thrusterLight!: THREE.PointLight;

  // Smoke & Spark System (Guaranteed WebGL Compatible)
  private smokeGroup: THREE.Group;
  private smokePuffs: SmokePuff[] = [];
  private maxSmoke = 65;

  private sparkPoints!: THREE.Points;
  private sparkGeo!: THREE.BufferGeometry;
  private sparkPositions!: Float32Array;
  private sparkColors!: Float32Array;
  private sparks: Spark[] = [];
  private maxSparks = 60;

  // Projectiles
  public lasers: LaserBolt[] = [];
  private laserGeo: THREE.CylinderGeometry;
  private laserMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.mesh.add(this.bodyGroup);
    scene.add(this.mesh);

    this.smokeGroup = new THREE.Group();
    scene.add(this.smokeGroup);

    // Dynamic Thruster Point Light
    this.thrusterLight = new THREE.PointLight(0xff7700, 5, 14, 1.2);
    scene.add(this.thrusterLight);

    // Build the 3D Action Figure Model (Corrected Horizontal Orientation)
    this.buildActionFigureModel();

    // Build Robust Faux-Volumetric Smoke and Spark Pools
    this.initSmokeSystem();
    this.initSparkSystem();

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
        velocity: new THREE.Vector3(24, 0, 0),
        active: false,
        life: 0,
      });
    }

    this.reset();
  }

  public reset(startX: number = 0, startY: number = 0) {
    this.position.set(startX, startY, 0);
    this.velocity.set(7.0, 0, 0);
    this.life = 100;
    this.fuel = 100;
    this.invulnerableTime = 0;
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
    this.bodyGroup.rotation.z = 0;

    // Reset lasers
    for (const l of this.lasers) {
      l.active = false;
      l.mesh.visible = false;
    }

    // Reset smoke & sparks
    for (const sp of this.smokePuffs) {
      sp.active = false;
      sp.mesh.visible = false;
    }
    for (const sk of this.sparks) {
      sk.active = false;
    }
  }

  /**
   * Action Figure Construction with strictly aligned horizontal coordinates:
   * +X: FORWARD (Right on screen)
   * +Y: UP
   * +Z: TOWARDS CAMERA
   */
  private buildActionFigureModel() {
    // 1. Materials matching Image 1
    const suitOrange = new THREE.MeshStandardMaterial({
      color: 0xf05a10,
      roughness: 0.28,
      metalness: 0.08,
    });

    const creamPlastic = new THREE.MeshStandardMaterial({
      color: 0xf5efe4,
      roughness: 0.35,
      metalness: 0.05,
    });

    const chromeJetpack = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.95,
      roughness: 0.12,
    });

    const amberVisor = new THREE.MeshPhysicalMaterial({
      color: 0xff7700,
      metalness: 0.15,
      roughness: 0.05,
      transmission: 0.45,
      opacity: 0.95,
      transparent: true,
      reflectivity: 0.9,
    });

    const yellowAccent = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.25,
    });

    // 2. Torso (Capsule / horizontal cylinder along X)
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.26, 0.75, 16);
    torsoGeo.rotateZ(Math.PI / 2); // Axis along X: Head at +X, legs at -X!
    const torso = new THREE.Mesh(torsoGeo, suitOrange);
    torso.position.set(0, 0, 0);
    this.bodyGroup.add(torso);

    // Yellow stripe along torso
    const stripeGeo = new THREE.BoxGeometry(0.76, 0.08, 0.52);
    const stripe = new THREE.Mesh(stripeGeo, yellowAccent);
    torso.add(stripe);

    // 3. Chest Control Box ("JJ" console mounted on top/front)
    const chestBoxGeo = new THREE.BoxGeometry(0.34, 0.18, 0.36);
    const chestBox = new THREE.Mesh(chestBoxGeo, creamPlastic);
    chestBox.position.set(0.06, 0.22, 0);
    torso.add(chestBox);

    // Tactile colorful buttons (Green, Blue, Red, Yellow)
    const buttonColors = [0x00cc44, 0x0088ff, 0xee2222, 0xffcc00];
    const buttonGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10);
    let bIdx = 0;
    for (let bx = -0.07; bx <= 0.07; bx += 0.14) {
      for (let bz = -0.09; bz <= 0.09; bz += 0.18) {
        const bMat = new THREE.MeshStandardMaterial({ color: buttonColors[bIdx % 4], roughness: 0.2 });
        const btn = new THREE.Mesh(buttonGeo, bMat);
        btn.position.set(bx, 0.1, bz);
        chestBox.add(btn);
        bIdx++;
      }
    }

    // 4. Helmet & Head at +X (Forward)
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0.48, 0.08, 0);
    this.bodyGroup.add(helmetGroup);

    // Cream Dome
    const helmetDomeGeo = new THREE.SphereGeometry(0.33, 20, 20);
    const helmetDome = new THREE.Mesh(helmetDomeGeo, creamPlastic);
    helmetGroup.add(helmetDome);

    // Ribbed collar ring
    const collarGeo = new THREE.TorusGeometry(0.26, 0.06, 12, 24);
    collarGeo.rotateY(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, creamPlastic);
    collar.position.x = -0.16;
    helmetGroup.add(collar);

    // Amber Bubble Visor (Facing forward towards +X)
    const visorGeo = new THREE.SphereGeometry(0.28, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
    visorGeo.rotateZ(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, amberVisor);
    visor.position.set(0.08, 0.02, 0);
    helmetGroup.add(visor);

    // Stylized action figure face inside
    const faceGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xdf9b72, roughness: 0.5 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0.06, 0, 0);
    helmetGroup.add(face);

    // 5. Twin Chrome Rocket Jetpack (Mounted on back at y = +0.22, x = -0.1)
    const jetpackGroup = new THREE.Group();
    jetpackGroup.position.set(-0.12, 0.25, 0);
    this.bodyGroup.add(jetpackGroup);

    const rocketTankGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 16);
    rocketTankGeo.rotateZ(Math.PI / 2); // along X

    const leftTank = new THREE.Mesh(rocketTankGeo, chromeJetpack);
    leftTank.position.z = -0.22;
    jetpackGroup.add(leftTank);

    const rightTank = new THREE.Mesh(rocketTankGeo, chromeJetpack);
    rightTank.position.z = 0.22;
    jetpackGroup.add(rightTank);

    // Chrome Manifold bridge
    const bridgeGeo = new THREE.BoxGeometry(0.22, 0.1, 0.44);
    const bridge = new THREE.Mesh(bridgeGeo, chromeJetpack);
    jetpackGroup.add(bridge);

    // Stabilizing winglets
    const wingGeo = new THREE.BoxGeometry(0.26, 0.03, 0.22);
    const leftWing = new THREE.Mesh(wingGeo, chromeJetpack);
    leftWing.position.set(-0.15, 0, -0.34);
    leftWing.rotation.x = -0.35;
    jetpackGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, chromeJetpack);
    rightWing.position.set(-0.15, 0, 0.34);
    rightWing.rotation.x = 0.35;
    jetpackGroup.add(rightWing);

    // Exhaust Nozzles (Pointing backwards to -X)
    const nozzleGeo = new THREE.ConeGeometry(0.13, 0.25, 16, 1, true);
    nozzleGeo.rotateZ(Math.PI / 2); // Base points to -X

    const leftNozzle = new THREE.Mesh(nozzleGeo, chromeJetpack);
    leftNozzle.position.set(-0.48, 0, -0.22);
    jetpackGroup.add(leftNozzle);

    const rightNozzle = new THREE.Mesh(nozzleGeo, chromeJetpack);
    rightNozzle.position.set(-0.48, 0, 0.22);
    jetpackGroup.add(rightNozzle);

    // 6. VISIBLE 3D ROCKET THRUSTER FLAMES (Attached directly to nozzles!)
    const outerFlameGeo = new THREE.ConeGeometry(0.16, 0.75, 12);
    outerFlameGeo.rotateZ(-Math.PI / 2); // Points out towards -X
    outerFlameGeo.translate(-0.38, 0, 0);

    const innerFlameGeo = new THREE.ConeGeometry(0.09, 0.45, 12);
    innerFlameGeo.rotateZ(-Math.PI / 2);
    innerFlameGeo.translate(-0.23, 0, 0);

    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.85,
    });
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
    });

    // Left flame cone
    this.leftFlameCone = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    this.leftFlameCone.position.set(-0.5, 0, -0.22);
    jetpackGroup.add(this.leftFlameCone);

    this.leftInnerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.leftFlameCone.add(this.leftInnerFlame);

    // Right flame cone
    this.rightFlameCone = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    this.rightFlameCone.position.set(-0.5, 0, 0.22);
    jetpackGroup.add(this.rightFlameCone);

    this.rightInnerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.rightFlameCone.add(this.rightInnerFlame);

    // 7. Arms & Outstretched Raygun Blaster
    const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.55, 12);
    armGeo.rotateZ(Math.PI / 2);

    // Right arm holding gun forward
    const rightArm = new THREE.Mesh(armGeo, suitOrange);
    rightArm.position.set(0.3, -0.12, 0.28);
    this.bodyGroup.add(rightArm);

    // Left arm tucked back
    const leftArm = new THREE.Mesh(armGeo, suitOrange);
    leftArm.position.set(0.1, -0.1, -0.28);
    this.bodyGroup.add(leftArm);

    // Raygun Blaster
    this.blasterMesh = new THREE.Group();
    this.blasterMesh.position.set(0.34, 0, 0);

    const gunBodyGeo = new THREE.BoxGeometry(0.24, 0.1, 0.08);
    const gunBody = new THREE.Mesh(gunBodyGeo, chromeJetpack);
    this.blasterMesh.add(gunBody);

    const gunBarrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10);
    gunBarrelGeo.rotateZ(Math.PI / 2);
    const gunBarrel = new THREE.Mesh(gunBarrelGeo, creamPlastic);
    gunBarrel.position.x = 0.22;
    this.blasterMesh.add(gunBarrel);

    for (let r = 0.12; r <= 0.26; r += 0.07) {
      const ringGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 12);
      ringGeo.rotateY(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, yellowAccent);
      ring.position.x = r;
      this.blasterMesh.add(ring);
    }
    rightArm.add(this.blasterMesh);

    // 8. Trailing Legs & Action Figure Boots (Pointing backwards to -X)
    const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.65, 12);
    legGeo.rotateZ(Math.PI / 2);

    const bootGeo = new THREE.BoxGeometry(0.32, 0.18, 0.16);

    const leg1 = new THREE.Mesh(legGeo, suitOrange);
    leg1.position.set(-0.55, -0.06, -0.12);
    this.bodyGroup.add(leg1);

    const boot1 = new THREE.Mesh(bootGeo, creamPlastic);
    boot1.position.set(-0.35, -0.02, 0);
    leg1.add(boot1);

    const leg2 = new THREE.Mesh(legGeo, suitOrange);
    leg2.position.set(-0.52, -0.14, 0.12);
    this.bodyGroup.add(leg2);

    const boot2 = new THREE.Mesh(bootGeo, creamPlastic);
    boot2.position.set(-0.35, -0.02, 0);
    leg2.add(boot2);

    this.mesh.scale.set(0.9, 0.9, 0.9);
  }

  /**
   * Initializes volumetric smoke puff billboards with a procedural soft radial gradient texture
   */
  private initSmokeSystem() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.3, 'rgba(255, 180, 100, 0.85)');
    grad.addColorStop(0.65, 'rgba(180, 120, 80, 0.5)');
    grad.addColorStop(1.0, 'rgba(40, 30, 25, 0.0)');

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
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });

      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      this.smokeGroup.add(mesh);

      this.smokePuffs.push({
        mesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 1.0,
        baseScale: 0.5,
        rotSpeed: 0,
        active: false,
      });
    }
  }

  /**
   * Initializes high-speed golden sparks/embers
   */
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
    this.smokeGroup.add(this.sparkPoints);

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

  public shoot(): boolean {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

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
      this.mesh.visible = Math.floor(this.invulnerableTime * 14) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 2. Physics: Jetpack Thrust & Fuel
    const isActuallyThrusting = inputThrust && this.fuel > 0;
    const gravity = -14.0;
    const thrustAccel = 30.0;

    if (isActuallyThrusting) {
      this.velocity.y += thrustAccel * dt;
      this.fuel = Math.max(0, this.fuel - 24 * dt);
    } else {
      this.fuel = Math.min(this.maxFuel, this.fuel + 8.0 * dt);
    }

    if (inputDive) {
      this.velocity.y -= 25.0 * dt;
    }

    // Apply gravity
    this.velocity.y += gravity * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -11, 10);

    // Apply movement
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Floor and Ceiling bounds
    const floorY = -3.8;
    const ceilingY = 3.8;
    if (this.position.y < floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
    } else if (this.position.y > ceilingY) {
      this.position.y = ceilingY;
      this.velocity.y = 0;
    }

    this.mesh.position.copy(this.position);

    // Gentle aerodynamic flight tilt (-20 to +20 degrees)
    const targetTilt = (this.velocity.y / 11) * 0.35;
    this.bodyGroup.rotation.z = THREE.MathUtils.lerp(this.bodyGroup.rotation.z, targetTilt, dt * 10);

    // 3. Update Rocket Flames & Light
    const nozzleWorldX = this.position.x - 0.55;
    const nozzleWorldY = this.position.y + 0.22;
    const nozzleWorldZ = this.position.z;

    this.thrusterLight.position.set(nozzleWorldX, nozzleWorldY, nozzleWorldZ);

    if (isActuallyThrusting) {
      // Roaring flame: scales up with flicker
      const flicker = 1.0 + Math.random() * 0.45;
      this.leftFlameCone.scale.set(flicker, 1.0 + Math.random() * 0.2, 1.0 + Math.random() * 0.2);
      this.rightFlameCone.scale.copy(this.leftFlameCone.scale);
      this.leftFlameCone.visible = true;
      this.rightFlameCone.visible = true;

      this.thrusterLight.intensity = 18 + Math.random() * 8;
      this.thrusterLight.distance = 15;

      // Emit heavy volumetric smoke puffs
      this.emitSmoke(nozzleWorldX, nozzleWorldY, nozzleWorldZ, 2);
      this.emitSparks(nozzleWorldX, nozzleWorldY, nozzleWorldZ, 2);
    } else {
      // Idle small pilot flame
      this.leftFlameCone.scale.set(0.35, 0.35, 0.35);
      this.rightFlameCone.scale.set(0.35, 0.35, 0.35);
      this.leftFlameCone.visible = true;
      this.rightFlameCone.visible = true;

      this.thrusterLight.intensity = 2.0;
      this.thrusterLight.distance = 6;

      // Occasional faint idle puff
      if (Math.random() < 0.2) {
        this.emitSmoke(nozzleWorldX, nozzleWorldY, nozzleWorldZ, 1, true);
      }
    }

    // 4. Update Smoke Puffs
    this.updateSmoke(dt);

    // 5. Update Sparks
    this.updateSparks(dt);

    // 6. Update Lasers
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

  private emitSmoke(x: number, y: number, z: number, count: number, isIdle: boolean = false) {
    for (let c = 0; c < count; c++) {
      const puff = this.smokePuffs.find(p => !p.active);
      if (!puff) return;

      puff.active = true;
      puff.age = 0;
      puff.maxLife = isIdle ? 0.6 : (0.8 + Math.random() * 0.5);
      puff.baseScale = isIdle ? 0.3 : (0.45 + Math.random() * 0.2);
      puff.rotSpeed = (Math.random() - 0.5) * 4.0;

      puff.mesh.position.set(
        x + (Math.random() - 0.5) * 0.15,
        y + (Math.random() - 0.5) * 0.2,
        z + (Math.random() - 0.5) * 0.2
      );

      const speedX = isIdle ? 1.5 : (4.5 + Math.random() * 2.5);
      puff.velocity.set(
        -speedX - this.velocity.x * 0.25,
        (Math.random() - 0.45) * 1.5,
        (Math.random() - 0.5) * 0.5
      );

      puff.mesh.scale.set(puff.baseScale, puff.baseScale, 1);
      puff.mesh.visible = true;

      // Initial color tint: fiery gold
      const mat = puff.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(1.0, 0.7, 0.3);
      mat.opacity = 0.85;
    }
  }

  private emitSparks(x: number, y: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const spark = this.sparks.find(s => !s.active);
      if (!spark) return;

      spark.active = true;
      spark.age = 0;
      spark.maxLife = 0.25 + Math.random() * 0.3;
      spark.position.set(x, y, z);
      spark.velocity.set(
        -(8.0 + Math.random() * 6.0) - this.velocity.x * 0.4,
        (Math.random() - 0.5) * 4.0,
        (Math.random() - 0.5) * 1.5
      );
    }
  }

  private updateSmoke(dt: number) {
    for (const puff of this.smokePuffs) {
      if (!puff.active) continue;

      puff.age += dt;
      if (puff.age >= puff.maxLife) {
        puff.active = false;
        puff.mesh.visible = false;
        continue;
      }

      // Drag and hot air buoyancy
      puff.velocity.x *= (1.0 - dt * 1.4);
      puff.velocity.y += dt * 0.8;
      puff.mesh.position.addScaledVector(puff.velocity, dt);

      // Expansion into thick billowing cauliflower smoke
      const progress = puff.age / puff.maxLife;
      const currentScale = puff.baseScale + progress * 2.4;
      puff.mesh.scale.set(currentScale, currentScale, 1);
      puff.mesh.rotation.z += puff.rotSpeed * dt;

      // Color thermal fade: Gold -> Rich Orange -> Terracotta -> Soot Gray
      const mat = puff.mesh.material as THREE.MeshBasicMaterial;
      if (progress < 0.25) {
        const t = progress / 0.25;
        mat.color.setRGB(1.0, THREE.MathUtils.lerp(0.8, 0.4, t), 0.1);
        mat.opacity = 0.85;
      } else if (progress < 0.6) {
        const t = (progress - 0.25) / 0.35;
        mat.color.setRGB(
          THREE.MathUtils.lerp(1.0, 0.45, t),
          THREE.MathUtils.lerp(0.4, 0.25, t),
          THREE.MathUtils.lerp(0.1, 0.18, t)
        );
        mat.opacity = 0.75 - t * 0.2;
      } else {
        const t = (progress - 0.6) / 0.4;
        mat.color.setRGB(0.28, 0.24, 0.22);
        mat.opacity = (1.0 - t) * 0.55;
      }
    }
  }

  private updateSparks(dt: number) {
    let pIdx = 0;
    let cIdx = 0;

    for (const sp of this.sparks) {
      if (sp.active) {
        sp.age += dt;
        if (sp.age >= sp.maxLife) {
          sp.active = false;
        } else {
          sp.velocity.x *= (1.0 - dt * 2.8);
          sp.position.addScaledVector(sp.velocity, dt);
        }
      }

      if (sp.active) {
        this.sparkPositions[pIdx] = sp.position.x;
        this.sparkPositions[pIdx + 1] = sp.position.y;
        this.sparkPositions[pIdx + 2] = sp.position.z;

        const progress = sp.age / sp.maxLife;
        this.sparkColors[cIdx] = 1.0;
        this.sparkColors[cIdx + 1] = 0.9 - progress * 0.6;
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
  }
}
