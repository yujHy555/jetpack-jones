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

export class Player {
  public mesh: THREE.Group;
  public state: PlayerState = PlayerState.IDLE;

  // Transform & Physics
  public position: THREE.Vector3 = new THREE.Vector3(0, -3.8, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = true;
  public facingRight: boolean = true;
  public radius: number = 0.5;
  public height: number = 1.9;

  // Stats
  public life: number = 100;
  public maxLife: number = 100;
  public fuel: number = 100;
  public maxFuel: number = 100;
  public invulnerableTime: number = 0;

  // 2D Character Display Hierarchy
  private characterGroup: THREE.Group;
  private spritePlane!: THREE.Mesh;
  private jetpackMesh!: THREE.Group;
  private flameConeLeft!: THREE.Mesh;
  private flameConeRight!: THREE.Mesh;
  private thrusterLight: THREE.PointLight;

  // Animation Timers
  private animTime: number = 0;

  // Jetpack Smoke & Spark VFX
  private vfxGroup: THREE.Group;
  private smokePuffs: SmokePuff[] = [];
  private maxSmoke = 70;
  private sparks: Spark[] = [];
  private maxSparks = 60;
  private sparkGeo!: THREE.BufferGeometry;
  private sparkPositions!: Float32Array;
  private sparkColors!: Float32Array;
  private sparkPoints!: THREE.Points;

  // Running Dust Puffs
  private dustPuffs: DustParticle[] = [];
  private maxDust = 25;

  // Blaster Projectiles
  public lasers: LaserBolt[] = [];
  private laserGeo: THREE.CylinderGeometry;
  private laserMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.characterGroup = new THREE.Group();
    this.mesh.add(this.characterGroup);
    scene.add(this.mesh);

    this.vfxGroup = new THREE.Group();
    scene.add(this.vfxGroup);

    // Dynamic thruster point light
    this.thrusterLight = new THREE.PointLight(0xff7711, 0, 14, 1.2);
    scene.add(this.thrusterLight);

    // Build the 2D Character Sprite from reference image
    this.build2DCharacter();

    // Attach Chrome Jetpack to the 2D character's back
    this.buildJetpack();

    // VFX Systems
    this.initSmokeSystem();
    this.initSparkSystem();
    this.initDustSystem();

    // Laser Bolts
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
        velocity: new THREE.Vector3(25, 0, 0),
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

  /**
   * Loads reference character PNG and removes the background color in browser canvas
   */
  private build2DCharacter() {
    const planeGeo = new THREE.PlaneGeometry(1.0, 2.05); // Aspect ratio matches 284x714
    planeGeo.translate(0, 1.02, 0); // Pivot at feet

    // Fallback material while image loads
    const initialMat = new THREE.MeshStandardMaterial({
      color: 0xee6611,
      roughness: 0.35,
      transparent: true,
    });

    this.spritePlane = new THREE.Mesh(planeGeo, initialMat);
    this.characterGroup.add(this.spritePlane);

    // Load and process image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/assets/character.png';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample background color near corners (light beige)
      const bgR = data[0], bgG = data[1], bgB = data[2];

      // Key out background pixels with smooth alpha feathering
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dr = r - bgR;
        const dg = g - bgG;
        const db = b - bgB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);

        if (dist < 32) {
          data[i + 3] = 0; // Transparent background
        } else if (dist < 46) {
          // Feathered edge
          data[i + 3] = Math.floor(((dist - 32) / 14) * 255);
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const cleanMat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.4,
        metalness: 0.05,
        alphaTest: 0.05,
      });

