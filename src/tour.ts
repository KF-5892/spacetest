// ツアー定義(データ駆動)。将来はJSON外部化してシーンモジュール組み合わせ(FR-05)に発展させる。

export type WorldId = 'A' | 'B' | 'C';
export type RailKey = 'A' | 'B1' | 'C' | 'B2';
export type BiasTarget = 'earth' | 'moon' | 'mars' | 'canyonExit' | null;

export interface Phase {
  id: string;
  label: string;
  start: number;
  end: number;
  bias: BiasTarget;
  biasW: number;
}

// 総尺(秒)
export const TOUR_LENGTH = 150;
// ワープ中に世界を差し替える時刻(FR-46: ロードを見せない遷移)
export const WORLD_SWAP_T = 60;
// 大気圏突入/離脱で地表世界と切り替える時刻(FR-47: ヘイズのピークで差し替え)
export const SURFACE_IN_T = 88;
export const SURFACE_OUT_T = 126;

export const PHASES: Phase[] = [
  { id: 'boarding', label: '出発', start: 0, end: 8, bias: 'earth', biasW: 0.5 },
  { id: 'earth', label: '地球周回', start: 8, end: 34, bias: 'earth', biasW: 0.38 },
  { id: 'moon', label: '月フライバイ', start: 34, end: 48, bias: 'moon', biasW: 0.45 },
  { id: 'charge', label: 'ワープチャージ', start: 48, end: 56, bias: null, biasW: 0 },
  { id: 'warp', label: 'ワープ航行', start: 56, end: 64, bias: null, biasW: 0 },
  { id: 'approach', label: '火星接近', start: 64, end: 82, bias: 'mars', biasW: 0.35 },
  { id: 'entry', label: '大気圏突入', start: 82, end: SURFACE_IN_T, bias: 'mars', biasW: 0.55 },
  { id: 'surface', label: '峡谷飛行', start: SURFACE_IN_T, end: 118.5, bias: null, biasW: 0 },
  { id: 'ascent', label: '上昇', start: 118.5, end: SURFACE_OUT_T, bias: 'canyonExit', biasW: 0.35 },
  { id: 'departure', label: '軌道離脱', start: SURFACE_OUT_T, end: 140, bias: 'mars', biasW: 0.45 },
  { id: 'arrival', label: '帰投減速', start: 140, end: TOUR_LENGTH, bias: 'mars', biasW: 0.25 },
];

export function phaseAt(t: number): Phase {
  for (const p of PHASES) {
    if (t < p.end) return p;
  }
  return PHASES[PHASES.length - 1];
}

// 時刻→ アクティブな世界とレール
export function segmentAt(t: number): { world: WorldId; rail: RailKey } {
  if (t < WORLD_SWAP_T) return { world: 'A', rail: 'A' };
  if (t < SURFACE_IN_T) return { world: 'B', rail: 'B1' };
  if (t < SURFACE_OUT_T) return { world: 'C', rail: 'C' };
  return { world: 'B', rail: 'B2' };
}

export interface Subtitle {
  t: number;
  dur: number;
  text: string;
}

