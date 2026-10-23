import * as THREE from 'three';

/**
 * MarsOutpost - AAA Low-Poly Martian Environment
 * Directly inspired by the provided low-poly Mars references:
 * - Faceted low-poly terracotta terrain with craters and canyons
 * - Modular circular hab ring corridor and central saucer observatory
 * - Research skyscraper tower with rotating communication dish
 * - Elevated skyway catwalk bridges with safety lights
 * - Low-poly 6-wheeled Mars exploration rovers
 * - Automated defense turret platforms
 * - Geodesic domes and atmospheric Martian dust
 */
export class MarsOutpost {
  public group: THREE.Group;
  public terrainMesh!: THREE.Mesh;
  public walkableSurfaces: { minX: number; maxX: number; minZ: number; maxZ: number; y: number }[] = [];
  public terrainHeightMap: (x: number, z: number) => number;
  private animatables: ((dt: number, time: number) => void)[] = [];
  public dustParticles!: THREE.Points;
  private dustPositions!: Float32Array;
  private dustVelocities!: Float32Array;

  constructor() {
    this.group = new THREE.Group();
    this.terrainHeightMap = this.createHeightMap();
    this.buildTerrain();
    this.buildOutpostComplex();
    this.buildAtmosphericDust();
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
    // Terracotta red, burnt orange ridges, dark canyon dust, and dusky salmon
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
      const normHeight = (vy + 8.0) / 12.0;
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

    // Add jagged low-poly rock boulder clusters around canyon & crater rims
    this.buildRockClusters();
  }

