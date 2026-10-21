import * as THREE from 'three';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  // Cinematic lighting
  public keyLight: THREE.DirectionalLight;
  public rimLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;

  constructor() {
    this.canvas = document.getElementById('canvas3d') as HTMLCanvasElement;
    this.scene = new THREE.Scene();

    // Scene background and atmospheric haze
    this.scene.background = new THREE.Color(0x141216);
    this.scene.fog = new THREE.FogExp2(0x141216, 0.028);

    // Camera setup - locked horizontal perspective for 2.5D platformer
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100);
    this.camera.position.set(0, 0, 11);

    // WebGL Renderer configuration
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0)); // Prevent GPU lag on ultra high-DPI
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // Environment Lighting
    this.ambientLight = new THREE.AmbientLight(0x28242a, 1.8);
    this.scene.add(this.ambientLight);

    // Warm key directional light (steampunk factory lighting)
    this.keyLight = new THREE.DirectionalLight(0xffeedd, 3.2);
    this.keyLight.position.set(5, 10, 8);
    this.scene.add(this.keyLight);

    // Cool cyan-blue rim light on the back edges
    this.rimLight = new THREE.DirectionalLight(0x4488bb, 1.8);
    this.rimLight.position.set(-6, -4, -4);
    this.scene.add(this.rimLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Smooth 2.5D camera tracking with dynamic deadzone
   */
  public updateCamera(targetX: number, targetY: number, dt: number) {
    // Camera leads slightly ahead and frames the platformer view
    const targetCamX = targetX + 1.8;
    const targetCamY = targetY + 1.2;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 6.5);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, THREE.MathUtils.clamp(targetCamY, -1.2, 5.0), dt * 5.5);

    // Keep key light following the action
    this.keyLight.position.x = this.camera.position.x + 5;
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }
}
