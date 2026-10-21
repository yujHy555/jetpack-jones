/**
 * Cross-platform Input Manager (Keyboard, Mouse, Touch, Gamepad)
 */
export class InputManager {
  public thrust: boolean = false;
  public dive: boolean = false;
  public shoot: boolean = false;
  public shootJustPressed: boolean = false;

  private keys: Record<string, boolean> = {};

  constructor() {
    this.setupKeyboard();
    this.setupTouch();
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Prevent scrolling when using Space / Arrow keys in browser
      if (['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        e.preventDefault();
      }

      this.keys[e.code] = true;

      if ((e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Enter') && !e.repeat) {
        this.shootJustPressed = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse click on canvas for shooting
    const canvas = document.getElementById('canvas3d');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          // Left click: if clicked on upper half or right half
          this.shootJustPressed = true;
        }
      });
    }
  }

  private setupTouch() {
    const btnThrust = document.getElementById('btn-thrust');
    const btnLaser = document.getElementById('btn-laser');

    if (btnThrust) {
      const startThrust = (e: Event) => {
        e.preventDefault();
        this.thrust = true;
        btnThrust.classList.add('active');
      };
      const stopThrust = (e: Event) => {
        e.preventDefault();
        this.thrust = false;
        btnThrust.classList.remove('active');
      };

      btnThrust.addEventListener('touchstart', startThrust, { passive: false });
      btnThrust.addEventListener('touchend', stopThrust, { passive: false });
      btnThrust.addEventListener('touchcancel', stopThrust, { passive: false });
      btnThrust.addEventListener('mousedown', startThrust);
      btnThrust.addEventListener('mouseup', stopThrust);
      btnThrust.addEventListener('mouseleave', stopThrust);
    }

    if (btnLaser) {
      const startLaser = (e: Event) => {
        e.preventDefault();
        this.shoot = true;
        this.shootJustPressed = true;
        btnLaser.classList.add('active');
      };
      const stopLaser = (e: Event) => {
        e.preventDefault();
        this.shoot = false;
        btnLaser.classList.remove('active');
      };

      btnLaser.addEventListener('touchstart', startLaser, { passive: false });
      btnLaser.addEventListener('touchend', stopLaser, { passive: false });
      btnLaser.addEventListener('touchcancel', stopLaser, { passive: false });
      btnLaser.addEventListener('mousedown', startLaser);
      btnLaser.addEventListener('mouseup', stopLaser);
      btnLaser.addEventListener('mouseleave', stopLaser);
    }
  }

  public update() {
    // Check Keyboard states
    const kbThrust = !!(this.keys['Space'] || this.keys['KeyW'] || this.keys['ArrowUp']);
    const kbDive = !!(this.keys['KeyS'] || this.keys['ArrowDown']);
    const kbShoot = !!(this.keys['KeyJ'] || this.keys['KeyZ'] || this.keys['Enter']);

    // Check Gamepad
    let padThrust = false;
    let padDive = false;
    let padShoot = false;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of gamepads) {
      if (pad) {
        // Button A (0) or Trigger (7) for thrust
        if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) padThrust = true;
        // Button X (2) or B (1) for laser
        if (pad.buttons[2]?.pressed || pad.buttons[1]?.pressed) {
          if (!this.shoot) this.shootJustPressed = true;
          padShoot = true;
        }
        // Dpad down or Left stick down
        if (pad.buttons[13]?.pressed || (pad.axes[1] && pad.axes[1] > 0.5)) padDive = true;
      }
    }

    // Merge with touch button states
    const btnThrustActive = document.getElementById('btn-thrust')?.classList.contains('active') ?? false;
    const btnLaserActive = document.getElementById('btn-laser')?.classList.contains('active') ?? false;

    this.thrust = kbThrust || padThrust || btnThrustActive;
    this.dive = kbDive || padDive;
    this.shoot = kbShoot || padShoot || btnLaserActive;
  }

  public consumeShootTrigger(): boolean {
    if (this.shootJustPressed) {
      this.shootJustPressed = false;
      return true;
    }
    return false;
  }
}
