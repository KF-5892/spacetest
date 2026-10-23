import * as THREE from 'three';
import { canyonCenter, terrainHeight } from './world/terrain';
import { EARTH_RADIUS, MARS_RADIUS, MOON_POS, MOON_RADIUS } from './tour';

// ============================================================
// フリーフライト(FR-20〜23): 惑星間/惑星内を自由に移動する操縦モード
//  - 水平を保つ yaw/pitch 操縦(NFR-32: 視界の傾きを出さない)
//  - 慣性つきだが減衰が効く「扱いやすい」宇宙船モデル
//  - 惑星クリックで自動接近(FR-21)
//  - 地表モードでは地形クリアランスで地面にめり込まない
// ============================================================

const UP = new THREE.Vector3(0, 1, 0);
const MAX_PITCH = 1.45; // ±約83°

export type BodyKind = 'earth' | 'moon' | 'mars';

export interface Body {
  name: string;
  kind: BodyKind;
  pos: THREE.Vector3;
  radius: number;
}

// 太陽系レイアウト(1つの座標空間。惑星間を実際に飛べる距離感で配置)
export const FREE_BODIES: Body[] = [
  { name: '地球', kind: 'earth', pos: new THREE.Vector3(0, 0, 0), radius: EARTH_RADIUS },
  { name: '月', kind: 'moon', pos: new THREE.Vector3(MOON_POS[0], MOON_POS[1], MOON_POS[2]), radius: MOON_RADIUS },
  { name: '火星', kind: 'mars', pos: new THREE.Vector3(-1600, 150, -2550), radius: MARS_RADIUS },
];

export function bodyByKind(kind: BodyKind): Body {
  return FREE_BODIES.find((b) => b.kind === kind)!;
}

// 地表モードの可動範囲(terrain.ts の地形生成範囲の内側)
const SURF_X = 2000;
const SURF_Z = 1000;
const SURF_CLEARANCE = 10; // 地面からの最低クリアランス
export const SURFACE_CEILING = 760; // これを超えて上昇したら離脱判定

export interface FlightTelemetry {
  speed: number;        // u/s
  boosting: boolean;
  nearest: Body;
  nearestDist: number;  // 表面までの距離
  approaching: Body | null;
  onSurface: boolean;
  altitude: number;     // 地表モード時の対地高度
}

export class FreeFlight {
  readonly pos = new THREE.Vector3();
  private readonly vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  onSurface = false;

  // 入力状態
  private readonly keys = new Set<string>();
  private approach: Body | null = null;

  // 作業用
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly accel = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly tmp = new THREE.Vector3();
  private fov = 62;

  private speedScale(): number {
    return this.onSurface ? 150 : 520; // 加速度の基準(u/s^2相当)
  }

  reset(pos: THREE.Vector3, lookAt: THREE.Vector3, onSurface: boolean): void {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.onSurface = onSurface;
    this.approach = null;
    this.aimAt(lookAt);
  }

  // 現在位置から target を向く yaw/pitch を即時セット
  private aimAt(target: THREE.Vector3): void {
    this.m.lookAt(this.pos, target, UP);
    this.quat.setFromRotationMatrix(this.m);
    this.euler.setFromQuaternion(this.quat, 'YXZ');
    this.yaw = this.euler.y;
    this.pitch = THREE.MathUtils.clamp(this.euler.x, -MAX_PITCH, MAX_PITCH);
  }

