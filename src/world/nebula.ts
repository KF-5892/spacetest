import * as THREE from 'three';

function makeNebulaTexture(hue: number, sat: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // 多重の放射グラデーションで雲状のむらを作る
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 14; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.5;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.5;
    const r = size * (0.12 + Math.random() * 0.28);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const h = hue + (Math.random() - 0.5) * 40;
    const l = 45 + Math.random() * 25;
    g.addColorStop(0, `hsla(${h}, ${sat}%, ${l}%, ${0.10 + Math.random() * 0.10})`);
    g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 遠景にうっすら漂う星雲スプライト群(スカイボックスグループに入れる)
export function createNebulas(): THREE.Group {
  const group = new THREE.Group();
  const specs: { dir: THREE.Vector3; scale: number; hue: number; sat: number; opacity: number }[] = [
    { dir: new THREE.Vector3(0.55, 0.28, -0.75), scale: 3600, hue: 195, sat: 90, opacity: 0.5 },
    { dir: new THREE.Vector3(-0.8, 0.1, -0.5), scale: 3000, hue: 275, sat: 75, opacity: 0.42 },
    { dir: new THREE.Vector3(0.2, -0.35, 0.9), scale: 3200, hue: 330, sat: 60, opacity: 0.3 },
    { dir: new THREE.Vector3(-0.3, 0.75, 0.55), scale: 2600, hue: 220, sat: 85, opacity: 0.36 },
    { dir: new THREE.Vector3(0.9, -0.1, 0.35), scale: 2400, hue: 180, sat: 70, opacity: 0.26 },
  ];
  for (const s of specs) {
    const mat = new THREE.SpriteMaterial({
      map: makeNebulaTexture(s.hue, s.sat),
      transparent: true,
      opacity: s.opacity,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(s.dir).normalize().multiplyScalar(5000);
    sprite.scale.setScalar(s.scale);
    sprite.renderOrder = -10;
    group.add(sprite);
  }
  return group;
}

// 太陽: 遠景のグロースプライト(光源方向の記号)
export function createSunSprite(dir: THREE.Vector3): THREE.Sprite {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255, 255, 250, 1)');
  g.addColorStop(0.08, 'rgba(255, 250, 225, 1)');
  g.addColorStop(0.22, 'rgba(255, 225, 160, 0.55)');
  g.addColorStop(0.5, 'rgba(255, 190, 120, 0.16)');
  g.addColorStop(1.0, 'rgba(255, 170, 100, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(dir).normalize().multiplyScalar(4300);
  sprite.scale.setScalar(1500);
  return sprite;
}
