import * as THREE from 'three';
import { EnemyBlob } from '../entities/EnemyBlob';
import { DroneEnemy } from '../entities/DroneEnemy';
import { PhysicsCrate } from '../entities/PhysicsCrate';

export enum ObstacleType {
  GEAR = 'gear',
  PISTON = 'piston',
  PLASMA_TUBE = 'plasma_tube',
  HAZARD_PLATFORM = 'hazard_platform',
  LASER_GATE = 'laser_gate',
  COVER_BARRIER = 'cover_barrier'
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
    center?: THREE.Vector2; // Dynamic world position of collider
  };
  update: (dt: number, time: number) => void;
  destructible: boolean;
  health: number;
  active: boolean;
  isCrushing?: boolean;
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

interface PickupFXParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface PickupFXShockwave {
  mesh: THREE.Mesh;
  age: number;
  maxLife: number;
  active: boolean;
}

export class ObstacleManager {
  private scene: THREE.Scene;
  public obstacles: ActiveObstacle[] = [];
  public pickups: ActivePickup[] = [];
  public enemies: EnemyBlob[] = [];
  public drones: DroneEnemy[] = [];
  public crates: PhysicsCrate[] = [];
  private nextId = 1;

  // Pickup Particle FX Pools
  private fxParticles: PickupFXParticle[] = [];
  private fxShockwaves: PickupFXShockwave[] = [];

  // Cached Materials
  private steelMat: THREE.MeshStandardMaterial;
  private darkIronMat: THREE.MeshStandardMaterial;
  private bronzeMat: THREE.MeshStandardMaterial;
  private hazardMat: THREE.MeshStandardMaterial;
  private outpostPlatformMat: THREE.MeshStandardMaterial;
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

    // Retro Outpost Platform Deck Texture (Matching reference image: Bone-Cream with Amber Center Stripe)
    const platCanvas = document.createElement('canvas');
    platCanvas.width = 256;
    platCanvas.height = 128;
    const pCtx = platCanvas.getContext('2d')!;
    pCtx.fillStyle = '#f5eee3';
    pCtx.fillRect(0, 0, 256, 128);
    pCtx.fillStyle = '#e27f2c';
    pCtx.fillRect(0, 28, 256, 72);
    pCtx.strokeStyle = '#353a42';
    pCtx.lineWidth = 3;
    pCtx.beginPath();
    pCtx.moveTo(0, 28); pCtx.lineTo(256, 28);
    pCtx.moveTo(0, 100); pCtx.lineTo(256, 100);
    pCtx.stroke();
    pCtx.lineWidth = 2;
    for (let px = 0; px <= 256; px += 32) {
      pCtx.beginPath();
      pCtx.moveTo(px, 0); pCtx.lineTo(px, 128);
      pCtx.stroke();
    }
    const platTex = new THREE.CanvasTexture(platCanvas);
    platTex.wrapS = THREE.RepeatWrapping;
    platTex.wrapT = THREE.ClampToEdgeWrapping;
    platTex.repeat.set(2, 1);

    this.outpostPlatformMat = new THREE.MeshStandardMaterial({
      map: platTex,
      roughness: 0.35,
      metalness: 0.25,
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

    // Initialize Pickup Particle FX Pools
    const pGeo = new THREE.SphereGeometry(0.12, 8, 8);
    for (let i = 0; i < 48; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.fxParticles.push({
        mesh,
        velocity: new THREE.Vector3(),
        age: 0,
        maxLife: 0.5,
        baseScale: 1.0,
        active: false,
      });
    }

    const swGeo = new THREE.RingGeometry(0.25, 0.45, 24);
    for (let i = 0; i < 8; i++) {
      const swMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(swGeo, swMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.fxShockwaves.push({
        mesh,
        age: 0,
        maxLife: 0.35,
        active: false,
      });
    }
  }

  public clear() {
    for (const obs of this.obstacles) {
      this.scene.remove(obs.group);
    }
    for (const p of this.pickups) {
      this.scene.remove(p.mesh);
    }
    for (const e of this.enemies) {
      e.destroy(this.scene);
    }
    for (const d of this.drones) {
      d.destroy(this.scene);
    }
    for (const c of this.crates) {
      c.destroy(this.scene);
    }
    for (const p of this.fxParticles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const sw of this.fxShockwaves) {
      sw.active = false;
      sw.mesh.visible = false;
    }
    this.obstacles = [];
    this.pickups = [];
    this.enemies = [];
    this.drones = [];
    this.crates = [];
  }

  public spawnCrate(x: number, y: number): PhysicsCrate {
    const crate = new PhysicsCrate(this.scene, x, y);
    this.crates.push(crate);
    return crate;
  }

  public spawnBlob(x: number, y: number, patrolRange: number = 3.5): EnemyBlob {
    const blob = new EnemyBlob(this.scene, x, y, patrolRange);
    this.enemies.push(blob);
    return blob;
  }

  public spawnDrone(x: number, y: number = 1.2, patrolRange: number = 6.0): DroneEnemy {
    const drone = new DroneEnemy(this.scene, x, y, patrolRange);
    this.drones.push(drone);
    return drone;
  }

  /**
   * Spawns a Giant Steel Cog/Gear (from Image 2)
   */
  /**
   * Spawns a Triple-AAA Quality Heavy Industrial Hazard Saw / Spinning Wheel
   * Features:
   * - Razor-sharp beveled teeth with glowing molten thermal cutting edges
   * - Heavy chrome perimeter rim with industrial bolt rivets
   * - Perforated dark titanium drive disc with circular cooling vents
   * - High-speed counter-rotating inner turbine rotor for mechanical depth
   * - Glowing molten axle core and massive brass locking hub
   */
  public spawnGear(x: number, y: number, radius: number = 2.2, speed: number = 1.0): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // 1. Heavy Polished Steel Perimeter Rim with Chamfered Bevel
    const rimGeo = new THREE.TorusGeometry(radius * 0.88, radius * 0.11, 16, 40);
    const rimMesh = new THREE.Mesh(rimGeo, this.steelMat);
    group.add(rimMesh);

    // 2. Heavy Industrial Bolt Rivets around the rim
    const rivetGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 10);
    rivetGeo.rotateX(Math.PI / 2);
    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2;
      const rivet = new THREE.Mesh(rivetGeo, this.darkIronMat);
      rivet.position.set(Math.cos(angle) * (radius * 0.88), Math.sin(angle) * (radius * 0.88), 0.06);
      group.add(rivet);
    }

