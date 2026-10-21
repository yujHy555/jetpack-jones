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

  // Handheld Camera Mode
  public handheldEnabled: boolean = true;
  public handheldIntensity: number = 0.7; // 0.0 (static) to 1.0 (full organic handheld sway)
  private handheldTime: number = 0;

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

    // Lightweight ultra-soft simple shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Environment Lighting
    this.ambientLight = new THREE.AmbientLight(0x353240, 2.4);
    this.scene.add(this.ambientLight);

    // High-angle key directional light for simple, short, soft shadows
    this.keyLight = new THREE.DirectionalLight(0xffeedd, 3.0);
    this.keyLight.position.set(0.5, 22, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 1.0;
    this.keyLight.shadow.camera.far = 35;
    this.keyLight.shadow.camera.left = -14;
    this.keyLight.shadow.camera.right = 14;
    this.keyLight.shadow.camera.top = 14;
    this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.bias = -0.001;
    this.keyLight.shadow.radius = 4.5; // Soft diffused shadow edges
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

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

  public toggleHandheld(): boolean {
    this.handheldEnabled = !this.handheldEnabled;
    return this.handheldEnabled;
  }

  public triggerShake(intensity: number = 0.2, duration: number = 0.18) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = duration;
  }

  /**
   * Unrestricted 360° Camera Tracking
   * Tracks Jones everywhere: on the ground and high in the air!
   * Includes subtle organic handheld camera breathing and sway effect.
   */
  public updateCamera(targetX: number, targetY: number, dt: number) {
    // Camera leads slightly ahead and tracks full height in the air
    const targetCamX = targetX + 1.8;
    const targetCamY = Math.max(-1.5, targetY + 1.2); // Never cuts off top in air!

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 6.5);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 6.5);

    // Subtle Organic Handheld Camera Breathing & Sway (scaled by user slider)
    if (this.handheldEnabled && this.handheldIntensity > 0) {
      this.handheldTime += dt;
      const mult = this.handheldIntensity;
      const hx = (Math.sin(this.handheldTime * 1.1) * 0.05 + Math.sin(this.handheldTime * 2.3 + 1.2) * 0.025) * mult;
      const hy = (Math.cos(this.handheldTime * 0.9) * 0.06 + Math.sin(this.handheldTime * 1.7 + 0.8) * 0.025) * mult;
      const rotZ = Math.sin(this.handheldTime * 0.75) * 0.0055 * mult;
      const rotX = Math.cos(this.handheldTime * 0.85) * 0.0045 * mult;

      this.camera.position.x += hx;
      this.camera.position.y += hy;
      this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, rotZ, dt * 5.0);
      this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, rotX, dt * 5.0);
    } else {
      this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, 0, dt * 5.0);
      this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, 0, dt * 5.0);
    }

    // Apply Screen Shake if active
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      const shakeAmt = this.shakeIntensity * (this.shakeDuration / 0.18);
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      if (this.shakeDuration <= 0) this.shakeIntensity = 0;
    }

    // Keep key light directly overhead for simple, short, soft shadows
    this.keyLight.position.x = this.camera.position.x + 0.5;
    this.keyLight.position.y = this.camera.position.y + 18;
    this.keyLight.position.z = 6;
    this.keyLight.target.position.set(this.camera.position.x, this.camera.position.y - 2, 0);
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }
}
