import * as THREE from 'three';
import { NOISE_GLSL } from './noise';

// 全惑星共通の頂点シェーダ:
// ノイズはオブジェクト空間(自転してもテクスチャが追従)、ライティングはワールド空間。
const PLANET_VERT = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vObjPos = normalize(position);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export interface SharedUniforms {
  uTime: { value: number };
  uLightDir: { value: THREE.Vector3 };
}

function planetMaterial(fragBody: string, shared: SharedUniforms, extra: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uLightDir: shared.uLightDir, ...extra },
    vertexShader: PLANET_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLightDir;
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      ${NOISE_GLSL}
      ${fragBody}
    `,
  });
}

// 大気のリムグロー(惑星よりわずかに大きい球、加算合成)
function makeAtmosphere(radius: number, scale: number, color: THREE.Color, intensity: number, shared: SharedUniforms): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: shared.uLightDir,
      uColor: { value: color },
      uIntensity: { value: intensity },
    },
    vertexShader: PLANET_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightDir;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float rim = pow(1.0 - abs(dot(viewDir, normalize(vWorldNormal))), 3.0);
        float sunFace = smoothstep(-0.45, 0.55, dot(normalize(vWorldNormal), uLightDir));
        vec3 col = uColor * rim * uIntensity * (0.2 + 0.8 * sunFace);
        gl_FragColor = vec4(col, rim);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 48, 32), mat);
  mesh.renderOrder = 2;
  return mesh;
}

export interface Planet {
  group: THREE.Group;
  update(dt: number): void;
}

// ---- 地球 ---------------------------------------------------------------
export function createEarth(radius: number, shared: SharedUniforms): Planet {
  const group = new THREE.Group();

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    planetMaterial(/* glsl */ `
      void main() {
        vec3 p = vObjPos;
        float h = fbm(p * 1.9 + vec3(2.7, 0.0, 4.1));
        float detail = fbm(p * 6.2 + vec3(13.0));
        float land = smoothstep(0.015, 0.10, h + 0.22 * detail);

        // 海: 深い青→沿岸の明るい青
        float shallow = smoothstep(-0.14, 0.03, h);
        vec3 ocean = mix(vec3(0.004, 0.075, 0.22), vec3(0.02, 0.21, 0.42), shallow);

        // 陸: 緑〜茶のむら + 緯度で雪
        float m = smoothstep(-0.4, 0.6, fbm(p * 4.4 + vec3(31.0)));
        vec3 landCol = mix(vec3(0.10, 0.34, 0.15), vec3(0.45, 0.34, 0.19), m);
        landCol = mix(landCol, vec3(0.75, 0.72, 0.6), smoothstep(0.35, 0.6, detail) * 0.4);

        vec3 col = mix(ocean, landCol, land);

        // 極冠
        float ice = smoothstep(0.76, 0.9, abs(p.y) + 0.06 * h);
        col = mix(col, vec3(0.92, 0.95, 1.0), ice);

        // ライティング
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uLightDir);
        float diff = max(dot(N, L), 0.0);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 42.0) * 0.5 * (1.0 - land) * (1.0 - ice);

        vec3 night = col * vec3(0.05, 0.07, 0.13);
        vec3 day = col * (0.12 + 1.05 * diff) + vec3(1.0, 0.95, 0.85) * spec;
        gl_FragColor = vec4(mix(night, day, smoothstep(0.0, 0.25, diff)), 1.0);
      }
    `, shared)
  );
  group.add(surface);

  // 雲層
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.016, 72, 48),
    planetMaterial(/* glsl */ `
      void main() {
        vec3 p = vObjPos;
        float c = fbm(p * 3.1 + vec3(uTime * 0.008, 0.0, uTime * 0.004));
        c += 0.4 * fbm(p * 7.7 - vec3(uTime * 0.012));
        float a = smoothstep(0.08, 0.58, c) * 0.85;
        vec3 N = normalize(vWorldNormal);
        float diff = max(dot(N, normalize(uLightDir)), 0.0);
        vec3 col = vec3(1.0) * (0.08 + 0.95 * diff);
        gl_FragColor = vec4(col, a * (0.1 + 0.9 * smoothstep(0.0, 0.3, diff)));
      }
    `, shared)
  );
  clouds.material.transparent = true;
  clouds.material.depthWrite = false;
  clouds.renderOrder = 1;
  group.add(clouds);

  group.add(makeAtmosphere(radius, 1.07, new THREE.Color(0.35, 0.6, 1.0), 1.5, shared));

  return {
    group,
    update(dt: number) {
      surface.rotation.y += dt * 0.010;
      clouds.rotation.y += dt * 0.016;
    },
  };
}

// ---- 月 -----------------------------------------------------------------
export function createMoon(radius: number, shared: SharedUniforms): Planet {
  const group = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 72, 48),
    planetMaterial(/* glsl */ `
      void main() {
        vec3 p = vObjPos;
        float n = fbm(p * 4.6 + vec3(7.0));
        float maria = smoothstep(0.05, 0.5, fbm(p * 1.8 + vec3(3.3))); // 「海」の暗い斑
        float crater = smoothstep(0.32, 0.62, abs(fbm(p * 9.5 - vec3(2.0))));
        float g = 0.58 + 0.20 * n;
        g *= mix(1.0, 0.55, maria);
        g *= mix(0.82, 1.08, crater);
        vec3 col = vec3(g * 1.02, g, g * 0.95);
        float diff = max(dot(normalize(vWorldNormal), normalize(uLightDir)), 0.0);
        gl_FragColor = vec4(col * (0.03 + 1.1 * diff), 1.0);
      }
    `, shared)
  );
  group.add(surface);
  return {
    group,
    update(dt: number) {
      surface.rotation.y += dt * 0.003;
    },
  };
}

// ---- 火星 ---------------------------------------------------------------
export function createMars(radius: number, shared: SharedUniforms): Planet {
  const group = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    planetMaterial(/* glsl */ `
      void main() {
        vec3 p = vObjPos;
        float h = fbm(p * 2.9 + vec3(5.0));
        float d = fbm(p * 7.3 + vec3(17.0));
        vec3 col = mix(vec3(0.48, 0.18, 0.09), vec3(0.83, 0.5, 0.3), smoothstep(-0.45, 0.55, h));
        // 暗い玄武岩地帯
        col = mix(col, vec3(0.3, 0.13, 0.08), smoothstep(0.2, 0.55, d) * 0.55);
        // 峡谷風の暗い筋(赤道付近)
        float canyon = smoothstep(0.18, 0.02, abs(p.y + 0.12 * h)) * smoothstep(0.15, 0.5, abs(fbm(p * 3.4 - vec3(9.0))));
        col = mix(col, vec3(0.22, 0.09, 0.06), canyon * 0.6);
        // 極冠
        float ice = smoothstep(0.91, 0.97, abs(p.y) + 0.03 * h);
        col = mix(col, vec3(0.95, 0.94, 0.92), ice);
        float diff = max(dot(normalize(vWorldNormal), normalize(uLightDir)), 0.0);
        gl_FragColor = vec4(col * (0.04 + 1.12 * diff), 1.0);
      }
    `, shared)
  );
  group.add(surface);
  group.add(makeAtmosphere(radius, 1.05, new THREE.Color(0.9, 0.55, 0.35), 0.7, shared));
  return {
    group,
    update(dt: number) {
      surface.rotation.y += dt * 0.012;
    },
  };
}
