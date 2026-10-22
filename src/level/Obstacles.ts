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
  COVER_BARRIER = 'cover_barrier',
  ALIEN_SNAPPER = 'alien_snapper',
  SPORE_SPIRE = 'spore_spire',
  SKY_MAZE_WALL = 'sky_maze_wall',
  ALIEN_CYBER_SENTINEL = 'alien_cyber_sentinel'
}

function createRoundedBoxGeo(
  width: number,
  height: number,
  depth: number,
  radius: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = Math.min(radius, w / 2 - 0.05, h / 2 - 0.05);

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: Math.max(0.05, depth - r * 2),
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  return geo;
}

export enum PickupType {
  FUEL = 'fuel',
  COIN = 'coin',
  HEART = 'heart',
  JETPACK_UPGRADE = 'jetpack_upgrade'
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
    crate.onDestroy = (cx: number, cy: number) => {
      // Guaranteed collectible drops when a crate is destroyed!
      if (Math.random() > 0.40) {
        this.spawnCoinPickup(cx, cy + 0.45);
      } else {
        this.spawnFuelPickup(cx, cy + 0.45);
      }
    };
    this.crates.push(crate);
    return crate;
  }

  public spawnBlob(x: number, y: number, patrolRange: number = 3.5): EnemyBlob {
    const blob = new EnemyBlob(this.scene, x, y, patrolRange);
    this.enemies.push(blob);
    return blob;
  }

  public spawnDrone(x: number, y: number = 1.2, patrolRange: number = 6.0, isAlien: boolean = false): DroneEnemy {
    const drone = new DroneEnemy(this.scene, x, y, patrolRange, isAlien);
    this.drones.push(drone);
    return drone;
  }

  /**
   * Spawns a Giant Steel Cog/Gear (from Image 2)
   */
  /**
   * Spawns an Ultra-Modern Sci-Fi Grav-Rotor Hazard Wheel
   * Features:
   * - Redesigned sleek cybernetic aesthetics completely replacing outdated industrial parts
   * - Center Hub: Quantum Singularity Plasma Core surrounded by dual magnetic gimbal containment rings
   * - Sleek aerodynamic carbon-composite impeller blades with high-frequency neon cyan plasma cutting emitters
   * - Counter-rotating inner hyper-vortex vanes
   * - Pulsing animated energy halos and dynamic glow
   */
  public spawnGear(x: number, y: number, radius: number = 2.2, speed: number = 1.0): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // 1. Sleek Matte Carbon-Composite Outer Chassis Ring
    const outerRingGeo = new THREE.TorusGeometry(radius * 0.88, radius * 0.08, 16, 48);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x15181f,
      metalness: 0.85,
      roughness: 0.25,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, chassisMat);
    group.add(outerRing);

    // 2. High-Tech Luminous Cyan Magnetic Flux Conduit Rail
    const conduitGeo = new THREE.TorusGeometry(radius * 0.88, radius * 0.022, 12, 48);
    const cyanPlasmaMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const conduitMesh = new THREE.Mesh(conduitGeo, cyanPlasmaMat);
    group.add(conduitMesh);

    // 3. Modern Aerodynamic Sci-Fi Cutter Blades with Glowing Cyan Plasma Edges
    const bladeCount = 8;
    const bladeAngle = (Math.PI * 2) / bladeCount;
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      metalness: 0.9,
      roughness: 0.2,
    });
    const plasmaEdgeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
    });

    for (let i = 0; i < bladeCount; i++) {
      const angle = i * bladeAngle;
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(Math.cos(angle) * (radius * 0.92), Math.sin(angle) * (radius * 0.92), 0);
      bladeGroup.rotation.z = angle;

      // Sleek angular blade spar
      const sparGeo = new THREE.BoxGeometry(radius * 0.28, 0.16, 0.18);
      const spar = new THREE.Mesh(sparGeo, bladeMat);
      bladeGroup.add(spar);

      // Razor-sharp high-frequency plasma emitter cutting tip
      const tipGeo = new THREE.ConeGeometry(0.12, radius * 0.30, 4);
      tipGeo.rotateZ(-Math.PI / 2);
      const tip = new THREE.Mesh(tipGeo, plasmaEdgeMat);
      tip.position.set(radius * 0.22, 0, 0);
      bladeGroup.add(tip);

      // Embedded energy micro-conduit on blade face
      const lineGeo = new THREE.BoxGeometry(radius * 0.22, 0.03, 0.20);
      const line = new THREE.Mesh(lineGeo, cyanPlasmaMat);
      line.position.set(0, 0, 0);
      bladeGroup.add(line);

      group.add(bladeGroup);
    }

    // 4. Sleek Aerodynamic Tri-Spoke Carbon Chassis (Open, Modern Architecture)
    const spokeCount = 3;
    const spokeAngle = (Math.PI * 2) / spokeCount;
    const spokeGeo = new THREE.BoxGeometry(radius * 0.65, 0.18, 0.14);
    for (let s = 0; s < spokeCount; s++) {
      const angle = s * spokeAngle;
      const spoke = new THREE.Mesh(spokeGeo, chassisMat);
      spoke.position.set(Math.cos(angle) * (radius * 0.42), Math.sin(angle) * (radius * 0.42), 0);
      spoke.rotation.z = angle;
      group.add(spoke);

      // Neon conduit running down each spoke
      const spokeLineGeo = new THREE.BoxGeometry(radius * 0.62, 0.03, 0.16);
      const spokeLine = new THREE.Mesh(spokeLineGeo, cyanPlasmaMat);
      spokeLine.position.set(Math.cos(angle) * (radius * 0.42), Math.sin(angle) * (radius * 0.42), 0);
      spokeLine.rotation.z = angle;
      group.add(spokeLine);
    }

    // 5. High-Speed Counter-Rotating Hyper-Vortex Impeller
    const innerTurbine = new THREE.Group();
    group.add(innerTurbine);

    const vaneCount = 5;
    const vaneGeo = new THREE.BoxGeometry(0.06, radius * 0.35, 0.12);
    for (let v = 0; v < vaneCount; v++) {
      const angle = (v / vaneCount) * Math.PI * 2;
      const vane = new THREE.Mesh(vaneGeo, bladeMat);
      vane.position.set(Math.cos(angle) * (radius * 0.22), Math.sin(angle) * (radius * 0.22), 0.04);
      vane.rotation.z = angle + 0.45; // Sleek turbine pitch
      innerTurbine.add(vane);
    }

    // 6. ULTRA-MODERN SCI-FI CENTER HUB: QUANTUM SINGULARITY PLASMA CORE & GIMBAL CONFINEMENT
    // (Completely eliminates outdated hex nut, bronze hub and industrial bolts!)
    const hubCenterGroup = new THREE.Group();
    group.add(hubCenterGroup);

    // Sleek titanium containment ring around core
    const innerGimbalGeo = new THREE.TorusGeometry(radius * 0.28, radius * 0.035, 16, 32);
    const innerGimbal = new THREE.Mesh(innerGimbalGeo, this.steelMat);
    hubCenterGroup.add(innerGimbal);

    // Glowing Neon Holographic Gimbal Halo
    const haloRingGeo = new THREE.RingGeometry(radius * 0.22, radius * 0.28, 32);
    const haloRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const haloMesh = new THREE.Mesh(haloRingGeo, haloRingMat);
    haloMesh.position.z = 0.08;
    hubCenterGroup.add(haloMesh);

    // Floating Polyhedral Quantum Antimatter / Plasma Reactor Core
    const coreGeo = new THREE.IcosahedronGeometry(radius * 0.15, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.z = 0.05;
    hubCenterGroup.add(coreMesh);

    // Holographic Wireframe Overlayer for high-tech cyber lattice look
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const wireCore = new THREE.Mesh(coreGeo, wireMat);
    wireCore.position.z = 0.05;
    wireCore.scale.setScalar(1.08);
    hubCenterGroup.add(wireCore);

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
        // Main sci-fi rotor rotation
        group.rotation.z += speed * dt;
        // Inner hyper-vortex counter-rotates in reverse at high speed
        innerTurbine.rotation.z -= speed * 2.8 * dt;
        // Quantum singularity core spins along local axes
        coreMesh.rotation.x += 3.5 * dt;
        coreMesh.rotation.y += 2.8 * dt;
        wireCore.rotation.x -= 2.0 * dt;
        wireCore.rotation.z += 2.5 * dt;
        // High-energy quantum pulse
        const pulse = 0.85 + Math.sin(time * 9.0) * 0.15;
        coreMat.color.setRGB(0.0, 1.0 * pulse, 1.0 * pulse);
        plasmaEdgeMat.opacity = 0.80 + Math.sin(time * 12.0) * 0.20;
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
   * Spawns a Modern Sci-Fi Tactical Blast Cover Barrier
   * Height 1.25m: Jones can crouch behind it for 100% cover from laser fire,
   * or stand upright to fire back over the top!
   * Sleek dark titanium chassis with glowing electric cyan holographic energy blast-plate.
   * Completely avoids obsolete hazard stripes for a pristine futuristic aesthetic.
   */
  public spawnCoverBarrier(x: number, y: number = -3.70): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const bWidth = 1.6;
    const bHeight = 1.25;
    const bDepth = 0.55;

    // 1. Sleek Modern Dark Titanium Armor Chassis with Chamfered Flanks
    const baseGeo = new THREE.BoxGeometry(bWidth, bHeight * 0.72, bDepth);
    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x161b22,
      metalness: 0.88,
      roughness: 0.22,
    });
    const barrierMesh = new THREE.Mesh(baseGeo, darkTitaniumMat);
    barrierMesh.position.set(0, (bHeight * 0.72) / 2, 0);
    group.add(barrierMesh);

    // 2. Translucent Electric Cyan Holographic Blast Shield Plate across top
    const shieldPlateGeo = new THREE.BoxGeometry(bWidth - 0.08, bHeight * 0.38, 0.12);
    const shieldPlateMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      emissive: 0x003344,
      roughness: 0.08,
      metalness: 0.15,
      transmission: 0.75,
      transparent: true,
      opacity: 0.85,
    });
    const shieldPlate = new THREE.Mesh(shieldPlateGeo, shieldPlateMat);
    shieldPlate.position.set(0, bHeight - (bHeight * 0.38) / 2, 0);
    group.add(shieldPlate);

    // 3. Top Armored Reinforcement Crest (Brushed Chrome)
    const crestGeo = new THREE.BoxGeometry(bWidth + 0.04, 0.08, bDepth * 0.4);
    const crestMesh = new THREE.Mesh(crestGeo, this.steelMat);
    crestMesh.position.set(0, bHeight + 0.04, 0);
    group.add(crestMesh);

    // 4. Recessed Status LED Indicator Lightbars (Electric Cyan & Emerald Status)
    const ledGeo = new THREE.BoxGeometry(bWidth * 0.85, 0.04, 0.04);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const ledFront = new THREE.Mesh(ledGeo, ledMat);
    ledFront.position.set(0, bHeight * 0.72 - 0.04, bDepth / 2 + 0.015);
    group.add(ledFront);

    // 5. Dual Heavy Hydraulic Magnetic Ground Anchors
    for (const sx of [-bWidth / 2 + 0.18, bWidth / 2 - 0.18]) {
      const anchorGeo = new THREE.BoxGeometry(0.26, 0.20, bDepth + 0.18);
      const anchor = new THREE.Mesh(anchorGeo, this.steelMat);
      anchor.position.set(sx, 0.10, 0);
      group.add(anchor);

      const boltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8);
      const bolt = new THREE.Mesh(boltGeo, this.steelMat);
      bolt.position.set(sx, 0.22, bDepth / 2 + 0.04);
      group.add(bolt);
    }

    this.scene.add(group);

    // Ensure NO collectables ever overlap or intersect with this barrier
    for (const p of this.pickups) {
      if (p.active) {
        const bMinX = x - bWidth / 2 - 0.55;
        const bMaxX = x + bWidth / 2 + 0.55;
        const bMaxY = y + bHeight + 0.55;
        if (p.position.x >= bMinX && p.position.x <= bMaxX && p.position.y <= bMaxY) {
          p.position.x = p.position.x >= x ? bMaxX + 0.35 : bMinX - 0.35;
          p.mesh.position.x = p.position.x;
        }
      }
    }

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
   * Spawns an Exotic Bioluminescent Snapper Plant (Alien Venus Carnivore)
   * Beautiful exotic plant that sways gently, tracks the player, and snaps shut with
   * needle-sharp crystalline fangs when the player gets within 4.5m!
   * Can be shot and destroyed by blaster shots (takes 2 hits).
   */
  /**
   * Spawns an Alien Cyber Sentinel (Biomechanical Quadruped Stalker)
   * Heavy armored predator with titanium/obsidian carapace, glowing crimson optics,
   * 4 articulated hydraulic scythe legs, and dorsal plasma projector.
   * Paces along ground/platforms and attacks the player! Takes 3 hits to destroy.
   */
  public spawnAlienCyberSentinel(x: number, y: number = -3.70): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // Modern White & Chrome Chassis with Flashing Blue Buttons
    const whiteChassisMat = new THREE.MeshStandardMaterial({
      color: 0xf4f7fa,
      metalness: 0.12,
      roughness: 0.20,
    });
    const jointChromeMat = new THREE.MeshStandardMaterial({
      color: 0xdae2ec,
      metalness: 0.95,
      roughness: 0.10,
    });
    const darkTrimMat = new THREE.MeshBasicMaterial({
      color: 0x0a101d,
    });
    const glowBlueVisorMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
    });

    const bodyRoot = new THREE.Group();
    bodyRoot.position.set(0, 0.65, 0);
    group.add(bodyRoot);

    // 1. Sleek Modern Rounded White Carapace / Torso
    const thoraxGeo = createRoundedBoxGeo(0.92, 0.42, 0.50, 0.10);
    const thorax = new THREE.Mesh(thoraxGeo, whiteChassisMat);
    bodyRoot.add(thorax);

    // Dark Accent Spine Strip
    const spineStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.06, 0.14),
      darkTrimMat
    );
    spineStrip.position.set(0, 0.22, 0);
    bodyRoot.add(spineStrip);

    // Flashing Electric Blue LED Buttons (3 on left flank, 3 on right flank = 6 total)
    const ledMaterials: THREE.MeshBasicMaterial[] = [];
    for (const zSide of [0.26, -0.26]) {
      // Recessed console plate
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.14, 0.03),
        darkTrimMat
      );
      plate.position.set(0, 0.05, zSide);
      bodyRoot.add(plate);

      // 3 flashing rounded buttons
      for (let b = 0; b < 3; b++) {
        const bx = -0.18 + b * 0.18;
        const bMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
        ledMaterials.push(bMat);

        const btnGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12);
        btnGeo.rotateX(Math.PI / 2);
        const btn = new THREE.Mesh(btnGeo, bMat);
        btn.position.set(bx, 0.05, zSide + (zSide > 0 ? 0.02 : -0.02));
        bodyRoot.add(btn);
      }
    }

    // 2. Modern Aerodynamic Rounded Canine Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0.52, 0.06, 0);
    bodyRoot.add(headGroup);

    const headGeo = createRoundedBoxGeo(0.44, 0.30, 0.36, 0.08);
    const head = new THREE.Mesh(headGeo, whiteChassisMat);
    headGroup.add(head);

    // Sleek Electric Blue Visor Slit
    const visorGeo = new THREE.BoxGeometry(0.12, 0.08, 0.30);
    const visor = new THREE.Mesh(visorGeo, glowBlueVisorMat);
    visor.position.set(0.18, 0.04, 0);
    headGroup.add(visor);

    // Modern Cyber Dog Ears (Angled back)
    for (const zEar of [-0.15, 0.15]) {
      const earGeo = new THREE.ConeGeometry(0.04, 0.18, 5);
      earGeo.rotateZ(0.55);
      const ear = new THREE.Mesh(earGeo, whiteChassisMat);
      ear.position.set(-0.12, 0.18, zEar);
      headGroup.add(ear);
    }

    // Modern Chrome Audio Sensor Grill / Chin
    const chin = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.22),
      jointChromeMat
    );
    chin.position.set(0.15, -0.10, 0);
    headGroup.add(chin);

    // 3. Dorsal Compact Plasma Pulse Coil
    const cannonBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.10, 14),
      jointChromeMat
    );
    cannonBase.position.set(-0.16, 0.26, 0);
    bodyRoot.add(cannonBase);

    const cannonBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.36, 10),
      whiteChassisMat
    );
    cannonBarrel.rotateZ(-Math.PI / 2);
    cannonBarrel.position.set(0.08, 0.28, 0);
    bodyRoot.add(cannonBarrel);

    const blueCoilRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.014, 8, 16),
      glowBlueVisorMat
    );
    blueCoilRing.rotateY(Math.PI / 2);
    blueCoilRing.position.set(0.06, 0.28, 0);
    bodyRoot.add(blueCoilRing);

    // 4. Four Articulated White Legs with Chrome Knees & Blue LED Rings
    const legs: { upper: THREE.Group; lower: THREE.Group; isFront: boolean }[] = [];
    const legXOffsets = [0.28, -0.28];
    const legZOffsets = [0.27, -0.27];

    for (const lx of legXOffsets) {
      for (const lz of legZOffsets) {
        const isFront = lx > 0;
        const upperLeg = new THREE.Group();
        upperLeg.position.set(lx, -0.10, lz);
        bodyRoot.add(upperLeg);

        // White upper thigh casing
        const thighGeo = createRoundedBoxGeo(0.08, 0.34, 0.08, 0.02);
        thighGeo.translate(0, -0.17, 0);
        const thigh = new THREE.Mesh(thighGeo, whiteChassisMat);
        upperLeg.add(thigh);

        // Polished chrome knee joint with Blue LED ring
        const knee = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 10, 10),
          jointChromeMat
        );
        knee.position.set(0, -0.34, 0);
        upperLeg.add(knee);

        const kneeRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.056, 0.010, 6, 12),
          glowBlueVisorMat
        );
        kneeRing.rotateX(Math.PI / 2);
        kneeRing.position.set(0, -0.34, 0);
        upperLeg.add(kneeRing);

        // Lower leg white paw
        const lowerLeg = new THREE.Group();
        lowerLeg.position.set(0, -0.34, 0);
        upperLeg.add(lowerLeg);

        const shinGeo = new THREE.ConeGeometry(0.038, 0.38, 6);
        shinGeo.rotateX(Math.PI);
        shinGeo.translate(0, -0.19, 0);
        const shin = new THREE.Mesh(shinGeo, whiteChassisMat);
        lowerLeg.add(shin);

        legs.push({ upper: upperLeg, lower: lowerLeg, isFront });
      }
    }

    this.scene.add(group);

    // Robust Platform Edge Detection:
    // Determine minX and maxX so the robot dog NEVER walks off platform edges into air!
    const startX = x;
    let minX = startX - 2.8;
    let maxX = startX + 2.8;

    if (y > -3.5) {
      // Find platform underneath this elevated patrol dog
      const platforms = this.getPlatforms();
      const plat = platforms.find(p => {
        const pTop = p.y + p.height / 2;
        const pLeft = p.x - p.width / 2;
        const pRight = p.x + p.width / 2;
        return Math.abs(y - pTop) < 0.35 && x >= pLeft && x <= pRight;
      });

      if (plat) {
        // Keep 0.45m clearance from both edges so it NEVER falls off
        minX = plat.x - plat.width / 2 + 0.45;
        maxX = plat.x + plat.width / 2 - 0.45;
        if (maxX < minX) {
          // Very narrow platform: center it
          minX = plat.x - 0.2;
          maxX = plat.x + 0.2;
        }
      }
    }

    let patrolDir = 1;
    let walkPhase = Math.random() * Math.PI * 2;
    let currentX = THREE.MathUtils.clamp(x, minX, maxX);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.ALIEN_CYBER_SENTINEL,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(0.75, 0.65),
        center: new THREE.Vector2(x, y + 0.65),
      },
      health: 3,
      destructible: true,
      active: true,
      update: (dt: number, time: number) => {
        // Flashing Electric Blue LED Buttons Pattern
        for (let i = 0; i < ledMaterials.length; i++) {
          const pulse = Math.sin(time * 14.0 + i * 1.3);
          const isBright = pulse > -0.2;
          ledMaterials[i].color.setHex(isBright ? 0x00f5ff : 0x002244);
        }

        // Stalking Patrol Navigation with strict Edge Boundaries (never falls off!)
        currentX += patrolDir * 1.6 * dt;
        if (currentX >= maxX) {
          currentX = maxX;
          patrolDir = -1;
        } else if (currentX <= minX) {
          currentX = minX;
          patrolDir = 1;
        }

        group.position.x = currentX;
        if (obs.collider.center) {
          obs.collider.center.x = currentX;
          obs.collider.center.y = group.position.y + 0.65;
        }

        // Smooth Turn Face Direction
        group.scale.x = patrolDir;

        // Animate 4-Leg Stalking Canine Gait
        walkPhase += dt * 7.5;
        for (let i = 0; i < legs.length; i++) {
          const l = legs[i];
          const phaseOffset = i % 2 === 0 ? 0 : Math.PI;
          const legAngle = Math.sin(walkPhase + phaseOffset) * 0.48;
          l.upper.rotation.z = legAngle;
          l.lower.rotation.z = -Math.abs(legAngle) * 0.65;
        }

        // Body Breathing & Head Hunting Sway
        bodyRoot.position.y = 0.65 + Math.abs(Math.sin(walkPhase * 2)) * 0.06;
        headGroup.rotation.y = Math.sin(time * 2.5) * 0.22;
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  // Legacy Plant Forwarders -> Automatically Replaced by Alien Cyber Sentinel!
  public spawnAlienSnapper(x: number, y: number = -3.70): ActiveObstacle {
    return this.spawnAlienCyberSentinel(x, y);
  }

  public spawnSporeSpire(x: number, y: number = -3.70): ActiveObstacle {
    return this.spawnAlienCyberSentinel(x, y);
  }

  /**
   * Spawns a high-voltage deadly Sky Maze Laser Barrier Wall
   * Touching this wall causes INSTANT DEATH to the player!
   */
  public spawnSkyMazeWall(x: number, y: number, width: number, height: number): ActiveObstacle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x11131a,
      metalness: 0.9,
      roughness: 0.2,
    });
    const isHorizontal = width >= height;

    if (isHorizontal) {
      const railGeo = new THREE.BoxGeometry(width + 0.3, 0.14, 0.45);
      const railTop = new THREE.Mesh(railGeo, frameMat);
      railTop.position.set(0, height / 2, 0);
      group.add(railTop);

      const railBot = new THREE.Mesh(railGeo, frameMat);
      railBot.position.set(0, -height / 2, 0);
      group.add(railBot);

      const nodeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 12);
      const nodeL = new THREE.Mesh(nodeGeo, this.steelMat);
      nodeL.position.set(-width / 2, 0, 0);
      group.add(nodeL);
      const nodeR = new THREE.Mesh(nodeGeo, this.steelMat);
      nodeR.position.set(width / 2, 0, 0);
      group.add(nodeR);
    } else {
      const postGeo = new THREE.BoxGeometry(0.14, height + 0.3, 0.45);
      const postL = new THREE.Mesh(postGeo, frameMat);
      postL.position.set(-width / 2, 0, 0);
      group.add(postL);

      const postR = new THREE.Mesh(postGeo, frameMat);
      postR.position.set(width / 2, 0, 0);
      group.add(postR);

      const nodeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 12);
      nodeGeo.rotateX(Math.PI / 2);
      const nodeT = new THREE.Mesh(nodeGeo, this.steelMat);
      nodeT.position.set(0, height / 2, 0);
      group.add(nodeT);
      const nodeB = new THREE.Mesh(nodeGeo, this.steelMat);
      nodeB.position.set(0, -height / 2, 0);
      group.add(nodeB);
    }

    // High-Voltage Bio-Plasma Laser Curtain (Lethal Violet-Magenta Field with Cyan Core)
    const energyGeo = new THREE.PlaneGeometry(width, height);
    const energyMat = new THREE.MeshBasicMaterial({
      color: 0xaa00ff,
      transparent: true,
      opacity: 0.80,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const energyCurtain = new THREE.Mesh(energyGeo, energyMat);
    group.add(energyCurtain);

    const coreBeamGeo = isHorizontal
      ? new THREE.BoxGeometry(width, 0.08, 0.12)
      : new THREE.BoxGeometry(0.08, height, 0.12);
    const coreBeamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const coreBeam = new THREE.Mesh(coreBeamGeo, coreBeamMat);
    group.add(coreBeam);

    this.scene.add(group);

    const obs: ActiveObstacle = {
      id: this.nextId++,
      type: ObstacleType.SKY_MAZE_WALL,
      group,
      collider: {
        type: 'box',
        halfSize: new THREE.Vector2(width / 2, height / 2),
        center: new THREE.Vector2(x, y),
      },
      destructible: false,
      health: 99999,
      active: true,
      update: (dt: number, time: number) => {
        const pulse = 0.70 + Math.sin(time * 16.0 + x) * 0.30;
        energyMat.opacity = pulse * 0.85;
        const hueShift = 0.5 + Math.sin(time * 8.0) * 0.5;
        energyMat.color.setRGB(0.7 + 0.3 * hueShift, 0.1 * hueShift, 1.0);
      },
    };

    this.obstacles.push(obs);
    return obs;
  }

  /**
   * Spawns a high-altitude deadly Sky Maze in Level 2 with rich collectibles!
   * Touching ANY wall of the maze causes INSTANT DEATH.
   */
  public spawnSkyMaze(startX: number, baseY: number = 4.5) {
    const mazeLength = 32.0;
    const mazeHeight = 11.0;
    const topY = baseY + mazeHeight;

    // 1. Outer Boundary Laser Walls (Spacious 11-meter vertical arena)
    this.spawnSkyMazeWall(startX + mazeLength / 2, topY, mazeLength, 0.5);
    this.spawnSkyMazeWall(startX + mazeLength / 2, baseY, mazeLength, 0.5);

    // 2. Interior Maze Baffles / Obstacle Gates (Extra-wide clearances for smooth, fun jetpack navigation)
    // Gate 1: Hanging Laser Pillar from ceiling (Leaves 6.5m spacious clearance underneath!)
    this.spawnSkyMazeWall(startX + 6.0, baseY + 8.8, 0.8, 4.4);

    // Gate 2: Rising Spire Laser Pillar from floor (Leaves 6.8m wide open crest above!)
    this.spawnSkyMazeWall(startX + 13.0, baseY + 2.1, 0.8, 4.2);

    // Divider 3: Horizontal Bifurcation Beam (Splits passage with 5m+ clearance on both paths)
    this.spawnSkyMazeWall(startX + 21.0, baseY + 5.5, 8.5, 0.5);

    // Gate 4: High Path Baffle (Soft guide forcing smooth swoop to exit corridor)
    this.spawnSkyMazeWall(startX + 25.5, baseY + 9.5, 0.8, 3.0);

    // 3. Generous Collectibles along safe, wide flight corridors
    // Entrance launch booster
    this.spawnFuelPickup(startX - 0.8, baseY + 2.2);

    // Low corridor waypoint rewards (comfortable cruising altitude)
    this.spawnCoinPickup(startX + 4.0, baseY + 2.2);
    this.spawnCoinPickup(startX + 6.0, baseY + 2.2);
    this.spawnCoinPickup(startX + 8.5, baseY + 2.2);

    // High crest waypoint rewards
    this.spawnFuelPickup(startX + 13.0, baseY + 8.0);
    this.spawnCoinPickup(startX + 11.0, baseY + 8.0);
    this.spawnCoinPickup(startX + 15.0, baseY + 8.0);

    // Fork: Low Path
    this.spawnCoinPickup(startX + 18.5, baseY + 2.4);
    this.spawnFuelPickup(startX + 21.0, baseY + 2.4);
    this.spawnCoinPickup(startX + 23.5, baseY + 2.4);

    // Fork: High Path (Secret Golden Stash!)
    this.spawnCoinPickup(startX + 18.5, baseY + 8.0);
    this.spawnCoinPickup(startX + 21.0, baseY + 8.0);
    this.spawnFuelPickup(startX + 23.5, baseY + 8.0);

    // Exit Triumphant Cache
    this.spawnCoinPickup(startX + 28.5, baseY + 5.5);
    this.spawnFuelPickup(startX + 30.5, baseY + 5.5);
  }

  /**
   * Spawns the Hyper-Ion Quantum Jetpack Collectible Upgrade
   */
  public spawnHyperJetpackPickup(x: number, y: number): ActivePickup {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // Holographic Gyro Ring 1 (Cyan)
    const ring1Geo = new THREE.TorusGeometry(0.46, 0.024, 8, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    group.add(ring1);

    // Holographic Gyro Ring 2 (Magenta)
    const ring2Geo = new THREE.TorusGeometry(0.44, 0.022, 8, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xff00bb,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 3;
    group.add(ring2);

    // High-Energy Sparkling Core
    const coreGeo = new THREE.OctahedronGeometry(0.20, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Mini Hyper Aero Wings
    const miniWingGeo = new THREE.BoxGeometry(0.42, 0.06, 0.08);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      metalness: 0.9,
      roughness: 0.2,
    });
    const miniWings = new THREE.Mesh(miniWingGeo, wingMat);
    miniWings.position.set(0, -0.04, 0);
    group.add(miniWings);

    this.scene.add(group);

    const pickup: ActivePickup = {
      id: this.nextId++,
      type: PickupType.JETPACK_UPGRADE,
      mesh: group,
      position: group.position,
      radius: 0.65,
      active: true,
      update: (dt: number, time: number) => {
        group.position.y = y + Math.sin(time * 3.5) * 0.18;
        ring1.rotation.z += dt * 3.2;
        ring1.rotation.y += dt * 2.0;
        ring2.rotation.z -= dt * 2.8;
        ring2.rotation.x += dt * 2.2;
        core.rotation.y += dt * 4.0;
        core.rotation.z += dt * 3.0;
      },
    };

    this.pickups.push(pickup);
    return pickup;
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
    // Collision Prevention: Ensure collectibles NEVER go over/intersect with barriers or wheels
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      if (obs.type === ObstacleType.COVER_BARRIER) {
        const bHalf = obs.collider.halfSize || new THREE.Vector2(0.8, 0.625);
        const bCenter = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y + bHalf.y);
        const bMinX = bCenter.x - bHalf.x - 0.55;
        const bMaxX = bCenter.x + bHalf.x + 0.55;
        const bMaxY = bCenter.y + bHalf.y + 0.55;
        if (x >= bMinX && x <= bMaxX && y <= bMaxY) {
          x = x >= bCenter.x ? bMaxX + 0.35 : bMinX - 0.35;
        }
      } else if (obs.type === ObstacleType.GEAR) {
        const gearRadius = obs.collider.radius || 2.2;
        const dist = Math.hypot(x - obs.group.position.x, y - obs.group.position.y);
        if (dist < gearRadius + 0.55) {
          y = obs.group.position.y + gearRadius + 0.75;
        }
      }
    }

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
    // Collision Prevention: Ensure collectibles NEVER go over/intersect with barriers or wheels
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      if (obs.type === ObstacleType.COVER_BARRIER) {
        const bHalf = obs.collider.halfSize || new THREE.Vector2(0.8, 0.625);
        const bCenter = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y + bHalf.y);
        const bMinX = bCenter.x - bHalf.x - 0.55;
        const bMaxX = bCenter.x + bHalf.x + 0.55;
        const bMaxY = bCenter.y + bHalf.y + 0.55;
        if (x >= bMinX && x <= bMaxX && y <= bMaxY) {
          x = x >= bCenter.x ? bMaxX + 0.35 : bMinX - 0.35;
        }
      } else if (obs.type === ObstacleType.GEAR) {
        const gearRadius = obs.collider.radius || 2.2;
        const dist = Math.hypot(x - obs.group.position.x, y - obs.group.position.y);
        if (dist < gearRadius + 0.55) {
          y = obs.group.position.y + gearRadius + 0.75;
        }
      }
    }

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
    // Cover Barriers act as solid physical platforms for smooth walking on top
    for (const obs of this.obstacles) {
      if (obs.active && obs.type === ObstacleType.COVER_BARRIER) {
        const half = obs.collider.halfSize || new THREE.Vector2(0.8, 0.625);
        const center = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y + half.y);
        list.push({
          x: center.x,
          y: center.y,
          width: half.x * 2,
          height: half.y * 2,
        });
      }
    }
    // Upper gantry housing of mechanical press allows player to safely land, stand, and walk on top!
    for (const obs of this.obstacles) {
      if (obs.active && obs.type === ObstacleType.PISTON) {
        list.push({
          x: obs.group.position.x,
          y: obs.group.position.y,
          width: 2.4,
          height: 1.2,
        });
      }
    }
    // Horizontal Sky Maze floor and ceiling barriers act as solid landing surfaces for ragdoll death
    for (const obs of this.obstacles) {
      if (obs.active && obs.type === ObstacleType.SKY_MAZE_WALL) {
        const half = obs.collider.halfSize || new THREE.Vector2(0.5, 0.5);
        if (half.x > half.y && half.x >= 1.5) {
          const center = obs.collider.center || new THREE.Vector2(obs.group.position.x, obs.group.position.y);
          list.push({
            x: center.x,
            y: center.y,
            width: half.x * 2,
            height: half.y * 2,
          });
        }
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
   * Spawns Visible High-Energy Bullet Impact Flash & Ricochet Sparks on Any Surface
   */
  public spawnBulletImpact(x: number, y: number, color: number = 0x00f5ff) {
    // 1. Expanding High-Energy Impact Shockwave Ring
    const sw = this.fxShockwaves.find(s => !s.active);
    if (sw) {
      sw.active = true;
      sw.age = 0;
      sw.mesh.position.set(x, y, 0.12);
      sw.mesh.scale.set(0.15, 0.15, 0.15);
      (sw.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      sw.mesh.visible = true;
    }

    // 2. High-Speed Ricochet Spark Particles
    const count = 10;
    let spawned = 0;
    for (const p of this.fxParticles) {
      if (p.active) continue;
      p.active = true;
      p.age = 0;
      p.maxLife = 0.22 + Math.random() * 0.16;
      p.baseScale = 0.65 + Math.random() * 0.45;
      p.mesh.position.set(x, y, 0.12);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 6.5;
      p.velocity.set(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0
      );

      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(
        spawned % 2 === 0 ? color : 0xffffff
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
