import * as THREE from 'three';
import { NOISE_GLSL } from './noise';

// ============================================================
// 火星地表シーン(ソアリン型の地表飛行: FR-47/48)
//  - 地形はJS側の高さ関数で生成(レールのクリアランス計算と共有するため)
//  - 峡谷(マリネリス風)が x 方向に蛇行し、レールはその中を縫って飛ぶ
// ============================================================

// --- 決定論的な2D値ノイズ(JS側) ---
function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function fbm2(x: number, y: number, oct = 4): number {
  let f = 0;
  let amp = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < oct; i++) {
    f += amp * vnoise(fx, fy);
    fx = fx * 2.03 + 19.1;
    fy = fy * 2.03 + 7.7;
    amp *= 0.5;
  }
  return f;
}

function sstep(edge0: number, edge1: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// 峡谷の中心線(xに対するz)
export function canyonCenter(x: number): number {
  return 260 * Math.sin(x * 0.0011) + 90 * Math.sin(x * 0.0037 + 1.7);
}

// 地形の高さ関数: 砂丘 + 台地(メサ) を峡谷が切り裂く
export function terrainHeight(x: number, z: number): number {
  const dunes = fbm2(x * 0.004, z * 0.004) * 14;
  const m = fbm2(x * 0.0015 + 10, z * 0.0015 - 5);
  const mesaMask = sstep(0.05, 0.45, m);
  const mesa = mesaMask * (58 + 22 * fbm2(x * 0.006 - 3, z * 0.006 + 8));
  let h = dunes + mesa + 14;
  const d = Math.abs(z - canyonCenter(x));
  const halfW = 150 + 45 * fbm2(x * 0.0021, 3.7);
  const wall = sstep(halfW, halfW * 0.42, d); // 峡谷内で1
  const floor = -85 + fbm2(x * 0.008, z * 0.008) * 6;
  h = h + (floor - h) * wall;
  return h;
}

// 地表レールの制御点を生成: 峡谷中心線に沿い、高度プロファイル+クリアランスを保証
export function buildSurfaceRailPoints(): [number, number, number][] {
  const stations: { x: number; alt: number; weave: number }[] = [
    { x: -1850, alt: 235, weave: 0 },   // 砂塵の層から進入
    { x: -1550, alt: 120, weave: 15 },
    { x: -1250, alt: 55, weave: -40 },
    { x: -950, alt: 38, weave: 45 },
    { x: -650, alt: 34, weave: -45 },
    { x: -350, alt: 46, weave: 35 },
    { x: -60, alt: 100, weave: 0 },     // 尾根越えのビスタ
    { x: 240, alt: 42, weave: -40 },
    { x: 540, alt: 33, weave: 45 },
    { x: 840, alt: 36, weave: -40 },
    { x: 1140, alt: 55, weave: 25 },
    { x: 1440, alt: 140, weave: 0 },    // 出口へ上昇開始
    { x: 1750, alt: 330, weave: 0 },
    { x: 2000, alt: 540, weave: 0 },
  ];
  return stations.map((s) => {
    const z = canyonCenter(s.x) + s.weave;
    // 周辺の最大地形高を調べ、最低クリアランス24を確保(スプラインの膨らみ余裕込み)
    let ground = -Infinity;
    for (let dx = -60; dx <= 60; dx += 30) {
      for (let dz = -45; dz <= 45; dz += 22.5) {
        ground = Math.max(ground, terrainHeight(s.x + dx, z + dz));
      }
    }
    const y = Math.max(terrainHeight(s.x, z) + s.alt, ground + 24);
    return [s.x, y, z];
  });
}

// 地表の太陽方向(演出優先で軌道シーンより高めの「黄金時間」光)
const SURFACE_LIGHT = new THREE.Vector3(0.35, 0.5, 0.79).normalize();
const FOG_COLOR = new THREE.Color(0.85, 0.63, 0.42); // バタースコッチの地平

const TERRAIN_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

function createTerrainMesh(): THREE.Mesh {
  const width = 4400;
  const depth = 2200;
  const geo = new THREE.PlaneGeometry(width, depth, 440, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: SURFACE_LIGHT },
      uFogColor: { value: FOG_COLOR },
      uFogDensity: { value: 0.00085 },
    },
    vertexShader: TERRAIN_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightDir;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      ${NOISE_GLSL}
      void main() {
        vec3 N = normalize(vNormalW);
        float slope = 1.0 - N.y;

        // 斜面(峡谷の壁)は地層の縞、平地は砂
        float band = sin(vWorldPos.y * 0.35 + fbm(vWorldPos * 0.02) * 2.5) * 0.5 + 0.5;
        vec3 strata = mix(vec3(0.42, 0.18, 0.10), vec3(0.72, 0.42, 0.24), band);
        float dust = fbm(vec3(vWorldPos.x * 0.012, 0.0, vWorldPos.z * 0.012)) * 0.5 + 0.5;
        vec3 dustCol = mix(vec3(0.55, 0.28, 0.16), vec3(0.80, 0.55, 0.36), dust);
        vec3 col = mix(dustCol, strata, smoothstep(0.22, 0.55, slope));

        float diff = max(dot(N, uLightDir), 0.0);
        col *= (0.30 + 0.95 * diff) * vec3(1.0, 0.93, 0.85);

        float dist = distance(cameraPosition, vWorldPos);
        float fog = 1.0 - exp(-dist * uFogDensity);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function createSkyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: SURFACE_LIGHT },
      uHorizon: { value: FOG_COLOR },
      uZenith: { value: new THREE.Color(0.30, 0.17, 0.12) },
    },
    vertexShader: TERRAIN_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightDir;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos - cameraPosition);
        float t = clamp(dir.y * 1.4, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(t, 0.7));
        float sunD = max(dot(dir, uLightDir), 0.0);
        col += vec3(1.0, 0.85, 0.65) * pow(sunD, 260.0) * 1.6; // 太陽
        col += vec3(0.95, 0.70, 0.48) * pow(sunD, 10.0) * 0.30; // グレア
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), mat);
  dome.renderOrder = -5;
  dome.frustumCulled = false;
  return dome;
}

// 進入/離脱時に突き抜ける砂塵の層
function createDustDeck(): THREE.Group {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.55;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.55;
    const r = size * (0.18 + Math.random() * 0.24);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(226, 178, 128, 0.32)');
    g.addColorStop(1, 'rgba(226, 178, 128, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  const place = (x0: number, x1: number, count: number, y0: number, y1: number, opacity: number) => {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: opacity + Math.random() * 0.18,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      const x = x0 + Math.random() * (x1 - x0);
      s.position.set(x, y0 + Math.random() * (y1 - y0), canyonCenter(x) + (Math.random() - 0.5) * 320);
      s.scale.setScalar(420 + Math.random() * 480);
      group.add(s);
    }
  };
  place(-2100, -1450, 7, 250, 450, 0.45); // 進入側: 降下中に突き抜ける
  place(1780, 2350, 5, 430, 640, 0.32);   // 離脱側: 上昇の最後(ヘイズ直前)に抜ける。視界を塞がないよう高めに
  return group;
}

export interface MarsSurface {
  group: THREE.Group;
  skyDome: THREE.Mesh;
}

export function createMarsSurface(): MarsSurface {
  const group = new THREE.Group();
  const skyDome = createSkyDome();
  group.add(skyDome);
  group.add(createTerrainMesh());
  group.add(createDustDeck());
  return { group, skyDome };
}
