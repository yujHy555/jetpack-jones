import * as THREE from 'three';

export interface MarsEnemy {
  id: string;
  type: 'turret' | 'drone';
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  radius: number;
  active: boolean;
  mesh: THREE.Group;
  flashTimer: number;
  shootCooldown: number;
  headMesh?: THREE.Group;
  update: (dt: number, totalTime: number, playerPos: THREE.Vector3) => void;
  takeDamage: (amount: number) => boolean; // returns true if destroyed
}

export interface MarsHostileBolt {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  active: boolean;
  life: number;
}

export interface SolidObstacle {
  type: 'box' | 'cylinder';
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  centerX?: number;
  centerZ?: number;
  radius?: number;
  maxY: number;
}

/**
 * MarsOutpost - AAA Low-Poly Martian Environment & Combat Arena
 * Directly inspired by the provided low-poly Mars references:
 * - Faceted low-poly terracotta terrain with craters and canyons
 * - Modular circular hab ring corridor and central saucer observatory
 * - Research skyscraper tower with rotating communication dish
 * - Elevated skyway catwalk bridges with safety lights
 * - Low-poly 6-wheeled Mars exploration rovers
 * - Automated defense turret platforms & Aerial Martian Sentry Drones
 * - Geodesic domes and atmospheric Martian dust
 * - Real-time 3D collision resolution against solid structures
 * - Dynamic slope normal calculation for terrain walking
 * - Full cursor lock-on targeting and laser damage system
 */
export class MarsOutpost {
  public group: THREE.Group;
  public terrainMesh!: THREE.Mesh;
  public walkableSurfaces: { minX: number; maxX: number; minZ: number; maxZ: number; y: number }[] = [];
  public solidObstacles: SolidObstacle[] = [];
  public terrainHeightMap: (x: number, z: number) => number;
  private animatables: ((dt: number, time: number) => void)[] = [];
  public dustParticles!: THREE.Points;
  private dustPositions!: Float32Array;
  private dustVelocities!: Float32Array;

  // Active Level 3 Enemies & Hostile Projectiles
  public enemies: MarsEnemy[] = [];
  public hostileBolts: MarsHostileBolt[] = [];
  private boltPool: MarsHostileBolt[] = [];
  private boltGeo: THREE.CylinderGeometry;
  private boltMat: THREE.MeshBasicMaterial;

