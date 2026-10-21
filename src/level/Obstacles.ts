import * as THREE from 'three';

export enum ObstacleType {
  GEAR = 'gear',
  PISTON = 'piston',
  PLASMA_TUBE = 'plasma_tube',
  HAZARD_PLATFORM = 'hazard_platform'
}

export enum PickupType {
  FUEL = 'fuel',
  COIN = 'coin',
  HEART = 'heart'
}

export interface ActiveObstacle {
  id: number;
  type: ObstacleType;
  group: THREE.Group;
  collider: {
    type: 'circle' | 'box';
    radius?: number;
    halfSize?: THREE.Vector2;
  };
  update: (dt: number, time: number) => void;
  destructible: boolean;
  health: number;
  active: boolean;
}

export interface ActivePickup {
  id: number;
  type: PickupType;
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  active: boolean;
  update: (dt: number, time: number) => void;
}

export class ObstacleManager {
  private scene: THREE.Scene;
  public obstacles: ActiveObstacle[] = [];
  public pickups: ActivePickup[] = [];
  private nextId = 1;

  // Cached Materials
  private steelMat: THREE.MeshStandardMaterial;
  private darkIronMat: THREE.MeshStandardMaterial;
  private bronzeMat: THREE.MeshStandardMaterial;
  private hazardMat: THREE.MeshStandardMaterial;
  private plasmaGlassMat: THREE.MeshPhysicalMaterial;
  private plasmaCoreMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.steelMat = new THREE.MeshStandardMaterial({
      color: 0x9095a0,
      metalness: 0.88,
      roughness: 0.22,
    });

