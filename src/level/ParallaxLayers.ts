import * as THREE from 'three';

export const GROUND_Y = -3.70;

interface ParallaxObject {
  group: THREE.Group;
  baseX: number;
  parallaxFactor: number;
}

/**
 * Outside Retro-Futuristic Alien Outpost Environment
 * Recreated accurately from reference concept art:
 * - Horizon sunset gradient sky in peach, coral, and apricot tones
 * - Celestial ringed gas giant with elliptical ring & orbiting moons
 * - Angular cel-shaded slate-teal rock peaks and mountain clefts
 * - Retro sci-fi cream & orange outpost towers, domed silos, spire command towers, and skybridges
 * - Foreground bridge catwalk with orange center runner stripe, cream deck, rounded pipe guardrails,
 *   industrial under-chassis with cable bundles, and vintage CRT computer terminal workstations!
 */
export class ParallaxLayers {
  public group: THREE.Group;

  // Background layers with parallax
  private skyBackdrop!: THREE.Mesh;
  private ringedPlanetGroup!: THREE.Group;
  private moonsGroup!: THREE.Group;
  private mountainModules: ParallaxObject[] = [];
  private outpostModules: ParallaxObject[] = [];
  private floorTiles: THREE.Group[] = [];
  private foregroundConsoles: THREE.Group[] = [];

