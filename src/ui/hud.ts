// DOMオーバーレイ(コックピットHUD・字幕・画面遷移)の制御

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element: #${id}`);
  return e as T;
}

export interface HudCallbacks {
  onStart(): void;
  onFree(): void;
  onReplay(): void;
  onReturnMenu(): void;
  onComfortChange(enabled: boolean): void;
  onApproach(index: number): void;
  bodyNames: string[];
}

export interface FreeHud {
  speedText: string;
  speedUnit: string;
  targetName: string;
  targetDist: string;
  boosting: boolean;
  approaching: string | null;
  prompt: string | null;
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
  private hazeEl = el<HTMLDivElement>('haze');
  private entryGlowEl = el<HTMLDivElement>('entry-glow');
  private pauseBadge = el<HTMLDivElement>('pause-badge');
  private startScreen = el<HTMLDivElement>('start-screen');
  private endScreen = el<HTMLDivElement>('end-screen');
  private hint = el<HTMLDivElement>('hint');
  private routeNodes = [el<HTMLSpanElement>('route-earth'), el<HTMLSpanElement>('route-moon'), el<HTMLSpanElement>('route-mars')];

  // フリーフライトHUD
  private freeTargetName = el<HTMLDivElement>('free-target-name');
  private freeTargetDist = el<HTMLDivElement>('free-target-dist');
  private freePrompt = el<HTMLDivElement>('free-prompt');
  private markerLayer = el<HTMLDivElement>('marker-layer');
  private markers: HTMLButtonElement[] = [];

  private lastSubtitle = '';
  private frames = 0;
  private fpsTimer = 0;
  currentFps = 0;

  constructor(cb: HudCallbacks) {
    el<HTMLButtonElement>('start-btn').addEventListener('click', () => cb.onStart());
    el<HTMLButtonElement>('free-btn').addEventListener('click', () => cb.onFree());
    el<HTMLButtonElement>('replay-btn').addEventListener('click', () => cb.onReplay());
    el<HTMLButtonElement>('menu-btn').addEventListener('click', () => cb.onReturnMenu());
    el<HTMLButtonElement>('free-exit').addEventListener('click', () => cb.onReturnMenu());
    el<HTMLDivElement>('reticle'); // 存在確認(表示は body.free-mode のCSSで制御)
    el<HTMLDivElement>('free-info');
    const comfort = el<HTMLInputElement>('comfort-check');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      comfort.checked = true;
      cb.onComfortChange(true);
    }
    comfort.addEventListener('change', () => cb.onComfortChange(comfort.checked));
    // 操作ヒントはしばらくしたら控えめに
    window.setTimeout(() => this.hint.classList.add('dim'), 14000);

    // 惑星マーカー(クリックで自動接近: FR-21)を名前の数だけ生成
    cb.bodyNames.forEach((name, i) => {
      const m = document.createElement('button');
      m.className = 'marker';
      m.innerHTML = `<span class="marker-dot"></span><span class="marker-label">${name}</span><span class="marker-dist"></span>`;
      m.style.display = 'none';
      m.addEventListener('click', (e) => { e.stopPropagation(); cb.onApproach(i); });
      this.markerLayer.appendChild(m);
      this.markers.push(m);
    });
  }

  // ---- フリーフライト ----
  // 表示は body.free-mode のCSSで切り替える(個別トグルより堅牢)
  setFreeMode(on: boolean): void {
    document.body.classList.toggle('free-mode', on);
    if (!on) {
      this.hideMarkers();
      this.freePrompt.classList.add('hidden');
    }
  }

  setFreeHud(f: FreeHud | null): void {
    if (!f) {
      this.freePrompt.classList.add('hidden');
      return;
    }
    this.speed.textContent = f.speedText;
    this.speedUnit.textContent = f.speedUnit;
    this.speed.classList.toggle('warp', f.boosting);
    this.freeTargetName.textContent = f.approaching ? `▶ ${f.approaching} へ接近中` : f.targetName;
    this.freeTargetName.classList.toggle('approaching', !!f.approaching);
    this.freeTargetDist.textContent = f.targetDist;
    if (f.prompt) {
      this.freePrompt.textContent = f.prompt;
      this.freePrompt.classList.remove('hidden');
    } else {
      this.freePrompt.classList.add('hidden');
    }
  }

  setStatusText(txt: string): void {
    this.status.textContent = txt;
    this.status.dataset.mode = txt === 'BOOST' || txt === 'AUTO' ? 'warp' : 'cruise';
    this.warpFill.style.width = txt === 'BOOST' ? '100%' : txt === 'AUTO' ? '60%' : '0%';
  }

  setMarker(i: number, visible: boolean, x: number, y: number, name: string, dist: string, selected: boolean): void {
    const m = this.markers[i];
    if (!m) return;
    if (!visible) { m.style.display = 'none'; return; }
    m.style.display = 'flex';
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    m.classList.toggle('selected', selected);
    (m.querySelector('.marker-label') as HTMLElement).textContent = name;
    (m.querySelector('.marker-dist') as HTMLElement).textContent = dist;
  }

  hideMarkers(): void {
    for (const m of this.markers) m.style.display = 'none';
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

  setHaze(opacity: number): void {
    this.hazeEl.style.opacity = String(opacity);
  }

  setEntryGlow(opacity: number): void {
    this.entryGlowEl.style.opacity = String(opacity);
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
