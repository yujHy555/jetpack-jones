import * as THREE from 'three';

export const GROUND_Y = -3.70;

interface SporeMote {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  speedX: number;
  speedY: number;
  phase: number;
}

/**
 * Outside Alien Planet Environment with Infinite Seamless Ground & Celestial Horizons
 * Features:
 * - High-resolution, undistorted procedurally tiled alien bedrock & glowing lichen
 * - Vast cosmic sky with twinkling starfield
 * - Giant ringed gas giant moon & smaller crimson satellite
 * - Bioluminescent mushroom spires with pulsing neon caps
 * - Floating ambient alien spores drifting in cosmic breeze
 */
export class ParallaxLayers {
  public group: THREE.Group;
  private bgFloraModules: THREE.Group[] = [];
  private floorTiles: THREE.Group[] = [];
  private sporeMotes: SporeMote[] = [];

  // Celestial Bodies
  private skyBackdrop!: THREE.Mesh;
  private ringedPlanetGroup!: THREE.Group;
  private crimsonMoonMesh!: THREE.Mesh;
  private starPoints!: THREE.Points;

  // Materials
  private groundMat!: THREE.MeshStandardMaterial;
  private lichenMat!: THREE.MeshStandardMaterial;
  private shroomStalkMat!: THREE.MeshStandardMaterial;
  private shroomCapMatCyan!: THREE.MeshStandardMaterial;
  private shroomCapMatPink!: THREE.MeshStandardMaterial;
  private crystalMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initAlienMaterials();
    this.createCosmicSky(scene);
    this.createCelestialMoons();
    this.createInfiniteAlienGround();
    this.createAlienFloraBackdrop();
    this.createDriftingSpores();
  }

  private initAlienMaterials() {
    // 1. Procedural Seamless Alien Bedrock Texture (512x512)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base alien rock strata (dark violet-slate)
    ctx.fillStyle = '#161224';
    ctx.fillRect(0, 0, 512, 512);

    // Layered extraterrestrial sedimentary bands
    for (let y = 0; y < 512; y += 16) {
      const shade = Math.sin(y * 0.05) * 15 + 24;
      ctx.fillStyle = `rgb(${shade + 8}, ${shade - 2}, ${shade + 18})`;
      ctx.fillRect(0, y, 512, 16);
    }

    // Glowing bioluminescent mineral veins (Cyan & Violet fissures)
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 245, 255, 0.45)' : 'rgba(230, 40, 210, 0.35)';
      ctx.beginPath();
      let x = (i * 37) % 512;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < 512) {
        x += (Math.random() - 0.5) * 28;
        y += Math.random() * 32 + 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Fine crystalline mineral grains
    for (let p = 0; p < 800; p++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      const bright = Math.random() < 0.3;
      ctx.fillStyle = bright ? 'rgba(0, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(px, py, bright ? 2 : 1, bright ? 2 : 1);
    }

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    // Tiled with 1:1 world unit density: 1 repeat per 4 units horizontally
    groundTex.repeat.set(10, 1);

    this.groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.75,
      metalness: 0.25,
    });

    // 2. Bioluminescent Moss & Lichen Surface Trim
    const lichenCanvas = document.createElement('canvas');
    lichenCanvas.width = 256;
    lichenCanvas.height = 32;
    const lCtx = lichenCanvas.getContext('2d')!;
    lCtx.fillStyle = '#0a1d24';
    lCtx.fillRect(0, 0, 256, 32);

    for (let lx = 0; lx < 256; lx += 8) {
      const h = Math.random() * 18 + 10;
      const grad = lCtx.createLinearGradient(lx, 0, lx, h);
      grad.addColorStop(0, '#00ffff');
      grad.addColorStop(0.6, '#00a88b');
      grad.addColorStop(1, 'transparent');
      lCtx.fillStyle = grad;
      lCtx.fillRect(lx, 0, 6, h);
    }

    const lichenTex = new THREE.CanvasTexture(lichenCanvas);
    lichenTex.wrapS = THREE.RepeatWrapping;
    lichenTex.wrapT = THREE.ClampToEdgeWrapping;
    lichenTex.repeat.set(16, 1);

    this.lichenMat = new THREE.MeshStandardMaterial({
      map: lichenTex,
      emissive: 0x004444,
      emissiveIntensity: 0.8,
      roughness: 0.35,
    });

    // 3. Alien Flora Materials
    this.shroomStalkMat = new THREE.MeshStandardMaterial({
      color: 0x221c38,
      roughness: 0.5,
      metalness: 0.1,
    });

    this.shroomCapMatCyan = new THREE.MeshStandardMaterial({
      color: 0x054857,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });

    this.shroomCapMatPink = new THREE.MeshStandardMaterial({
      color: 0x4a0a38,
      emissive: 0xff1493,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });

    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0x00ffee,
      emissive: 0x006677,
      emissiveIntensity: 0.4,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.9,
    });
  }

  private createCosmicSky(scene: THREE.Scene) {
    // Atmospheric gradient dome
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 128;
    skyCanvas.height = 256;
    const sCtx = skyCanvas.getContext('2d')!;

    const grad = sCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#060212'); // Deep space zenith
    grad.addColorStop(0.45, '#16082b'); // Violet nebula mid-sky
    grad.addColorStop(0.78, '#2a0e3a'); // Magenta alien glow
    grad.addColorStop(1.0, '#0e2434'); // Cyan dusk horizon

    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 256);

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyGeo = new THREE.PlaneGeometry(160, 90);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });

    this.skyBackdrop = new THREE.Mesh(skyGeo, skyMat);
    this.skyBackdrop.position.set(0, 8, -42);
    this.group.add(this.skyBackdrop);

    // Starfield Points
    const starCount = 220;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3 + 0] = (Math.random() - 0.5) * 140;
      starPositions[i * 3 + 1] = Math.random() * 50 - 5;
      starPositions[i * 3 + 2] = -40 + Math.random() * 4;

      const colChoice = Math.random();
      if (colChoice < 0.6) {
        starColors[i * 3 + 0] = 1.0;
        starColors[i * 3 + 1] = 1.0;
        starColors[i * 3 + 2] = 1.0; // White
      } else if (colChoice < 0.85) {
        starColors[i * 3 + 0] = 0.5;
        starColors[i * 3 + 1] = 0.9;
        starColors[i * 3 + 2] = 1.0; // Cyan
      } else {
        starColors[i * 3 + 0] = 1.0;
        starColors[i * 3 + 1] = 0.6;
        starColors[i * 3 + 2] = 0.9; // Pink
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.starPoints = new THREE.Points(starGeo, starMat);
    this.group.add(this.starPoints);
  }

  private createCelestialMoons() {
    // 1. Giant Ringed Alien Gas Giant Moon
    this.ringedPlanetGroup = new THREE.Group();
    this.ringedPlanetGroup.position.set(22, 16, -34);

    // Planet Sphere with atmospheric shading
    const planetGeo = new THREE.SphereGeometry(6.5, 32, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x1b4a68,
      emissive: 0x0a2030,
      roughness: 0.6,
      metalness: 0.1,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.ringedPlanetGroup.add(planetMesh);

    // Concentric Majestic Rings
    const ringGeo = new THREE.RingGeometry(8.5, 14.5, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.rotation.y = 0.35;
    this.ringedPlanetGroup.add(ringMesh);

    this.group.add(this.ringedPlanetGroup);

    // 2. Smaller Distant Crimson Satellite Moon
    const moonGeo = new THREE.SphereGeometry(2.4, 20, 16);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xa83256,
      emissive: 0x440818,
      roughness: 0.8,
    });
    this.crimsonMoonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.crimsonMoonMesh.position.set(-28, 20, -36);
    this.group.add(this.crimsonMoonMesh);
  }

  private createInfiniteAlienGround() {
    const tileWidth = 40;
    const tileCount = 5; // Total 200 units span
    const slabHeight = 2.6;

    for (let i = 0; i < tileCount; i++) {
      const x = (i - 1) * tileWidth;

      const tileGroup = new THREE.Group();
      // Center of slab at Y = -5.0 -> Top surface at EXACTLY Y = -3.70!
      tileGroup.position.set(x, -5.0, 0);

      // Main alien bedrock slab
      const slabGeo = new THREE.BoxGeometry(tileWidth, slabHeight, 10);
      const slab = new THREE.Mesh(slabGeo, this.groundMat);
      tileGroup.add(slab);

      // Glowing bioluminescent lichen along top surface edge
      const lichenGeo = new THREE.BoxGeometry(tileWidth, 0.08, 2.2);
      const lichen = new THREE.Mesh(lichenGeo, this.lichenMat);
      // Top face at Y = -3.70 + 0.04 = -3.66
      lichen.position.set(0, slabHeight / 2 + 0.04, 0);
      tileGroup.add(lichen);

      this.group.add(tileGroup);
      this.floorTiles.push(tileGroup);
    }
  }

  private createAlienFloraBackdrop() {
    // Repeating background alien mushroom spires and crystal formations
    for (let i = 0; i < 6; i++) {
      const module = new THREE.Group();
      module.position.set(i * 30 - 25, 0, -8);

      // A. Giant Bioluminescent Mushroom Spires
      const shroomPositions = [
        { x: -9, scale: 1.4, mat: this.shroomCapMatCyan },
        { x: -3, scale: 0.9, mat: this.shroomCapMatPink },
        { x: 5, scale: 1.6, mat: this.shroomCapMatPink },
        { x: 11, scale: 1.1, mat: this.shroomCapMatCyan },
      ];

      for (const sp of shroomPositions) {
        const shroomGroup = new THREE.Group();
        shroomGroup.position.set(sp.x, -3.7, 0);
        shroomGroup.scale.set(sp.scale, sp.scale, sp.scale);

        // Curving organic stem
        const stemHeight = 4.2;
        const stemGeo = new THREE.CylinderGeometry(0.2, 0.45, stemHeight, 10);
        stemGeo.translate(0, stemHeight / 2, 0);
        const stem = new THREE.Mesh(stemGeo, this.shroomStalkMat);
        shroomGroup.add(stem);

        // Glowing umbrella mushroom cap
        const capGeo = new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45);
        const cap = new THREE.Mesh(capGeo, sp.mat);
        cap.position.y = stemHeight;
        cap.rotation.x = Math.PI;
        shroomGroup.add(cap);

        // Under-cap glowing ring / gills
        const gillGeo = new THREE.TorusGeometry(1.2, 0.08, 8, 16);
        gillGeo.rotateX(Math.PI / 2);
        const gill = new THREE.Mesh(gillGeo, sp.mat);
        gill.position.y = stemHeight - 0.05;
        shroomGroup.add(gill);

        module.add(shroomGroup);
      }

      // B. Alien Crystal Spires
      for (let cx = -12; cx <= 12; cx += 8) {
        const crystalGroup = new THREE.Group();
        crystalGroup.position.set(cx + (Math.random() - 0.5) * 2, -3.7, -1);

        const h = 2.5 + Math.random() * 2.0;
        const cGeo = new THREE.ConeGeometry(0.35, h, 5);
        cGeo.translate(0, h / 2, 0);
        const cMesh = new THREE.Mesh(cGeo, this.crystalMat);
        cMesh.rotation.z = (Math.random() - 0.5) * 0.35;
        crystalGroup.add(cMesh);

        module.add(crystalGroup);
      }

      this.group.add(module);
      this.bgFloraModules.push(module);
    }
  }

  private createDriftingSpores() {
    const sporeGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const sporeMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const sporeMatPink = new THREE.MeshBasicMaterial({ color: 0xff00bb });

    for (let i = 0; i < 36; i++) {
      const isCyan = i % 2 === 0;
      const mesh = new THREE.Mesh(sporeGeo, isCyan ? sporeMatCyan : sporeMatPink);
      const baseX = (Math.random() - 0.5) * 50;
      const baseY = -3.2 + Math.random() * 9.0;
      mesh.position.set(baseX, baseY, (Math.random() - 0.5) * 6);
      this.group.add(mesh);

      this.sporeMotes.push({
        mesh,
        baseX,
        baseY,
        speedX: 0.8 + Math.random() * 1.2,
        speedY: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(playerX: number, time: number) {
    // 1. Follow player with celestial sky backdrop & distant moons (Parallax ratio ~0.02)
    this.skyBackdrop.position.x = playerX;
    this.ringedPlanetGroup.position.x = 22 + playerX * 0.03;
    this.crimsonMoonMesh.position.x = -28 + playerX * 0.02;
    this.starPoints.position.x = playerX * 0.01;

    // Subtle celestial rotation of the giant ringed planet
    this.ringedPlanetGroup.rotation.y = time * 0.02;

    // 2. Seamless Ground Leapfrogging (Infinite Ground Guarantee at Y = -3.70)
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

    // 3. Seamless Alien Flora Leapfrogging (Midground Parallax)
    const moduleWidth = 30;
    const floraCount = this.bgFloraModules.length;
    const floraSpan = (floraCount * moduleWidth) / 2;

    for (let i = 0; i < floraCount; i++) {
      const mod = this.bgFloraModules[i];
      if (mod.position.x < playerX - floraSpan) {
        mod.position.x += floraCount * moduleWidth;
      } else if (mod.position.x > playerX + floraSpan) {
        mod.position.x -= floraCount * moduleWidth;
      }
    }

    // 4. Bioluminescent Shroom Cap Pulsing Glow
    const pulseCyan = 0.45 + Math.sin(time * 3.0) * 0.25;
    const pulsePink = 0.40 + Math.sin(time * 2.5 + 1.0) * 0.22;
    this.shroomCapMatCyan.emissiveIntensity = pulseCyan;
    this.shroomCapMatPink.emissiveIntensity = pulsePink;

    // 5. Drifting Bioluminescent Spores
    for (const mote of this.sporeMotes) {
      // Relative motion with gentle waving
      const relX = ((mote.baseX - playerX * 0.8 + time * mote.speedX * 2.0) % 50) - 25;
      mote.mesh.position.x = playerX + relX;
      mote.mesh.position.y = mote.baseY + Math.sin(time * mote.speedY + mote.phase) * 0.5;
    }
  }
}
