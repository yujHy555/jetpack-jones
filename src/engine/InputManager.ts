/**
 * Enhanced Cross-platform Input Manager for 2D Platformer
 * Handles Walk, Run, Jump, Jetpack Flight, and Blaster.
 */
export class InputManager {
  public moveX: number = 0; // -1 = Left, 0 = Neutral, +1 = Right
  public run: boolean = false;
  public jumpJustPressed: boolean = false;
  public jetpack: boolean = false;
  public shootJustPressed: boolean = false;

  private keys: Record<string, boolean> = {};

  // Touch states
  private touchLeft: boolean = false;
  private touchRight: boolean = false;
  private touchRun: boolean = false;
  private touchJetpack: boolean = false;

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
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
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const canvas = document.getElementById('canvas3d');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this.shootJustPressed = true;
        }
      });
    }
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
    bindBtn('btn-run', () => { this.touchRun = !this.touchRun; }, () => {}); // Toggle run on mobile
    bindBtn('btn-jump', () => { this.jumpJustPressed = true; }, () => {});
    bindBtn('btn-jetpack', () => { this.touchJetpack = true; }, () => { this.touchJetpack = false; });
    bindBtn('btn-laser', () => { this.shootJustPressed = true; }, () => {});
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
        if (pad.buttons[0]?.pressed) this.jumpJustPressed = true; // A = jump
        if (pad.buttons[7]?.pressed || pad.buttons[5]?.pressed) this.jetpack = true; // R2/RB = jetpack
        if (pad.buttons[2]?.pressed) this.shootJustPressed = true; // X = shoot
        if (pad.buttons[10]?.pressed || pad.buttons[4]?.pressed) this.run = true; // L3/LB = run
      }
    }

    this.moveX = mx;

    // 2. Sprint / Run
    const kbRun = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    this.run = kbRun || this.touchRun;

    // 3. Jetpack Thrust
    // Holding Space, or holding Up/W, or holding the mobile Jetpack button
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
}
