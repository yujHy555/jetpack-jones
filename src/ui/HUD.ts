/**
 * Retro Arcade HUD & UI Manager
 * Handles segmented LED health & fuel meters, score tickers, and screen overlays
 */
export class HUD {
  private scoreEl: HTMLElement | null;
  private lifeBarEl: HTMLElement | null;
  private fuelBarEl: HTMLElement | null;
  private overlayScreen: HTMLElement | null;
  private overlayTitle: HTMLElement | null;
  private overlaySubtitle: HTMLElement | null;
  private btnStart: HTMLElement | null;

  private lifeSegments: HTMLElement[] = [];
  private fuelSegments: HTMLElement[] = [];
  private totalSegments = 10;

  constructor() {
    this.scoreEl = document.getElementById('hud-score');
    this.lifeBarEl = document.getElementById('life-bar');
    this.fuelBarEl = document.getElementById('fuel-bar');
    this.overlayScreen = document.getElementById('overlay-screen');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlaySubtitle = document.getElementById('overlay-subtitle');
    this.btnStart = document.getElementById('btn-start');

    this.initGauges();
  }

  private initGauges() {
    if (this.lifeBarEl) {
      this.lifeBarEl.innerHTML = '';
      for (let i = 0; i < this.totalSegments; i++) {
        const seg = document.createElement('div');
        seg.className = 'gauge-segment segment-life active';
        this.lifeBarEl.appendChild(seg);
        this.lifeSegments.push(seg);
      }
    }

    if (this.fuelBarEl) {
      this.fuelBarEl.innerHTML = '';
      for (let i = 0; i < this.totalSegments; i++) {
        const seg = document.createElement('div');
        seg.className = 'gauge-segment segment-fuel active full';
        this.fuelBarEl.appendChild(seg);
        this.fuelSegments.push(seg);
      }
    }
  }

  public update(score: number, life: number, fuel: number) {
    // 1. Score display (6 digits)
    if (this.scoreEl) {
      this.scoreEl.textContent = Math.floor(score).toString().padStart(6, '0');
    }

    // 2. Life Bar segments
    const activeLifeSegments = Math.round((life / 100) * this.totalSegments);
    for (let i = 0; i < this.totalSegments; i++) {
      const seg = this.lifeSegments[i];
      if (i < activeLifeSegments) {
        seg.className = 'gauge-segment segment-life active';
        if (activeLifeSegments <= 2) {
          seg.classList.add('low');
        }
      } else {
        seg.className = 'gauge-segment segment-life';
      }
    }

    // 3. Fuel Bar segments
    const activeFuelSegments = Math.round((fuel / 100) * this.totalSegments);
    for (let i = 0; i < this.totalSegments; i++) {
      const seg = this.fuelSegments[i];
      if (i < activeFuelSegments) {
        seg.className = 'gauge-segment segment-fuel active';
        if (activeFuelSegments > 6) {
          seg.classList.add('full'); // Green
        } else if (activeFuelSegments > 2) {
          seg.classList.add('mid'); // Yellow
        } else {
          seg.classList.add('low'); // Orange/Red warning flash
        }
      } else {
        seg.className = 'gauge-segment segment-fuel';
      }
    }
  }

  public showGameOver(finalScore: number, onRestart: () => void) {
    if (this.overlayScreen && this.overlayTitle && this.overlaySubtitle && this.btnStart) {
      this.overlayTitle.textContent = 'MISSION FAILED';
      this.overlayTitle.style.color = '#ff3311';
      this.overlaySubtitle.innerHTML = `
        Jones' suit compromised in the industrial works!<br><br>
        <span style="font-size: 20px; color: #ffaa00; font-family: 'Press Start 2P', monospace;">
          FINAL SCORE: ${Math.floor(finalScore).toString().padStart(6, '0')}
        </span>
      `;
      this.btnStart.textContent = 'RETRY MISSION';
      this.overlayScreen.classList.remove('hidden');

      const clickHandler = () => {
        this.btnStart?.removeEventListener('click', clickHandler);
        this.hideOverlay();
        onRestart();
      };
      this.btnStart.addEventListener('click', clickHandler);
    }
  }

  public showStartScreen(onStart: () => void) {
    if (this.overlayScreen && this.btnStart) {
      this.overlayScreen.classList.remove('hidden');
      const clickHandler = () => {
        this.btnStart?.removeEventListener('click', clickHandler);
        this.hideOverlay();
        onStart();
      };
      this.btnStart.addEventListener('click', clickHandler);
    }
  }

  public hideOverlay() {
    if (this.overlayScreen) {
      this.overlayScreen.classList.add('hidden');
    }
  }
}
