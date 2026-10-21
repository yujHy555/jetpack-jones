import * as THREE from 'three';

export interface DroneLaser {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  life: number;
}

interface ScrapParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  active: boolean;
}

/**
 * Flying Attack Drone Bot
 * Features:
 * - Hovering retro-futuristic rounded chassis with pulsating red cyclops optic eye
 * - Dual anti-grav repulsor thrusters with cyan energy glow
 * - AI: Patrols and pursues Jones in the air, aiming and firing red laser bolts
 * - Bullet reaction: Springy jiggle wobble when shot
 * - Explosive mechanical death with scrap shrapnel and sparks
 */
export class DroneEnemy {
  public group: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public radius: number = 0.55;
  public health: number = 2;
  public active: boolean = true;

  // Visual Meshes - Helmet-styled Attack Drone
  private chassisMesh: THREE.Mesh;
  private eyeMesh: THREE.Mesh;
  private eyeLight: THREE.PointLight;
  private ledMaterials: THREE.MeshBasicMaterial[] = [];
  private antennaBeaconMat: THREE.MeshBasicMaterial;
  private shadowMesh: THREE.Mesh;

  // AI & Flight Physics
  private patrolX: number;
  private patrolRange: number;
  private hoverBaseY: number;
  private flightPhase: number;
  private shootCooldown: number = 2.2;
  private shootTimer: number = 1.0;
  private jiggleTimer: number = 0;

  // Projectiles & Death FX
  public lasers: DroneLaser[] = [];
  private scrapPool: ScrapParticle[] = [];
  private isDying: boolean = false;
  private deathTimer: number = 0;
  private shockRing: THREE.Mesh;

