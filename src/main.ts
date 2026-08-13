import * as THREE from 'three';
import './style.css';
import { CameraRig, Rail } from './rail';
import { Hud } from './ui/hud';
import { WarpEffect } from './effects/warp';
import { createStarShell, DustField } from './world/stars';
import { createNebulas, createSunSprite } from './world/nebula';
import { createEarth, createMars, createMoon } from './world/planets';
import type { Planet, SharedUniforms } from './world/planets';
import { buildSurfaceRailPoints, canyonCenter, createMarsSurface } from './world/terrain';
import type { MarsSurface } from './world/terrain';
import {
  EARTH_RADIUS, MARS_RADIUS, MOON_POS, MOON_RADIUS,
  RAIL_A, RAIL_B1, RAIL_B2, RAIL_C_KEYFRAMES,
  SUBTITLES, TOUR_LENGTH, WORLD_SWAP_T, phaseAt, segmentAt,
} from './tour';
import type { RailKey } from './tour';

// 太陽は+Z寄り: レールが通る昼側を照らす(シーンの見せ場が明るくなる向き)
const LIGHT_DIR = new THREE.Vector3(0.25, 0.22, 0.94).normalize();
const FLASH_T = 63.55; // ワープ出口の閃光時刻
// 上昇中に見下ろす「登ってきた峡谷」の注視点
const CANYON_LOOKBACK = new THREE.Vector3(1000, -40, canyonCenter(1000));

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function ramp(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

// 大気圏突入/離脱のヘイズ(画面を覆う砂塵。ピークで世界を差し替える: FR-47)
function hazeEnvelope(t: number): number {
  const descent = Math.min(ramp(t, 84.5, 87.8), 1 - ramp(t, 88.6, 91));
  const ascent = Math.min(ramp(t, 123, 125.7), 1 - ramp(t, 126.4, 128.5));
  return Math.max(descent, ascent);
}

// 突入時の摩擦光(画面端のオレンジのグロー)
function entryGlowEnvelope(t: number): number {
  return Math.min(ramp(t, 82, 86.5), 1 - ramp(t, 88, 89.5));
}

class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly hud: Hud;
  private readonly shared: SharedUniforms = {
    uTime: { value: 0 },
    uLightDir: { value: LIGHT_DIR },
  };

  private readonly rails: Record<RailKey, Rail>;
  private readonly worldA = new THREE.Group();
  private readonly worldB = new THREE.Group();
  private readonly worldC = new THREE.Group();
  private surface!: MarsSurface;
  private readonly skybox = new THREE.Group();
  private readonly planets: Planet[] = [];
  private readonly dust = new DustField();
  private readonly warp = new WarpEffect();

  private tourTime = 0;
  private prevTourTime = 0;
  private started = false;
  private paused = false;
  private ended = false;
  private comfort = false;
  private quality: 'high' | 'low' = 'high';

  private speedSm = 0;
  private prevRailPos: THREE.Vector3 | null = null;

  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpAhead = new THREE.Vector3();
  private readonly tmpTarget = new THREE.Vector3();
  private readonly tmpBias = new THREE.Vector3();
  private readonly clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x020208);
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.rails = {
      A: new Rail(RAIL_A),
      B1: new Rail(RAIL_B1),
      C: new Rail({ points: buildSurfaceRailPoints(), keyframes: RAIL_C_KEYFRAMES }),
      B2: new Rail(RAIL_B2),
    };

    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.scene.add(this.rig.camera);
    this.rig.camera.add(this.warp.group);

    // 遠景(カメラ追従: 星・星雲・太陽)
    this.skybox.add(createStarShell(), createNebulas(), createSunSprite(LIGHT_DIR));
    this.scene.add(this.skybox);
    this.scene.add(this.dust.points);

    // 世界A: 地球+月
    const earth = createEarth(EARTH_RADIUS, this.shared);
    const moon = createMoon(MOON_RADIUS, this.shared);
    moon.group.position.set(MOON_POS[0], MOON_POS[1], MOON_POS[2]);
    this.worldA.add(earth.group, moon.group);
    // 世界B: 火星(軌道)
    const mars = createMars(MARS_RADIUS, this.shared);
    this.worldB.add(mars.group);
    this.worldB.visible = false;
    // 世界C: 火星地表(ソアリン型の峡谷飛行: FR-47/48)
    this.surface = createMarsSurface();
    this.worldC.add(this.surface.group);
    this.worldC.visible = false;
    this.planets.push(earth, moon, mars);
    this.scene.add(this.worldA, this.worldB, this.worldC);

    this.hud = new Hud({
      onStart: () => this.begin(),
      onReplay: () => this.replay(),
      onComfortChange: (v) => { this.comfort = v; },
    });

    this.setQuality('high');
    this.bindInput(canvas);
    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    // デバッグ/検証用フック(スクリーンショット取得などに使用)
    (window as unknown as Record<string, unknown>).__cosmo = {
      start: () => this.begin(),
      seek: (t: number) => this.seek(t),
      time: () => this.tourTime,
      fps: () => this.hud.currentFps,
    };
  }

  run(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
    });
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.hud.showStart(false);
    this.seek(0);
  }

  private replay(): void {
    this.ended = false;
    this.paused = false;
    this.hud.showEnd(false);
    this.hud.setPaused(false);
    this.seek(0);
  }

  private seek(t: number): void {
    this.tourTime = Math.max(0, Math.min(t, TOUR_LENGTH));
    this.prevTourTime = this.tourTime;
    this.prevRailPos = null;
    this.rig.snapLook();
    if (this.tourTime < TOUR_LENGTH && this.ended) {
      this.ended = false;
      this.hud.showEnd(false);
    }
    this.hud.setFade(0);
  }

  private setQuality(q: 'high' | 'low'): void {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
    this.hud.setQualityLabel(q.toUpperCase());
  }

  private togglePause(): void {
    if (!this.started || this.ended) return;
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.rig.addLook(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('dblclick', () => this.rig.recenter());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (this.started && !this.ended) {
          e.preventDefault();
          this.togglePause();
        }
      } else if (e.code === 'KeyC') {
        this.rig.recenter();
      } else if (e.code === 'KeyQ') {
        this.setQuality(this.quality === 'high' ? 'low' : 'high');
      } else if (e.code === 'KeyR') {
        if (this.started) this.replay();
      }
    });
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.rig.camera.aspect = w / h;
    this.rig.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private update(dt: number): void {
    this.shared.uTime.value += dt;
    for (const p of this.planets) p.update(dt);

    if (this.started && !this.paused && !this.ended) {
      this.tourTime = Math.min(this.tourTime + dt, TOUR_LENGTH);
    }
    this.applyTour(dt);

    this.skybox.position.copy(this.rig.camera.position);
    if (this.worldC.visible) this.surface.skyDome.position.copy(this.rig.camera.position);
    this.dust.update(this.rig.camera.position);
    this.warp.update(dt);
    this.hud.tickFps(dt);
    this.renderer.render(this.scene, this.rig.camera);
  }

  private applyTour(dt: number): void {
    const t = this.tourTime;
    const phase = phaseAt(t);

    // 世界の切替(ワープの光/大気圏のヘイズに隠れて行う)
    const seg = segmentAt(t);
    this.worldA.visible = seg.world === 'A';
    this.worldB.visible = seg.world === 'B';
    this.worldC.visible = seg.world === 'C';
    this.skybox.visible = seg.world !== 'C'; // 地表では空ドームが星空を覆う

    // レール上の位置と注視点
    const rail = this.rails[seg.rail];
    const u = rail.uAt(t);
    rail.pointAt(u, this.tmpPos);
    rail.pointAt(Math.min(u + 0.015, 1), this.tmpAhead);
    if (this.tmpAhead.distanceToSquared(this.tmpPos) < 1e-6) {
      const tangent = rail.curve.getTangentAt(1);
      this.tmpAhead.copy(this.tmpPos).addScaledVector(tangent, 10);
    }
    this.tmpTarget.copy(this.tmpAhead);
    if (phase.bias === 'earth' || phase.bias === 'mars') {
      this.tmpBias.set(0, 0, 0);
      this.tmpTarget.lerp(this.tmpBias, phase.biasW);
    } else if (phase.bias === 'moon') {
      this.tmpBias.set(MOON_POS[0], MOON_POS[1], MOON_POS[2]);
      this.tmpTarget.lerp(this.tmpBias, phase.biasW);
    } else if (phase.bias === 'canyonExit') {
      this.tmpTarget.lerp(CANYON_LOOKBACK, phase.biasW);
    }

    // ワープ強度エンベロープ
    const charge = phase.id === 'charge' ? clamp01((t - phase.start) / (phase.end - phase.start)) : 0;
    const warpAmt = t >= 56 && t < 64 ? clamp01(Math.min((t - 56) / 0.9, (64 - t) / 0.9)) : 0;
    this.warp.setIntensity(warpAmt);
    this.dust.points.visible = this.quality === 'high' && warpAmt < 0.3 && seg.world !== 'C';

    // 大気圏突入/離脱の演出(FR-47)
    const haze = hazeEnvelope(t);
    const entryGlow = entryGlowEnvelope(t);
    this.hud.setHaze(haze);
    this.hud.setEntryGlow(entryGlow);

    // カメラ演出パラメータ(快適モードでは減衰: NFR-33)
    const comfortMul = this.comfort ? 0.4 : 1;
    const boardingKick = phase.id === 'boarding' ? clamp01(t / 6) * 3.5 : 0;
    const fovKick = (warpAmt * 20 + charge * 4 + boardingKick + entryGlow * 6) * comfortMul;
    const rumble =
      (charge * 0.14 + warpAmt * 0.28 + entryGlow * 0.3 + (seg.world === 'C' ? 0.05 : 0)) *
      (this.comfort ? 0.35 : 1);
    const swayAmp = this.comfort ? 0.25 : seg.world === 'C' ? 1.4 : 1;

    this.rig.apply(this.tmpPos, this.tmpTarget, dt, {
      swayAmp,
      rumble,
      fovKick,
      idleDrift: !this.started,
    });

    // ワープ突入時に視点を正面へ戻す/出口の閃光
    const crossed = (mark: number) => this.prevTourTime < mark && t >= mark && t - this.prevTourTime < 0.5;
    if (crossed(56)) this.rig.recenter();
    if (crossed(FLASH_T)) this.hud.flash();

    // HUD
    this.hud.setPhase(phase.label);
    this.hud.setProgress(t / TOUR_LENGTH);
    this.hud.setRouteLeg(t < 34 ? 0 : t < WORLD_SWAP_T ? 1 : 2);

    let subtitle: string | null = null;
    if (this.started) {
      for (const s of SUBTITLES) {
        if (t >= s.t && t < s.t + s.dur) { subtitle = s.text; break; }
      }
    }
    this.hud.setSubtitle(subtitle);

    // 速度表示(レール上の実速度を平滑化した演出値)
    if (this.prevRailPos && dt > 0) {
      const v = this.tmpPos.distanceTo(this.prevRailPos) / dt;
      if (v * dt < 50) this.speedSm += (v - this.speedSm) * Math.min(1, dt * 3);
    }
    this.prevRailPos = (this.prevRailPos ?? new THREE.Vector3()).copy(this.tmpPos);
    if (warpAmt > 0.05) {
      this.hud.setSpeed((warpAmt * 3.2).toFixed(1), 'c(光速比)', true);
    } else if (seg.world === 'C') {
      this.hud.setSpeed((this.speedSm * 9).toFixed(0), 'km/h(対地)', false);
    } else {
      this.hud.setSpeed((this.speedSm * 38).toFixed(1), 'km/s', false);
    }

    if (phase.id === 'charge') this.hud.setWarp(charge, 'CHARGE', 'charge');
    else if (warpAmt > 0) this.hud.setWarp(1, 'JUMP', 'warp');
    else if (phase.id === 'entry' || phase.id === 'ascent') this.hud.setWarp(0, 'ENTRY', 'charge');
    else if (seg.world === 'C') this.hud.setWarp(0, 'TERRAIN', 'cruise');
    else this.hud.setWarp(0, 'CRUISE', 'cruise');

    // 終幕: フェード→終了画面
    const fadeStart = TOUR_LENGTH - 3;
    const fade = t > fadeStart ? clamp01((t - fadeStart) / 2.5) : 0;
    this.hud.setFade(fade);
    if (t >= TOUR_LENGTH && !this.ended && this.started) {
      this.ended = true;
      this.hud.setSubtitle(null);
      this.hud.showEnd(true);
    }

    this.prevTourTime = t;
  }
}

// ---- 起動 ----------------------------------------------------------------
const canvas = document.getElementById('gl') as HTMLCanvasElement | null;
if (!canvas) throw new Error('canvas #gl not found');
try {
  new App(canvas).run();
} catch (err) {
  console.error(err);
  const msg = document.createElement('div');
  msg.className = 'webgl-error';
  msg.textContent = 'WebGLの初期化に失敗しました。ハードウェアアクセラレーションが有効なPCブラウザでお試しください。';
  document.body.appendChild(msg);
}
