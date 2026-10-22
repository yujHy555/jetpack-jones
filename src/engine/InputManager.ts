import * as THREE from 'three';

/**
 * Cross-platform Input Manager with 360° Mouse Aiming & Reticle Support
 */
export class InputManager {
  public moveX: number = 0; // -1 = Left, 0 = Neutral, +1 = Right
  public run: boolean = false;
  public jumpJustPressed: boolean = false;
  public jetpack: boolean = false;
  public shootJustPressed: boolean = false;
  public ragdollJustPressed: boolean = false;
  public handheldToggleJustPressed: boolean = false;

  // Mouse & 360° Aiming
  public mouseScreenX: number = window.innerWidth / 2;
  public mouseScreenY: number = window.innerHeight / 2;
  public mouseWorldTarget: THREE.Vector3 = new THREE.Vector3(10, 0, 0);
  public hasMouse: boolean = false;
  private reticleEl: HTMLElement | null = null;

  private keys: Record<string, boolean> = {};

  // Touch states
  private touchLeft: boolean = false;
  private touchRight: boolean = false;
  private touchRun: boolean = false;
  private touchJetpack: boolean = false;

  constructor() {
    this.reticleEl = document.getElementById('reticle');
    this.setupKeyboard();
    this.setupTouch();
    this.setupMouse();
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        e.preventDefault();
      }

      const wasPressed = !!this.keys[e.code];
      this.keys[e.code] = true;

      if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !wasPressed) {
        this.jumpJustPressed = true;
      }

      if ((e.code === 'Space') && !wasPressed) {
        this.jumpJustPressed = true;
      }

      if ((e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Enter') && !wasPressed) {
        this.shootJustPressed = true;
        this.triggerReticlePulse();
      }

      if ((e.code === 'KeyR') && !wasPressed) {
        this.ragdollJustPressed = true;
      }

      if ((e.code === 'KeyH') && !wasPressed) {
        this.handheldToggleJustPressed = true;
      }

      if ((e.code === 'KeyF') && !wasPressed) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private setupMouse() {
    window.addEventListener('mousemove', (e) => {
      this.hasMouse = true;
      this.mouseScreenX = e.clientX;
      this.mouseScreenY = e.clientY;

      if (this.reticleEl) {
        this.reticleEl.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        this.reticleEl.classList.add('active');
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.shootJustPressed = true;
        this.triggerReticlePulse();
      }
    });

    window.addEventListener('mouseleave', () => {
      if (this.reticleEl) {
        this.reticleEl.classList.remove('active');
      }
    });
  }

  private setupTouch() {
    const bindBtn = (id: string, onStart: () => void, onEnd: () => void) => {
      const el = document.getElementById(id);
      if (!el) return;

      const start = (e: Event) => {
        e.preventDefault();
        el.classList.add('active');
        onStart();
      };
      const end = (e: Event) => {
        e.preventDefault();
        el.classList.remove('active');
        onEnd();
      };

      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    };

    bindBtn('btn-left', () => { this.touchLeft = true; }, () => { this.touchLeft = false; });
    bindBtn('btn-right', () => { this.touchRight = true; }, () => { this.touchRight = false; });
    bindBtn('btn-run', () => { this.touchRun = !this.touchRun; }, () => {});
    bindBtn('btn-jump', () => { this.jumpJustPressed = true; }, () => {});
    bindBtn('btn-jetpack', () => { this.touchJetpack = true; }, () => { this.touchJetpack = false; });
    bindBtn('btn-laser', () => {
      this.shootJustPressed = true;
      this.triggerReticlePulse();
    }, () => {});
  }

  public triggerReticlePulse() {
    if (this.reticleEl) {
      this.reticleEl.classList.remove('reticle-shoot');
      void this.reticleEl.offsetWidth; // Trigger reflow
      this.reticleEl.classList.add('reticle-shoot');
    }
  }

  /**
   * Projects mouse screen coordinate onto game world plane (Z = 0)
   */
  public updateAimWorldTarget(camera: THREE.PerspectiveCamera) {
    if (!this.hasMouse) return;

    // Normalized Device Coordinates (-1 to +1)
    const ndcX = (this.mouseScreenX / window.innerWidth) * 2 - 1;
    const ndcY = -(this.mouseScreenY / window.innerHeight) * 2 + 1;

    // Unproject to find world ray
    const rayOrigin = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
    const rayTarget = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
    const rayDir = rayTarget.sub(rayOrigin).normalize();

    // Intersect with plane Z = 0
    if (Math.abs(rayDir.z) > 0.0001) {
      const distance = -rayOrigin.z / rayDir.z;
      this.mouseWorldTarget.copy(rayOrigin).addScaledVector(rayDir, distance);
    }
  }

  public update() {
    // 1. Horizontal Move Input
    let mx = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.touchLeft) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight'] || this.touchRight) mx += 1;

    // Gamepad axes
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of gamepads) {
      if (pad) {
        if (pad.axes[0] < -0.3 || pad.buttons[14]?.pressed) mx = -1;
        if (pad.axes[0] > 0.3 || pad.buttons[15]?.pressed) mx = 1;
        if (pad.buttons[0]?.pressed) this.jumpJustPressed = true;
        if (pad.buttons[7]?.pressed || pad.buttons[5]?.pressed) this.jetpack = true;
        if (pad.buttons[2]?.pressed) this.shootJustPressed = true;
        if (pad.buttons[10]?.pressed || pad.buttons[4]?.pressed) this.run = true;

        // Right stick aim if available
        if (Math.abs(pad.axes[2]) > 0.3 || Math.abs(pad.axes[3]) > 0.3) {
          this.hasMouse = true;
        }
      }
    }

    this.moveX = mx;

    // 2. Sprint / Run
    const kbRun = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    this.run = kbRun || this.touchRun;

    // 3. Jetpack Thrust
    const kbJetpack = !!(this.keys['Space'] || (this.keys['KeyW'] && !this.jumpJustPressed) || (this.keys['ArrowUp'] && !this.jumpJustPressed));
    this.jetpack = kbJetpack || this.touchJetpack;
  }

  public consumeJumpTrigger(): boolean {
    if (this.jumpJustPressed) {
      this.jumpJustPressed = false;
      return true;
    }
    return false;
  }

  public consumeShootTrigger(): boolean {
    if (this.shootJustPressed) {
      this.shootJustPressed = false;
      return true;
    }
    return false;
  }

  public consumeRagdollTrigger(): boolean {
    if (this.ragdollJustPressed) {
      this.ragdollJustPressed = false;
      return true;
    }
    return false;
  }

  public consumeHandheldToggleTrigger(): boolean {
    if (this.handheldToggleJustPressed) {
      this.handheldToggleJustPressed = false;
      return true;
    }
    return false;
  }
}
