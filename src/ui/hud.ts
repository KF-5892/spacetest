// DOMオーバーレイ(コックピットHUD・字幕・画面遷移)の制御

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element: #${id}`);
  return e as T;
}

export interface HudCallbacks {
  onStart(): void;
  onReplay(): void;
  onComfortChange(enabled: boolean): void;
}

export class Hud {
  private subtitle = el<HTMLDivElement>('subtitle');
  private phaseLabel = el<HTMLDivElement>('phase-label');
  private phaseConsole = el<HTMLDivElement>('phase-console');
  private speed = el<HTMLDivElement>('speed');
  private speedUnit = el<HTMLDivElement>('speed-unit');
  private progressFill = el<HTMLDivElement>('progress-fill');
  private warpFill = el<HTMLDivElement>('warp-fill');
  private status = el<HTMLDivElement>('status');
  private fps = el<HTMLDivElement>('fps');
  private flashEl = el<HTMLDivElement>('flash');
  private fadeEl = el<HTMLDivElement>('fade');
  private pauseBadge = el<HTMLDivElement>('pause-badge');
  private startScreen = el<HTMLDivElement>('start-screen');
  private endScreen = el<HTMLDivElement>('end-screen');
  private hint = el<HTMLDivElement>('hint');
  private routeNodes = [el<HTMLSpanElement>('route-earth'), el<HTMLSpanElement>('route-moon'), el<HTMLSpanElement>('route-mars')];

  private lastSubtitle = '';
  private frames = 0;
  private fpsTimer = 0;
  currentFps = 0;

  constructor(cb: HudCallbacks) {
    el<HTMLButtonElement>('start-btn').addEventListener('click', () => cb.onStart());
    el<HTMLButtonElement>('replay-btn').addEventListener('click', () => cb.onReplay());
    const comfort = el<HTMLInputElement>('comfort-check');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      comfort.checked = true;
      cb.onComfortChange(true);
    }
    comfort.addEventListener('change', () => cb.onComfortChange(comfort.checked));
    // 操作ヒントはしばらくしたら控えめに
    window.setTimeout(() => this.hint.classList.add('dim'), 14000);
  }

  setSubtitle(text: string | null): void {
    const t = text ?? '';
    if (t === this.lastSubtitle) return;
    this.lastSubtitle = t;
    if (!t) {
      this.subtitle.classList.add('hidden');
    } else {
      this.subtitle.innerHTML = `<span class="navi">NAVI</span>${t}`;
      this.subtitle.classList.remove('hidden');
    }
  }

  setPhase(label: string): void {
    if (this.phaseLabel.textContent !== label) {
      this.phaseLabel.textContent = label;
      this.phaseConsole.textContent = label;
    }
  }

  setProgress(f: number): void {
    this.progressFill.style.width = `${(f * 100).toFixed(2)}%`;
  }

  setRouteLeg(leg: 0 | 1 | 2): void {
    this.routeNodes.forEach((n, i) => n.classList.toggle('active', i === leg));
  }

  setSpeed(value: string, unit: string, warp: boolean): void {
    this.speed.textContent = value;
    this.speedUnit.textContent = unit;
    this.speed.classList.toggle('warp', warp);
  }

  setWarp(fill: number, status: string, mode: 'cruise' | 'charge' | 'warp'): void {
    this.warpFill.style.width = `${(fill * 100).toFixed(1)}%`;
    this.status.textContent = status;
    this.status.dataset.mode = mode;
  }

  flash(): void {
    this.flashEl.classList.remove('run');
    void this.flashEl.offsetWidth; // CSSアニメーション再生のためのリフロー
    this.flashEl.classList.add('run');
  }

  setFade(opacity: number): void {
    this.fadeEl.style.opacity = String(opacity);
  }

  setPaused(paused: boolean): void {
    this.pauseBadge.classList.toggle('hidden', !paused);
  }

  showStart(show: boolean): void {
    this.startScreen.classList.toggle('hidden', !show);
  }

  showEnd(show: boolean): void {
    this.endScreen.classList.toggle('hidden', !show);
  }

  setQualityLabel(q: string): void {
    this.fps.dataset.q = q;
  }

  tickFps(dt: number): void {
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
      this.fps.textContent = `${this.currentFps} FPS ┆ ${this.fps.dataset.q ?? ''}`;
    }
  }
}