    this.darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x3a3c42,
      metalness: 0.75,
      roughness: 0.45,
    });

    this.bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xaa7035,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Procedural Hazard Stripe Texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffbb00';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    for (let i = -128; i < 256; i += 32) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 48, 128);
      ctx.lineTo(i + 32, 128);
      ctx.closePath();
    }
    ctx.fill();
    const hazardTex = new THREE.CanvasTexture(canvas);
    hazardTex.wrapS = THREE.RepeatWrapping;
    hazardTex.wrapT = THREE.RepeatWrapping;
    hazardTex.repeat.set(3, 1);

    this.hazardMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.4,
      metalness: 0.2,
    });

    this.plasmaGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.85,
      transparent: true,
      opacity: 0.7,
      reflectivity: 0.9,
    });

    this.plasmaCoreMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
    });
  }

  public clear() {
    for (const obs of this.obstacles) {
      this.scene.remove(obs.group);
    }
    for (const p of this.pickups) {
      this.scene.remove(p.mesh);
    }
    this.obstacles = [];
    this.pickups = [];
  }

  /**
   * Spawns a Giant Steel Cog/Gear (from Image 2)
   */
  public spawnGear(x: number, y: number, radius: number = 2.2, speed: number = 1.0): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const teethCount = Math.floor(radius * 5);
    const toothAngle = (Math.PI * 2) / teethCount;

    // Center rim & hub
    const hubGeo = new THREE.CylinderGeometry(radius * 0.35, radius * 0.35, 0.45, 24);
    hubGeo.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, this.bronzeMat);
    group.add(hub);

    const rimGeo = new THREE.TorusGeometry(radius * 0.82, radius * 0.14, 12, 32);
    const rim = new THREE.Mesh(rimGeo, this.steelMat);
    group.add(rim);

    // Spokes
    for (let s = 0; s < 5; s++) {
      const angle = (s / 5) * Math.PI * 2;
      const spokeGeo = new THREE.BoxGeometry(0.22, radius * 0.8, 0.3);
      const spoke = new THREE.Mesh(spokeGeo, this.darkIronMat);
      spoke.position.set(Math.cos(angle) * (radius * 0.4), Math.sin(angle) * (radius * 0.4), 0);
      spoke.rotation.z = angle + Math.PI / 2;
      group.add(spoke);
    }

    // Outer gear teeth
    for (let i = 0; i < teethCount; i++) {
      const angle = i * toothAngle;
      const toothGeo = new THREE.BoxGeometry(0.35, 0.4, 0.4);
      const tooth = new THREE.Mesh(toothGeo, this.steelMat);
      tooth.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      tooth.rotation.z = angle;
      group.add(tooth);
    }

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.GEAR,
      group,
      collider: {
        type: 'circle',
        radius: radius * 0.95,
      },
      destructible: false,
      health: 9999,
      active: true,
      update: (dt: number) => {
        group.rotation.z += speed * dt;
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a Hydraulic Crushing Piston
   */
  public spawnPiston(x: number, topY: number = 4.5, strokeLength: number = 4.5): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, topY, 0);

    // Fixed Top Housing
    const housingGeo = new THREE.BoxGeometry(1.4, 1.8, 1.2);
    const housing = new THREE.Mesh(housingGeo, this.darkIronMat);
    group.add(housing);

    // Moving Piston Rod & Heavy Hammer Foot
    const rodGroup = new THREE.Group();
    group.add(rodGroup);

    const rodGeo = new THREE.CylinderGeometry(0.25, 0.25, strokeLength, 16);
    const rod = new THREE.Mesh(rodGeo, this.steelMat);
    rod.position.y = -strokeLength / 2;
    rodGroup.add(rod);

    const hammerGeo = new THREE.BoxGeometry(1.6, 0.7, 1.0);
    const hammer = new THREE.Mesh(hammerGeo, this.hazardMat);
    hammer.position.y = -strokeLength;
    rodGroup.add(hammer);

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.PISTON,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(0.8, 0.35),
      },
      destructible: false,
      health: 9999,
      active: true,
      update: (dt: number, time: number) => {
        // Slam down fast, retract slowly
        const cycle = (time * 1.8) % Math.PI;
        const extension = Math.pow(Math.sin(cycle), 4.0);
        rodGroup.position.y = -extension * (strokeLength - 1.2);
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a Glowing Plasma Containment Tube (from Image 2)
   */
  public spawnPlasmaTube(x: number, y: number): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // Metal Base & Caps with Hazard trim
    const capGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.4, 16);
    const topCap = new THREE.Mesh(capGeo, this.hazardMat);
    topCap.position.y = 1.6;
    group.add(topCap);

    const bottomCap = new THREE.Mesh(capGeo, this.hazardMat);
    bottomCap.position.y = -1.6;
    group.add(bottomCap);

    // Outer Glass Cylinder
    const glassGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.8, 20);
    const glass = new THREE.Mesh(glassGeo, this.plasmaGlassMat);
    group.add(glass);

    // Inner Glowing Plasma Bolt
    const lightningGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.7, 8);
    const lightning = new THREE.Mesh(lightningGeo, this.plasmaCoreMat);
    group.add(lightning);

    // Orange Glow Light
    const glowLight = new THREE.PointLight(0xff7700, 4.0, 6);
    group.add(glowLight);

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.PLASMA_TUBE,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(0.65, 1.7),
      },
      destructible: true,
      health: 3, // Can be blown up with 3 blaster shots!
      active: true,
      update: (dt: number, time: number) => {
        // Pulsate energy lightning inside
        const flicker = 0.8 + Math.sin(time * 25) * 0.2 + Math.random() * 0.15;
        lightning.scale.set(flicker, 1.0, flicker);
        glowLight.intensity = flicker * 5.0;
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a Hazard Catwalk Platform with Yellow/Black stripes
   */
  public spawnPlatform(x: number, y: number, width: number = 3.5, height: number = 0.5): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const geo = new THREE.BoxGeometry(width, height, 1.2);
    const mesh = new THREE.Mesh(geo, this.hazardMat);
    group.add(mesh);

    // Support strut beams underneath
    const strutGeo = new THREE.BoxGeometry(0.2, 1.2, 0.8);
    const strut1 = new THREE.Mesh(strutGeo, this.darkIronMat);
    strut1.position.set(-width * 0.35, -0.7, 0);
    group.add(strut1);

    const strut2 = new THREE.Mesh(strutGeo, this.darkIronMat);
    strut2.position.set(width * 0.35, -0.7, 0);
    group.add(strut2);

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.HAZARD_PLATFORM,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(width / 2, height / 2),
      },
      destructible: false,
      health: 9999,
      active: true,
      update: () => {},
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a Floating Fuel Canister Pickup
   */
  public spawnFuelPickup(x: number, y: number): ActivePickup {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const canGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0x39ff14,
      emissive: 0x116605,
      roughness: 0.2,
      metalness: 0.3,
    });
    const can = new THREE.Mesh(canGeo, canMat);
    group.add(can);

    const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 12);
    const cap = new THREE.Mesh(capGeo, this.steelMat);
    cap.position.y = 0.35;
    group.add(cap);

    this.scene.add(group);

    const pickup: ActivePickup = {
      id: this.nextId++,
      type: PickupType.FUEL,
      mesh: group,
      position: group.position,
      radius: 0.55,
      active: true,
      update: (dt: number, time: number) => {
        group.rotation.y += 2.5 * dt;
        group.position.y = y + Math.sin(time * 4) * 0.15;
      },
    };

    this.pickups.push(pickup);
    return pickup;
  }

  /**
   * Spawns a Golden Bonus Coin / JJ Action Token
   */
  public spawnCoinPickup(x: number, y: number): ActivePickup {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffbb00,
      emissive: 0x553300,
      metalness: 0.9,
      roughness: 0.2,
    });
    const coin = new THREE.Mesh(coinGeo, coinMat);
    group.add(coin);

    this.scene.add(group);

    const pickup: ActivePickup = {
      id: this.nextId++,
      type: PickupType.COIN,
      mesh: group,
      position: group.position,
      radius: 0.5,
      active: true,
      update: (dt: number, time: number) => {
        group.rotation.y += 3.8 * dt;
        group.position.y = y + Math.sin(time * 5 + x) * 0.12;
      },
    };

    this.pickups.push(pickup);
    return pickup;
  }

  public removeObstacle(obs: ActiveObstacle) {
    obs.active = false;
    this.scene.remove(obs.group);
  }

  public removePickup(p: ActivePickup) {
    p.active = false;
    this.scene.remove(p.mesh);
  }

  public getPlatforms(): { x: number; y: number; width: number; height: number }[] {
    const list: { x: number; y: number; width: number; height: number }[] = [];
    for (const obs of this.obstacles) {
      if (obs.active && obs.type === ObstacleType.HAZARD_PLATFORM && obs.collider.halfSize) {
        list.push({
          x: obs.group.position.x,
          y: obs.group.position.y,
          width: obs.collider.halfSize.x * 2,
          height: obs.collider.halfSize.y * 2,
        });
      }
    }
    return list;
  }

  public update(dt: number, time: number, playerX: number) {
    // Update and recycle obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (!obs.active) {
        this.obstacles.splice(i, 1);
        continue;
      }
      obs.update(dt, time);

      // Despawn if far behind camera
      if (obs.group.position.x < playerX - 18) {
        this.removeObstacle(obs);
        this.obstacles.splice(i, 1);
      }
    }

    // Update and recycle pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!p.active) {
        this.pickups.splice(i, 1);
        continue;
      }
      p.update(dt, time);

      if (p.mesh.position.x < playerX - 18) {
        this.removePickup(p);
        this.pickups.splice(i, 1);
      }
    }
  }
}