  /**
   * Faceted low-poly angular boulders matching Blender reference (Image 3)
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

    // Spawn 45 distinct angular boulders along canyon edges and crater rims
    const rockGeoBase = new THREE.DodecahedronGeometry(1.0, 0);

    for (let i = 0; i < 48; i++) {
      // Place along canyon edges (z ~ -10..-5 and z ~ 7..14) and surrounding perimeter
      const side = (i % 2 === 0) ? -1 : 1;
      const rx = (i * 3.4) - 30 + (Math.sin(i * 4.7) * 4);
      const rz = side * (8.5 + (Math.cos(i * 3.1) * 5.5));
      const ry = this.terrainHeightMap(rx, rz);

      const rock = new THREE.Mesh(rockGeoBase, i % 3 === 0 ? rockDarkMat : rockMat);
      const scaleX = 1.2 + Math.sin(i * 1.3) * 0.8;
      const scaleY = 0.9 + Math.cos(i * 2.1) * 0.6;
      const scaleZ = 1.3 + Math.sin(i * 3.7) * 0.8;

      rock.scale.set(scaleX, scaleY, scaleZ);
      rock.position.set(rx, ry + scaleY * 0.7, rz);
      rock.rotation.set(i * 0.8, i * 1.4, i * 0.5);

      this.group.add(rock);
    }
  }

  /**
   * 2. High-Tech Modular Mars Research Outpost Complex
   * Features:
   * - Circular Hab Ring (Image 2)
   * - Central Command Saucer & Observatory (Image 2 & 3)
   * - Research Hub Skyscraper Tower with Radar Dish (Image 1 & 3)
   * - Elevated Skyway Bridges spanning across the canyon (Image 1 & 3)
   * - Mars Rovers & Defense Turrets (Image 1 & 2)
   */
  private buildOutpostComplex() {
    const outpostWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6fa,
      roughness: 0.28,
      metalness: 0.22,
    });

    const outpostTrimMat = new THREE.MeshStandardMaterial({
      color: 0xcc4422, // High-contrast Martian red-orange safety stripes
      roughness: 0.35,
      metalness: 0.15,
    });

    const windowGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff, // Glowing cyan sci-fi observation windows
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
    // A. CENTRAL COMMAND OBSERVATORY SAUCER (Images 2 & 3)
    // ========================================================
    const saucerCenter = new THREE.Vector3(14, -2.4, 2.0);
    const saucerGroup = new THREE.Group();
    saucerGroup.position.copy(saucerCenter);

    // Massive central support pylon
    const pylonGeo = new THREE.CylinderGeometry(2.4, 3.2, 5.5, 16);
    const pylon = new THREE.Mesh(pylonGeo, metalDarkMat);
    pylon.position.y = -2.75;
    saucerGroup.add(pylon);

    // Primary saucer disk body
    const saucerDiskGeo = new THREE.CylinderGeometry(5.8, 6.4, 1.4, 24);
    const saucerDisk = new THREE.Mesh(saucerDiskGeo, outpostWhiteMat);
    saucerGroup.add(saucerDisk);

    // Saucer observation window ring
    const windowRingGeo = new THREE.CylinderGeometry(5.85, 5.85, 0.35, 24, 1, true);
    const windowRing = new THREE.Mesh(windowRingGeo, windowGlowMat);
    windowRing.position.y = 0.1;
    saucerGroup.add(windowRing);

    // Sleek low-profile command dome roof (Image 2)
    const saucerDomeGeo = new THREE.SphereGeometry(4.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const saucerDome = new THREE.Mesh(saucerDomeGeo, outpostWhiteMat);
    saucerDome.scale.set(1.0, 0.45, 1.0);
    saucerDome.position.y = 0.7;
    saucerGroup.add(saucerDome);

    // Roof ventilation hub with radial spokes (Image 2)
    const hubGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.4, 12);
    const hub = new THREE.Mesh(hubGeo, outpostTrimMat);
    hub.position.y = 1.6;
    saucerGroup.add(hub);

    this.group.add(saucerGroup);

    // Register roof as walkable/platform landing surface!
    this.walkableSurfaces.push({
      minX: saucerCenter.x - 5.5,
      maxX: saucerCenter.x + 5.5,
      minZ: saucerCenter.z - 5.5,
      maxZ: saucerCenter.z + 5.5,
      y: saucerCenter.y + 0.7,
    });

    // ========================================================
    // B. CIRCULAR MODULAR HABITAT RING CORRIDOR (Image 2)
    // ========================================================
    const ringRadius = 13.5;
    const ringSegments = 14;
    const ringGroup = new THREE.Group();
    ringGroup.position.set(saucerCenter.x, -1.8, saucerCenter.z);

    for (let i = 0; i < ringSegments; i++) {
      // Leave entrance openings for player skyway access
      if (i === 3 || i === 4) continue;

      const angle = (i / ringSegments) * Math.PI * 2;
      const modX = Math.cos(angle) * ringRadius;
      const modZ = Math.sin(angle) * ringRadius;

      const modGroup = new THREE.Group();
      modGroup.position.set(modX, 0, modZ);
      modGroup.rotation.y = -angle + Math.PI / 2;

      // Curved capsule module
      const moduleGeo = new THREE.BoxGeometry(4.8, 2.2, 2.6);
      const moduleMesh = new THREE.Mesh(moduleGeo, outpostWhiteMat);
      modGroup.add(moduleMesh);

      // Red-orange safety stripe
      const stripeGeo = new THREE.BoxGeometry(4.84, 0.35, 2.64);
      const stripeMesh = new THREE.Mesh(stripeGeo, outpostTrimMat);
      stripeMesh.position.y = 0.65;
      modGroup.add(stripeMesh);

      // Cyan window strip
      const winGeo = new THREE.BoxGeometry(3.6, 0.4, 2.66);
      const winMesh = new THREE.Mesh(winGeo, windowGlowMat);
      winMesh.position.y = -0.1;
      modGroup.add(winMesh);

      // Ground support stilts
      const stiltGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8);
      const stilt1 = new THREE.Mesh(stiltGeo, metalDarkMat);
      stilt1.position.set(-1.8, -1.8, 0);
      modGroup.add(stilt1);
      const stilt2 = new THREE.Mesh(stiltGeo, metalDarkMat);
      stilt2.position.set(1.8, -1.8, 0);
      modGroup.add(stilt2);

      ringGroup.add(modGroup);

      // Register module roof as platform
      this.walkableSurfaces.push({
        minX: saucerCenter.x + modX - 2.2,
        maxX: saucerCenter.x + modX + 2.2,
        minZ: saucerCenter.z + modZ - 1.3,
        maxZ: saucerCenter.z + modZ + 1.3,
        y: -1.8 + 1.1,
      });
    }

    // Radial spoke connectors from ring to central saucer (Image 2)
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
    // C. RESEARCH SKYSCRAPER TOWER WITH SATELLITE DISH (Images 1 & 3)
    // ========================================================
    const towerPos = new THREE.Vector3(-8, -3.7, -4.0);
    const towerGroup = new THREE.Group();
    towerGroup.position.copy(towerPos);

    // Stepped skyscraper base
    const baseBuildingGeo = new THREE.BoxGeometry(7.5, 3.2, 7.5);
    const baseBuilding = new THREE.Mesh(baseBuildingGeo, outpostWhiteMat);
    baseBuilding.position.y = 1.6;
    towerGroup.add(baseBuilding);

    // Main vertical monolithic research tower (Images 1 & 3)
    const towerMainGeo = new THREE.BoxGeometry(4.2, 16.5, 3.6);
    const towerMain = new THREE.Mesh(towerMainGeo, outpostWhiteMat);
    towerMain.position.y = 11.2;
    towerGroup.add(towerMain);

    // Vertical cyan holo-window column
    const winColumnGeo = new THREE.BoxGeometry(1.6, 14.5, 3.66);
    const winColumn = new THREE.Mesh(winColumnGeo, windowGlowMat);
    winColumn.position.y = 11.5;
    towerGroup.add(winColumn);

    // Tower crown platform
    const crownGeo = new THREE.BoxGeometry(5.2, 0.8, 4.6);
    const crown = new THREE.Mesh(crownGeo, outpostTrimMat);
    crown.position.y = 19.8;
    towerGroup.add(crown);

    // Rotating parabolic satellite dish (Images 1 & 3)
    const dishGroup = new THREE.Group();
    dishGroup.position.y = 20.6;
    const dishStemGeo = new THREE.CylinderGeometry(0.2, 0.25, 1.2, 8);
    const dishStem = new THREE.Mesh(dishStemGeo, metalDarkMat);
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

    // Register tower roof and base as platforms
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
      y: towerPos.y + 20.2, // High vantage landing for jetpack!
    });

    // ========================================================
    // D. ELEVATED SKYWAY BRIDGE OVER THE CANYON (Images 1 & 3)
    // Spans from tower area (-4, -1.2, 0) to central saucer (9, -0.6, 2)
    // ========================================================
    const bridgeStart = new THREE.Vector3(-3.5, -0.8, -1.0);
    const bridgeEnd = new THREE.Vector3(8.5, -0.6, 1.8);
    const bridgeLength = bridgeStart.distanceTo(bridgeEnd);

    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.copy(bridgeStart).lerp(bridgeEnd, 0.5);
    const angleToTarget = Math.atan2(bridgeEnd.x - bridgeStart.x, bridgeEnd.z - bridgeStart.z);
    bridgeGroup.rotation.y = angleToTarget - Math.PI / 2;

    // Deck slab
    const deckGeo = new THREE.BoxGeometry(bridgeLength, 0.4, 2.6);
    const deck = new THREE.Mesh(deckGeo, catwalkMat);
    bridgeGroup.add(deck);

    // Guard rails with luminous safety runners (Image 1)
    const railGeo = new THREE.BoxGeometry(bridgeLength, 0.6, 0.12);
    const railL = new THREE.Mesh(railGeo, outpostTrimMat);
    railL.position.set(0, 0.45, 1.25);
    bridgeGroup.add(railL);
    const railR = new THREE.Mesh(railGeo, outpostTrimMat);
    railR.position.set(0, 0.45, -1.25);
    bridgeGroup.add(railR);

    // Cyan illuminated edge lights
    const edgeLightGeo = new THREE.BoxGeometry(bridgeLength, 0.08, 0.08);
    const edgeLightL = new THREE.Mesh(edgeLightGeo, windowGlowMat);
    edgeLightL.position.set(0, 0.22, 1.18);
    bridgeGroup.add(edgeLightL);
    const edgeLightR = new THREE.Mesh(edgeLightGeo, windowGlowMat);
    edgeLightR.position.set(0, 0.22, -1.18);
    bridgeGroup.add(edgeLightR);

    // Support pillars into canyon floor
    const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 6.0, 8), metalDarkMat);
    pillar1.position.set(-bridgeLength * 0.25, -3.0, 0);
    bridgeGroup.add(pillar1);
    const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 6.0, 8), metalDarkMat);
    pillar2.position.set(bridgeLength * 0.25, -3.0, 0);
    bridgeGroup.add(pillar2);

    this.group.add(bridgeGroup);

    // Register bridge deck as walkable surface
    this.walkableSurfaces.push({
      minX: Math.min(bridgeStart.x, bridgeEnd.x) - 0.5,
      maxX: Math.max(bridgeStart.x, bridgeEnd.x) + 0.5,
      minZ: Math.min(bridgeStart.z, bridgeEnd.z) - 1.4,
      maxZ: Math.max(bridgeStart.z, bridgeEnd.z) + 1.4,
      y: -0.5,
    });

    // ========================================================
    // E. LOW-POLY 6-WHEELED MARS ROVERS (Image 1)
    // ========================================================
    this.spawnRover(new THREE.Vector3(5, -3.3, 10), Math.PI * 0.35);
    this.spawnRover(new THREE.Vector3(26, -3.3, -4), -Math.PI * 0.65);

    // ========================================================
    // F. AUTOMATED DEFENSE TURRETS (Images 1 & 2)
    // ========================================================
    this.spawnTurret(new THREE.Vector3(25, -3.3, 6));
    this.spawnTurret(new THREE.Vector3(-14, -3.3, 4));

    // ========================================================
    // G. GEODESIC BIOSPHERE DOMES (Image 1)
    // ========================================================
    this.spawnGeodesicDome(new THREE.Vector3(22, -3.4, -14), 4.2);
    this.spawnGeodesicDome(new THREE.Vector3(32, -3.4, -11), 3.4);
  }

  /**
   * Low-Poly 6-Wheeled Planetary Rover (Image 1)
   */
  private spawnRover(pos: THREE.Vector3, rotY: number) {
    const roverGroup = new THREE.Group();
    roverGroup.position.copy(pos);
    roverGroup.rotation.y = rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdedee5, roughness: 0.35, metalness: 0.45 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.85, metalness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x005577, roughness: 0.1 });

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(2.4, 0.7, 1.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.65;
    roverGroup.add(chassis);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.2, 0.6, 1.25);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0.4, 1.2, 0);
    roverGroup.add(cabin);

    // 6 Chunky Tires
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
  }

  /**
   * Automated Defense Turret Platform (Images 1 & 2)
   */
  private spawnTurret(pos: THREE.Vector3) {
    const turretGroup = new THREE.Group();
    turretGroup.position.copy(pos);

    const turretMat = new THREE.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.3, metalness: 0.5 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.4, metalness: 0.8 });

    // Base pedestal
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.8, 0.6, 8);
    const base = new THREE.Mesh(baseGeo, turretMat);
    turretGroup.add(base);

    // Swivel head
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.7;
    const domeHeadGeo = new THREE.SphereGeometry(0.9, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const domeHead = new THREE.Mesh(domeHeadGeo, turretMat);
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

    turretGroup.add(headGroup);

    // Animate turret tracking back and forth
    this.animatables.push((dt, time) => {
      headGroup.rotation.y = Math.sin(time * 0.6 + pos.x) * 0.8;
      headGroup.rotation.x = Math.sin(time * 1.2) * 0.15 - 0.1;
    });

    this.group.add(turretGroup);
  }

  /**
   * Geodesic Biosphere Dome (Image 1)
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
      wireframe: false,
    });

    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = 0;
    domeGroup.add(domeMesh);

    this.group.add(domeGroup);

    this.walkableSurfaces.push({
      minX: pos.x - radius * 0.8,
      maxX: pos.x + radius * 0.8,
      minZ: pos.z - radius * 0.8,
      maxZ: pos.z + radius * 0.8,
      y: pos.y + radius * 0.95,
    });
  }

  /**
   * 3. Martian Atmospheric Dust & Wind Particles
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

      this.dustVelocities[i * 3 + 0] = 1.2 + Math.random() * 2.4; // Strong Martian crosswind
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

    // Check walkable structures (bridges, hab roofs, saucers, towers)
    for (const s of this.walkableSurfaces) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        if (s.y > highest) {
          highest = s.y;
        }
      }
    }

    return highest;
  }

  public update(dt: number, totalTime: number) {
    // 1. Run animations (rotating dishes, turrets)
    for (const fn of this.animatables) {
      fn(dt, totalTime);
    }

    // 2. Animate atmospheric dust
    if (this.dustParticles && this.dustPositions) {
      const pos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        let x = this.dustPositions[i * 3 + 0] + this.dustVelocities[i * 3 + 0] * dt;
        let y = this.dustPositions[i * 3 + 1] + this.dustVelocities[i * 3 + 1] * dt;
        let z = this.dustPositions[i * 3 + 2] + this.dustVelocities[i * 3 + 2] * dt;

        // Wrap around boundaries
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
