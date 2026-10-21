import * as THREE from 'three';

/**
 * Continuous Industrial Environment with Infinite Seamless Ground & Ceiling
 * Never ends or disappears as the player explores!
 */
export class ParallaxLayers {
  public group: THREE.Group;
  private bgElements: THREE.Group[] = [];

  // Modular floor tiles that seamlessly leapfrog
  private floorTiles: THREE.Mesh[] = [];
  private ceilingTiles: THREE.Mesh[] = [];
  private steamVents: THREE.Group[] = [];

  private floorMat: THREE.MeshStandardMaterial;
  private ceilingMat: THREE.MeshStandardMaterial;
  private hazardTrimMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e24,
      roughness: 0.65,
      metalness: 0.6,
    });

    this.ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.7,
      metalness: 0.5,
    });

    // Procedural Hazard Stripe Texture for Floor Grating Trim
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#111';
    for (let i = -64; i < 128; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 12, 0);
      ctx.lineTo(i + 36, 64);
      ctx.lineTo(i + 24, 64);
      ctx.closePath();
      ctx.fill();
    }
    const hazardTex = new THREE.CanvasTexture(canvas);
    hazardTex.wrapS = THREE.RepeatWrapping;
    hazardTex.wrapT = THREE.RepeatWrapping;
    hazardTex.repeat.set(16, 1);

    this.hazardTrimMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.4,
      metalness: 0.2,
    });

    this.createInfiniteGroundAndCeiling();
    this.createIndustrialBackdrop();
  }

  private createInfiniteGroundAndCeiling() {
    const tileWidth = 40;
    const tileCount = 5; // Spans 200 units total

    for (let i = 0; i < tileCount; i++) {
      const x = (i - 1) * tileWidth;

      // Solid floor slab (Y = -5.0, top surface at Y = -3.8)
      const floorTile = new THREE.Group();
      floorTile.position.set(x, -4.9, 0);

      const slabGeo = new THREE.BoxGeometry(tileWidth, 2.2, 10);
      const slab = new THREE.Mesh(slabGeo, this.floorMat);
      floorTile.add(slab);

      // Top hazard border stripe
      const trimGeo = new THREE.BoxGeometry(tileWidth, 0.15, 2.0);
      const trim = new THREE.Mesh(trimGeo, this.hazardTrimMat);
      trim.position.set(0, 1.15, 0);
      floorTile.add(trim);

      this.group.add(floorTile);
      this.floorTiles.push(floorTile as unknown as THREE.Mesh);

      // Solid ceiling structure (Y = 12.0)
      const ceilTile = new THREE.Group();
      ceilTile.position.set(x, 12.0, 0);

      const ceilSlab = new THREE.Mesh(new THREE.BoxGeometry(tileWidth, 2.0, 10), this.ceilingMat);
      ceilTile.add(ceilSlab);

      this.group.add(ceilTile);
      this.ceilingTiles.push(ceilTile as unknown as THREE.Mesh);
    }
  }

  private createIndustrialBackdrop() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e2026,
      roughness: 0.65,
      metalness: 0.5,
    });

    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x383c44,
      roughness: 0.35,
      metalness: 0.8,
    });

    // Repeating background industrial factory modules
    for (let i = 0; i < 6; i++) {
      const module = new THREE.Group();
      module.position.set(i * 26 - 15, 0, -8);

      // Vertical heavy I-beams
      for (let b = -10; b <= 10; b += 6) {
        const beamGeo = new THREE.BoxGeometry(0.9, 26, 0.9);
        const beam = new THREE.Mesh(beamGeo, metalMat);
        beam.position.x = b;
        beam.position.y = 3;
        module.add(beam);
      }

      // Horizontal catwalk cross-girders
      for (let y = -2; y <= 8; y += 4) {
        const girderGeo = new THREE.BoxGeometry(26, 0.8, 0.6);
        const girder = new THREE.Mesh(girderGeo, metalMat);
        girder.position.y = y;
        module.add(girder);
      }

      // Industrial steam pipes
      const pipeGeo = new THREE.CylinderGeometry(0.55, 0.55, 26, 16);
      pipeGeo.rotateZ(Math.PI / 2);
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.position.set(0, 3.5, 1);
      module.add(pipe);

      // Amber & Cyan warning beacon lamps
      for (let lx = -9; lx <= 9; lx += 6) {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: lx % 12 === 0 ? 0x00e5ff : 0xffaa00 })
        );
        bulb.position.set(lx, 4.2, 1.4);
        module.add(bulb);
      }

      this.group.add(module);
      this.bgElements.push(module);
    }
  }

  public update(playerX: number, time: number) {
    const tileWidth = 40;
    const tileCount = this.floorTiles.length;
    const halfSpan = (tileCount * tileWidth) / 2;

    // 1. Seamless Ground & Ceiling Leapfrogging (Infinite Ground Guarantee!)
    for (let i = 0; i < tileCount; i++) {
      const floorTile = this.floorTiles[i];
      const ceilTile = this.ceilingTiles[i];

      // If tile falls too far behind player, shift it forward to the front
      if (floorTile.position.x < playerX - halfSpan) {
        floorTile.position.x += tileCount * tileWidth;
      } else if (floorTile.position.x > playerX + halfSpan) {
        floorTile.position.x -= tileCount * tileWidth;
      }

      ceilTile.position.x = floorTile.position.x;
    }

    // 2. Parallax Scrolling for Background Factory Scaffolding
    for (const mod of this.bgElements) {
      if (mod.position.x < playerX - 45) {
        mod.position.x += 6 * 26;
      }
    }
  }
}