  // Reusable Materials
  private creamPlatingMat!: THREE.MeshStandardMaterial;
  private orangePanelMat!: THREE.MeshStandardMaterial;
  private darkMetalMat!: THREE.MeshStandardMaterial;
  private steelPipeMat!: THREE.MeshStandardMaterial;
  private rockTealDarkMat!: THREE.MeshStandardMaterial;
  private rockTealMidMat!: THREE.MeshStandardMaterial;
  private rockTealLightMat!: THREE.MeshStandardMaterial;
  private deckWalkwayMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initAestheticMaterials();
    this.createSunsetSky();
    this.createCelestialRingedPlanet();
    this.createSatelliteMoons();
    this.createDistantMountains();
    this.createOutpostTowers();
    this.createSeamlessCatwalkBridge();
    this.createForegroundTerminalConsoles();
  }

  private initAestheticMaterials() {
    // 1. Cream Outpost Plating (#f7f0e6)
    this.creamPlatingMat = new THREE.MeshStandardMaterial({
      color: 0xf5eee3,
      roughness: 0.45,
      metalness: 0.15,
    });

    // 2. Bold Warm Orange Panels (#e27c2f)
    this.orangePanelMat = new THREE.MeshStandardMaterial({
      color: 0xe27a2b,
      roughness: 0.40,
      metalness: 0.20,
    });

    // 3. Dark Industrial Metal & Structural Girders (#2d333b)
    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2b313a,
      roughness: 0.65,
      metalness: 0.55,
    });

    // 4. Steel Guardrails & Conduit Piping (#c5d1de)
    this.steelPipeMat = new THREE.MeshStandardMaterial({
      color: 0xbfcddb,
      roughness: 0.35,
      metalness: 0.70,
    });

    // 5. Stylized Cel-Shaded Slate-Teal Rock Materials
    this.rockTealDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1c2830,
      roughness: 0.85,
      metalness: 0.10,
      flatShading: true,
    });

    this.rockTealMidMat = new THREE.MeshStandardMaterial({
      color: 0x2a3945,
      roughness: 0.80,
      metalness: 0.10,
      flatShading: true,
    });

    this.rockTealLightMat = new THREE.MeshStandardMaterial({
      color: 0x3d5260,
      roughness: 0.75,
      metalness: 0.10,
      flatShading: true,
    });

    // 6. Foreground Walkway Deck Texture (Cream deck with vibrant amber center lane)
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

    // Inner hazard accent border line
    ctx.strokeStyle = '#c46922';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 56); ctx.lineTo(512, 56);
    ctx.moveTo(0, 200); ctx.lineTo(512, 200);
    ctx.stroke();

    // Dark panel joint lines & vertical expansion seams
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

    // 5-band horizontal dusk gradient matching reference
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

    // Planet Sphere (Terracotta Peach)
    const planetGeo = new THREE.SphereGeometry(6.2, 32, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0xdf9882,
      roughness: 0.65,
      metalness: 0.05,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.ringedPlanetGroup.add(planetMesh);

    // Atmospheric shadow crescent line
    const shadowGeo = new THREE.TorusGeometry(6.25, 0.08, 8, 48);
    shadowGeo.rotateY(Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x3d2b27 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.x = 0.5;
    this.ringedPlanetGroup.add(shadowMesh);

    // Iconic Giant Elliptical Ring System
    const ringGeo = new THREE.RingGeometry(8.6, 15.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xdda08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.35;
    ringMesh.rotation.y = 0.28;
    this.ringedPlanetGroup.add(ringMesh);

    // Fine dark ring outline
    const ringOutlineGeo = new THREE.RingGeometry(15.15, 15.25, 64);
    const ringOutlineMat = new THREE.MeshBasicMaterial({ color: 0x2d1f1c, side: THREE.DoubleSide });
    const ringOutline = new THREE.Mesh(ringOutlineGeo, ringOutlineMat);
    ringOutline.rotation.x = ringMesh.rotation.x;
    ringOutline.rotation.y = ringMesh.rotation.y;
    this.ringedPlanetGroup.add(ringOutline);

    this.group.add(this.ringedPlanetGroup);
  }

  /**
   * 3. Multiple Orbiting Satellite Moons
   */
  private createSatelliteMoons() {
    this.moonsGroup = new THREE.Group();

    // A. Large Moon (Upper Left)
    const moonGeo1 = new THREE.SphereGeometry(2.2, 24, 18);
    const moonMat1 = new THREE.MeshStandardMaterial({
      color: 0xf5b89a,
      roughness: 0.7,
    });
    const moon1 = new THREE.Mesh(moonGeo1, moonMat1);
    moon1.position.set(-28, 22, -34);
    this.moonsGroup.add(moon1);

    // Subtle dark contour line
    const contourGeo = new THREE.TorusGeometry(2.22, 0.04, 8, 32);
    const contourMat = new THREE.MeshBasicMaterial({ color: 0x3a2924 });
    const contour = new THREE.Mesh(contourGeo, contourMat);
    contour.position.copy(moon1.position);
    this.moonsGroup.add(contour);

    // B. Tiny Moon near large moon
    const moonGeo2 = new THREE.SphereGeometry(0.7, 16, 12);
    const moon2 = new THREE.Mesh(moonGeo2, moonMat1);
    moon2.position.set(-24, 18, -33);
    this.moonsGroup.add(moon2);

    // C. Midground Floating Moon between towers
    const moonGeo3 = new THREE.SphereGeometry(1.2, 18, 14);
    const moon3 = new THREE.Mesh(moonGeo3, moonMat1);
    moon3.position.set(10, 10, -28);
    this.moonsGroup.add(moon3);

    // D. Distant Far-Right Moon
    const moonGeo4 = new THREE.SphereGeometry(1.0, 16, 12);
    const moon4 = new THREE.Mesh(moonGeo4, moonMat1);
    moon4.position.set(38, 14, -30);
    this.moonsGroup.add(moon4);

    this.group.add(this.moonsGroup);
  }

  /**
   * 4. Angular Cel-Shaded Slate-Teal Mountain Peaks
   */
  private createDistantMountains() {
    const mountainSpan = 45;
    const count = 5;

    for (let i = 0; i < count; i++) {
      const baseX = (i - 2) * mountainSpan;
      const group = new THREE.Group();
      group.position.set(baseX, -3.7, -22);

      // Left Angular Cliff Massif
      const cliff1 = this.createFacetedPeak(9, 22, 7, this.rockTealDarkMat, this.rockTealMidMat);
      cliff1.position.set(-15, 0, 0);
      group.add(cliff1);

      // Right Angular Cliff Massif
      const cliff2 = this.createFacetedPeak(11, 24, 8, this.rockTealMidMat, this.rockTealLightMat);
      cliff2.position.set(16, 0, 0);
      group.add(cliff2);

      // Distant softer mountain peak in center background
      const cliffCenter = this.createFacetedPeak(14, 18, 6, this.rockTealDarkMat, this.rockTealLightMat);
      cliffCenter.position.set(0, 0, -4);
      group.add(cliffCenter);

      this.group.add(group);
      this.mountainModules.push({ group, baseX, parallaxFactor: 0.12 });
    }
  }

  private createFacetedPeak(
    width: number,
    height: number,
    depth: number,
    darkMat: THREE.Material,
    lightMat: THREE.Material
  ): THREE.Group {
    const peakGroup = new THREE.Group();

    // Geometric faceted cone / pyramid segments
    const geo1 = new THREE.ConeGeometry(width * 0.55, height, 5);
    geo1.translate(0, height / 2, 0);
    const mesh1 = new THREE.Mesh(geo1, darkMat);
    peakGroup.add(mesh1);

    // Secondary overlapping facet for angular cel-shaded look
    const geo2 = new THREE.ConeGeometry(width * 0.42, height * 0.88, 4);
    geo2.translate(width * 0.15, height * 0.44, depth * 0.15);
    const mesh2 = new THREE.Mesh(geo2, lightMat);
    mesh2.rotation.y = 0.5;
    peakGroup.add(mesh2);

    return peakGroup;
  }

  /**
   * 5. Retro-Futuristic Outpost Towers (Cream & Warm Orange)
   */
  private createOutpostTowers() {
    const moduleSpan = 45;
    const count = 5;

    for (let i = 0; i < count; i++) {
      const baseX = (i - 2) * moduleSpan;
      const group = new THREE.Group();
      group.position.set(baseX, -3.7, -14);

      // --- TOWER 1: Left Observation Cupola & Landing Tower ---
      const tower1 = this.buildCupolaTower();
      tower1.position.set(-12, 0, 0);
      group.add(tower1);

      // Connecting Elevated Skybridge to Mountain
      const bridgeGeo = new THREE.BoxGeometry(7, 0.45, 1.2);
      const bridgeMesh = new THREE.Mesh(bridgeGeo, this.creamPlatingMat);
      bridgeMesh.position.set(-16.5, 6.2, 0);
      group.add(bridgeMesh);

      // --- TOWER 2: Center-Right Domed Silo Outpost Tower ---
      const tower2 = this.buildDomedSiloTower();
      tower2.position.set(3, 0, 0);
      group.add(tower2);

      // --- TOWER 3: Distant Slender Relay Pylon ---
      const tower3 = this.buildRelayPylon();
      tower3.position.set(10.5, 0, -3);
      group.add(tower3);

      // --- TOWER 4: Right Spire Command Tower ---
      const tower4 = this.buildSpireCommandTower();
      tower4.position.set(18, 0, 0);
      group.add(tower4);

      // Elevated Snaking Highway / Skybridge in Midground
      const highwayGeo = new THREE.BoxGeometry(16, 0.4, 1.5);
      const highway = new THREE.Mesh(highwayGeo, this.creamPlatingMat);
      highway.position.set(-6, 2.8, -2);
      highway.rotation.z = -0.06;
      group.add(highway);

      this.group.add(group);
      this.outpostModules.push({ group, baseX, parallaxFactor: 0.35 });
    }
  }

  private buildCupolaTower(): THREE.Group {
    const t = new THREE.Group();

    // Octagonal Tapered Pylon Column
    const colHeight = 8.5;
    const colGeo = new THREE.CylinderGeometry(0.9, 1.4, colHeight, 8);
    colGeo.translate(0, colHeight / 2, 0);
    const col = new THREE.Mesh(colGeo, this.creamPlatingMat);
    t.add(col);

    // Recessed vertical orange panel accents
    const orangeStripeGeo = new THREE.BoxGeometry(0.35, colHeight * 0.7, 1.9);
    const orangeStripe = new THREE.Mesh(orangeStripeGeo, this.orangePanelMat);
    orangeStripe.position.y = colHeight * 0.48;
    t.add(orangeStripe);

    // Heavy Flanged Base Footing
    const baseGeo = new THREE.CylinderGeometry(1.6, 2.1, 1.2, 8);
    baseGeo.translate(0, 0.6, 0);
    const base = new THREE.Mesh(baseGeo, this.darkMetalMat);
    t.add(base);

    // Observation Cupola / Octagonal Head
    const cupolaHeadY = colHeight + 0.9;
    const cupolaGeo = new THREE.CylinderGeometry(2.5, 1.6, 1.8, 8);
    const cupola = new THREE.Mesh(cupolaGeo, this.creamPlatingMat);
    cupola.position.y = cupolaHeadY;
    t.add(cupola);

    // Orange Cupola Collar Band
    const bandGeo = new THREE.CylinderGeometry(2.52, 2.05, 0.9, 8);
    const band = new THREE.Mesh(bandGeo, this.orangePanelMat);
    band.position.y = cupolaHeadY - 0.2;
    t.add(band);

    // Diagonal Under-Struts
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * Math.PI * 2;
      const strutGeo = new THREE.BoxGeometry(0.18, 1.6, 0.25);
      const strut = new THREE.Mesh(strutGeo, this.darkMetalMat);
      strut.position.set(Math.cos(angle) * 1.5, colHeight - 0.2, Math.sin(angle) * 1.5);
      strut.rotation.z = Math.cos(angle) * 0.4;
      t.add(strut);
    }

    return t;
  }

  private buildDomedSiloTower(): THREE.Group {
    const t = new THREE.Group();

    const h = 9.5;
    // Main Cylindrical Silo Body
    const cylGeo = new THREE.CylinderGeometry(1.2, 1.5, h, 16);
    cylGeo.translate(0, h / 2, 0);
    const cyl = new THREE.Mesh(cylGeo, this.creamPlatingMat);
    t.add(cyl);

    // Vertical conduit pipes running up the tower
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, h * 0.9, 8);
      pipeGeo.translate(0, h * 0.45, 0);
      const pipe = new THREE.Mesh(pipeGeo, this.steelPipeMat);
      pipe.position.set(Math.cos(angle) * 1.35, 0, Math.sin(angle) * 1.35);
      t.add(pipe);
    }

    // Domed Observatory Cap (Cream with Orange Wedges)
    const domeRadius = 2.2;
    const domeGeo = new THREE.SphereGeometry(domeRadius, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const dome = new THREE.Mesh(domeGeo, this.creamPlatingMat);
    dome.position.y = h;
    t.add(dome);

    // Orange Facet Wedges on Dome
    const wedgeGeo = new THREE.ConeGeometry(domeRadius * 0.98, 1.8, 4);
    wedgeGeo.translate(0, 0.9, 0);
    const wedge = new THREE.Mesh(wedgeGeo, this.orangePanelMat);
    wedge.position.y = h + 0.1;
    t.add(wedge);

    // Rooftop Antenna Telemetry Mast
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.08, 2.5, 8);
    mastGeo.translate(0, 1.25, 0);
    const mast = new THREE.Mesh(mastGeo, this.steelPipeMat);
    mast.position.y = h + domeRadius * 0.85;
    t.add(mast);

    // Dual Aerodynamic Side Fins
    const finGeo = new THREE.BoxGeometry(0.15, 2.4, 0.9);
    const finL = new THREE.Mesh(finGeo, this.orangePanelMat);
    finL.position.set(-1.8, h * 0.75, 0);
    finL.rotation.z = 0.25;
    t.add(finL);

    const finR = new THREE.Mesh(finGeo, this.orangePanelMat);
    finR.position.set(1.8, h * 0.75, 0);
    finR.rotation.z = -0.25;
    t.add(finR);

    return t;
  }

  private buildRelayPylon(): THREE.Group {
    const t = new THREE.Group();

    const h = 7.0;
    // Slender Pylon Column
    const pylonGeo = new THREE.CylinderGeometry(0.45, 0.8, h, 10);
    pylonGeo.translate(0, h / 2, 0);
    const pylon = new THREE.Mesh(pylonGeo, this.creamPlatingMat);
    t.add(pylon);

    // Flared Dish Head
    const dishGeo = new THREE.CylinderGeometry(1.6, 0.5, 0.8, 12);
    dishGeo.translate(0, h + 0.4, 0);
    const dish = new THREE.Mesh(dishGeo, this.creamPlatingMat);
    t.add(dish);

    const dishRingGeo = new THREE.CylinderGeometry(1.62, 1.2, 0.35, 12);
    dishRingGeo.translate(0, h + 0.5, 0);
    const dishRing = new THREE.Mesh(dishRingGeo, this.orangePanelMat);
    t.add(dishRing);

    // Antennae Spikes
    for (let i = 0; i < 3; i++) {
      const spGeo = new THREE.CylinderGeometry(0.02, 0.04, 1.5, 6);
      spGeo.translate(0, 0.75, 0);
      const sp = new THREE.Mesh(spGeo, this.steelPipeMat);
      sp.position.set((i - 1) * 0.6, h + 0.8, 0);
      t.add(sp);
    }

    return t;
  }

  private buildSpireCommandTower(): THREE.Group {
    const t = new THREE.Group();

    const h = 10.5;
    // Multi-faceted Command Column
    const colGeo = new THREE.CylinderGeometry(1.4, 1.8, h, 8);
    colGeo.translate(0, h / 2, 0);
    const col = new THREE.Mesh(colGeo, this.creamPlatingMat);
    t.add(col);

    // Panoramic Observation Slit Windows (Dark tint band)
    const windowGeo = new THREE.CylinderGeometry(1.65, 1.45, 0.9, 8);
    windowGeo.translate(0, h * 0.72, 0);
    const win = new THREE.Mesh(windowGeo, this.darkMetalMat);
    t.add(win);

    // Conical Pointed Roof Spire (#e27c2f)
    const spireGeo = new THREE.ConeGeometry(2.1, 3.8, 8);
    spireGeo.translate(0, 1.9, 0);
    const spire = new THREE.Mesh(spireGeo, this.orangePanelMat);
    spire.position.y = h;
    t.add(spire);

    // Telemetry Needle Spire
    const needleGeo = new THREE.CylinderGeometry(0.03, 0.06, 2.2, 6);
    needleGeo.translate(0, 1.1, 0);
    const needle = new THREE.Mesh(needleGeo, this.steelPipeMat);
    needle.position.y = h + 3.8;
    t.add(needle);

    return t;
  }

  /**
   * 6. Infinite Seamless Foreground Catwalk Bridge (Ground at Y = -3.70)
   */
  private createSeamlessCatwalkBridge() {
    const tileWidth = 40;
    const tileCount = 5; // 200 units span
    const slabHeight = 2.4;

    for (let i = 0; i < tileCount; i++) {
      const x = (i - 1) * tileWidth;
      const tileGroup = new THREE.Group();
      // Center of slab at Y = -4.90 -> Top surface at EXACTLY Y = -3.70!
      tileGroup.position.set(x, -4.90, 0);

      // Main Bridge Walking Deck (Cream borders with amber center stripe)
      const deckGeo = new THREE.BoxGeometry(tileWidth, slabHeight, 10);
      const deckMesh = new THREE.Mesh(deckGeo, this.deckWalkwayMat);
      tileGroup.add(deckMesh);

      // Industrial Guardrail Pipe running along the rear deck edge
      const railGeo = new THREE.CylinderGeometry(0.14, 0.14, tileWidth, 12);
      railGeo.rotateZ(Math.PI / 2);
      const railMesh = new THREE.Mesh(railGeo, this.steelPipeMat);
      railMesh.position.set(0, slabHeight / 2 + 0.35, -2.2);
      tileGroup.add(railMesh);

      // Vertical Railing Stanchions
      for (let rx = -tileWidth / 2 + 2; rx < tileWidth / 2; rx += 4.0) {
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
        const post = new THREE.Mesh(postGeo, this.darkMetalMat);
        post.position.set(rx, slabHeight / 2 + 0.15, -2.2);
        tileGroup.add(post);
      }

      // Front Guardrail Pipe
      const frontRailGeo = new THREE.CylinderGeometry(0.12, 0.12, tileWidth, 12);
      frontRailGeo.rotateZ(Math.PI / 2);
      const frontRail = new THREE.Mesh(frontRailGeo, this.steelPipeMat);
      frontRail.position.set(0, slabHeight / 2 + 0.35, 2.2);
      tileGroup.add(frontRail);

      // Industrial Under-Deck Chassis (Girders & Cable Bundles)
      const underbeamGeo = new THREE.BoxGeometry(tileWidth, 0.6, 8.5);
      const underbeam = new THREE.Mesh(underbeamGeo, this.darkMetalMat);
      underbeam.position.set(0, -slabHeight / 2 - 0.25, 0);
      tileGroup.add(underbeam);

      // Hanging Under-Deck Electrical Conduit Cable Bundles
      for (let c = 0; c < 3; c++) {
        const cableGeo = new THREE.CylinderGeometry(0.05, 0.05, tileWidth, 8);
        cableGeo.rotateZ(Math.PI / 2);
        const cable = new THREE.Mesh(cableGeo, this.darkMetalMat);
        cable.position.set(0, -slabHeight / 2 - 0.5 - c * 0.12, 1.2 + c * 0.4);
        tileGroup.add(cable);
      }

      this.group.add(tileGroup);
      this.floorTiles.push(tileGroup);
    }
  }

  /**
   * 7. Foreground Vintage CRT Computer Terminal Consoles (As shown in reference image!)
   */
  private createForegroundTerminalConsoles() {
    const spacing = 36;
    const count = 6;

    for (let i = 0; i < count; i++) {
      const baseX = (i - 2) * spacing;
      const consoleGroup = new THREE.Group();
      // Positioned in the foreground at Y = -3.70, Z = 2.4 (just in front of Jones' plane)
      consoleGroup.position.set(baseX, -3.70, 2.2);

      // Angled Beige/Cream Console Chassis
      const chassisGeo = new THREE.BoxGeometry(1.6, 1.2, 0.9);
      const chassis = new THREE.Mesh(chassisGeo, this.creamPlatingMat);
      chassis.position.set(0, 0.55, 0);
      consoleGroup.add(chassis);

      // Slanted CRT Monitor Hood
      const hoodGeo = new THREE.BoxGeometry(1.1, 0.85, 0.7);
      const hood = new THREE.Mesh(hoodGeo, this.creamPlatingMat);
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

      // Molded Keyboard Shelf & Colored Mechanical Buttons
      const kbGeo = new THREE.BoxGeometry(0.9, 0.1, 0.45);
      const kb = new THREE.Mesh(kbGeo, this.darkMetalMat);
      kb.position.set(-0.15, 0.85, 0.35);
      kb.rotation.x = 0.22;
      consoleGroup.add(kb);

      // Antenna on terminal
      const antGeo = new THREE.CylinderGeometry(0.02, 0.04, 1.2, 6);
      antGeo.translate(0, 0.6, 0);
      const ant = new THREE.Mesh(antGeo, this.steelPipeMat);
      ant.position.set(0.65, 1.1, -0.2);
      consoleGroup.add(ant);

      // Heavy Ribbed Conduit Hose connecting into bridge deck
      const hoseGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 10);
      hoseGeo.rotateZ(Math.PI / 3);
      const hose = new THREE.Mesh(hoseGeo, this.darkMetalMat);
      hose.position.set(0.85, 0.35, 0);
      consoleGroup.add(hose);

      this.group.add(consoleGroup);
      this.foregroundConsoles.push(consoleGroup);
    }
  }

  public update(playerX: number, time: number) {
    // 1. Follow player with celestial backdrop & moons (ultra-low parallax ratio ~0.01-0.03)
    this.skyBackdrop.position.x = playerX;
    this.ringedPlanetGroup.position.x = 24 + playerX * 0.025;
    this.moonsGroup.position.x = playerX * 0.015;

    // 2. Parallax Mountains Leapfrogging (Factor 0.12)
    const mSpan = 45;
    const mCount = this.mountainModules.length;
    const mTotal = mSpan * mCount;

    for (const m of this.mountainModules) {
      const relX = ((m.baseX - playerX * (1.0 - m.parallaxFactor)) % mTotal + mTotal) % mTotal - mTotal / 2;
      m.group.position.x = playerX + relX;
    }

    // 3. Parallax Outpost Towers Leapfrogging (Factor 0.35)
    const oSpan = 45;
    const oCount = this.outpostModules.length;
    const oTotal = oSpan * oCount;

    for (const o of this.outpostModules) {
      const relX = ((o.baseX - playerX * (1.0 - o.parallaxFactor)) % oTotal + oTotal) % oTotal - oTotal / 2;
      o.group.position.x = playerX + relX;
    }

    // 4. Foreground Seamless Ground Bridge Leapfrogging (Infinite Ground Guarantee at Y = -3.70)
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

    // 5. Foreground Terminal Consoles Leapfrogging
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
