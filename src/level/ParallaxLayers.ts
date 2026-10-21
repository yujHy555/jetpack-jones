import * as THREE from 'three';

export const GROUND_Y = -3.70;

interface ParallaxObject {
  group: THREE.Group;
  baseX: number;
  parallaxFactor: number;
}

/**
 * Creates a 3D Box geometry with smooth rounded/beveled corners
 */
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
    depth: Math.max(0.1, depth - r * 2),
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

/**
 * Minimalist Retro-Modern Alien Environment
 * Features:
 * - Sunset dusk horizon gradient sky in coral, salmon, and apricot bands
 * - Celestial ringed gas giant planet & orbiting satellite moons
 * - Background elements made of clean, simple CUBES WITH ROUNDED CORNERS in layered pastel/slate/ochre tones
 * - Seamless catwalk bridge with zero Z-fighting
 * - Soft real-time shadow reception
 */
export class ParallaxLayers {
  public group: THREE.Group;

  // Background layers with parallax
  private skyBackdrop!: THREE.Mesh;
  private ringedPlanetGroup!: THREE.Group;
  private moonsGroup!: THREE.Group;
  private distantCubeModules: ParallaxObject[] = [];
  private midCubeModules: ParallaxObject[] = [];
  private floorTiles: THREE.Group[] = [];
  private foregroundConsoles: THREE.Group[] = [];

  // Reusable Materials Palette
  private creamMat!: THREE.MeshStandardMaterial;
  private orangeMat!: THREE.MeshStandardMaterial;
  private tealSlateMat!: THREE.MeshStandardMaterial;
  private darkCharcoalMat!: THREE.MeshStandardMaterial;
  private pastelLavenderMat!: THREE.MeshStandardMaterial;
  private steelPipeMat!: THREE.MeshStandardMaterial;
  private deckWalkwayMat!: THREE.MeshStandardMaterial;