      this.spritePlane.material = cleanMat;
    };
  }

  /**
   * Attaches the twin-cylinder chrome rocket jetpack to the 2D character's back
   */
  private buildJetpack() {
    this.jetpackMesh = new THREE.Group();
    this.jetpackMesh.position.set(-0.25, 1.15, -0.05); // Mounted on back
    this.characterGroup.add(this.jetpackMesh);

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8ea,
      metalness: 0.95,
      roughness: 0.12,
    });

    const tankGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.65, 16);
    const leftTank = new THREE.Mesh(tankGeo, chromeMat);
    leftTank.position.z = -0.14;
    this.jetpackMesh.add(leftTank);

    const rightTank = new THREE.Mesh(tankGeo, chromeMat);
    rightTank.position.z = 0.14;
    this.jetpackMesh.add(rightTank);

    const bridgeGeo = new THREE.BoxGeometry(0.12, 0.1, 0.32);
    const bridge = new THREE.Mesh(bridgeGeo, chromeMat);
    this.jetpackMesh.add(bridge);

    // Exhaust Nozzles pointing downwards
    const nozzleGeo = new THREE.ConeGeometry(0.1, 0.2, 16, 1, true);
    nozzleGeo.rotateX(Math.PI); // Point down
    const leftNozzle = new THREE.Mesh(nozzleGeo, chromeMat);
    leftNozzle.position.set(0, -0.38, -0.14);
    this.jetpackMesh.add(leftNozzle);

    const rightNozzle = new THREE.Mesh(nozzleGeo, chromeMat);
    rightNozzle.position.set(0, -0.38, 0.14);
    this.jetpackMesh.add(rightNozzle);

    // 3D Animated Rocket Flame Cones
    const flameGeo = new THREE.ConeGeometry(0.14, 0.65, 12);
    flameGeo.rotateX(Math.PI);
    flameGeo.translate(0, -0.32, 0);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });

    this.flameConeLeft = new THREE.Mesh(flameGeo, flameMat);
    this.flameConeLeft.position.set(0, -0.4, -0.14);
    this.jetpackMesh.add(this.flameConeLeft);

    this.flameConeRight = new THREE.Mesh(flameGeo, flameMat);
    this.flameConeRight.position.set(0, -0.4, 0.14);
    this.jetpackMesh.add(this.flameConeRight);

    // Inner bright yellow flame
    const innerFlameGeo = new THREE.ConeGeometry(0.07, 0.4, 12);
    innerFlameGeo.rotateX(Math.PI);
    innerFlameGeo.translate(0, -0.2, 0);
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });

    const innerL = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.flameConeLeft.add(innerL);

    const innerR = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    this.flameConeRight.add(innerR);

    this.flameConeLeft.visible = false;
    this.flameConeRight.visible = false;
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
      color: 0x887766,
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

  public shoot(): boolean {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return false;

    laser.position.set(
      this.position.x + (this.facingRight ? 0.6 : -0.6),
      this.position.y + 1.1,
      this.position.z
    );

    laser.velocity.set(this.facingRight ? 24 : -24, 0, 0);
    laser.active = true;
    laser.life = 1.2;
    laser.mesh.position.copy(laser.position);
    laser.mesh.visible = true;
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

  public update(dt: number, moveX: number, run: boolean, jumpPressed: boolean, jetpackHold: boolean, platforms: { x: number; y: number; width: number; height: number }[]) {
    this.animTime += dt;

    // 1. Invulnerability flash
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= dt;
      this.mesh.visible = Math.floor(this.invulnerableTime * 14) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 2. Horizontal Movement: Walk vs Run
    const walkSpeed = 4.5;
    const runSpeed = 8.5;
    const currentSpeed = run ? runSpeed : walkSpeed;

    if (moveX !== 0) {
      this.facingRight = moveX > 0;
      this.characterGroup.scale.x = this.facingRight ? 1 : -1;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveX * currentSpeed, dt * 12);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * 14);
    }

    // 3. Jump from Ground
    if (jumpPressed && this.isGrounded) {
      this.velocity.y = 11.5;
      this.isGrounded = false;
      this.emitDust(this.position.x, this.position.y, 4);
    }

    // 4. Jetpack Flight
    const isActuallyJetpacking = jetpackHold && this.fuel > 0;
    const gravity = -17.0;
    const jetpackLift = 32.0;

    if (isActuallyJetpacking) {
      this.velocity.y += jetpackLift * dt;
      this.fuel = Math.max(0, this.fuel - 24 * dt);
      this.isGrounded = false;
    } else {
      // Natural fuel recovery when not burning
      this.fuel = Math.min(this.maxFuel, this.fuel + 8.0 * dt);
    }

    // Apply gravity
    this.velocity.y += gravity * dt;
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -14, 12);

    // 5. Update Position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 6. Platform & Ground Collisions
    const floorY = -3.8;
    this.isGrounded = false;

    if (this.position.y <= floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Check elevated catwalk platforms
    for (const plat of platforms) {
      const platTop = plat.y + plat.height / 2;
      const platLeft = plat.x - plat.width / 2;
      const platRight = plat.x + plat.width / 2;

      // Landing from above
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

    this.mesh.position.copy(this.position);

    // 7. Determine Animation State
    if (isActuallyJetpacking) {
      this.state = PlayerState.JETPACK;
    } else if (!this.isGrounded) {
      this.state = this.velocity.y > 0 ? PlayerState.JUMP : PlayerState.FALL;
    } else if (Math.abs(this.velocity.x) > 0.8) {
      this.state = run ? PlayerState.RUN : PlayerState.WALK;
    } else {
      this.state = PlayerState.IDLE;
    }

    // 8. 2D Character Animation Posture & Bob
    this.applyAnimationPosture(dt, run);

    // 9. Update Jetpack Flames & Volumetric Smoke
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
      l.position.x += l.velocity.x * dt;
      l.mesh.position.copy(l.position);
    }
  }

  private applyAnimationPosture(dt: number, run: boolean) {
    switch (this.state) {
      case PlayerState.IDLE:
        // Gentle breathing bob
        const breathe = Math.sin(this.animTime * 3.5) * 0.03;
        this.spritePlane.position.y = breathe;
        this.spritePlane.rotation.z = THREE.MathUtils.lerp(this.spritePlane.rotation.z, 0, dt * 10);
        break;

      case PlayerState.WALK:
        // Walk cycle bob and slight forward step lean
        const walkBob = Math.abs(Math.sin(this.animTime * 9)) * 0.05;
        this.spritePlane.position.y = walkBob;
        this.spritePlane.rotation.z = THREE.MathUtils.lerp(this.spritePlane.rotation.z, 0.06, dt * 8);

        // Footstep dust
        if (Math.sin(this.animTime * 9) > 0.85) {
          this.emitDust(this.position.x, this.position.y, 1);
        }
        break;

      case PlayerState.RUN:
        // Athletic sprint forward lean and bouncy stride
        const runBob = Math.abs(Math.sin(this.animTime * 15)) * 0.08;
        this.spritePlane.position.y = runBob;
        this.spritePlane.rotation.z = THREE.MathUtils.lerp(this.spritePlane.rotation.z, 0.16, dt * 10);

        if (Math.sin(this.animTime * 15) > 0.8) {
          this.emitDust(this.position.x, this.position.y, 2);
        }
        break;

      case PlayerState.JUMP:
      case PlayerState.FALL:
        // Airborne jump tilt
        const jumpTilt = (this.velocity.y / 12) * 0.12;
        this.spritePlane.position.y = 0;
        this.spritePlane.rotation.z = THREE.MathUtils.lerp(this.spritePlane.rotation.z, jumpTilt, dt * 10);
        break;

      case PlayerState.JETPACK:
        // Jetpack flight tilt leaning into flight vector
        const flightTilt = (this.velocity.x / 8.5) * 0.25;
        this.spritePlane.position.y = Math.sin(this.animTime * 14) * 0.02; // thruster vibration
        this.spritePlane.rotation.z = THREE.MathUtils.lerp(this.spritePlane.rotation.z, flightTilt, dt * 12);
        break;
    }
  }

  private updateJetpackVFX(dt: number, isJetpacking: boolean) {
    const nozzleX = this.position.x + (this.facingRight ? -0.28 : 0.28);
    const nozzleY = this.position.y + 0.72;
    const nozzleZ = this.position.z;

    this.thrusterLight.position.set(nozzleX, nozzleY, nozzleZ);

    if (isJetpacking) {
      this.flameConeLeft.visible = true;
      this.flameConeRight.visible = true;

      // Flame scale flicker
      const flick = 1.0 + Math.random() * 0.4;
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

    // Update Smoke Particles
    for (const puff of this.smokePuffs) {
      if (!puff.active) continue;

      puff.age += dt;
      if (puff.age >= puff.maxLife) {
        puff.active = false;
        puff.mesh.visible = false;
        continue;
      }

      // Drag and hot exhaust expansion
      puff.velocity.x *= (1.0 - dt * 1.5);
      puff.velocity.y *= (1.0 - dt * 1.2);
      puff.mesh.position.addScaledVector(puff.velocity, dt);

      const progress = puff.age / puff.maxLife;
      const currentScale = puff.baseScale + progress * 2.2;
      puff.mesh.scale.set(currentScale, currentScale, 1);
      puff.mesh.rotation.z += puff.rotSpeed * dt;

      // Thermal fade
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

      // Blasts downwards and opposite to facing direction
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
