import * as THREE from 'three';
import { NOISE_GLSL } from '../world/noise';

const STREAK_COUNT = 700;

// ワープ演出: カメラに追従するトンネル(不透明寄り=背景マスク)+ 星が線に伸びるストリーク
export class WarpEffect {
  readonly group = new THREE.Group();

  private readonly tunnelMat: THREE.ShaderMaterial;
  private readonly streakMat: THREE.LineBasicMaterial;
  private readonly streakGeo: THREE.BufferGeometry;
  private readonly streakData: { r: number; theta: number; z: number; len: number }[] = [];

  constructor() {
    // --- トンネル(カメラを包む筒。内側から見るので BackSide) ---
    const tunnelGeo = new THREE.CylinderGeometry(26, 26, 460, 48, 1, true);
    tunnelGeo.rotateX(Math.PI / 2); // 軸をZに
    this.tunnelMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          float ang = vUv.x * 6.2831853 + vUv.y * 2.4 + uTime * 0.35;
          float band = fbm(vec3(cos(ang) * 1.5, sin(ang) * 1.5, vUv.y * 5.5 - uTime * 2.4));
          band = clamp(band * 0.6 + 0.5, 0.0, 1.0);
          vec3 col = mix(vec3(0.015, 0.02, 0.1), vec3(0.3, 0.22, 0.8), band);
          col += vec3(0.75, 0.85, 1.0) * pow(band, 6.0) * 1.4;
          // 筒の両端をフェード(前方は星空の「出口」が見える)
          float endFade = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
          float alpha = uOpacity * mix(0.25, 1.0, endFade) * (0.75 + 0.25 * band);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const tunnel = new THREE.Mesh(tunnelGeo, this.tunnelMat);
    tunnel.position.z = -110;
    tunnel.frustumCulled = false;
    tunnel.renderOrder = 40;
    this.group.add(tunnel);

    // --- ストリーク(前方から流れてくる線分) ---
    const positions = new Float32Array(STREAK_COUNT * 2 * 3);
    const colors = new Float32Array(STREAK_COUNT * 2 * 3);
    for (let i = 0; i < STREAK_COUNT; i++) {
      const r = 4 + Math.pow(Math.random(), 0.7) * 70;
      const theta = Math.random() * Math.PI * 2;
      const z = -260 + Math.random() * 290;
      const len = 14 + Math.random() * 55;
      this.streakData.push({ r, theta, z, len });
      // 先頭(カメラ寄り)は明るく、尾は暗く
      colors[i * 6 + 0] = 0.8; colors[i * 6 + 1] = 0.88; colors[i * 6 + 2] = 1.0;
      colors[i * 6 + 3] = 0.12; colors[i * 6 + 4] = 0.18; colors[i * 6 + 5] = 0.5;
    }
    this.streakGeo = new THREE.BufferGeometry();
    this.streakGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.streakGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.streakMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const streaks = new THREE.LineSegments(this.streakGeo, this.streakMat);
    streaks.frustumCulled = false;
    streaks.renderOrder = 41;
    this.group.add(streaks);

    this.group.visible = false;
    this.writeStreaks();
  }

  private writeStreaks(): void {
    const attr = this.streakGeo.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const s = this.streakData[i];
      const x = Math.cos(s.theta) * s.r;
      const y = Math.sin(s.theta) * s.r;
      arr[i * 6 + 0] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = s.z;
      arr[i * 6 + 3] = x;
      arr[i * 6 + 4] = y;
      arr[i * 6 + 5] = s.z - s.len;
    }
    attr.needsUpdate = true;
  }

  /** intensity: 0..1(トンネル/ストリークの濃さ) */
  setIntensity(intensity: number): void {
    const on = intensity > 0.002;
    this.group.visible = on;
    this.tunnelMat.uniforms.uOpacity.value = intensity;
    this.streakMat.opacity = intensity;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.tunnelMat.uniforms.uTime.value += dt;
    for (const s of this.streakData) {
      s.z += dt * 640;
      if (s.z > 30) {
        s.z -= 290;
        s.theta = Math.random() * Math.PI * 2;
        s.r = 4 + Math.pow(Math.random(), 0.7) * 70;
      }
    }
    this.writeStreaks();
  }
}
