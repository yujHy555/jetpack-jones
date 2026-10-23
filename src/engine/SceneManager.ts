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
  public baseZ: number = 17.5; // Pulled back for spacious panoramic view of the levels and flight areas
  public currentLevel: number = 1;
  public isIsometric: boolean = false;

  constructor() {
    this.canvas = document.getElementById('canvas3d') as HTMLCanvasElement;
    this.scene = new THREE.Scene();

    // Scene background and atmospheric haze: Darker dusky twilight palette so bright cyan bullets pop with razor-sharp contrast
    this.scene.background = new THREE.Color(0xff99cc); // Lighter, brighter radiant retro pink
    this.scene.fog = new THREE.FogExp2(0x28192b, 0.012);

    // Camera setup - locked horizontal perspective for 2.5D platformer
    // Pulled back (Z = 17.5) for spacious panoramic view of the levels and flight areas
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 140);
    this.camera.position.set(0, 0, this.baseZ);

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

    // Cel-Shading & Flat Vibrant Lighting: disabled heavy 3D shadow maps in favor of clean round toon shadows
    this.renderer.shadowMap.enabled = false;

    // Bright Flat Cel-Shading Environment Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 3.4);
    this.scene.add(this.ambientLight);

    // Gentle front-top fill wash for vivid cartoon colors without harsh dark shading
    this.keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    this.keyLight.position.set(0.5, 20, 10);
    this.keyLight.castShadow = false;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    // Crisp cartoon cyan rim accent
    this.rimLight = new THREE.DirectionalLight(0x88eeff, 1.0);
    this.rimLight.position.set(-6, -2, -2);
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

  public setLevel(lvl: number) {
    this.currentLevel = lvl;
    if (lvl === 3) {
      this.isIsometric = true;
      // Mars Twilight Atmosphere
      this.scene.background = new THREE.Color(0x943825);
      this.scene.fog = new THREE.FogExp2(0x822d1c, 0.009);
      this.ambientLight.color.setHex(0x6a382c);
      this.ambientLight.intensity = 2.8;
      this.keyLight.color.setHex(0xffaa85);
      this.keyLight.intensity = 2.8;
      this.rimLight.color.setHex(0x44ccff);
      this.rimLight.intensity = 1.4;
    } else {
      this.isIsometric = false;
      this.camera.rotation.set(0, 0, 0);
      if (lvl === 2) {
        this.scene.background = new THREE.Color(0x1a0d24);
        this.scene.fog = new THREE.FogExp2(0x1a0d24, 0.012);
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 3.2;
        this.keyLight.color.setHex(0xfff8ee);
        this.keyLight.intensity = 1.4;
      } else {
        this.scene.background = new THREE.Color(0xff99cc);
        this.scene.fog = new THREE.FogExp2(0x28192b, 0.012);
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 3.4;
        this.keyLight.color.setHex(0xfff8ee);
        this.keyLight.intensity = 1.4;
      }
    }
  }

  /**
   * Unrestricted Camera Tracking
   * - Level 1 & 2: 2.5D panoramic side-scrolling perspective (Z = 17.5)
   * - Level 3: Triple AAA True Isometric Perspective with smooth damped lookAt & 3D drone breathing
   */
  public updateCamera(targetX: number, targetY: number, dt: number, targetZ: number = 0) {
    if (this.isIsometric) {
      // ========================================================
      // TRIPLE AAA ISOMETRIC CAMERA SYSTEM
      // Classic 45° azimuth / 38° elevation diamond isometric view
      // Positioned to look across the canyon, tower, and circular hab ring
      // ========================================================
      const isoDistX = -18.0;
      const isoDistY = 22.0;
      const isoDistZ = 18.0;

      const targetCamX = targetX + isoDistX;
      const targetCamY = targetY + isoDistY;
      const targetCamZ = targetZ + isoDistZ;

      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 5.5);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 5.5);
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, dt * 5.5);

      const lookTarget = new THREE.Vector3(targetX, targetY + 1.2, targetZ);
      this.camera.lookAt(lookTarget);

      // Organic Handheld Isometric Drone Cam Sway
      if (this.handheldEnabled && this.handheldIntensity > 0) {
        this.handheldTime += dt;
        const mult = this.handheldIntensity;
        const hx = Math.sin(this.handheldTime * 1.1) * 0.08 * mult;
        const hy = Math.cos(this.handheldTime * 0.9) * 0.08 * mult;
        const hz = Math.sin(this.handheldTime * 1.4) * 0.08 * mult;
        this.camera.position.x += hx;
        this.camera.position.y += hy;
        this.camera.position.z += hz;
      }

      // 3D Screen Shake in Isometric Space
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
        const shakeAmt = this.shakeIntensity * (this.shakeDuration / 0.18);
        this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
        this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
        this.camera.position.z += (Math.random() - 0.5) * shakeAmt;
        if (this.shakeDuration <= 0) this.shakeIntensity = 0;
      }

      // High-angle directional Mars twilight sun tracking the player
      this.keyLight.position.set(this.camera.position.x + 8, this.camera.position.y + 26, this.camera.position.z + 10);
      this.keyLight.target.position.set(targetX, targetY, targetZ);
      return;
    }

    // 2.5D Side-scrolling Camera Tracking (Levels 1 & 2)
    const targetCamX = targetX + 1.8;
    const targetCamY = Math.max(-1.5, targetY + 1.2); // Never cuts off top in air!

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 6.5);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 6.5);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.baseZ, dt * 6.5);

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