  // Dedicated Light Greys and Whites for Background Elements
  private bgPureWhiteMat!: THREE.MeshStandardMaterial;
  private bgLightGreyMat!: THREE.MeshStandardMaterial;
  private bgSoftSlateGreyMat!: THREE.MeshStandardMaterial;
  private bgCoolSilverMat!: THREE.MeshStandardMaterial;
  private bgMutedGreyMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initAestheticMaterials();
    this.createSunsetSky();
    this.createCelestialRingedPlanet();
    this.createSatelliteMoons();
    this.createRoundedCubeBackground();
    this.createSeamlessCatwalkBridge();
    this.createForegroundTerminalConsoles();
  }

  private initAestheticMaterials() {
    this.creamMat = new THREE.MeshStandardMaterial({
      color: 0xf6f0e6,
      roughness: 0.35,
      metalness: 0.12,
    });

    this.orangeMat = new THREE.MeshStandardMaterial({
      color: 0xe58835,
      roughness: 0.38,
      metalness: 0.18,
    });

    this.tealSlateMat = new THREE.MeshStandardMaterial({
      color: 0x2e3d48,
      roughness: 0.55,
      metalness: 0.15,
    });

    this.darkCharcoalMat = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.65,
      metalness: 0.40,
    });

    this.pastelLavenderMat = new THREE.MeshStandardMaterial({
      color: 0x6e6878,
      roughness: 0.50,
      metalness: 0.10,
    });

    this.steelPipeMat = new THREE.MeshStandardMaterial({
      color: 0xbfcddb,
      roughness: 0.35,
      metalness: 0.70,
    });

    // Pristine Light Greys and Crisp Whites for all Background Objects
    this.bgPureWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.05,
    });

    this.bgLightGreyMat = new THREE.MeshStandardMaterial({
      color: 0xf0f2f5,
      roughness: 0.42,
      metalness: 0.08,
    });

    this.bgSoftSlateGreyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e6eb,
      roughness: 0.45,
      metalness: 0.10,
    });

    this.bgCoolSilverMat = new THREE.MeshStandardMaterial({
      color: 0xd4d8df,
      roughness: 0.48,
      metalness: 0.12,
    });

    this.bgMutedGreyMat = new THREE.MeshStandardMaterial({
      color: 0xc8cdd6,
      roughness: 0.52,
      metalness: 0.10,
    });

    // Main walkway deck (cream with vibrant amber runner stripe)
    const deckCanvas = document.createElement('canvas');
    deckCanvas.width = 512;
    deckCanvas.height = 256;
    const ctx = deckCanvas.getContext('2d')!;

    // Cream outer decking
    ctx.fillStyle = '#f5eee3';
    ctx.fillRect(0, 0, 512, 256);

    // Warm orange / amber center runner stripe
    ctx.fillStyle = '#e58b38';
    ctx.fillRect(0, 56, 512, 144);

    // Hazard accent lines
    ctx.strokeStyle = '#c46922';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 56); ctx.lineTo(512, 56);
    ctx.moveTo(0, 200); ctx.lineTo(512, 200);
    ctx.stroke();

    // Expansion panel joints
    ctx.strokeStyle = '#434b55';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 256);
      ctx.stroke();
    }

    const deckTex = new THREE.CanvasTexture(deckCanvas);
    deckTex.wrapS = THREE.RepeatWrapping;
    deckTex.wrapT = THREE.ClampToEdgeWrapping;
    deckTex.repeat.set(8, 1);

    this.deckWalkwayMat = new THREE.MeshStandardMaterial({
      map: deckTex,
      roughness: 0.40,
      metalness: 0.25,
    });
  }

  /**
   * 1. Stylized Sunset / Dusk Sky with horizontal pastel bands
   */
  private createSunsetSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.00, '#d96c5b'); // Coral rose zenith
    grad.addColorStop(0.25, '#eb826e'); // Soft salmon
    grad.addColorStop(0.50, '#f79a7a'); // Warm peach
    grad.addColorStop(0.75, '#feb88e'); // Golden apricot
    grad.addColorStop(1.00, '#fedab1'); // Warm buff cream horizon

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 512);

    const skyTex = new THREE.CanvasTexture(canvas);
    const skyGeo = new THREE.PlaneGeometry(180, 95);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });

    this.skyBackdrop = new THREE.Mesh(skyGeo, skyMat);
    this.skyBackdrop.position.set(0, 12, -42);
    this.group.add(this.skyBackdrop);
  }

  /**
   * 2. Giant Ringed Planet (Upper Right)
   */
  private createCelestialRingedPlanet() {
    this.ringedPlanetGroup = new THREE.Group();
    this.ringedPlanetGroup.position.set(24, 18, -32);

    // Planet Sphere (Light Grey / Soft Silver)
    const planetGeo = new THREE.SphereGeometry(6.2, 32, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0xedf0f5,
      roughness: 0.55,
      metalness: 0.05,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.ringedPlanetGroup.add(planetMesh);

    // Pristine Pearlescent White Ring System
    const ringGeo = new THREE.RingGeometry(8.6, 15.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.90,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.35;
    ringMesh.rotation.y = 0.28;
    this.ringedPlanetGroup.add(ringMesh);

    this.group.add(this.ringedPlanetGroup);
  }

  /**
   * 3. Multiple Orbiting Satellite Moons
   */
  private createSatelliteMoons() {
    this.moonsGroup = new THREE.Group();

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa,
      roughness: 0.5,
    });

    // Large Moon (Upper Left)
    const moon1 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 18), moonMat);
    moon1.position.set(-28, 22, -34);
    this.moonsGroup.add(moon1);

    // Tiny Moon near large moon
    const moon2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), this.bgSoftSlateGreyMat);
    moon2.position.set(-24, 18, -33);
    this.moonsGroup.add(moon2);

    // Midground Floating Moon
    const moon3 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 14), this.bgLightGreyMat);
    moon3.position.set(10, 10, -28);
    this.moonsGroup.add(moon3);

    this.group.add(this.moonsGroup);
  }

  /**
   * 4. Background Elements: Simple Cubes with Rounded Corners
   * High-key minimalist light greys and whites with zero dark/saturated clutter
   */
  private createRoundedCubeBackground() {
    const moduleSpan = 40;
    const count = 6;

    // Distant Layer (Parallax Factor 0.12, Z = -22)
    for (let i = 0; i < count; i++) {
      const baseX = (i - 2) * moduleSpan;
      const group = new THREE.Group();
      group.position.set(baseX, -3.7, -22);

      // Distant tall monolith rounded cubes in light greys & whites
      const geoMonolith = createRoundedBoxGeo(6.0, 18.0, 5.0, 0.8);
      const meshMonolith1 = new THREE.Mesh(geoMonolith, this.bgCoolSilverMat);
      meshMonolith1.position.set(-14, 9.0, 0);
      meshMonolith1.receiveShadow = true;
      group.add(meshMonolith1);

      const meshMonolith2 = new THREE.Mesh(geoMonolith, this.bgLightGreyMat);
      meshMonolith2.position.set(16, 11.0, -2);
      meshMonolith2.receiveShadow = true;
      group.add(meshMonolith2);

      // Stacked background cubes
      const geoBlockLg = createRoundedBoxGeo(7.5, 9.0, 5.0, 0.9);
      const meshBlockLg = new THREE.Mesh(geoBlockLg, this.bgSoftSlateGreyMat);
      meshBlockLg.position.set(0, 4.5, -4);
      meshBlockLg.receiveShadow = true;
      group.add(meshBlockLg);

      const geoTopCube = createRoundedBoxGeo(4.0, 4.0, 4.0, 0.6);
      const meshTopCube = new THREE.Mesh(geoTopCube, this.bgPureWhiteMat);
      meshTopCube.position.set(0, 11.0, -3.5);
      meshTopCube.receiveShadow = true;
      group.add(meshTopCube);

      this.group.add(group);
      this.distantCubeModules.push({ group, baseX, parallaxFactor: 0.12 });
    }

    // Midground Layer (Parallax Factor 0.32, Z = -13)
    for (let i = 0; i < count; i++) {
      const baseX = (i - 2) * moduleSpan;
      const group = new THREE.Group();
      group.position.set(baseX, -3.7, -13);

      // 1. Left Cluster: Stepped Pure White & Soft Grey Rounded Cubes
      const geoMid1 = createRoundedBoxGeo(4.2, 8.5, 3.8, 0.6);
      const m1 = new THREE.Mesh(geoMid1, this.bgLightGreyMat);
      m1.position.set(-11, 4.25, 0);
      m1.receiveShadow = true;
      group.add(m1);

      const geoOrangeCube = createRoundedBoxGeo(3.0, 3.0, 3.0, 0.5);
      const mWhiteCube = new THREE.Mesh(geoOrangeCube, this.bgPureWhiteMat);
      mWhiteCube.position.set(-11, 10.0, 0.2);
      mWhiteCube.receiveShadow = true;
      group.add(mWhiteCube);

      // 2. Center Floating Modern Cube
      const geoFloat = createRoundedBoxGeo(3.8, 3.8, 3.8, 0.65);
      const mFloat = new THREE.Mesh(geoFloat, this.bgPureWhiteMat);
      mFloat.position.set(3.5, 7.5, -1);
      mFloat.rotation.set(0.1, 0.15, 0.05);
      mFloat.receiveShadow = true;
      group.add(mFloat);

      // Pillar base below floating cube
      const geoPillar = createRoundedBoxGeo(2.6, 5.0, 2.6, 0.4);
      const mPillar = new THREE.Mesh(geoPillar, this.bgMutedGreyMat);
      mPillar.position.set(3.5, 2.5, -1);
      mPillar.receiveShadow = true;
      group.add(mPillar);

      // 3. Right Cluster: Architectural Rounded Blocks
      const geoTowerBlock = createRoundedBoxGeo(4.5, 11.5, 4.0, 0.7);
      const mTower = new THREE.Mesh(geoTowerBlock, this.bgSoftSlateGreyMat);
      mTower.position.set(15, 5.75, 0);
      mTower.receiveShadow = true;
      group.add(mTower);

      const geoCapCube = createRoundedBoxGeo(3.2, 2.2, 3.2, 0.45);
      const mCap = new THREE.Mesh(geoCapCube, this.bgPureWhiteMat);
      mCap.position.set(15, 12.6, 0);
      mCap.receiveShadow = true;
      group.add(mCap);

      // Floating Accent Cubes
      const geoAccent1 = createRoundedBoxGeo(1.8, 1.8, 1.8, 0.35);
      const mAccent1 = new THREE.Mesh(geoAccent1, this.bgPureWhiteMat);
      mAccent1.position.set(-4.5, 5.0, 1.0);
      mAccent1.rotation.y = 0.2;
      group.add(mAccent1);

      const mAccent2 = new THREE.Mesh(geoAccent1, this.bgCoolSilverMat);
      mAccent2.position.set(9.5, 4.2, 0.5);
      mAccent2.rotation.y = -0.3;
      group.add(mAccent2);

      this.group.add(group);
      this.midCubeModules.push({ group, baseX, parallaxFactor: 0.32 });
    }
  }

  /**
   * 5. Infinite Seamless Foreground Catwalk Bridge (Ground at Y = -3.70)
   * With zero coplanar Z-fighting and soft shadow reception
   */
  private createSeamlessCatwalkBridge() {
    const tileWidth = 40;
    const tileCount = 5;
    const slabHeight = 2.4;

    for (let i = 0; i < tileCount; i++) {
      const x = (i - 1) * tileWidth;
      const tileGroup = new THREE.Group();
      tileGroup.position.set(x, -4.90, 0);

      // Main Bridge Walking Deck
      const deckGeo = new THREE.BoxGeometry(tileWidth, slabHeight, 10);
      const deckMesh = new THREE.Mesh(deckGeo, this.deckWalkwayMat);
      deckMesh.receiveShadow = true;
      tileGroup.add(deckMesh);

      // Industrial Guardrail Pipe running along rear deck edge
      const railGeo = new THREE.CylinderGeometry(0.14, 0.14, tileWidth, 12);
      railGeo.rotateZ(Math.PI / 2);
      const railMesh = new THREE.Mesh(railGeo, this.steelPipeMat);
      railMesh.position.set(0, slabHeight / 2 + 0.35, -2.2);
      tileGroup.add(railMesh);

      // Vertical Railing Stanchions
      for (let rx = -tileWidth / 2 + 2; rx < tileWidth / 2; rx += 4.0) {
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
        const post = new THREE.Mesh(postGeo, this.darkCharcoalMat);
        post.position.set(rx, slabHeight / 2 + 0.15, -2.2);
        tileGroup.add(post);
      }

      // Front Guardrail Pipe
      const frontRailGeo = new THREE.CylinderGeometry(0.12, 0.12, tileWidth, 12);
      frontRailGeo.rotateZ(Math.PI / 2);
      const frontRail = new THREE.Mesh(frontRailGeo, this.steelPipeMat);
      frontRail.position.set(0, slabHeight / 2 + 0.35, 2.2);
      tileGroup.add(frontRail);

      // Under-Deck Industrial Chassis (Girders & Conduit Bundles)
      const underbeamGeo = new THREE.BoxGeometry(tileWidth, 0.6, 8.5);
      const underbeam = new THREE.Mesh(underbeamGeo, this.darkCharcoalMat);
      underbeam.position.set(0, -slabHeight / 2 - 0.25, 0);
      tileGroup.add(underbeam);

      for (let c = 0; c < 3; c++) {
        const cableGeo = new THREE.CylinderGeometry(0.05, 0.05, tileWidth, 8);
        cableGeo.rotateZ(Math.PI / 2);
        const cable = new THREE.Mesh(cableGeo, this.darkCharcoalMat);
        cable.position.set(0, -slabHeight / 2 - 0.5 - c * 0.12, 1.2 + c * 0.4);
        tileGroup.add(cable);
      }

      this.group.add(tileGroup);
      this.floorTiles.push(tileGroup);
    }
  }

  /**
   * 6. Foreground Vintage CRT Computer Terminal Consoles
   */
  private createForegroundTerminalConsoles() {
    const spacing = 36;
    const count = 6;

    for (let i = 0; i < count; i++) {
      const baseX = (i - 2) * spacing;
      const consoleGroup = new THREE.Group();
      consoleGroup.position.set(baseX, -3.70, 2.2);

      // Angled Beige/Cream Console Chassis
      const chassisGeo = new THREE.BoxGeometry(1.6, 1.2, 0.9);
      const chassis = new THREE.Mesh(chassisGeo, this.creamMat);
      chassis.position.set(0, 0.55, 0);
      consoleGroup.add(chassis);

      // Slanted CRT Monitor Hood
      const hoodGeo = new THREE.BoxGeometry(1.1, 0.85, 0.7);
      const hood = new THREE.Mesh(hoodGeo, this.creamMat);
      hood.position.set(-0.15, 1.25, -0.05);
      hood.rotation.x = -0.15;
      consoleGroup.add(hood);

      // Glowing Amber/Green CRT Phosphor Screen
      const screenGeo = new THREE.PlaneGeometry(0.75, 0.55);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(-0.15, 1.28, 0.32);
      screen.rotation.x = -0.15;
      consoleGroup.add(screen);

      // Molded Keyboard Shelf
      const kbGeo = new THREE.BoxGeometry(0.9, 0.1, 0.45);
      const kb = new THREE.Mesh(kbGeo, this.darkCharcoalMat);
      kb.position.set(-0.15, 0.85, 0.35);
      kb.rotation.x = 0.22;
      consoleGroup.add(kb);

      this.group.add(consoleGroup);
      this.foregroundConsoles.push(consoleGroup);
    }
  }

  public update(playerX: number, time: number) {
    // 1. Follow player with celestial backdrop & moons
    this.skyBackdrop.position.x = playerX;
    this.ringedPlanetGroup.position.x = 24 + playerX * 0.025;
    this.moonsGroup.position.x = playerX * 0.015;

    // 2. Parallax Distant Rounded Cubes Leapfrogging (Factor 0.12)
    const mSpan = 40;
    const mCount = this.distantCubeModules.length;
    const mTotal = mSpan * mCount;

    for (const m of this.distantCubeModules) {
      const relX = ((m.baseX - playerX * (1.0 - m.parallaxFactor)) % mTotal + mTotal) % mTotal - mTotal / 2;
      m.group.position.x = playerX + relX;
    }

    // 3. Parallax Midground Rounded Cubes Leapfrogging (Factor 0.32)
    const oSpan = 40;
    const oCount = this.midCubeModules.length;
    const oTotal = oSpan * oCount;

    for (const o of this.midCubeModules) {
      const relX = ((o.baseX - playerX * (1.0 - o.parallaxFactor)) % oTotal + oTotal) % oTotal - oTotal / 2;
      o.group.position.x = playerX + relX;
    }

    // 4. Foreground Seamless Catwalk Bridge Leapfrogging (Infinite Ground at Y = -3.70)
    const tileWidth = 40;
    const tileCount = this.floorTiles.length;
    const halfSpan = (tileCount * tileWidth) / 2;

    for (let i = 0; i < tileCount; i++) {
      const floorTile = this.floorTiles[i];
      if (floorTile.position.x < playerX - halfSpan) {
        floorTile.position.x += tileCount * tileWidth;
      } else if (floorTile.position.x > playerX + halfSpan) {
        floorTile.position.x -= tileCount * tileWidth;
      }
    }

    // 5. Foreground Consoles Leapfrogging
    const cSpan = 36;
    const cCount = this.foregroundConsoles.length;
    const cTotal = cSpan * cCount;

    for (let i = 0; i < cCount; i++) {
      const con = this.foregroundConsoles[i];
      const relX = (((i - 2) * cSpan - playerX) % cTotal + cTotal) % cTotal - cTotal / 2;
      con.position.x = playerX + relX;
    }
  }
}
