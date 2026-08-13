import * as THREE from 'three';
import type { RailDef } from './tour';

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// スプラインレール: 時刻→弧長パラメータu→位置
export class Rail {
  readonly curve: THREE.CatmullRomCurve3;
  private readonly keyframes: [number, number][];

  constructor(def: RailDef) {
    this.curve = new THREE.CatmullRomCurve3(
      def.points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
      'catmullrom',
      0.5
    );
    this.keyframes = def.keyframes;
  }

  uAt(t: number): number {
    const k = this.keyframes;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) {
      const [ta, ua] = k[i];
      const [tb, ub] = k[i + 1];
      if (t <= tb) {
        const s = (t - ta) / (tb - ta);
        return ua + (ub - ua) * s;
      }
    }
    return k[k.length - 1][1];
  }

  pointAt(u: number, out: THREE.Vector3): THREE.Vector3 {
    return this.curve.getPointAt(clamp01(u), out);
  }
}

export interface RigParams {
  swayAmp: number;   // 待機時の微揺れ 0..1
  rumble: number;    // ワープ等の振動 0..1
  fovKick: number;   // FOV加算(度)
  idleDrift: boolean; // タイトル画面のゆったりした首振り
}

// カメラの姿勢制御: レール位置 + 視線バイアス + ユーザーの見回しオフセット + 揺れ/FOV
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yawOffset = 0;
  pitchOffset = 0;
  recentering = false;

  private readonly baseFov = 62;
  private fov = 62;
  private elapsed = 0;
  private readonly q = new THREE.Quaternion();
  private readonly qSmooth = new THREE.Quaternion();
  private hasSmooth = false;
  private readonly qOff = new THREE.Quaternion();
  private readonly m = new THREE.Matrix4();
  private readonly euler = new THREE.Euler();
  private readonly right = new THREE.Vector3();
  private readonly upv = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.5, 12000);
  }

  addLook(dx: number, dy: number): void {
    this.recentering = false;
    this.yawOffset = THREE.MathUtils.clamp(this.yawOffset - dx * 0.0032, -1.2, 1.2);
    this.pitchOffset = THREE.MathUtils.clamp(this.pitchOffset - dy * 0.0028, -0.72, 0.72);
  }

  recenter(): void {
    this.recentering = true;
  }

  // シーク直後などに呼び、注視スムージングを即時追従にリセットする
  snapLook(): void {
    this.hasSmooth = false;
  }

  apply(pos: THREE.Vector3, target: THREE.Vector3, dt: number, p: RigParams): void {
    this.elapsed += dt;

    if (this.recentering) {
      const k = Math.min(1, dt * 5);
      this.yawOffset *= 1 - k;
      this.pitchOffset *= 1 - k;
      if (Math.abs(this.yawOffset) < 0.002 && Math.abs(this.pitchOffset) < 0.002) {
        this.yawOffset = 0;
        this.pitchOffset = 0;
        this.recentering = false;
      }
    }

    // 基本姿勢: レール上からターゲットを見る(注視点の切替はスムージングで吸収)
    this.m.lookAt(pos, target, new THREE.Vector3(0, 1, 0));
    this.q.setFromRotationMatrix(this.m);
    if (!this.hasSmooth) {
      this.qSmooth.copy(this.q);
      this.hasSmooth = true;
    } else {
      this.qSmooth.slerp(this.q, Math.min(1, dt * 3.5));
    }

    // ユーザーの見回し + タイトル画面のドリフト
    let yaw = this.yawOffset;
    let pitch = this.pitchOffset;
    if (p.idleDrift) {
      yaw += Math.sin(this.elapsed * 0.11) * 0.07;
      pitch += Math.sin(this.elapsed * 0.07 + 1.0) * 0.03;
    }
    this.euler.set(pitch, yaw, Math.sin(this.elapsed * 0.23) * 0.012 * p.swayAmp, 'YXZ');
    this.qOff.setFromEuler(this.euler);
    this.camera.quaternion.multiplyQuaternions(this.qSmooth, this.qOff);

    // 位置: 微揺れ + 振動をカメラローカル軸に加算
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.upv.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const swayX = Math.sin(this.elapsed * 0.5) * 0.55 * p.swayAmp;
    const swayY = Math.cos(this.elapsed * 0.37) * 0.4 * p.swayAmp;
    const rumX = (Math.random() - 0.5) * 2 * p.rumble;
    const rumY = (Math.random() - 0.5) * 2 * p.rumble;
    this.camera.position
      .copy(pos)
      .addScaledVector(this.right, swayX + rumX)
      .addScaledVector(this.upv, swayY + rumY);

    // FOV(なめらかに追従)
    const targetFov = this.baseFov + p.fovKick;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 6);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