export const SUBTITLES: Subtitle[] = [
  { t: 1, dur: 6, text: 'コスモライナーへようこそ。本日の航路は 地球 — 月 — 火星 です。' },
  { t: 8.5, dur: 6, text: '発進します。ドラッグで窓の外を自由に見回せます。' },
  { t: 17, dur: 6.5, text: '高度400km。ここから見る地球は、90分で1周する景色です。' },
  { t: 26, dur: 6, text: 'まもなく昼と夜の境界線——ターミネーターを越えます。' },
  { t: 35, dur: 6.5, text: '月が接近中。クレーターの影が長いのは、太陽が低いからです。' },
  { t: 43.5, dur: 4.5, text: '月面高度およそ10km。静かの海を通過します。' },
  { t: 49, dur: 4, text: 'ワープ航行の準備に入ります。シートベルトをご確認ください。' },
  { t: 53.2, dur: 2.6, text: 'ワープまで、3… 2… 1…' },
  { t: 57, dur: 5, text: 'ワープ航行中。火星まで、およそ8秒の旅です。' },
  { t: 65, dur: 5.5, text: 'ワープ完了。赤い惑星——火星です。' },
  { t: 72, dur: 5.5, text: 'これより大気圏に突入し、地表へ降下します。' },
  { t: 78.5, dur: 5, text: '機体が少し揺れます。摩擦光は正常な現象です。ご安心ください。' },
  { t: 84.5, dur: 3.5, text: '突入開始。高度、120km——' },
  { t: 90.5, dur: 4, text: '——ようこそ、火星の空へ。' },
  { t: 95.5, dur: 6.5, text: '眼下に広がるのはマリネリス峡谷。深さはグランドキャニオンの約4倍。' },
  { t: 103.5, dur: 6, text: '峡谷の壁の縞模様は、数十億年分の地層です。' },
  { t: 111, dur: 6, text: '風は強くても大気が薄いので、そよ風のようにしか感じないそうです。' },
  { t: 118.5, dur: 4.5, text: '前方、峡谷の出口です。上昇します——' },
  { t: 124, dur: 3.5, text: '砂塵の層を抜けて、宇宙へ。' },
  { t: 129.5, dur: 5.5, text: '火星を離れます。窓から最後の眺めをどうぞ。' },
  { t: 141, dur: 6.5, text: '本日のツアーはここまで。またのご搭乗をお待ちしております。' },
];

// レール定義: 制御点(Catmull-Rom)と 時刻→弧長パラメータu のキーフレーム
export interface RailDef {
  points: [number, number, number][];
  keyframes: [number, number][];
}

// 世界A: 地球(原点, r=50)と月(420, 10, -260, r=13.6)
// 経路は太陽方向(+Z寄り)の昼側に沿わせ、常に「照らされた面」を見ながら飛ぶ
export const RAIL_A: RailDef = {
  points: [
    [-120, 22, 135],
    [-40, 34, 150],
    [60, 40, 130],
    [150, 30, 60],
    [240, 20, -40],
    [330, 14, -130],
    [400, 10, -238],
    [452, 15, -247],
    [530, 26, -300],
  ],
  keyframes: [
    [0, 0],
    [8, 0.07],
    [21, 0.3],
    [34, 0.55],
    [41, 0.72],
    [48, 0.86],
    [56, 1.0],
  ],
};

// 世界B(往路): 火星(原点, r=34)へ接近し、大気圏へダイブする
export const RAIL_B1: RailDef = {
  points: [
    [-260, 64, 190],
    [-160, 44, 128],
    [-70, 30, 84],
    [0, 20, 58],
    [10, 10, 42],
    [10, 5, 36.6],
  ],
  keyframes: [
    [WORLD_SWAP_T, 0],
    [64, 0.07],
    [74, 0.38],
    [80, 0.62],
    [84, 0.82],
    [SURFACE_IN_T, 1.0],
  ],
};

// 世界C(地表): 制御点は terrain.ts の buildSurfaceRailPoints() が生成する
export const RAIL_C_KEYFRAMES: [number, number][] = [
  [SURFACE_IN_T, 0],
  [92, 0.09],
  [104, 0.42],
  [116, 0.72],
  [122, 0.88],
  [SURFACE_OUT_T, 1.0],
];

// 世界B(復路): 火星を離れ、減速しながら帰投する
export const RAIL_B2: RailDef = {
  points: [
    [14, 7, 42],
    [70, 26, 95],
    [150, 58, 150],
    [250, 105, 205],
    [400, 165, 265],
    [560, 230, 320],
  ],
  keyframes: [
    [SURFACE_OUT_T, 0],
    [131, 0.28],
    [138, 0.62],
    [144, 0.85],
    [TOUR_LENGTH, 1.0],
  ],
};

export const MOON_POS: [number, number, number] = [420, 10, -260];
export const EARTH_RADIUS = 50;
export const MOON_RADIUS = 13.6;
export const MARS_RADIUS = 34;
