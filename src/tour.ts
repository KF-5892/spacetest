// ツアー定義(データ駆動)。将来はJSON外部化してシーンモジュール組み合わせ(FR-05)に発展させる。

export type WorldId = 'A' | 'B';
export type BiasTarget = 'earth' | 'moon' | 'mars' | null;

export interface Phase {
  id: string;
  label: string;
  start: number;
  end: number;
  bias: BiasTarget;
  biasW: number;
}

// 総尺(秒)
export const TOUR_LENGTH = 98;
// ワープ中に世界を差し替える時刻(FR-46: ロードを見せない遷移)
export const WORLD_SWAP_T = 60;

export const PHASES: Phase[] = [
  { id: 'boarding', label: '出発', start: 0, end: 8, bias: 'earth', biasW: 0.5 },
  { id: 'earth', label: '地球周回', start: 8, end: 34, bias: 'earth', biasW: 0.38 },
  { id: 'moon', label: '月フライバイ', start: 34, end: 48, bias: 'moon', biasW: 0.45 },
  { id: 'charge', label: 'ワープチャージ', start: 48, end: 56, bias: null, biasW: 0 },
  { id: 'warp', label: 'ワープ航行', start: 56, end: 64, bias: null, biasW: 0 },
  { id: 'mars', label: '火星遊覧', start: 64, end: 88, bias: 'mars', biasW: 0.35 },
  { id: 'arrival', label: '帰投減速', start: 88, end: TOUR_LENGTH, bias: 'mars', biasW: 0.12 },
];

export function phaseAt(t: number): Phase {
  for (const p of PHASES) {
    if (t < p.end) return p;
  }
  return PHASES[PHASES.length - 1];
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
  { t: 65, dur: 5, text: 'ワープ完了。赤い惑星——火星です。' },
  { t: 72, dur: 7, text: '眼下はマリネリス峡谷。深さはグランドキャニオンの約4倍あります。' },
  { t: 81, dur: 6, text: '火星では、夕日が青く見えるのだそうです。' },
  { t: 89.5, dur: 6.5, text: '本日のツアーはここまで。またのご搭乗をお待ちしております。' },
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

// 世界B: 火星(原点, r=34)
export const RAIL_B: RailDef = {
  points: [
    [-260, 64, 190],
    [-160, 44, 128],
    [-70, 30, 84],
    [8, 13, 44],
    [80, 15, -8],
    [165, 36, -84],
    [300, 86, -170],
  ],
  keyframes: [
    [WORLD_SWAP_T, 0],
    [64, 0.08],
    [76, 0.45],
    [88, 0.82],
    [94, 0.95],
    [TOUR_LENGTH, 1.0],
  ],
};

export const MOON_POS: [number, number, number] = [420, 10, -260];
export const EARTH_RADIUS = 50;
export const MOON_RADIUS = 13.6;
export const MARS_RADIUS = 34;
