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

  // Camera Tracking & Screen Shake
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;

  constructor() {
    this.canvas = document.getElementById('canvas3d') as HTMLCanvasElement;
    this.scene = new THREE.Scene();

    // Scene background and atmospheric haze
    this.scene.background = new THREE.Color(0x141216);
    this.scene.fog = new THREE.FogExp2(0x141216, 0.024);

    // Camera setup - locked horizontal perspective for 2.5D platformer
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 100);
    this.camera.position.set(0, 0, 11);

    // WebGL Renderer configuration
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // Environment Lighting
    this.ambientLight = new THREE.AmbientLight(0x282630, 2.2);
    this.scene.add(this.ambientLight);

    // Warm key directional light (industrial factory lighting)
    this.keyLight = new THREE.DirectionalLight(0xffeedd, 3.4);
    this.keyLight.position.set(6, 12, 9);
    this.scene.add(this.keyLight);

    // Cyan-blue fill rim light
    this.rimLight = new THREE.DirectionalLight(0x00ccff, 2.2);
    this.rimLight.position.set(-8, -4, -4);
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

  public triggerShake(intensity: number = 0.2, duration: number = 0.18) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = duration;
  }

  /**
   * Unrestricted 360° Camera Tracking
   * Tracks Jones everywhere: on the ground and high in the air!
   */
  public updateCamera(targetX: number, targetY: number, dt: number) {
    // Camera leads slightly ahead and tracks full height in the air
    const targetCamX = targetX + 1.8;
    const targetCamY = Math.max(-1.5, targetY + 1.2); // Never cuts off top in air!

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 6.5);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 6.5);

    // Apply Screen Shake if active
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      const shakeAmt = this.shakeIntensity * (this.shakeDuration / 0.18);
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      if (this.shakeDuration <= 0) this.shakeIntensity = 0;
    }

    // Keep key light following the action
    this.keyLight.position.x = this.camera.position.x + 5;
    this.keyLight.position.y = this.camera.position.y + 8;
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }
}
