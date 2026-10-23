import * as THREE from 'three';

export const GROUND_Y = -3.70;

interface ParallaxObject {
  group: THREE.Group;
  baseX: number;
  baseY: number;
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
  private normalSkyTex!: THREE.CanvasTexture;
  private alienSkyTex!: THREE.CanvasTexture;
  private marsSkyTex!: THREE.CanvasTexture;
  private atmosphereClouds!: THREE.Group;
  private ringedPlanetGroup!: THREE.Group;
  private moonsGroup!: THREE.Group;
  private distantCubeModules: ParallaxObject[] = [];
  private midCubeModules: ParallaxObject[] = [];
  private floorTiles: THREE.Group[] = [];
  private foregroundConsoles: THREE.Group[] = [];
  private droneCitySignTex!: THREE.CanvasTexture;
  private dofVeilPlane!: THREE.Mesh;

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
    this.createAtmosphericClouds();
    this.createCelestialRingedPlanet();
    this.createSatelliteMoons();
    this.createRoundedCubeBackground();
    this.createSeamlessCatwalkBridge();
    this.createForegroundTerminalConsoles();
    this.createFakeDOFVeil();
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

    // Pure White, Light Silver, and Crisp Clean High-Tech Whites for Background Cubes
    this.bgPureWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xfcfdfd,
      roughness: 0.28,
      metalness: 0.15,
    });

    this.bgLightGreyMat = new THREE.MeshStandardMaterial({
      color: 0xf2f5f9,
      roughness: 0.32,
      metalness: 0.18,
    });

    this.bgSoftSlateGreyMat = new THREE.MeshStandardMaterial({
      color: 0xe8ecf2,
      roughness: 0.35,
      metalness: 0.20,
    });

    this.bgCoolSilverMat = new THREE.MeshStandardMaterial({
      color: 0xdee3eb,
      roughness: 0.38,
      metalness: 0.22,
    });

    this.bgMutedGreyMat = new THREE.MeshStandardMaterial({
      color: 0xd4dae3,
      roughness: 0.42,
      metalness: 0.25,
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
   * 1. Multi-Tier Atmosphere Strata: From Desert Horizon to Cosmic Exosphere
   * Supports unlimited high-altitude vertical jetpack flight!
   */
  private createSunsetSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Multi-tier atmospheric strata in dark retro dusky twilight & plum wine:
    // Provides rich, high-contrast dark backdrop so bright cyan bullets pop brilliantly
    const grad = ctx.createLinearGradient(0, 1024, 0, 0); // Bottom = 1024, Top = 0
    grad.addColorStop(0.00, '#ffa0cf'); // Lighter, brighter vibrant retro pink horizon
    grad.addColorStop(0.12, '#ff7eb9'); // Radiant coral strawberry pink
    grad.addColorStop(0.26, '#f55d9d'); // Electric candy pink
    grad.addColorStop(0.44, '#bd3881'); // Rich magenta rose
    grad.addColorStop(0.65, '#6b194f'); // Deep plum wine
    grad.addColorStop(0.85, '#2c0a24'); // Midnight cosmic violet
    grad.addColorStop(1.00, '#0e020d'); // Starry abyss

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1024);

    // Paint twinkling stars and cosmic clusters in upper atmosphere (top 50% of canvas)
    for (let s = 0; s < 360; s++) {
      const sx = ((s * 97) % 256);
      const sy = ((s * 311) % 520); // top half (0 to 520)
      const r = (s % 3 === 0) ? 1.4 : (s % 2 === 0 ? 0.9 : 0.6);
      const alpha = 0.45 + (s % 5) * 0.12;
      ctx.fillStyle = (s % 4 === 0) ? `rgba(180, 240, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.normalSkyTex = new THREE.CanvasTexture(canvas);

    // Planet Xylos - Deep Bioluminescent Alien Sky Canvas
    const alienCanvas = document.createElement('canvas');
    alienCanvas.width = 256;
    alienCanvas.height = 1024;
    const aCtx = alienCanvas.getContext('2d')!;
    const aGrad = aCtx.createLinearGradient(0, 1024, 0, 0);
    aGrad.addColorStop(0.00, '#2e1065'); // Deep alien indigo horizon
    aGrad.addColorStop(0.18, '#581c87'); // Royal alien violet
    aGrad.addColorStop(0.38, '#701a75'); // Bioluminescent magenta
    aGrad.addColorStop(0.58, '#86198f'); // Radiant plum
    aGrad.addColorStop(0.78, '#4a044e'); // Cosmic purple
    aGrad.addColorStop(1.00, '#0f051d'); // Deep cosmic void
    aCtx.fillStyle = aGrad;
    aCtx.fillRect(0, 0, 256, 1024);

    for (let s = 0; s < 400; s++) {
      const sx = ((s * 103) % 256);
      const sy = ((s * 283) % 650);
      const r = (s % 3 === 0) ? 1.6 : (s % 2 === 0 ? 1.0 : 0.6);
      const alpha = 0.5 + (s % 5) * 0.12;
      aCtx.fillStyle = (s % 3 === 0) ? `rgba(57, 255, 20, ${alpha})` : `rgba(0, 245, 255, ${alpha})`;
      aCtx.beginPath();
      aCtx.arc(sx, sy, r, 0, Math.PI * 2);
      aCtx.fill();
    }
    this.alienSkyTex = new THREE.CanvasTexture(alienCanvas);

    // Planet Mars - Desolate Terracotta Dusk Sky Canvas
    const marsCanvas = document.createElement('canvas');
    marsCanvas.width = 256;
    marsCanvas.height = 1024;
    const mCtx = marsCanvas.getContext('2d')!;
    const mGrad = mCtx.createLinearGradient(0, 1024, 0, 0);
    mGrad.addColorStop(0.00, '#e27b58'); // Warm ochre-peach Martian horizon glow
    mGrad.addColorStop(0.20, '#b8492c'); // Burnt terracotta
    mGrad.addColorStop(0.42, '#852b1b'); // Deep crimson rust
    mGrad.addColorStop(0.68, '#591a14'); // Dark Martian dusk
    mGrad.addColorStop(0.85, '#3b120f'); // Nightfall crimson
    mGrad.addColorStop(1.00, '#150606'); // Deep cosmic Martian night
    mCtx.fillStyle = mGrad;
    mCtx.fillRect(0, 0, 256, 1024);

    // Distant Martian moons (Phobos & Deimos) and cosmic dust
    mCtx.fillStyle = 'rgba(255, 230, 200, 0.85)';
    mCtx.beginPath();
    mCtx.arc(80, 280, 7.5, 0, Math.PI * 2); // Phobos
    mCtx.fill();

    mCtx.fillStyle = 'rgba(230, 200, 180, 0.65)';
    mCtx.beginPath();
    mCtx.arc(180, 210, 4.0, 0, Math.PI * 2); // Deimos
    mCtx.fill();

    for (let s = 0; s < 380; s++) {
      const sx = ((s * 107) % 256);
      const sy = ((s * 277) % 650);
      const r = (s % 3 === 0) ? 1.5 : (s % 2 === 0 ? 0.9 : 0.5);
      const alpha = 0.4 + (s % 5) * 0.12;
      mCtx.fillStyle = (s % 4 === 0) ? `rgba(255, 210, 160, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      mCtx.beginPath();
      mCtx.arc(sx, sy, r, 0, Math.PI * 2);
      mCtx.fill();
    }
    this.marsSkyTex = new THREE.CanvasTexture(marsCanvas);

    const skyGeo = new THREE.PlaneGeometry(280, 280);
    const skyMat = new THREE.MeshBasicMaterial({ map: this.normalSkyTex, depthWrite: false });

    this.skyBackdrop = new THREE.Mesh(skyGeo, skyMat);
    this.skyBackdrop.position.set(0, 75, -42);
    this.group.add(this.skyBackdrop);
  }

  public setLevel(lvl: number) {
    this.group.visible = true;
    if (this.skyBackdrop && (this.skyBackdrop.material as THREE.MeshBasicMaterial)) {
      if (lvl === 3) {
        (this.skyBackdrop.material as THREE.MeshBasicMaterial).map = this.marsSkyTex;
      } else if (lvl === 2) {
        (this.skyBackdrop.material as THREE.MeshBasicMaterial).map = this.alienSkyTex;
      } else {
        (this.skyBackdrop.material as THREE.MeshBasicMaterial).map = this.normalSkyTex;
      }
      (this.skyBackdrop.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }

  /**
   * Drifting Stratosphere Clouds & Atmospheric Wisps
   */
  private createAtmosphericClouds() {
    this.atmosphereClouds = new THREE.Group();
    this.atmosphereClouds.position.set(0, 24, -28);

    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xfff5f8,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    for (let c = 0; c < 8; c++) {
      const cx = (c - 4) * 26;
      const cy = (c % 2 === 0 ? 3 : -3) + Math.sin(c * 1.5) * 2.5;
      const puffGeo = new THREE.SphereGeometry(4.0 + (c % 3) * 1.5, 12, 8);
      puffGeo.scale(2.6, 0.45, 1.0); // Flattened wide stratospheric cloud
      const cloud = new THREE.Mesh(puffGeo, cloudMat);
      cloud.position.set(cx, cy, 0);
      this.atmosphereClouds.add(cloud);
    }

    this.group.add(this.atmosphereClouds);
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
      this.distantCubeModules.push({ group, baseX, baseY: -3.7, parallaxFactor: 0.12 });
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

      // Illuminated Billboard: "WELCOME TO DRONE CITY"
      if (!this.droneCitySignTex) {
        this.droneCitySignTex = this.createDroneCitySignTexture();
      }
      const signGeo = new THREE.BoxGeometry(7.2, 2.2, 0.25);
      const signMat = new THREE.MeshStandardMaterial({
        map: this.droneCitySignTex,
        emissive: 0x0088cc,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.2,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(15, 15.0, 0);
      group.add(signMesh);

      // Eye-level Drone City illuminated sign plaque mounted on midground block
      const eyeSignGeo = new THREE.BoxGeometry(6.4, 2.0, 0.2);
      const eyeSignMesh = new THREE.Mesh(eyeSignGeo, signMat);
      eyeSignMesh.position.set(-11, 6.5, 2.0);
      group.add(eyeSignMesh);

      // Support truss struts holding the Drone City sign
      for (const lx of [12.6, 17.4]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), this.steelPipeMat);
        leg.position.set(lx, 13.7, 0);
        group.add(leg);
      }

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
      this.midCubeModules.push({ group, baseX, baseY: -3.7, parallaxFactor: 0.32 });
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

  private createDroneCitySignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Dark cyber obsidian backplate
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, 512, 160);

    // Glowing double neon border
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 144);

    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 484, 132);

    // Corner brackets
    ctx.fillStyle = '#00f5ff';
    ctx.fillRect(4, 4, 18, 18);
    ctx.fillRect(490, 4, 18, 18);
    ctx.fillRect(4, 138, 18, 18);
    ctx.fillRect(490, 138, 18, 18);

    // Neon typography: "WELCOME TO DRONE CITY"
    ctx.shadowColor = '#00d0ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Press Start 2P", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WELCOME TO', 256, 56);

    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 34px "Press Start 2P", monospace, sans-serif';
    ctx.fillText('DRONE CITY', 256, 114);

    ctx.shadowBlur = 0;

    // Small cyber drone icon dots
    ctx.fillStyle = '#00f5ff';
    ctx.beginPath(); ctx.arc(70, 85, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(442, 85, 8, 0, Math.PI * 2); ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  private createFakeDOFVeil() {
    const dofCanvas = document.createElement('canvas');
    dofCanvas.width = 512;
    dofCanvas.height = 512;
    const ctx = dofCanvas.getContext('2d')!;

    // Soft atmospheric bokeh diffusion gradient faking Depth of Field
    const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
    grad.addColorStop(0.0, 'rgba(255, 230, 245, 0.16)');
    grad.addColorStop(0.4, 'rgba(255, 200, 235, 0.10)');
    grad.addColorStop(0.8, 'rgba(240, 180, 225, 0.05)');
    grad.addColorStop(1.0, 'rgba(220, 160, 210, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Soft defocused bokeh circles
    for (let b = 0; b < 24; b++) {
      const bx = ((b * 89) % 512);
      const by = ((b * 163) % 512);
      const br = 28 + (b % 4) * 16;
      const bGrad = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, br);
      bGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.08)');
      bGrad.addColorStop(0.7, 'rgba(255, 220, 245, 0.04)');
      bGrad.addColorStop(1.0, 'rgba(255, 200, 235, 0.0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    const dofTex = new THREE.CanvasTexture(dofCanvas);
    dofTex.wrapS = THREE.RepeatWrapping;
    dofTex.wrapT = THREE.RepeatWrapping;
    dofTex.repeat.set(6, 2);

    const dofGeo = new THREE.PlaneGeometry(320, 90);
    const dofMat = new THREE.MeshBasicMaterial({
      map: dofTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.dofVeilPlane = new THREE.Mesh(dofGeo, dofMat);
    this.dofVeilPlane.position.set(0, 15, -17.5);
    this.group.add(this.dofVeilPlane);
  }

  /**
   * 6. Foreground Vintage CRT Computer Terminal Consoles
   */
  private createForegroundTerminalConsoles() {
    const spacing = 36;
    const count = 6;

    for (let i = 0; i < count; i++) {
      // Offset consoles so none spawn anywhere near start position X=0
      const baseX = (i - 2) * spacing + 18;
      if (Math.abs(baseX) < 12) continue; // Guaranteed clear start view for the player!
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

      // High-Tech Electric Blue Phosphor Screen with Rounded Edges
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 256;
      screenCanvas.height = 192;
      const sCtx = screenCanvas.getContext('2d')!;

      // Deep cyan/blue phosphor background
      sCtx.fillStyle = '#051428';
      sCtx.fillRect(0, 0, 256, 192);

      // Cyan digital telemetry grid
      sCtx.strokeStyle = 'rgba(0, 180, 255, 0.25)';
      sCtx.lineWidth = 1;
      for (let y = 0; y < 192; y += 16) {
        sCtx.beginPath(); sCtx.moveTo(0, y); sCtx.lineTo(256, y); sCtx.stroke();
      }
      for (let x = 0; x < 256; x += 24) {
        sCtx.beginPath(); sCtx.moveTo(x, 0); sCtx.lineTo(x, 192); sCtx.stroke();
      }

      // Sine telemetry waveform
      sCtx.strokeStyle = '#00f5ff';
      sCtx.lineWidth = 3;
      sCtx.beginPath();
      for (let x = 0; x < 256; x += 4) {
        const y = 96 + Math.sin(x * 0.08) * 26 * Math.cos(x * 0.025);
        if (x === 0) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();

      // Telemetry digital text in glowing electric blue
      sCtx.fillStyle = '#00e5ff';
      sCtx.font = 'bold 14px monospace';
      sCtx.fillText('SYS: DRONE CITY', 14, 28);
      sCtx.fillStyle = '#70c5ff';
      sCtx.font = '11px monospace';
      sCtx.fillText('GRID: ONLINE [SECURE]', 14, 46);
      sCtx.fillText('RADAR SCAN: ACTIVE', 14, 168);

      const screenTex = new THREE.CanvasTexture(screenCanvas);

      // 2D Rounded Rectangle Screen Geometry
      const shape = new THREE.Shape();
      const sw = 0.76, sh = 0.54, sr = 0.07;
      shape.moveTo(-sw/2 + sr, -sh/2);
      shape.lineTo(sw/2 - sr, -sh/2);
      shape.quadraticCurveTo(sw/2, -sh/2, sw/2, -sh/2 + sr);
      shape.lineTo(sw/2, sh/2 - sr);
      shape.quadraticCurveTo(sw/2, sh/2, sw/2 - sr, sh/2);
      shape.lineTo(-sw/2 + sr, sh/2);
      shape.quadraticCurveTo(-sw/2, sh/2, -sw/2, sh/2 - sr);
      shape.lineTo(-sw/2, -sh/2 + sr);
      shape.quadraticCurveTo(-sw/2, -sh/2, -sw/2 + sr, -sh/2);

      const screenGeo = new THREE.ShapeGeometry(shape);
      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTex,
        color: 0x00c8ff,
      });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(-0.15, 1.28, 0.32);
      screen.rotation.x = -0.15;
      consoleGroup.add(screen);

      // Bezel Frame with Rounded Edges
      const bShape = new THREE.Shape();
      const bw = 0.82, bh = 0.60, br = 0.08;
      bShape.moveTo(-bw/2 + br, -bh/2);
      bShape.lineTo(bw/2 - br, -bh/2);
      bShape.quadraticCurveTo(bw/2, -bh/2, bw/2, -bh/2 + br);
      bShape.lineTo(bw/2, bh/2 - br);
      bShape.quadraticCurveTo(bw/2, bh/2, bw/2 - br, bh/2);
      bShape.lineTo(-bw/2 + br, bh/2);
      bShape.quadraticCurveTo(-bw/2, bh/2, -bw/2, bh/2 - br);
      bShape.lineTo(-bw/2, -bh/2 + br);
      bShape.quadraticCurveTo(-bw/2, -bh/2, -bw/2 + br, -bh/2);

      const bezelGeo = new THREE.ShapeGeometry(bShape);
      const bezelMat = new THREE.MeshBasicMaterial({ color: 0x090f18 });
      const bezel = new THREE.Mesh(bezelGeo, bezelMat);
      bezel.position.set(-0.15, 1.28, 0.315);
      bezel.rotation.x = -0.15;
      consoleGroup.add(bezel);

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

  public update(playerX: number, playerY: number = GROUND_Y, time: number = 0) {
    const alt = Math.max(0, playerY - GROUND_Y);

    // 1. Follow player with celestial backdrop & moons with vertical atmospheric scrolling
        if (this.dofVeilPlane) {
      this.dofVeilPlane.position.x = playerX * 0.15;
      this.dofVeilPlane.position.y = 15 + alt * 0.28;
    }
    this.skyBackdrop.position.x = playerX;
    this.skyBackdrop.position.y = 75 + alt * 0.35; // As player ascends, sky scrolls smoothly through strata

    this.ringedPlanetGroup.position.x = 24 + playerX * 0.025;
    this.ringedPlanetGroup.position.y = 28 + alt * 0.22;

    this.moonsGroup.position.x = playerX * 0.015;
    this.moonsGroup.position.y = 18 + alt * 0.20;

    // Drifting stratosphere clouds
    if (this.atmosphereClouds) {
      this.atmosphereClouds.position.x = playerX * 0.15 + ((time * 0.8) % 160) - 80;
      this.atmosphereClouds.position.y = 24 - alt * 0.15;
    }

    // 2. Parallax Distant Rounded Cubes Leapfrogging (Factor 0.12)
    const mSpan = 40;
    const mCount = this.distantCubeModules.length;
    const mTotal = mSpan * mCount;

    for (const m of this.distantCubeModules) {
      const relX = ((m.baseX - playerX * (1.0 - m.parallaxFactor)) % mTotal + mTotal) % mTotal - mTotal / 2;
      m.group.position.x = playerX + relX;
      m.group.position.y = m.baseY - alt * 0.08;
    }

    // 3. Parallax Midground Rounded Cubes Leapfrogging (Factor 0.32)
    const oSpan = 40;
    const oCount = this.midCubeModules.length;
    const oTotal = oSpan * oCount;

    for (const o of this.midCubeModules) {
      const relX = ((o.baseX - playerX * (1.0 - o.parallaxFactor)) % oTotal + oTotal) % oTotal - oTotal / 2;
      o.group.position.x = playerX + relX;
      o.group.position.y = o.baseY - alt * 0.16;
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
      // Offset by +18 so consoles never hover in front of player start position at X=0
      const relX = (((i - 2) * cSpan + 18 - playerX) % cTotal + cTotal) % cTotal - cTotal / 2;
      con.position.x = playerX + relX;
    }
  }
}
