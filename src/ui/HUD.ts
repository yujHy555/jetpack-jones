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

  public showRadioWarningBanner(text: string = 'WARNING — INCOMING PLANET SEDIMENT', durationMs: number = 3800) {
    let banner = document.getElementById('radio-warning-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'radio-warning-banner';
      banner.style.position = 'fixed';
      banner.style.top = '68px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.padding = '10px 22px';
      banner.style.background = 'rgba(25, 12, 16, 0.94)';
      banner.style.border = '2px solid #ff4444';
      banner.style.borderRadius = '6px';
      banner.style.color = '#ffdd44';
      banner.style.fontFamily = "'Share Tech Mono', monospace";
      banner.style.fontSize = '15px';
      banner.style.fontWeight = 'bold';
      banner.style.letterSpacing = '1.5px';
      banner.style.boxShadow = '0 0 24px rgba(255, 68, 68, 0.8), inset 0 0 12px rgba(255, 68, 68, 0.4)';
      banner.style.zIndex = '999';
      banner.style.pointerEvents = 'none';
      banner.style.textAlign = 'center';
      banner.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      banner.style.textShadow = '0 0 8px #ff4444';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<span style="display:inline-block; margin-right:8px;">📻 [RADIO COMMS]</span> ${text}`;
    banner.style.display = 'block';
    banner.style.opacity = '1';
    banner.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
      if (banner) {
        banner.style.opacity = '0';
        banner.style.transform = 'translateX(-50%) translateY(-15px)';
        setTimeout(() => {
          if (banner) banner.style.display = 'none';
        }, 400);
      }
    }, durationMs);
  }
}
