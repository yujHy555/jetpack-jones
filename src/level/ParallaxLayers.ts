import * as THREE from 'three';

/**
 * Industrial Steampunk/Dieselpunk Parallax Environment
 * Includes background factory scaffolding, molten conduit pipes, and floor/ceiling boundaries.
 */
export class ParallaxLayers {
  public group: THREE.Group;
  private bgElements: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.createIndustrialBackdrop();
    this.createFloorAndCeiling();
  }

  private createIndustrialBackdrop() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x222429,
      roughness: 0.6,
      metalness: 0.5,
    });

    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x3e4249,
      roughness: 0.35,
      metalness: 0.8,
    });

    // Construct repeating background factory modules
    for (let i = 0; i < 5; i++) {
      const module = new THREE.Group();
      module.position.set(i * 24 - 10, 0, -8); // Placed in deep background

      // Heavy vertical I-beams
      for (let b = -10; b <= 10; b += 6) {
        const beamGeo = new THREE.BoxGeometry(0.8, 18, 0.8);
        const beam = new THREE.Mesh(beamGeo, metalMat);
        beam.position.x = b;
        module.add(beam);
      }

      // Horizontal cross girders
      for (let y = -4; y <= 4; y += 4) {
        const girderGeo = new THREE.BoxGeometry(24, 0.7, 0.6);
        const girder = new THREE.Mesh(girderGeo, metalMat);
        girder.position.y = y;
        module.add(girder);
      }

      // Large background pipes
      const pipeGeo = new THREE.CylinderGeometry(0.6, 0.6, 24, 16);
      pipeGeo.rotateZ(Math.PI / 2);
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.position.set(0, 2.5, 1);
      module.add(pipe);

      // Distant amber indicator lights
      for (let lx = -8; lx <= 8; lx += 8) {
        const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(lx, 3.2, 1.4);
        module.add(bulb);
      }

      this.group.add(module);
      this.bgElements.push(module);
    }
  }

  private createFloorAndCeiling() {
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2126,
      roughness: 0.5,
      metalness: 0.7,
    });

    // Floor platform running along X
    const floorGeo = new THREE.BoxGeometry(100, 2, 8);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -5.5, 0);
    this.group.add(floor);

    // Ceiling girder structure
    const ceilingGeo = new THREE.BoxGeometry(100, 2, 8);
    const ceiling = new THREE.Mesh(ceilingGeo, floorMat);
    ceiling.position.set(0, 5.5, 0);
    this.group.add(ceiling);
  }

  public update(playerX: number, time: number) {
    // Parallax scrolling for background factory scaffolding
    for (const mod of this.bgElements) {
      if (mod.position.x < playerX - 35) {
        mod.position.x += 5 * 24;
      }
    }
  }
}