  // Explosion Particle VFX Pool
  private explosionGroup: THREE.Group;
  private explosionParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number; active: boolean }[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.explosionGroup = new THREE.Group();
    this.group.add(this.explosionGroup);

    this.boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8);
    this.boltGeo.rotateX(Math.PI / 2);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });

    this.terrainHeightMap = this.createHeightMap();
    this.buildTerrain();
    this.buildOutpostComplex();
    this.buildAtmosphericDust();
    this.initBoltPool();
    this.initExplosionVFX();
  }

  /**
   * Continuous mathematical height map for low-poly Martian terrain:
   * Smooth base ground with rolling dunes, deep canyon chasm, and crater rims
   */
  private createHeightMap(): (x: number, z: number) => number {
    return (x: number, z: number): number => {
      // 1. Broad rolling Martian dunes
      const dune1 = Math.sin(x * 0.05 + 1.2) * Math.cos(z * 0.05 + 0.8) * 1.8;
      const dune2 = Math.sin(x * 0.12 - z * 0.08) * 0.9;

      // 2. Canyon depression running through z = -8 to z = 12
      const canyonDist = Math.abs(z - 2.0);
      let canyonDip = 0;
      if (canyonDist < 16.0) {
        const factor = 1.0 - (canyonDist / 16.0);
        canyonDip = -Math.pow(factor, 1.8) * 4.2;
      }

      // 3. Outpost plateau clearing around x = 0..30, z = -15..15
      const outpostDist = Math.hypot(x - 14, z);
      let outpostFlatten = 1.0;
      if (outpostDist < 24) {
        outpostFlatten = Math.max(0, (outpostDist - 12) / 12);
      }

      // Base elevation is -3.70 to align with player standard ground
      return -3.70 + (dune1 + dune2 + canyonDip) * outpostFlatten;
    };
  }

  /**
   * 1. Low-Poly Faceted Rocky Martian Ground with Color Variation
   */
  private buildTerrain() {
    const width = 180;
    const depth = 180;
    const segsX = 54;
    const segsZ = 54;

    const geo = new THREE.PlaneGeometry(width, depth, segsX, segsZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // Color palette matching the references:
    const colBase = new THREE.Color(0xb64f38);
    const colRidge = new THREE.Color(0xd46848);
    const colCanyon = new THREE.Color(0x782718);
    const colDust = new THREE.Color(0x993c26);
    const tempCol = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Low-poly vertex jitter for genuine faceted rock ridges
      const jitterX = (Math.sin(vx * 1.5 + vz * 2.1) * 0.45);
      const jitterZ = (Math.cos(vx * 2.3 - vz * 1.7) * 0.45);
      const finalX = vx + jitterX;
      const finalZ = vz + jitterZ;

      const vy = this.terrainHeightMap(finalX, finalZ);
      pos.setX(i, finalX);
      pos.setY(i, vy);
      pos.setZ(i, finalZ);

      // Vertex color blending based on elevation and slope
      if (vy < -5.5) {
        tempCol.copy(colCanyon).lerp(colDust, (vy + 8.0) / 2.5);
      } else if (vy > -2.5) {
        tempCol.copy(colBase).lerp(colRidge, (vy + 2.5) / 2.5);
      } else {
        tempCol.copy(colDust).lerp(colBase, (vy + 5.5) / 3.0);
      }

      colors[i * 3 + 0] = tempCol.r;
      colors[i * 3 + 1] = tempCol.g;
      colors[i * 3 + 2] = tempCol.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      metalness: 0.06,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = false;
    this.group.add(this.terrainMesh);

    this.buildRockClusters();
  }

  /**
   * Faceted low-poly angular boulders matching Blender reference
   */
  private buildRockClusters() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x9c3e29,
      flatShading: true,
      roughness: 0.88,
      metalness: 0.08,
    });

    const rockDarkMat = new THREE.MeshStandardMaterial({
      color: 0x7a2818,
      flatShading: true,
      roughness: 0.95,
      metalness: 0.04,
    });

    const rockGeoBase = new THREE.DodecahedronGeometry(1.0, 0);

    for (let i = 0; i < 48; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const rx = (i * 3.4) - 30 + (Math.sin(i * 4.7) * 4);
      const rz = side * (8.5 + (Math.cos(i * 3.1) * 5.5));
      const ry = this.terrainHeightMap(rx, rz);

      const rock = new THREE.Mesh(rockGeoBase, (i % 3 === 0) ? rockDarkMat : rockMat);
      const scaleBase = 0.8 + Math.sin(i * 2.3) * 0.45;
      rock.scale.set(
        scaleBase * (0.8 + Math.random() * 0.6),
        scaleBase * (0.7 + Math.random() * 0.8),
        scaleBase * (0.8 + Math.random() * 0.6)
      );
      rock.position.set(rx, ry + rock.scale.y * 0.4, rz);
      rock.rotation.set(Math.sin(i) * 2, Math.cos(i) * 3, Math.sin(i * 0.7) * 2);
      this.group.add(rock);
    }
  }

  /**
   * 2. Modular Martian Outpost Complex
   */
  private buildOutpostComplex() {
    const outpostWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xe8ecf2,
      roughness: 0.35,
      metalness: 0.25,
      flatShading: true,
    });

    const outpostTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe85d3f,
      roughness: 0.4,
      metalness: 0.3,
    });

    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      emissive: 0x00aacc,
      roughness: 0.1,
      metalness: 0.1,
    });

    const metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x242832,
      roughness: 0.45,
      metalness: 0.65,
    });

    const catwalkMat = new THREE.MeshStandardMaterial({
      color: 0x3d4452,
      roughness: 0.65,
      metalness: 0.45,
    });

    // ========================================================
    // A. CENTRAL COMMAND OBSERVATORY SAUCER
    // ========================================================
    const saucerCenter = new THREE.Vector3(14, -2.4, 2.0);
    const saucerGroup = new THREE.Group();
    saucerGroup.position.copy(saucerCenter);

    const pylonGeo = new THREE.CylinderGeometry(2.4, 3.2, 5.5, 16);
    const pylon = new THREE.Mesh(pylonGeo, metalDarkMat);
    pylon.position.y = -2.75;
    saucerGroup.add(pylon);

    const saucerDiskGeo = new THREE.CylinderGeometry(5.8, 6.4, 1.4, 24);
    const saucerDisk = new THREE.Mesh(saucerDiskGeo, outpostWhiteMat);
    saucerGroup.add(saucerDisk);

    const windowRingGeo = new THREE.CylinderGeometry(5.85, 5.85, 0.35, 24, 1, true);
    const windowRing = new THREE.Mesh(windowRingGeo, windowGlowMat);
    windowRing.position.y = 0.1;
    saucerGroup.add(windowRing);

    const saucerDomeGeo = new THREE.SphereGeometry(4.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const saucerDome = new THREE.Mesh(saucerDomeGeo, outpostWhiteMat);
    saucerDome.scale.set(1.0, 0.45, 1.0);
    saucerDome.position.y = 0.7;
    saucerGroup.add(saucerDome);

    const hubGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.4, 12);
    const hub = new THREE.Mesh(hubGeo, outpostTrimMat);
    hub.position.y = 1.6;
    saucerGroup.add(hub);

    this.group.add(saucerGroup);

    // Register roof platform & solid collision pylon
    this.walkableSurfaces.push({
      minX: saucerCenter.x - 5.5,
      maxX: saucerCenter.x + 5.5,
      minZ: saucerCenter.z - 5.5,
      maxZ: saucerCenter.z + 5.5,
      y: saucerCenter.y + 0.7,
    });
    this.solidObstacles.push({
      type: 'cylinder',
      centerX: saucerCenter.x,
      centerZ: saucerCenter.z,
      radius: 3.0,
      maxY: saucerCenter.y + 0.6,
    });

    // ========================================================
    // B. CIRCULAR MODULAR HABITAT RING CORRIDOR
    // ========================================================
    const ringRadius = 13.5;
    const ringSegments = 14;
    const ringGroup = new THREE.Group();
    ringGroup.position.set(saucerCenter.x, -1.8, saucerCenter.z);

    for (let i = 0; i < ringSegments; i++) {
      if (i === 3 || i === 4) continue; // Entrance gateway

      const angle = (i / ringSegments) * Math.PI * 2;
      const modX = Math.cos(angle) * ringRadius;
      const modZ = Math.sin(angle) * ringRadius;

      const modGroup = new THREE.Group();
      modGroup.position.set(modX, 0, modZ);
      modGroup.rotation.y = -angle + Math.PI / 2;

      const moduleGeo = new THREE.BoxGeometry(4.8, 2.2, 2.6);
      const moduleMesh = new THREE.Mesh(moduleGeo, outpostWhiteMat);
      modGroup.add(moduleMesh);

      const stripeGeo = new THREE.BoxGeometry(4.84, 0.35, 2.64);
      const stripeMesh = new THREE.Mesh(stripeGeo, outpostTrimMat);
      stripeMesh.position.y = 0.65;
      modGroup.add(stripeMesh);

      const winGeo = new THREE.BoxGeometry(3.6, 0.4, 2.66);
      const winMesh = new THREE.Mesh(winGeo, windowGlowMat);
      winMesh.position.y = -0.1;
      modGroup.add(winMesh);

      const stiltGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8);
      const stilt1 = new THREE.Mesh(stiltGeo, metalDarkMat);
      stilt1.position.set(-1.8, -1.8, 0);
      modGroup.add(stilt1);
      const stilt2 = new THREE.Mesh(stiltGeo, metalDarkMat);
      stilt2.position.set(1.8, -1.8, 0);
      modGroup.add(stilt2);

      ringGroup.add(modGroup);

      // Register module roof platform and solid obstacle
      this.walkableSurfaces.push({
        minX: saucerCenter.x + modX - 2.2,
        maxX: saucerCenter.x + modX + 2.2,
        minZ: saucerCenter.z + modZ - 1.3,
        maxZ: saucerCenter.z + modZ + 1.3,
        y: -1.8 + 1.1,
      });

      this.solidObstacles.push({
        type: 'box',
        minX: saucerCenter.x + modX - 2.4,
        maxX: saucerCenter.x + modX + 2.4,
        minZ: saucerCenter.z + modZ - 1.3,
        maxZ: saucerCenter.z + modZ + 1.3,
        maxY: -1.8 + 1.1,
      });
    }

    // Radial spoke connectors
    const spokeAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    for (const sa of spokeAngles) {
      const spokeGroup = new THREE.Group();
      spokeGroup.rotation.y = -sa + Math.PI / 2;
      const spokeGeo = new THREE.CylinderGeometry(0.9, 0.9, ringRadius - 5.5, 10);
      spokeGeo.rotateZ(Math.PI / 2);
      const spokeMesh = new THREE.Mesh(spokeGeo, outpostWhiteMat);
      spokeMesh.position.set((ringRadius + 5.5) / 2, 0.4, 0);
      spokeGroup.add(spokeMesh);
      ringGroup.add(spokeGroup);
    }

    this.group.add(ringGroup);

    // ========================================================
    // C. RESEARCH SKYSCRAPER TOWER WITH SATELLITE DISH
    // ========================================================
    const towerPos = new THREE.Vector3(-8, -3.7, -4.0);
    const towerGroup = new THREE.Group();
    towerGroup.position.copy(towerPos);

    const baseBuildingGeo = new THREE.BoxGeometry(7.5, 3.2, 7.5);
    const baseBuilding = new THREE.Mesh(baseBuildingGeo, outpostWhiteMat);
    baseBuilding.position.y = 1.6;
    towerGroup.add(baseBuilding);

    const towerMainGeo = new THREE.BoxGeometry(4.2, 16.5, 3.6);
    const towerMain = new THREE.Mesh(towerMainGeo, outpostWhiteMat);
    towerMain.position.y = 11.2;
    towerGroup.add(towerMain);

    const winColumnGeo = new THREE.BoxGeometry(1.6, 14.5, 3.66);
    const winColumn = new THREE.Mesh(winColumnGeo, windowGlowMat);
    winColumn.position.y = 11.5;
    towerGroup.add(winColumn);

    const crownGeo = new THREE.BoxGeometry(5.2, 0.8, 4.6);
    const crown = new THREE.Mesh(crownGeo, outpostTrimMat);
    crown.position.y = 19.8;
    towerGroup.add(crown);

    const dishGroup = new THREE.Group();
    dishGroup.position.y = 20.6;
    const dishStem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 8), metalDarkMat);
    dishGroup.add(dishStem);

    const dishBowlGeo = new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
    dishBowlGeo.rotateX(Math.PI * 0.65);
    const dishBowl = new THREE.Mesh(dishBowlGeo, outpostWhiteMat);
    dishBowl.position.y = 1.5;
    dishGroup.add(dishBowl);

    const hornGeo = new THREE.ConeGeometry(0.35, 1.2, 8);
    hornGeo.rotateX(Math.PI * 0.65);
    const horn = new THREE.Mesh(hornGeo, outpostTrimMat);
    horn.position.set(0, 1.5, 0.9);
    dishGroup.add(horn);

    towerGroup.add(dishGroup);
    this.animatables.push((dt) => {
      dishGroup.rotation.y += dt * 0.45;
    });

    this.group.add(towerGroup);

    // Register platforms and solid collision
    this.walkableSurfaces.push({
      minX: towerPos.x - 3.6,
      maxX: towerPos.x + 3.6,
      minZ: towerPos.z - 3.6,
      maxZ: towerPos.z + 3.6,
      y: towerPos.y + 3.2,
    });
    this.walkableSurfaces.push({
      minX: towerPos.x - 2.5,
      maxX: towerPos.x + 2.5,
      minZ: towerPos.z - 2.2,
      maxZ: towerPos.z + 2.2,
      y: towerPos.y + 20.2,
    });
    this.solidObstacles.push({
      type: 'box',
      minX: towerPos.x - 3.8,
      maxX: towerPos.x + 3.8,
      minZ: towerPos.z - 3.8,
      maxZ: towerPos.z + 3.8,
      maxY: towerPos.y + 3.2,
    });

    // ========================================================
    // D. ELEVATED SKYWAY BRIDGE OVER THE CANYON
    // ========================================================
    const bridgeStart = new THREE.Vector3(-3.5, -0.8, -1.0);
    const bridgeEnd = new THREE.Vector3(8.5, -0.6, 1.8);
    const bridgeLength = bridgeStart.distanceTo(bridgeEnd);

    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.copy(bridgeStart).lerp(bridgeEnd, 0.5);
    const angleToTarget = Math.atan2(bridgeEnd.x - bridgeStart.x, bridgeEnd.z - bridgeStart.z);
    bridgeGroup.rotation.y = angleToTarget - Math.PI / 2;

    const deckGeo = new THREE.BoxGeometry(bridgeLength, 0.4, 2.6);
    const deck = new THREE.Mesh(deckGeo, catwalkMat);
    bridgeGroup.add(deck);

    const railGeo = new THREE.BoxGeometry(bridgeLength, 0.6, 0.12);
    const railL = new THREE.Mesh(railGeo, outpostTrimMat);
    railL.position.set(0, 0.45, 1.25);
    bridgeGroup.add(railL);
    const railR = new THREE.Mesh(railGeo, outpostTrimMat);
    railR.position.set(0, 0.45, -1.25);
    bridgeGroup.add(railR);

    const edgeLightGeo = new THREE.BoxGeometry(bridgeLength, 0.08, 0.08);
    const edgeLightL = new THREE.Mesh(edgeLightGeo, windowGlowMat);
    edgeLightL.position.set(0, 0.22, 1.18);
    bridgeGroup.add(edgeLightL);
    const edgeLightR = new THREE.Mesh(edgeLightGeo, windowGlowMat);
    edgeLightR.position.set(0, 0.22, -1.18);
    bridgeGroup.add(edgeLightR);

    this.group.add(bridgeGroup);

    this.walkableSurfaces.push({
      minX: Math.min(bridgeStart.x, bridgeEnd.x) - 0.5,
      maxX: Math.max(bridgeStart.x, bridgeEnd.x) + 0.5,
      minZ: Math.min(bridgeStart.z, bridgeEnd.z) - 1.4,
      maxZ: Math.max(bridgeStart.z, bridgeEnd.z) + 1.4,
      y: -0.5,
    });

    // ========================================================
    // E. LOW-POLY 6-WHEELED MARS ROVERS
    // ========================================================
    this.spawnRover(new THREE.Vector3(5, -3.3, 10), Math.PI * 0.35);
    this.spawnRover(new THREE.Vector3(26, -3.3, -4), -Math.PI * 0.65);

    // ========================================================
    // F. ACTIVE AUTOMATED DEFENSE TURRETS (Level 3 Enemies)
    // ========================================================
    this.spawnTurretEnemy(new THREE.Vector3(25, -3.3, 6), 'turret_1');
    this.spawnTurretEnemy(new THREE.Vector3(-14, -3.3, 4), 'turret_2');
    this.spawnTurretEnemy(new THREE.Vector3(10, -3.3, -12), 'turret_3');

    // ========================================================
    // G. ACTIVE AERIAL SENTRY DRONES (Level 3 Enemies)
    // ========================================================
    this.spawnSentryDrone(new THREE.Vector3(2, 1.8, -2), 'drone_1');
    this.spawnSentryDrone(new THREE.Vector3(18, 3.2, 5), 'drone_2');
    this.spawnSentryDrone(new THREE.Vector3(-4, 3.8, 3), 'drone_3');

    // ========================================================
    // H. GEODESIC BIOSPHERE DOMES
    // ========================================================
    this.spawnGeodesicDome(new THREE.Vector3(22, -3.4, -14), 4.2);
    this.spawnGeodesicDome(new THREE.Vector3(32, -3.4, -11), 3.4);
  }

  /**
   * Spawns an Active Automated Defense Turret Enemy with 3D tracking & weapon fire
   */
  private spawnTurretEnemy(pos: THREE.Vector3, id: string) {
    const turretGroup = new THREE.Group();
    turretGroup.position.copy(pos);

    const turretMat = new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.3, metalness: 0.5 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.4, metalness: 0.8 });

    // Pedestal
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.8, 0.6, 8);
    const base = new THREE.Mesh(baseGeo, turretMat);
    turretGroup.add(base);

    // Swivel head
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.7;

    const domeHeadGeo = new THREE.SphereGeometry(0.9, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const domeHeadMat = turretMat.clone();
    const domeHead = new THREE.Mesh(domeHeadGeo, domeHeadMat);
    headGroup.add(domeHead);

    // Dual gun barrels
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const b1 = new THREE.Mesh(barrelGeo, gunMat);
    b1.position.set(-0.25, 0.3, 0.8);
    headGroup.add(b1);
    const b2 = new THREE.Mesh(barrelGeo, gunMat);
    b2.position.set(0.25, 0.3, 0.8);
    headGroup.add(b2);

    // Glowing Red Sensor Eye
    const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0.45, 0.85);
    headGroup.add(eye);

    turretGroup.add(headGroup);
    this.group.add(turretGroup);

    this.solidObstacles.push({
      type: 'cylinder',
      centerX: pos.x,
      centerZ: pos.z,
      radius: 1.6,
      maxY: pos.y + 0.9,
    });

    const enemy: MarsEnemy = {
      id,
      type: 'turret',
      position: pos.clone().add(new THREE.Vector3(0, 0.8, 0)),
      health: 60,
      maxHealth: 60,
      radius: 1.4,
      active: true,
      mesh: turretGroup,
      headMesh: headGroup,
      flashTimer: 0,
      shootCooldown: 1.5 + Math.random() * 2.0,
      update: (dt: number, totalTime: number, playerPos: THREE.Vector3) => {
        if (!enemy.active) return;

        // Flash recovery
        if (enemy.flashTimer > 0) {
          enemy.flashTimer -= dt;
          if (enemy.flashTimer <= 0) {
            domeHeadMat.emissive.setHex(0x000000);
          }
        }

        const dist = enemy.position.distanceTo(playerPos);
        if (dist < 26.0) {
          // Track player in 3D
          const dx = playerPos.x - pos.x;
          const dz = playerPos.z - pos.z;
          const dy = playerPos.y + 1.0 - (pos.y + 0.7);

          const targetYaw = Math.atan2(dx, dz);
          headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetYaw, dt * 4.5);

          const horizDist = Math.hypot(dx, dz);
          const targetPitch = -Math.atan2(dy, horizDist);
          headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetPitch, dt * 4.5);

          // Automated Firing Loop
          enemy.shootCooldown -= dt;
          if (enemy.shootCooldown <= 0) {
            enemy.shootCooldown = 2.4 + Math.random() * 0.8;
            const muzzleWorldPos = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z);
            const aimDir = new THREE.Vector3(
              playerPos.x - muzzleWorldPos.x,
              playerPos.y + 1.0 - muzzleWorldPos.y,
              playerPos.z - muzzleWorldPos.z
            ).normalize();

            this.spawnHostileBolt(muzzleWorldPos, aimDir.multiplyScalar(22.0));
          }
        } else {
          // Idle surveillance sweep
          headGroup.rotation.y = Math.sin(totalTime * 0.6 + pos.x) * 0.8;
          headGroup.rotation.x = 0;
        }
      },
      takeDamage: (amount: number): boolean => {
        enemy.health -= amount;
        enemy.flashTimer = 0.15;
        domeHeadMat.emissive.setHex(0xffffff);

        if (enemy.health <= 0) {
          enemy.active = false;
          this.triggerExplosion(enemy.position);
          turretGroup.visible = false;
          return true;
        }
        return false;
      },
    };

    this.enemies.push(enemy);
  }

  /**
   * Spawns an Aerial Martian Sentry Drone Enemy with hovering thrusters and sensor optic
   */
  private spawnSentryDrone(pos: THREE.Vector3, id: string) {
    const droneGroup = new THREE.Group();
    droneGroup.position.copy(pos);

    const droneMat = new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.3, metalness: 0.7 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdde2e8, roughness: 0.2, metalness: 0.85 });

    // Chassis core
    const coreMat = droneMat.clone();
    const coreGeo = new THREE.OctahedronGeometry(0.65, 0);
    const core = new THREE.Mesh(coreGeo, coreMat);
    droneGroup.add(core);

    // Glowing Central Eye
    const eyeGeo = new THREE.SphereGeometry(0.24, 10, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0, 0.45);
    droneGroup.add(eye);

    // Lateral Thruster Pods
    const podGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8);
    const podL = new THREE.Mesh(podGeo, chromeMat);
    podL.position.set(-0.8, 0, 0);
    droneGroup.add(podL);
    const podR = new THREE.Mesh(podGeo, chromeMat);
    podR.position.set(0.8, 0, 0);
    droneGroup.add(podR);

    // Cyan Thruster Glows
    const glowGeo = new THREE.ConeGeometry(0.10, 0.35, 8);
    glowGeo.rotateX(Math.PI);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.8 });
    const glowL = new THREE.Mesh(glowGeo, glowMat);
    glowL.position.set(-0.8, -0.45, 0);
    droneGroup.add(glowL);
    const glowR = new THREE.Mesh(glowGeo, glowMat);
    glowR.position.set(0.8, -0.45, 0);
    droneGroup.add(glowR);

    this.group.add(droneGroup);

    const basePosY = pos.y;

    const enemy: MarsEnemy = {
      id,
      type: 'drone',
      position: droneGroup.position,
      health: 45,
      maxHealth: 45,
      radius: 1.1,
      active: true,
      mesh: droneGroup,
      flashTimer: 0,
      shootCooldown: 1.0 + Math.random() * 2.5,
      update: (dt: number, totalTime: number, playerPos: THREE.Vector3) => {
        if (!enemy.active) return;

        // Hover bobbing
        droneGroup.position.y = basePosY + Math.sin(totalTime * 2.5 + pos.x) * 0.35;

        // Flash recovery
        if (enemy.flashTimer > 0) {
          enemy.flashTimer -= dt;
          if (enemy.flashTimer <= 0) {
            coreMat.emissive.setHex(0x000000);
          }
        }

        const dist = droneGroup.position.distanceTo(playerPos);
        if (dist < 28.0) {
          // Face player
          const dx = playerPos.x - droneGroup.position.x;
          const dz = playerPos.z - droneGroup.position.z;
          const targetYaw = Math.atan2(dx, dz);
          droneGroup.rotation.y = THREE.MathUtils.lerp(droneGroup.rotation.y, targetYaw, dt * 5.0);

          // Shooting loop
          enemy.shootCooldown -= dt;
          if (enemy.shootCooldown <= 0) {
            enemy.shootCooldown = 2.8 + Math.random() * 1.0;
            const muzzleWorldPos = droneGroup.position.clone();
            const aimDir = new THREE.Vector3(
              playerPos.x - muzzleWorldPos.x,
              playerPos.y + 0.8 - muzzleWorldPos.y,
              playerPos.z - muzzleWorldPos.z
            ).normalize();

            this.spawnHostileBolt(muzzleWorldPos, aimDir.multiplyScalar(20.0));
          }
        }
      },
      takeDamage: (amount: number): boolean => {
        enemy.health -= amount;
        enemy.flashTimer = 0.15;
        coreMat.emissive.setHex(0xffffff);

        if (enemy.health <= 0) {
          enemy.active = false;
          this.triggerExplosion(droneGroup.position);
          droneGroup.visible = false;
          return true;
        }
        return false;
      },
    };

    this.enemies.push(enemy);
  }

  /**
   * Spawns a low-poly 6-wheeled Mars rover
   */
  private spawnRover(pos: THREE.Vector3, rotY: number) {
    const roverGroup = new THREE.Group();
    roverGroup.position.copy(pos);
    roverGroup.rotation.y = rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdedee5, roughness: 0.35, metalness: 0.45 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.85, metalness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x005577, roughness: 0.1 });

    const chassisGeo = new THREE.BoxGeometry(2.4, 0.7, 1.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.65;
    roverGroup.add(chassis);

    const cabinGeo = new THREE.BoxGeometry(1.2, 0.6, 1.25);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0.4, 1.2, 0);
    roverGroup.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 10);
    wheelGeo.rotateX(Math.PI / 2);

    const wheelOffsets = [
      [-0.8, -0.85], [0, -0.85], [0.8, -0.85],
      [-0.8, 0.85],  [0, 0.85],  [0.8, 0.85],
    ];
    for (const [wx, wz] of wheelOffsets) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(wx, 0.38, wz);
      roverGroup.add(w);
    }

    this.group.add(roverGroup);

    this.solidObstacles.push({
      type: 'box',
      minX: pos.x - 1.4,
      maxX: pos.x + 1.4,
      minZ: pos.z - 1.1,
      maxZ: pos.z + 1.1,
      maxY: pos.y + 1.5,
    });
  }

  /**
   * Spawns a Geodesic biosphere dome
   */
  private spawnGeodesicDome(pos: THREE.Vector3, radius: number) {
    const domeGroup = new THREE.Group();
    domeGroup.position.copy(pos);

    const domeGeo = new THREE.IcosahedronGeometry(radius, 1);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fb,
      flatShading: true,
      roughness: 0.35,
      metalness: 0.25,
    });

    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeGroup.add(domeMesh);
    this.group.add(domeGroup);

    this.walkableSurfaces.push({
      minX: pos.x - radius * 0.8,
      maxX: pos.x + radius * 0.8,
      minZ: pos.z - radius * 0.8,
      maxZ: pos.z + radius * 0.8,
      y: pos.y + radius * 0.95,
    });

    this.solidObstacles.push({
      type: 'cylinder',
      centerX: pos.x,
      centerZ: pos.z,
      radius: radius * 0.85,
      maxY: pos.y + radius * 0.9,
    });
  }

  /**
   * Pre-allocates Red Plasma Hostile Bolts
   */
  private initBoltPool() {
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.boltPool.push({
        mesh,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        active: false,
        life: 0,
      });
    }
  }

  private spawnHostileBolt(origin: THREE.Vector3, vel: THREE.Vector3) {
    const bolt = this.boltPool.find(b => !b.active);
    if (!bolt) return;
    bolt.active = true;
    bolt.position.copy(origin);
    bolt.velocity.copy(vel);
    bolt.life = 3.5;
    bolt.mesh.position.copy(origin);
    bolt.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.clone().normalize());
    bolt.mesh.visible = true;
    this.hostileBolts.push(bolt);
  }

  /**
   * Pre-allocates Explosion VFX Debris
   */
  private initExplosionVFX() {
    const debrisGeo = new THREE.DodecahedronGeometry(0.2, 0);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0xff6622, roughness: 0.4 });
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(debrisGeo, debrisMat);
      mesh.visible = false;
      this.explosionGroup.add(mesh);
      this.explosionParticles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        active: false,
      });
    }
  }

  public triggerExplosion(pos: THREE.Vector3) {
    for (let i = 0; i < 14; i++) {
      const p = this.explosionParticles.find(part => !part.active);
      if (!p) break;
      p.active = true;
      p.mesh.position.copy(pos);
      p.mesh.visible = true;
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.4;
      p.velocity.set(
        (Math.random() - 0.5) * 14.0,
        3.0 + Math.random() * 8.0,
        (Math.random() - 0.5) * 14.0
      );
    }
  }

  /**
   * Atmospheric Dust & Wind Particles
   */
  private buildAtmosphericDust() {
    const dustCount = 350;
    const geo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(dustCount * 3);
    this.dustVelocities = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      this.dustPositions[i * 3 + 0] = (Math.random() - 0.5) * 120;
      this.dustPositions[i * 3 + 1] = -3.7 + Math.random() * 18;
      this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 120;

      this.dustVelocities[i * 3 + 0] = 1.2 + Math.random() * 2.4;
      this.dustVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      this.dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xd66245,
      size: 0.28,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.group.add(this.dustParticles);
  }

  /**
   * Returns vertical ground/platform height at any (x, z) coordinate in Mars level
   */
  public getSurfaceHeight(x: number, z: number): number {
    let highest = this.terrainHeightMap(x, z);

    for (const s of this.walkableSurfaces) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        if (s.y > highest) {
          highest = s.y;
        }
      }
    }

    return highest;
  }

  /**
   * Returns true 3D surface normal at coordinate (x, z) for slope alignment
   */
  public getSurfaceNormal(x: number, z: number): THREE.Vector3 {
    // Check if currently on a flat structure surface
    for (const s of this.walkableSurfaces) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        return new THREE.Vector3(0, 1, 0);
      }
    }

    const delta = 0.25;
    const hL = this.terrainHeightMap(x - delta, z);
    const hR = this.terrainHeightMap(x + delta, z);
    const hD = this.terrainHeightMap(x, z - delta);
    const hU = this.terrainHeightMap(x, z + delta);

    const normal = new THREE.Vector3((hL - hR) / (2 * delta), 1.0, (hD - hU) / (2 * delta));
    normal.normalize();
    return normal;
  }

  /**
   * Resolves horizontal 3D movement against solid structures (towers, pylons, habs, rovers)
   * Slides the player smoothly along collision walls
   */
  public resolveCollision(currPos: THREE.Vector3, nextPos: THREE.Vector3, radius: number = 0.45): THREE.Vector3 {
    const resolved = nextPos.clone();

    for (const obs of this.solidObstacles) {
      if (resolved.y >= obs.maxY) continue; // Player is above obstacle

      if (obs.type === 'cylinder') {
        const dx = resolved.x - obs.centerX!;
        const dz = resolved.z - obs.centerZ!;
        const dist = Math.hypot(dx, dz);
        const minDist = obs.radius! + radius;
        if (dist < minDist && dist > 0.001) {
          const push = minDist - dist;
          resolved.x += (dx / dist) * push;
          resolved.z += (dz / dist) * push;
        }
      } else if (obs.type === 'box') {
        const minX = obs.minX! - radius;
        const maxX = obs.maxX! + radius;
        const minZ = obs.minZ! - radius;
        const maxZ = obs.maxZ! + radius;

        if (resolved.x >= minX && resolved.x <= maxX && resolved.z >= minZ && resolved.z <= maxZ) {
          const penLeft = resolved.x - minX;
          const penRight = maxX - resolved.x;
          const penDown = resolved.z - minZ;
          const penUp = maxZ - resolved.z;

          const minPen = Math.min(penLeft, penRight, penDown, penUp);
          if (minPen === penLeft) resolved.x = minX;
          else if (minPen === penRight) resolved.x = maxX;
          else if (minPen === penDown) resolved.z = minZ;
          else resolved.z = maxZ;
        }
      }
    }

    return resolved;
  }

  /**
   * Returns all active hostile targets for cursor lock-on aiming
   */
  public getLockOnTargets(): MarsEnemy[] {
    return this.enemies.filter(e => e.active);
  }

  public update(dt: number, totalTime: number, playerPos: THREE.Vector3 = new THREE.Vector3(0, -3.7, 0)) {
    // 1. Run environment animatables (e.g. rotating dishes)
    for (const fn of this.animatables) {
      fn(dt, totalTime);
    }

    // 2. Update active enemies (Turrets & Sentry Drones)
    for (const enemy of this.enemies) {
      if (enemy.active) {
        enemy.update(dt, totalTime, playerPos);
      }
    }

    // 3. Update Hostile Bolts
    for (let i = this.hostileBolts.length - 1; i >= 0; i--) {
      const b = this.hostileBolts[i];
      b.life -= dt;
      if (b.life <= 0 || !b.active) {
        b.active = false;
        b.mesh.visible = false;
        this.hostileBolts.splice(i, 1);
        continue;
      }

      b.position.addScaledVector(b.velocity, dt);
      b.mesh.position.copy(b.position);

      // Check ground impact
      const groundY = this.getSurfaceHeight(b.position.x, b.position.z);
      if (b.position.y <= groundY) {
        b.active = false;
        b.mesh.visible = false;
        this.hostileBolts.splice(i, 1);
      }
    }

    // 4. Update Explosion VFX Debris
    for (const p of this.explosionParticles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 18.0 * dt; // Martian gravity
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += dt * 8.0;
      p.mesh.rotation.y += dt * 6.0;
      const prog = 1.0 - (p.life / p.maxLife);
      p.mesh.scale.set(prog, prog, prog);
    }

    // 5. Animate atmospheric dust
    if (this.dustParticles && this.dustPositions) {
      const pos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        let x = this.dustPositions[i * 3 + 0] + this.dustVelocities[i * 3 + 0] * dt;
        let y = this.dustPositions[i * 3 + 1] + this.dustVelocities[i * 3 + 1] * dt;
        let z = this.dustPositions[i * 3 + 2] + this.dustVelocities[i * 3 + 2] * dt;

        if (x > 60) x = -60;
        if (y < -4.0) y = 14.0;
        if (y > 15.0) y = -3.5;
        if (z > 60) z = -60;
        if (z < -60) z = 60;

        this.dustPositions[i * 3 + 0] = x;
        this.dustPositions[i * 3 + 1] = y;
        this.dustPositions[i * 3 + 2] = z;
      }

      pos.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }
}