  constructor(scene: THREE.Scene, startX: number, startY: number = 0.8, patrolRange: number = 6.0) {
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.set(startX, startY, 0);

    this.patrolX = startX;
    this.patrolRange = patrolRange;
    this.hoverBaseY = startY;
    this.flightPhase = Math.random() * Math.PI * 2;
    this.shootTimer = 1.0 + Math.random() * 1.5;

    // Shared Helmet Materials
    const spaceWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa,
      roughness: 0.32,
      metalness: 0.15,
    });
    const darkHarnessMat = new THREE.MeshStandardMaterial({
      color: 0x1e232a,
      roughness: 0.55,
      metalness: 0.35,
    });
    const chromeMetalMat = new THREE.MeshStandardMaterial({
      color: 0xd8e0e8,
      metalness: 0.85,
      roughness: 0.18,
    });
    const rubyVisorMat = new THREE.MeshPhysicalMaterial({
      color: 0xff1133,
      emissive: 0x660011,
      roughness: 0.12,
      metalness: 0.10,
      transmission: 0.75,
      transparent: true,
      opacity: 0.88,
    });
    const cyanThrusterMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });

    // 1. Aerodynamic Space Helmet Dome Shell
    const helmetGeo = new THREE.SphereGeometry(0.46, 24, 24);
    this.chassisMesh = new THREE.Mesh(helmetGeo, spaceWhiteMat);
    this.chassisMesh.castShadow = true;
    this.group.add(this.chassisMesh);

    // 2. Top Centerline Crest Fin
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.05), darkHarnessMat);
    crest.position.set(-0.02, 0.44, 0);
    this.chassisMesh.add(crest);

    // 3. Panoramic Front Visor Seal Rim
    const visorRim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 12, 28), darkHarnessMat);
    visorRim.rotation.y = Math.PI / 2;
    visorRim.position.set(0.08, 0, 0);
    this.chassisMesh.add(visorRim);

    // 4. Panoramic Ruby/Amber Menacing Visor Bubble
    const visorGeo = new THREE.SphereGeometry(0.39, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    visorGeo.rotateZ(-Math.PI / 2);
    const visor = new THREE.Mesh(visorGeo, rubyVisorMat);
    visor.position.set(0.10, 0, 0);
    this.chassisMesh.add(visor);

    // 5. Internal Glowing Targeting Optic Scanner / Eye
    const eyeGeo = new THREE.SphereGeometry(0.14, 16, 16);
    eyeGeo.scale(1.2, 0.85, 0.85);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    this.eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeMesh.position.set(0.18, 0, 0);
    this.chassisMesh.add(this.eyeMesh);

    this.eyeLight = new THREE.PointLight(0xff002b, 2.8, 4.0);
    this.eyeLight.position.set(0.25, 0, 0);
    this.chassisMesh.add(this.eyeLight);

    // 6. Dual Side Command Pods with 3 Flashing LED Buttons (Left & Right)
    const buttonColors = [0xff1133, 0x00f5ff, 0xffaa00];
    for (const zSide of [0.46, -0.46]) {
      const pod = new THREE.Group();
      pod.position.set(0, 0, zSide);
      this.chassisMesh.add(pod);

      const podHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14),
        darkHarnessMat
      );
      podHousing.rotation.x = Math.PI / 2;
      pod.add(podHousing);

      const bezel = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.02, 8, 16),
        chromeMetalMat
      );
      bezel.position.z = zSide > 0 ? 0.04 : -0.04;
      pod.add(bezel);

      // 3 LED Buttons: Red, Cyan, Amber
      for (let b = 0; b < 3; b++) {
        const bMat = new THREE.MeshBasicMaterial({ color: buttonColors[b] });
        this.ledMaterials.push(bMat);

        const btnMesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), bMat);
        const bx = -0.05 + b * 0.05;
        const by = 0.01;
        const bz = zSide > 0 ? 0.045 : -0.045;
        btnMesh.position.set(bx, by, bz);
        pod.add(btnMesh);
      }
    }

    // 7. Dual Top Antenna Masts with Flashing Beacon Tips
    this.antennaBeaconMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    for (const zAnt of [0.18, -0.18]) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.018, 0.32, 8),
        chromeMetalMat
      );
      stem.position.set(-0.16, 0.50, zAnt);
      stem.rotation.z = -0.22;
      stem.rotation.x = zAnt > 0 ? 0.15 : -0.15;
      this.chassisMesh.add(stem);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        this.antennaBeaconMat
      );
      beacon.position.set(-0.21, 0.65, zAnt * 1.15);
      this.chassisMesh.add(beacon);
    }

    // 8. Rear Dual Jet / Oxygen Thruster Vents
    for (const zVent of [0.16, -0.16]) {
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12),
        darkHarnessMat
      );
      vent.position.set(-0.35, -0.08, zVent);
      vent.rotation.z = Math.PI / 2;
      this.chassisMesh.add(vent);

      const grille = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10),
        cyanThrusterMat
      );
      grille.position.set(-0.44, -0.08, zVent);
      grille.rotation.z = Math.PI / 2;
      this.chassisMesh.add(grille);
    }

    // 9. Under-chin Twin Laser Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.38, 8);
    barrelGeo.rotateZ(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111418, metalness: 0.9, roughness: 0.2 });
    const barrel1 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel1.position.set(0.24, -0.28, 0.15);
    this.chassisMesh.add(barrel1);

    const barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel2.position.set(0.24, -0.28, -0.15);
    this.chassisMesh.add(barrel2);

    scene.add(this.group);

    // Dynamic ground contact shadow decal
    const shadowGeo = new THREE.CircleGeometry(0.48, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x080a10,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(this.shadowMesh);

    // 4. Red Laser Bolt Pool
    const laserGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8);
    laserGeo.rotateZ(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(laserGeo, laserMat);
      mesh.visible = false;
      scene.add(mesh);

      const light = new THREE.PointLight(0xff0022, 2.0, 3.5);
      scene.add(light);
      light.visible = false;

      this.lasers.push({
        mesh,
        light,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        active: false,
        life: 0,
      });
    }

    // 5. Death Scrap Shrapnel Pool
    const scrapGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < 16; i++) {
      const sMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xe58835 : 0x2b313a,
        roughness: 0.4,
        metalness: 0.6,
      });
      const sMesh = new THREE.Mesh(scrapGeo, sMat);
      sMesh.visible = false;
      scene.add(sMesh);

      this.scrapPool.push({
        mesh: sMesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        active: false,
      });
    }

    // Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.2, 0.35, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.shockRing = new THREE.Mesh(ringGeo, shockMat);
    this.shockRing.visible = false;
    scene.add(this.shockRing);
  }

  public takeDamage(amount: number = 1): boolean {
    if (!this.active || this.isDying) return false;

    this.health -= amount;

    // Bullet hit jiggle reaction
    this.jiggleTimer = 0.36;

    if (this.health <= 0) {
      this.triggerDeath();
      return true;
    }

    // Hit flash
    (this.chassisMesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    setTimeout(() => {
      if (this.active && !this.isDying) {
        (this.chassisMesh.material as THREE.MeshStandardMaterial).color.setHex(0xf5f7fa);
      }
    }, 85);

    return false;
  }

  private triggerDeath() {
    this.isDying = true;
    this.active = false;
    this.group.visible = false;
    if (this.shadowMesh) this.shadowMesh.visible = false;

    const origin = this.position.clone();

    // Shockwave Ring
    this.shockRing.position.copy(origin);
    this.shockRing.scale.set(0.3, 0.3, 0.3);
    (this.shockRing.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.shockRing.visible = true;
    this.deathTimer = 0.45;

    // Shrapnel burst
    for (const sc of this.scrapPool) {
      sc.active = true;
      sc.age = 0;
      sc.mesh.position.copy(origin);
      sc.mesh.scale.set(1, 1, 1);
      sc.mesh.visible = true;

      const angle = Math.random() * Math.PI * 2;
      const spd = 4.5 + Math.random() * 6.5;
      sc.velocity.set(
        Math.cos(angle) * spd,
        Math.sin(angle) * spd + 2.5,
        (Math.random() - 0.5) * 3.0
      );
    }
  }

  public update(dt: number, time: number, playerX: number, playerY: number, groundY: number = -3.70) {
    // A. Death Explosion FX
    if (this.isDying) {
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        const prog = 1.0 - this.deathTimer / 0.45;
        const s = 0.3 + Math.sin(prog * Math.PI * 0.5) * 3.4;
        this.shockRing.scale.set(s, s, s);
        (this.shockRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - prog);

        for (const sc of this.scrapPool) {
          if (!sc.active) continue;
          sc.age += dt;
          if (sc.age >= sc.maxLife) {
            sc.active = false;
            sc.mesh.visible = false;
            continue;
          }
          sc.velocity.y -= 18.0 * dt;
          sc.mesh.position.addScaledVector(sc.velocity, dt);
          sc.mesh.rotation.x += dt * 6.0;
          sc.mesh.rotation.z += dt * 8.0;
        }

        if (this.deathTimer <= 0) {
          this.shockRing.visible = false;
        }
      }
      this.updateLasers(dt);
      return;
    }

    if (!this.active) {
      this.updateLasers(dt);
      return;
    }

    // ----------------------------------------------------
    // B. AI Flight: Sine-wave Hovering & Pursuit
    // ----------------------------------------------------
    this.flightPhase += dt * 2.2;
    const hoverOffset = Math.sin(this.flightPhase) * 0.65;
    const targetY = this.hoverBaseY + hoverOffset;

    const dx = playerX - this.position.x;
    const dy = (playerY + 1.2) - this.position.y;
    const distToPlayer = Math.hypot(dx, dy);

    // Smooth pursuit when in range
    if (distToPlayer < 16.0) {
      // Approach comfortable tactical distance (~6 units)
      const desiredX = playerX + (dx > 0 ? -5.5 : 5.5);
      const targetSpeedX = THREE.MathUtils.clamp((desiredX - this.position.x) * 1.8, -4.5, 4.5);
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetSpeedX, dt * 3.5);

      const targetFlyY = THREE.MathUtils.clamp(playerY + 2.0 + hoverOffset, groundY + 1.2, 8.0);
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetFlyY, dt * 2.5);
    } else {
      // Idle patrol
      const targetPatrolX = this.patrolX + Math.sin(this.flightPhase * 0.5) * this.patrolRange;
      const pSpeed = THREE.MathUtils.clamp((targetPatrolX - this.position.x) * 1.5, -3.0, 3.0);
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, pSpeed, dt * 3.0);
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 2.0);
    }

    this.position.x += this.velocity.x * dt;

    // Banking tilt based on horizontal velocity
    const targetTilt = -this.velocity.x * 0.08;
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, targetTilt, dt * 5.0);

    // Flashing Side Command Pod LED Buttons and Top Beacon tips
    const redOn = Math.sin(time * 7.5) > 0.0;
    const cyanGlow = Math.sin(time * 5.0 + 1.2) > -0.2;
    const amberOn = Math.sin(time * 11.0) > 0.2;
    for (let s = 0; s < 2; s++) {
      const off = s * 3;
      if (this.ledMaterials[off + 0]) this.ledMaterials[off + 0].color.setHex(redOn ? 0xff1133 : 0x440008);
      if (this.ledMaterials[off + 1]) this.ledMaterials[off + 1].color.setHex(cyanGlow ? 0x00f5ff : 0x002233);
      if (this.ledMaterials[off + 2]) this.ledMaterials[off + 2].color.setHex(amberOn ? 0xffaa00 : 0x331800);
    }
    const beaconOn = Math.sin(time * 8.0) > 0.0;
    this.antennaBeaconMat.color.setHex(beaconOn ? 0xff0044 : 0x220008);

    // Eye pulsing
    const eyePulse = 1.8 + Math.sin(time * 8.0) * 0.8;
    this.eyeLight.intensity = eyePulse;

    // ----------------------------------------------------
    // C. Bullet Hit Jiggle Reaction
    // ----------------------------------------------------
    if (this.jiggleTimer > 0) {
      this.jiggleTimer -= dt;
      const jiggleFreq = 36.0;
      const amp = (this.jiggleTimer / 0.36) * 0.38;
      const jy = 1.0 + Math.sin(time * jiggleFreq) * amp;
      const jx = 1.0 - Math.sin(time * jiggleFreq) * amp * 0.7;
      this.chassisMesh.scale.set(jx, jy, jx);
    } else {
      this.chassisMesh.scale.set(1, 1, 1);
    }

    // ----------------------------------------------------
    // D. Attack: Shoot Red Laser Bolts at Jones!
    // ----------------------------------------------------
    if (distToPlayer < 14.0) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.shootCooldown + Math.random() * 0.8;
        this.fireRedLaser(playerX, playerY + 0.9);
      }
    }

    // Dynamic ground contact shadow decal
    if (this.shadowMesh) {
      this.shadowMesh.position.set(this.position.x, groundY + 0.015, 0);
      const heightAbove = Math.max(0, this.position.y - groundY);
      const sScale = Math.max(0.25, 1.0 - heightAbove * 0.12);
      this.shadowMesh.scale.set(sScale, sScale, sScale);
      (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.45 - heightAbove * 0.06);
    }

    this.updateLasers(dt);
  }

  private fireRedLaser(targetX: number, targetY: number) {
    const laser = this.lasers.find(l => !l.active);
    if (!laser) return;

    laser.active = true;
    laser.life = 1.6;
    laser.position.set(this.position.x, this.position.y - 0.25, 0);
    laser.mesh.position.copy(laser.position);
    laser.light.position.copy(laser.position);
    laser.mesh.visible = true;
    laser.light.visible = true;

    const angle = Math.atan2(targetY - laser.position.y, targetX - laser.position.x);
    const speed = 16.0;
    laser.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, 0);
    laser.mesh.rotation.z = angle;
  }

  private updateLasers(dt: number) {
    for (const l of this.lasers) {
      if (!l.active) continue;
      l.life -= dt;
      if (l.life <= 0) {
        l.active = false;
        l.mesh.visible = false;
        l.light.visible = false;
        continue;
      }

      l.position.addScaledVector(l.velocity, dt);
      l.mesh.position.copy(l.position);
      l.light.position.copy(l.position);
    }
  }

  public destroy(scene: THREE.Scene) {
    this.active = false;
    scene.remove(this.group);
    if (this.shadowMesh) scene.remove(this.shadowMesh);
    scene.remove(this.shockRing);
    for (const l of this.lasers) {
      scene.remove(l.mesh);
      scene.remove(l.light);
    }
    for (const sc of this.scrapPool) scene.remove(sc.mesh);
  }
}