  setKey(code: string, down: boolean): void {
    if (down) {
      // 操縦入力があれば自動接近を解除(接近完了の減速中を除く)
      if (MOVE_KEYS.has(code)) this.approach = null;
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  clearKeys(): void {
    this.keys.clear();
  }

  addLook(dx: number, dy: number): void {
    this.approach = null;
    this.yaw -= dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -MAX_PITCH, MAX_PITCH);
  }

  requestApproach(body: Body): void {
    this.approach = body;
  }

  get approachTarget(): Body | null {
    return this.approach;
  }

  private nearestBody(): { body: Body; dist: number } {
    let best = FREE_BODIES[0];
    let bestD = Infinity;
    for (const b of FREE_BODIES) {
      const d = this.pos.distanceTo(b.pos) - b.radius;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return { body: best, dist: Math.max(0, bestD) };
  }

  // camera を駆動して毎フレームのテレメトリを返す
  update(dt: number, camera: THREE.PerspectiveCamera, comfort: boolean): FlightTelemetry {
    const boosting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // --- 自動接近(FR-21): 目標を向き、距離に応じて加減速 ---
    if (this.approach) {
      const target = this.approach;
      const stop = target.radius * (target.kind === 'earth' ? 3.0 : 4.2);
      this.tmp.copy(target.pos).sub(this.pos);
      const dist = this.tmp.length();
      this.aimTowardEased(target.pos, dt, 2.4);
      this.orientation(this.quat);
      this.fwd.set(0, 0, -1).applyQuaternion(this.quat);
      const along = dist - stop;
      if (along > 6) {
        const cruise = Math.min(620, 60 + along * 1.6);
        this.vel.lerp(this.tmp.copy(this.fwd).multiplyScalar(cruise), Math.min(1, dt * 1.6));
      } else {
        this.vel.multiplyScalar(Math.pow(0.02, dt));
        if (this.vel.lengthSq() < 4) this.approach = null; // 到着
      }
    } else {
      // --- 手動操縦 ---
      this.orientation(this.quat);
      this.fwd.set(0, 0, -1).applyQuaternion(this.quat);
      this.right.set(1, 0, 0).applyQuaternion(this.quat);
      this.accel.set(0, 0, 0);
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.accel.add(this.fwd);
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.accel.sub(this.fwd);
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.accel.add(this.right);
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.accel.sub(this.right);
      if (this.keys.has('KeyR') || this.keys.has('Space')) this.accel.add(UP);
      if (this.keys.has('KeyF')) this.accel.sub(UP);
      if (this.accel.lengthSq() > 0) {
        this.accel.normalize().multiplyScalar(this.speedScale() * (boosting ? 3.2 : 1));
        this.vel.addScaledVector(this.accel, dt);
      }
      // 減衰(手を離すと滑らかに停止)+ ブレーキ(B)
      const damp = this.keys.has('KeyB') ? 0.015 : 0.46;
      this.vel.multiplyScalar(Math.pow(damp, dt));
      // 速度上限
      const maxV = this.onSurface ? (boosting ? 520 : 240) : (boosting ? 1900 : 760);
      if (this.vel.length() > maxV) this.vel.setLength(maxV);
    }

    // --- 位置積分 ---
    this.pos.addScaledVector(this.vel, dt);

    // --- 地表モードの地形クリアランス/範囲クランプ ---
    let altitude = 0;
    if (this.onSurface) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -SURF_X, SURF_X);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -SURF_Z, SURF_Z);
      const ground = terrainHeight(this.pos.x, this.pos.z);
      const floor = ground + SURF_CLEARANCE;
      if (this.pos.y < floor) {
        this.pos.y = floor;
        if (this.vel.y < 0) this.vel.y = 0;
      }
      altitude = this.pos.y - ground;
    }

    // --- カメラ姿勢 ---
    this.orientation(camera.quaternion);
    camera.position.copy(this.pos);

    // 速度に応じた軽いFOVキック(快適モードで減衰: NFR-33)
    const speed = this.vel.length();
    const ref = this.onSurface ? 260 : 820;
    const targetFov = 62 + Math.min(10, (speed / ref) * 10) * (comfort ? 0.4 : 1);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(camera.fov - this.fov) > 0.01) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }

    const near = this.nearestBody();
    return {
      speed,
      boosting,
      nearest: near.body,
      nearestDist: near.dist,
      approaching: this.approach,
      onSurface: this.onSurface,
      altitude,
    };
  }

  private orientation(out: THREE.Quaternion): void {
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    out.setFromEuler(this.euler);
  }

  // target 方向の yaw/pitch へイージング(自動接近の操舵)
  private aimTowardEased(target: THREE.Vector3, dt: number, rate: number): void {
    this.m.lookAt(this.pos, target, UP);
    this.quat.setFromRotationMatrix(this.m);
    this.euler.setFromQuaternion(this.quat, 'YXZ');
    const k = Math.min(1, dt * rate);
    // yaw は最短角で補間
    let dYaw = this.euler.y - this.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    this.yaw += dYaw * k;
    this.pitch += (THREE.MathUtils.clamp(this.euler.x, -MAX_PITCH, MAX_PITCH) - this.pitch) * k;
  }
}

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyB', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

// 地表進入時のスポーン(峡谷の上空から)と離脱時のスポーン(火星軌道の外)を計算
export function surfaceSpawn(): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const x = -900;
  const z = canyonCenter(x);
  const y = terrainHeight(x, z) + 150;
  return {
    pos: new THREE.Vector3(x, y, z),
    look: new THREE.Vector3(x + 300, y - 30, canyonCenter(x + 300)),
  };
}

export function orbitSpawn(mars: Body): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const pos = mars.pos.clone().add(new THREE.Vector3(mars.radius * 2.6, mars.radius * 1.4, mars.radius * 3.4));
  return { pos, look: mars.pos.clone() };
}
