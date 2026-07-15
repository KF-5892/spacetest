import * as THREE from 'three';

// 丸いソフトドットのテクスチャ(Pointsの四角形描画を隠す)
let dotTexture: THREE.CanvasTexture | null = null;
function getDotTexture(): THREE.CanvasTexture {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new THREE.CanvasTexture(canvas);
  return dotTexture;
}

// 遠景の星野: カメラに追従する殻の上の固定星(スカイボックス相当)
export function createStarShell(count = 9000): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // 球殻上に一様分布
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 3300 + Math.random() * 1300;
    positions[i * 3 + 0] = s * Math.cos(phi) * r;
    positions[i * 3 + 1] = u * r;
    positions[i * 3 + 2] = s * Math.sin(phi) * r;
    // 色温度のばらつき(青白〜白〜橙)
    const t = Math.random();
    if (t < 0.12) color.setRGB(1.0, 0.75, 0.55);
    else if (t < 0.3) color.setRGB(1.0, 0.93, 0.8);
    else if (t < 0.75) color.setRGB(0.92, 0.95, 1.0);
    else color.setRGB(0.68, 0.8, 1.0);
    const b = 0.35 + Math.pow(Math.random(), 2.2) * 0.65;
    colors[i * 3 + 0] = color.r * b;
    colors[i * 3 + 1] = color.g * b;
    colors[i * 3 + 2] = color.b * b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    map: getDotTexture(),
    size: 2.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// 近景のダスト: カメラ周辺の立方体内でラップし、速度のパララックスを作る
export class DustField {
  readonly points: THREE.Points;
  private readonly half = 300;
  constructor(count = 1200) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() * 2 - 1) * this.half;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: getDotTexture(),
      color: 0x9db8dd,
      size: 1.3,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  // 各点をカメラ中心の [-half, half]^3 に折り返す
  update(cam: THREE.Vector3): void {
    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const size = this.half * 2;
    for (let i = 0; i < arr.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        const c = a === 0 ? cam.x : a === 1 ? cam.y : cam.z;
        let d = arr[i + a] - c;
        d = ((((d + this.half) % size) + size) % size) - this.half;
        arr[i + a] = c + d;
      }
    }
    attr.needsUpdate = true;
  }
}