    // 3. Dark Titanium Drive Disc with Circular Ventilation Ports
    const discGeo = new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.18, 32);
    discGeo.rotateX(Math.PI / 2);
    const discMesh = new THREE.Mesh(discGeo, this.darkIronMat);
    group.add(discMesh);

    // Circular cooling ports cut into disc
    const portGeo = new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 0.22, 16);
    portGeo.rotateX(Math.PI / 2);
    const portCavityMat = new THREE.MeshBasicMaterial({ color: 0x111215 });
    for (let p = 0; p < 4; p++) {
      const angle = (p / 4) * Math.PI * 2 + Math.PI / 4;
      const port = new THREE.Mesh(portGeo, portCavityMat);
      port.position.set(Math.cos(angle) * (radius * 0.48), Math.sin(angle) * (radius * 0.48), 0);
      group.add(port);
    }

    // 4. Razor-Sharp Beveled Saw Teeth with Glowing Molten Amber/Orange Cutting Edges
    const teethCount = Math.floor(radius * 6);
    const toothAngle = (Math.PI * 2) / teethCount;
    const toothBodyGeo = new THREE.BoxGeometry(0.32, 0.42, 0.32);
    const toothEdgeGeo = new THREE.ConeGeometry(0.14, 0.32, 4);
    toothEdgeGeo.rotateZ(-Math.PI / 2);
    const thermalMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

    for (let i = 0; i < teethCount; i++) {
      const angle = i * toothAngle;
      const toothGroup = new THREE.Group();
      toothGroup.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      toothGroup.rotation.z = angle;

      const body = new THREE.Mesh(toothBodyGeo, this.steelMat);
      toothGroup.add(body);

      // Glowing thermal saw tip
      const tip = new THREE.Mesh(toothEdgeGeo, thermalMat);
      tip.position.set(0.20, 0, 0);
      toothGroup.add(tip);

      group.add(toothGroup);
    }

    // 5. High-Speed Counter-Rotating Inner Turbine Rotor (Creates stunning mechanical motion!)
    const innerTurbine = new THREE.Group();
    group.add(innerTurbine);

    const turbineBladeGeo = new THREE.BoxGeometry(0.12, radius * 0.42, 0.18);
    for (let b = 0; b < 6; b++) {
      const angle = (b / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(turbineBladeGeo, this.bronzeMat);
      blade.position.set(Math.cos(angle) * (radius * 0.24), Math.sin(angle) * (radius * 0.24), 0.05);
      blade.rotation.z = angle + 0.35; // Angled turbine pitch
      innerTurbine.add(blade);
    }

    // 6. Central Hydraulic Axle Bearing with Glowing Molten Core
    const hubHousingGeo = new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, 0.38, 24);
    hubHousingGeo.rotateX(Math.PI / 2);
    const hubHousing = new THREE.Mesh(hubHousingGeo, this.steelMat);
    group.add(hubHousing);

    const coreLightGeo = new THREE.CircleGeometry(radius * 0.14, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const coreLightF = new THREE.Mesh(coreLightGeo, coreMat);
    coreLightF.position.z = 0.20;
    group.add(coreLightF);
    const coreLightB = new THREE.Mesh(coreLightGeo, coreMat);
    coreLightB.position.z = -0.20;
    group.add(coreLightB);

    // Massive Hexagonal Lock Nut on Center Axle
    const nutGeo = new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, 0.44, 6);
    nutGeo.rotateX(Math.PI / 2);
    const nut = new THREE.Mesh(nutGeo, this.darkIronMat);
    group.add(nut);

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.GEAR,
      group,
      collider: {
        type: 'circle',
        radius: radius * 1.05,
      },
      destructible: false,
      health: 9999,
      active: true,
      update: (dt: number, time: number) => {
        // Main saw body rotation
        group.rotation.z += speed * dt;
        // Inner turbine counter-rotates in reverse at 2.4x speed
        innerTurbine.rotation.z -= speed * 2.4 * dt;
        // Core molten heat pulse
        const pulse = 0.8 + Math.sin(time * 8.0) * 0.2;
        coreMat.color.setRGB(1.0 * pulse, 0.65 * pulse, 0.1 * pulse);
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a Heavy Hydraulic Crushing Piston / Mechanical Press
   * Positioned strategically to squash player against the floor or platform!
   * - Retracted: Parked high at the ceiling (headroom 3.2m above surface), player runs through freely.
   * - Slam: Downward stroke plunges violently to (surfaceY + 0.35m), crushing player with full squash physics!
   */
  public spawnPiston(x: number, surfaceY: number = -3.70, ceilingY?: number): ActiveObstacle {
    const group = new THREE.Group();
    const topY = ceilingY !== undefined ? ceilingY : (surfaceY + 6.0);
    group.position.set(x, topY, 0);

    // 1. Heavy Top Industrial Gantry Housing & Mounting Bracket
    const housingGeo = new THREE.BoxGeometry(2.4, 1.2, 1.5);
    const housing = new THREE.Mesh(housingGeo, this.darkIronMat);
    group.add(housing);

    // Hazard caution plate on housing front
    const chevronGeo = new THREE.BoxGeometry(2.42, 0.35, 1.52);
    const chevron = new THREE.Mesh(chevronGeo, this.hazardMat);
    chevron.position.y = -0.25;
    group.add(chevron);

    // Twin flashing warning beacons on top of housing
    const beaconGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.32, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });
    const beaconL = new THREE.Mesh(beaconGeo, beaconMat);
    beaconL.position.set(-0.85, 0.75, 0);
    group.add(beaconL);

    const beaconR = new THREE.Mesh(beaconGeo, beaconMat);
    beaconR.position.set(0.85, 0.75, 0);
    group.add(beaconR);

    // Twin fixed outer hydraulic cylinder barrels (chrome & dark iron)
    const barrelGeo = new THREE.CylinderGeometry(0.24, 0.24, 2.2, 16);
    const barrelL = new THREE.Mesh(barrelGeo, this.darkIronMat);
    barrelL.position.set(-0.65, -1.1, 0);
    group.add(barrelL);

    const barrelR = new THREE.Mesh(barrelGeo, this.darkIronMat);
    barrelR.position.set(0.65, -1.1, 0);
    group.add(barrelR);

    // 2. Moving Piston & Stomper Assembly
    const rodGroup = new THREE.Group();
    group.add(rodGroup);

    // Geometry & Kinematics calculation:
    // Hammer foot: Height 0.80, half-height 0.40.
    // Retracted: Bottom of hammer at surfaceY + 3.20 => Center at surfaceY + 3.60.
    // Slammed:   Bottom of hammer at surfaceY + 0.35 => Center at surfaceY + 0.75.
    const hammerRestWorldY = surfaceY + 3.60;
    const hammerSlamWorldY = surfaceY + 0.75;
    const strokeDistance = hammerRestWorldY - hammerSlamWorldY; // ~2.85m stroke
    const hammerLocalY = hammerRestWorldY - topY;

    // Telescopic chrome ram rods (attached to rodGroup, slide inside barrels)
    const ramGeo = new THREE.CylinderGeometry(0.16, 0.16, 3.2, 16);
    const ramL = new THREE.Mesh(ramGeo, this.steelMat);
    ramL.position.set(-0.65, hammerLocalY + 1.6, 0);
    rodGroup.add(ramL);

    const ramR = new THREE.Mesh(ramGeo, this.steelMat);
    ramR.position.set(0.65, hammerLocalY + 1.6, 0);
    rodGroup.add(ramR);

    // Central heavy main drive piston column
    const mainPistonGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 16);
    const mainPiston = new THREE.Mesh(mainPistonGeo, this.darkIronMat);
    mainPiston.position.set(0, hammerLocalY + 1.2, 0);
    rodGroup.add(mainPiston);

    // 3. Heavy Industrial Stomper Hammer with Caution Hazard Stripes
    const hammerGeo = new THREE.BoxGeometry(2.3, 0.80, 1.4);
    const hammer = new THREE.Mesh(hammerGeo, this.hazardMat);
    hammer.position.set(0, hammerLocalY, 0);
    rodGroup.add(hammer);

    // Hardened Steel Cleated Impact Sole Plate on bottom
    const solePlateGeo = new THREE.BoxGeometry(2.35, 0.14, 1.45);
    const solePlate = new THREE.Mesh(solePlateGeo, this.steelMat);
    solePlate.position.set(0, hammerLocalY - 0.40, 0);
    rodGroup.add(solePlate);

    // Heavy Pressure Rivets along the sole plate
    const cleatGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
    for (let c = -1.0; c <= 1.0; c += 0.5) {
      const cleat = new THREE.Mesh(cleatGeo, this.darkIronMat);
      cleat.position.set(c, hammerLocalY - 0.50, 0.4);
      rodGroup.add(cleat);
    }

    this.scene.add(group);

    const colliderCenter = new THREE.Vector2(x, hammerRestWorldY);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.PISTON,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(1.18, 0.46),
        center: colliderCenter,
      },
      destructible: false,
      health: 9999,
      active: true,
      isCrushing: false,
      update: (dt: number, time: number) => {
        // Press cycle:
        // Slow anticipation / warning at top -> violent rapid slam -> brief pause on floor -> smooth hydraulic retract
        const cyclePeriod = 2.5;
        const phase = (time % cyclePeriod) / cyclePeriod;

        let extension = 0;
        let isCrush = false;

        if (phase < 0.45) {
          // Resting parked high at ceiling: 3.2m open headroom (extension = 0)
          extension = 0;
        } else if (phase < 0.60) {
          // Rapid violent slam downward (0.45 to 0.60: 0.15s violent slam!)
          const slamT = (phase - 0.45) / 0.15;
          extension = Math.pow(slamT, 3.2);
          isCrush = true;
        } else if (phase < 0.72) {
          // Impact pause on floor (0.60 to 0.72)
          extension = 1.0;
        } else {
          // Smooth hydraulic retraction back to ceiling (0.72 to 1.0)
          const retractT = (phase - 0.72) / 0.28;
          extension = 1.0 - Math.sin(retractT * Math.PI * 0.5);
        }

        // Move rodGroup downward by (extension * strokeDistance)
        rodGroup.position.y = -extension * strokeDistance;

        // Dynamic world position of crushing hammer center
        const currentHammerWorldY = hammerRestWorldY + rodGroup.position.y;
        colliderCenter.set(x, currentHammerWorldY);

        obs.isCrushing = isCrush;

        // Flashing beacons flash rapidly right before slam
        const isPreSlam = phase > 0.28 && phase < 0.60;
        const flashRate = isPreSlam ? 24.0 : 4.0;
        const beaconOn = Math.sin(time * flashRate) > 0;
        beaconMat.color.setHex(beaconOn ? 0xff1100 : 0x330000);
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a High-Voltage Laser Barrier Forcefield Gate
   * Mandates jetpack flight: blocks the ground corridor, requiring player to soar over!
   */
  public spawnLaserGate(x: number, y: number = -3.70): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const gateHeight = 2.4;
    const gateWidth = 2.6;

    // Left and Right Industrial Emitter Pylons
    const pylonGeo = new THREE.BoxGeometry(0.40, gateHeight, 0.6);
    const pylonL = new THREE.Mesh(pylonGeo, this.darkIronMat);
    pylonL.position.set(-gateWidth / 2, gateHeight / 2, 0);
    group.add(pylonL);

    const pylonR = new THREE.Mesh(pylonGeo, this.darkIronMat);
    pylonR.position.set(gateWidth / 2, gateHeight / 2, 0);
    group.add(pylonR);

    // Hazard Stripes on Pylon Front
    const stripeGeo = new THREE.BoxGeometry(0.42, 0.35, 0.62);
    const stripeL = new THREE.Mesh(stripeGeo, this.hazardMat);
    stripeL.position.set(-gateWidth / 2, gateHeight * 0.3, 0);
    group.add(stripeL);

    const stripeR = new THREE.Mesh(stripeGeo, this.hazardMat);
    stripeR.position.set(gateWidth / 2, gateHeight * 0.3, 0);
    group.add(stripeR);

    // Flashing Strobe Beacons on top of Pylons
    const beaconGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
    const beaconL = new THREE.Mesh(beaconGeo, beaconMat);
    beaconL.position.set(-gateWidth / 2, gateHeight + 0.12, 0);
    group.add(beaconL);

    const beaconR = new THREE.Mesh(beaconGeo, beaconMat);
    beaconR.position.set(gateWidth / 2, gateHeight + 0.12, 0);
    group.add(beaconR);

    // Crackling Horizontal High-Voltage Laser Beams
    const beamCount = 4;
    const beamMeshes: THREE.Mesh[] = [];
    const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, gateWidth - 0.4, 8);
    beamGeo.rotateZ(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff1144,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    for (let b = 0; b < beamCount; b++) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 0.45 + b * 0.50, 0);
      group.add(beam);
      beamMeshes.push(beam);
    }

    // Holographic Floating Arrow Prompting Upward Flight
    const signGroup = new THREE.Group();
    signGroup.position.set(0, gateHeight + 0.65, 0);
    group.add(signGroup);

    const arrowGeo = new THREE.ConeGeometry(0.25, 0.4, 3);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, blending: THREE.AdditiveBlending });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    signGroup.add(arrow);

    this.scene.add(group);

    const colliderCenter = new THREE.Vector2(x, y + gateHeight / 2);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.LASER_GATE,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(gateWidth / 2 + 0.1, gateHeight / 2),
        center: colliderCenter,
      },
      destructible: false,
      health: 9999,
      active: true,
      update: (dt: number, time: number) => {
        // Crackling beam flicker
        const flicker = 0.85 + Math.sin(time * 28.0) * 0.15;
        beamMat.opacity = flicker;
        for (let b = 0; b < beamMeshes.length; b++) {
          beamMeshes[b].scale.y = 1.0 + Math.sin(time * 35.0 + b) * 0.08;
        }

        // Flashing beacons
        const beaconOn = Math.sin(time * 12.0) > 0;
        beaconMat.color.setHex(beaconOn ? 0xff1133 : 0x330008);

        // Bobbing floating flight arrow
        arrow.position.y = Math.sin(time * 6.0) * 0.12;
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a Tactical Blast Cover Barrier
   * Height 1.25m: Jones can crouch behind it for 100% cover from drone laser fire,
   * or stand upright to fire back over the top!
   */
  public spawnCoverBarrier(x: number, y: number = -3.70): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const bWidth = 1.6;
    const bHeight = 1.25;
    const bDepth = 0.55;

    // 1. Heavy Armor Plate Chassis (dark iron with beveled rim)
    const baseGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
    const barrierMesh = new THREE.Mesh(baseGeo, this.darkIronMat);
    barrierMesh.position.set(0, bHeight / 2, 0);
    group.add(barrierMesh);

    // 2. High-Visibility Hazard Chevrons along Top Lip
    const lipGeo = new THREE.BoxGeometry(bWidth + 0.08, 0.22, bDepth + 0.06);
    const lipMesh = new THREE.Mesh(lipGeo, this.hazardMat);
    lipMesh.position.set(0, bHeight - 0.11, 0);
    group.add(lipMesh);

    // 3. Glowing Cyan Energy Deflector Strips (visual indicator for bullet protection)
    const stripGeo = new THREE.BoxGeometry(bWidth * 0.75, 0.06, 0.05);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const stripMesh = new THREE.Mesh(stripGeo, stripMat);
    stripMesh.position.set(0, bHeight * 0.55, bDepth / 2 + 0.02);
    group.add(stripMesh);

    // 4. Heavy Ground Anchor Cleats
    for (const sx of [-bWidth / 2 + 0.15, bWidth / 2 - 0.15]) {
      const cleatGeo = new THREE.BoxGeometry(0.24, 0.15, bDepth + 0.16);
      const cleat = new THREE.Mesh(cleatGeo, this.steelMat);
      cleat.position.set(sx, 0.08, 0);
      group.add(cleat);
    }

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.COVER_BARRIER,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(bWidth / 2, bHeight / 2),
        center: new THREE.Vector2(x, y + bHeight / 2),
      },
      health: 999,
      destructible: false,
      active: true,
      update: () => {},
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
   * Spawns a Retro Sci-Fi Catwalk Platform (Cream deck with Amber runner stripe)
   */
  public spawnPlatform(x: number, y: number, width: number = 3.5, height: number = 0.5): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // Main walking deck (Bone cream with amber center stripe)
    const geo = new THREE.BoxGeometry(width, height, 1.3);
    const mesh = new THREE.Mesh(geo, this.outpostPlatformMat);
    group.add(mesh);

    // Dark steel bumper trims on front and back faces (cleanly separated, zero Z-fighting on top surface!)
    const bumperGeo = new THREE.BoxGeometry(width, height * 0.7, 0.08);
    const bumperFront = new THREE.Mesh(bumperGeo, this.darkIronMat);
    bumperFront.position.set(0, -0.05, 0.65);
    group.add(bumperFront);

    const bumperBack = new THREE.Mesh(bumperGeo, this.darkIronMat);
    bumperBack.position.set(0, -0.05, -0.65);
    group.add(bumperBack);

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
  /**
   * Spawns a High-Tech Sci-Fi Plasma Fuel Battery Cell
   * Features:
   * - Glowing cyan/emerald plasma containment core
   * - Ribbed industrial chrome & copper heat-sink end caps
   * - 3-bar LED energy status gauge
   * - Counter-rotating tilted atomic energy rings
   */
  public spawnFuelPickup(x: number, y: number): ActivePickup {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // 1. Glowing Plasma Core Cylinder
    const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.58, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    const plasmaCore = new THREE.Mesh(coreGeo, coreMat);
    group.add(plasmaCore);

    // Outer Translucent Crystalline Containment Tube
    const tubeGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.64, 16);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x60d5ff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.3,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    group.add(tube);

    // 2. Heavy Industrial Top & Bottom Heat-Sink End Caps
    const capGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12);
    const topCap = new THREE.Mesh(capGeo, this.steelMat);
    topCap.position.y = 0.36;
    group.add(topCap);

    const botCap = new THREE.Mesh(capGeo, this.steelMat);
    botCap.position.y = -0.36;
    group.add(botCap);

    // Copper Heat Sinks
    const finGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.04, 12);
    const fin1 = new THREE.Mesh(finGeo, this.bronzeMat);
    fin1.position.y = 0.31;
    group.add(fin1);
    const fin2 = new THREE.Mesh(finGeo, this.bronzeMat);
    fin2.position.y = -0.31;
    group.add(fin2);

    // Top Terminal Electrode / Spark Tip
    const tipGeo = new THREE.ConeGeometry(0.08, 0.16, 8);
    const tip = new THREE.Mesh(tipGeo, this.steelMat);
    tip.position.y = 0.48;
    group.add(tip);

    // 3. 3-Bar Glowing LED Charge Status Gauge
    const barGeo = new THREE.BoxGeometry(0.04, 0.08, 0.03);
    const barMaterials: THREE.MeshBasicMaterial[] = [];
    for (let b = 0; b < 3; b++) {
      const bMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      barMaterials.push(bMat);
      const bar = new THREE.Mesh(barGeo, bMat);
      bar.position.set(0, -0.14 + b * 0.14, 0.25);
      group.add(bar);
    }

    // 4. Orbiting Atomic Energy Rings
    const ringGroup = new THREE.Group();
    group.add(ringGroup);

    const ringGeo = new THREE.TorusGeometry(0.42, 0.022, 8, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 3;
    ringGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.y = Math.PI / 3;
    ringGroup.add(ring2);

    this.scene.add(group);

    const pickup: ActivePickup = {
      id: this.nextId++,
      type: PickupType.FUEL,
      mesh: group,
      position: group.position,
      radius: 0.65,
      active: true,
      update: (dt: number, time: number) => {
        // Continuous axial rotation and hovering bob
        group.rotation.y += 2.2 * dt;
        group.position.y = y + Math.sin(time * 3.8 + x) * 0.18;

        // Counter-rotating atomic electron rings
        ring1.rotation.z += 3.2 * dt;
        ring2.rotation.x -= 2.8 * dt;

        // Pulsing plasma core luminosity
        const pulse = 0.8 + Math.sin(time * 8.0) * 0.2;
        coreMat.opacity = pulse * 0.95;

        // Cascading LED charge bar sequence
        const cycle = (time * 6.0) % 3;
        for (let b = 0; b < 3; b++) {
          barMaterials[b].color.setHex(cycle >= b ? 0x00ff88 : 0x003318);
        }
      },
    };

    this.pickups.push(pickup);
    return pickup;
  }

  /**
   * Spawns a High-Tech Sci-Fi Quantum Credit Holo-Token
   * Features:
   * - Outer beveled gold coin medallion with sci-fi edge notches
   * - Counter-spinning glowing amber energy core
   * - Embossed holographic "JJ" insignia
   * - Pulsing translucent holographic energy halo
   */
  public spawnCoinPickup(x: number, y: number): ActivePickup {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // 1. Outer Beveled Metallic Gold Ring with Tech Notches
    const outerGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24);
    outerGeo.rotateX(Math.PI / 2);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffbb22,
      emissive: 0x442200,
      metalness: 0.95,
      roughness: 0.18,
    });
    const outerMedallion = new THREE.Mesh(outerGeo, goldMat);
    group.add(outerMedallion);

    // Outer edge tech notches
    const notchGeo = new THREE.BoxGeometry(0.08, 0.10, 0.10);
    for (let n = 0; n < 8; n++) {
      const angle = (n / 8) * Math.PI * 2;
      const notch = new THREE.Mesh(notchGeo, this.darkIronMat);
      notch.position.set(Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, 0);
      notch.rotation.z = angle;
      group.add(notch);
    }

    // 2. Counter-Rotating Inner Holographic Core
    const coreGroup = new THREE.Group();
    group.add(coreGroup);

    const innerGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.09, 16);
    innerGeo.rotateX(Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffd200,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
    });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerCore);

    // Embossed Central "JJ" Insignia Bars
    const jjBarGeo = new THREE.BoxGeometry(0.06, 0.22, 0.11);
    const jjBar1 = new THREE.Mesh(jjBarGeo, this.steelMat);
    jjBar1.position.set(-0.06, 0, 0);
    coreGroup.add(jjBar1);

    const jjBar2 = new THREE.Mesh(jjBarGeo, this.steelMat);
    jjBar2.position.set(0.06, 0, 0);
    coreGroup.add(jjBar2);

    // 3. Pulsing Holographic Energy Halo Ring
    const haloGeo = new THREE.RingGeometry(0.44, 0.54, 28);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    group.add(halo);

    this.scene.add(group);

    const pickup: ActivePickup = {
      id: this.nextId++,
      type: PickupType.COIN,
      mesh: group,
      position: group.position,
      radius: 0.55,
      active: true,
      update: (dt: number, time: number) => {
        // Outer medallion spins clockwise
        group.rotation.y += 3.4 * dt;
        group.position.y = y + Math.sin(time * 4.5 + x) * 0.14;

        // Inner core counter-rotates in reverse
        coreGroup.rotation.z -= 4.2 * dt;

        // Pulsing halo scale & shimmer
        const haloScale = 1.0 + Math.sin(time * 7.0) * 0.12;
        halo.scale.set(haloScale, haloScale, 1.0);
        haloMat.opacity = 0.40 + Math.sin(time * 8.0) * 0.25;
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

  public getHazardPlatforms(): { x: number; y: number; width: number; height: number }[] {
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

  public getPlatforms(): { x: number; y: number; width: number; height: number }[] {
    const list = this.getHazardPlatforms();
    // Crates act as physical solid platforms for player standing & stepping
    for (const crate of this.crates) {
      if (crate.active && !crate.isDestroyed) {
        list.push({
          x: crate.position.x,
          y: crate.position.y,
          width: crate.width,
          height: crate.height,
        });
      }
    }
    return list;
  }

  public update(dt: number, time: number, playerX: number, playerY: number = 0) {
    // Update and recycle obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (!obs.active) {
        this.obstacles.splice(i, 1);
        continue;
      }
      obs.update(dt, time);

      // Despawn if far behind camera
      if (obs.group.position.x < playerX - 25) {
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

      if (p.mesh.position.x < playerX - 25) {
        this.removePickup(p);
        this.pickups.splice(i, 1);
      }
    }

    // Update and recycle enemies
    const hazardPlatforms = this.getHazardPlatforms();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, time, playerX, playerY, hazardPlatforms);

      if (!e.active || e.position.x < playerX - 25) {
        if (e.position.x < playerX - 25 || !e.active) {
          e.destroy(this.scene);
        }
        this.enemies.splice(i, 1);
      }
    }

    // Update and recycle attack drones
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      d.update(dt, time, playerX, playerY);

      // Only recycle attack drone when death explosion has fully finished
      if ((!d.active && !d.isDying) || d.position.x < playerX - 35) {
        d.destroy(this.scene);
        this.drones.splice(i, 1);
      }
    }

    // Update and recycle physics crates
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.update(dt, time, hazardPlatforms);

      if (!c.active && c.isDestroyed && c.position.x < playerX - 30) {
        c.destroy(this.scene);
        this.crates.splice(i, 1);
      } else if (c.position.x < playerX - 35) {
        c.destroy(this.scene);
        this.crates.splice(i, 1);
      }
    }

    // Update Pickup Particle & Shockwave FX
    for (const p of this.fxParticles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 14.0 * dt; // gravity arc
      p.mesh.position.addScaledVector(p.velocity, dt);
      const prog = p.age / p.maxLife;
      const s = p.baseScale * (1.0 - prog * 0.75);
      p.mesh.scale.set(s, s, s);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - prog);
    }

    for (const sw of this.fxShockwaves) {
      if (!sw.active) continue;
      sw.age += dt;
      if (sw.age >= sw.maxLife) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const prog = sw.age / sw.maxLife;
      const s = 0.35 + Math.sin(prog * Math.PI * 0.5) * 3.6;
      sw.mesh.scale.set(s, s, s);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - prog);
    }

    // Resolve non-intersection collisions between enemies, drones, crates, and obstacles
    this.resolveEntityCollisions();
  }

  /**
   * Spawns AAA Particle Burst & Shockwave Ring on Collectible Pickup
   */
  public spawnPickupFX(x: number, y: number, type: PickupType) {
    // 1. Expanding Shockwave Ring
    const sw = this.fxShockwaves.find(s => !s.active);
    if (sw) {
      sw.active = true;
      sw.age = 0;
      sw.mesh.position.set(x, y, 0.08);
      sw.mesh.scale.set(0.2, 0.2, 0.2);
      (sw.mesh.material as THREE.MeshBasicMaterial).color.setHex(type === PickupType.FUEL ? 0x00f5ff : 0xffbb00);
      sw.mesh.visible = true;
    }

    // 2. Bursting Spark Particles
    const count = type === PickupType.FUEL ? 20 : 26;
    let spawned = 0;
    for (const p of this.fxParticles) {
      if (p.active) continue;
      p.active = true;
      p.age = 0;
      p.maxLife = 0.38 + Math.random() * 0.25;
      p.baseScale = 0.9 + Math.random() * 0.5;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.15, y + (Math.random() - 0.5) * 0.15, 0.08);

      const angle = (spawned / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 2.8 + Math.random() * 4.2;
      p.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed + (type === PickupType.FUEL ? 2.6 : 1.2),
        0
      );

      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(
        type === PickupType.FUEL
          ? (spawned % 2 === 0 ? 0x00f5ff : 0x39ff14)
          : (spawned % 2 === 0 ? 0xffea00 : 0xff8800)
      );
      p.mesh.scale.set(p.baseScale, p.baseScale, p.baseScale);
      p.mesh.visible = true;

      spawned++;
      if (spawned >= count) break;
    }
  }

  /**
   * Complete Non-Intersection System:
   * Prevents blobs, drones, crates, platforms, and obstacles from intersecting each other
   */
  private resolveEntityCollisions() {
    const rawPlatforms = this.obstacles
      .filter(o => o.active && o.type === ObstacleType.HAZARD_PLATFORM && o.collider && o.collider.halfSize)
      .map(o => ({
        x: o.group.position.x,
        y: o.group.position.y,
        width: o.collider.halfSize!.x * 2,
        height: o.collider.halfSize!.y * 2,
      }));

    // 1. Blob Enemies vs Blob Enemies (Push apart so blobs never merge)
    for (let i = 0; i < this.enemies.length; i++) {
      const e1 = this.enemies[i];
      if (!e1.active) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const e2 = this.enemies[j];
        if (!e2.active) continue;

        const dx = e1.position.x - e2.position.x;
        const dy = e1.position.y - e2.position.y;
        const minDist = e1.radius + e2.radius;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          e1.position.x += nx * push;
          e2.position.x -= nx * push;

          // If moving towards each other, bounce patrol directions
          if (e1.patrolDir * (e2.position.x - e1.position.x) > 0) e1.patrolDir *= -1;
          if (e2.patrolDir * (e1.position.x - e2.position.x) > 0) e2.patrolDir *= -1;
        }
      }
    }

    // 2. Drone Enemies vs Drone Enemies (Push apart to maintain air formation)
    for (let i = 0; i < this.drones.length; i++) {
      const d1 = this.drones[i];
      if (!d1.active) continue;
      for (let j = i + 1; j < this.drones.length; j++) {
        const d2 = this.drones[j];
        if (!d2.active) continue;

        const dx = d1.position.x - d2.position.x;
        const dy = d1.position.y - d2.position.y;
        const minDist = d1.radius + d2.radius + 0.20;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          d1.position.x += nx * push;
          d1.position.y += ny * push;
          d2.position.x -= nx * push;
          d2.position.y -= ny * push;
        }
      }
    }

    // 3. Drone Enemies vs Blob Enemies (Push drone upward/away from blob)
    for (const d of this.drones) {
      if (!d.active) continue;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const dx = d.position.x - e.position.x;
        const dy = d.position.y - (e.position.y + 0.35);
        const minDist = d.radius + e.radius + 0.15;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = minDist - dist;
          d.position.y += Math.max(0.4, dy / dist) * push;
        }
      }
    }

    // 4. Blobs vs Crates & Solid Obstacles (Cannot walk through crates or machinery)
    for (const e of this.enemies) {
      if (!e.active) continue;

      // Crates
      for (const c of this.crates) {
        if (!c.active || c.isDestroyed) continue;
        const distToCenter = e.position.x - c.position.x;
        const combinedHalfW = c.halfW + e.radius;
        const vertOverlap = e.position.y < c.position.y + c.halfH - 0.05 && e.position.y + 0.8 > c.position.y - c.halfH;

        if (vertOverlap && Math.abs(distToCenter) < combinedHalfW) {
          if (distToCenter > 0) {
            e.position.x = c.position.x + combinedHalfW;
            e.patrolDir = 1;
          } else {
            e.position.x = c.position.x - combinedHalfW;
            e.patrolDir = -1;
          }
          e.velocity.x = e.patrolDir * Math.abs(e.velocity.x);
        }
      }

      // Solid Machine Obstacles (e.g. Plasma Tube base, gears)
      for (const obs of this.obstacles) {
        if (!obs.active || obs.type === ObstacleType.HAZARD_PLATFORM) continue;
        const obsPos = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y);
        if (obs.collider.type === 'box' && obs.collider.halfSize) {
          const half = obs.collider.halfSize;
          const dx = e.position.x - obsPos.x;
          const combinedHalfW = half.x + e.radius;
          const vertOverlap = e.position.y < obsPos.y + half.y - 0.1 && e.position.y + 0.8 > obsPos.y - half.y;
          if (vertOverlap && Math.abs(dx) < combinedHalfW) {
            if (dx > 0) {
              e.position.x = obsPos.x + combinedHalfW;
              e.patrolDir = 1;
            } else {
              e.position.x = obsPos.x - combinedHalfW;
              e.patrolDir = -1;
            }
            e.velocity.x = e.patrolDir * Math.abs(e.velocity.x);
          }
        }
      }
    }

    // 5. Drones vs Platforms, Crates, and Machine Obstacles (Never pass through solid surfaces)
    for (const d of this.drones) {
      if (!d.active) continue;

      // Check Platforms
      for (const plat of rawPlatforms) {
        const platHalfW = plat.width / 2;
        const platHalfH = plat.height / 2;
        const cx = THREE.MathUtils.clamp(d.position.x, plat.x - platHalfW, plat.x + platHalfW);
        const cy = THREE.MathUtils.clamp(d.position.y, plat.y - platHalfH, plat.y + platHalfH);
        const dx = d.position.x - cx;
        const dy = d.position.y - cy;
        const distSq = dx * dx + dy * dy;
        const combinedR = d.radius + 0.08;

        if (distSq < combinedR * combinedR) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const push = combinedR - dist;
            d.position.x += (dx / dist) * push;
            d.position.y += (dy / dist) * push;
          } else {
            d.position.y = plat.y + platHalfH + combinedR;
          }
        }
      }

      // Check Crates
      for (const c of this.crates) {
        if (!c.active || c.isDestroyed) continue;
        const cx = THREE.MathUtils.clamp(d.position.x, c.position.x - c.halfW, c.position.x + c.halfW);
        const cy = THREE.MathUtils.clamp(d.position.y, c.position.y - c.halfH, c.position.y + c.halfH);
        const dx = d.position.x - cx;
        const dy = d.position.y - cy;
        const distSq = dx * dx + dy * dy;
        const combinedR = d.radius + 0.08;

        if (distSq < combinedR * combinedR) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const push = combinedR - dist;
            d.position.x += (dx / dist) * push;
            d.position.y += (dy / dist) * push;
          } else {
            d.position.y = c.position.y + c.halfH + combinedR;
          }
        }
      }

      // Check Obstacles (Pistons, Plasma Tubes, Gears)
      for (const obs of this.obstacles) {
        if (!obs.active || obs.type === ObstacleType.HAZARD_PLATFORM) continue;
        const obsPos = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y);
        if (obs.collider.type === 'box' && obs.collider.halfSize) {
          const half = obs.collider.halfSize;
          const cx = THREE.MathUtils.clamp(d.position.x, obsPos.x - half.x, obsPos.x + half.x);
          const cy = THREE.MathUtils.clamp(d.position.y, obsPos.y - half.y, obsPos.y + half.y);
          const dx = d.position.x - cx;
          const dy = d.position.y - cy;
          const distSq = dx * dx + dy * dy;
          const combinedR = d.radius + 0.08;
          if (distSq < combinedR * combinedR) {
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const push = combinedR - dist;
              d.position.x += (dx / dist) * push;
              d.position.y += (dy / dist) * push;
            } else {
              d.position.y = obsPos.y + half.y + combinedR;
            }
          }
        } else if (obs.collider.type === 'circle' && obs.collider.radius) {
          const dx = d.position.x - obsPos.x;
          const dy = d.position.y - obsPos.y;
          const minDist = obs.collider.radius + d.radius + 0.08;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const push = minDist - dist;
            d.position.x += (dx / dist) * push;
            d.position.y += (dy / dist) * push;
          }
        }
      }
    }
  }
}
