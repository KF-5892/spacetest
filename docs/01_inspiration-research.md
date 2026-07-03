# インスピレーション調査 — 宇宙飛行体験アプリ

- 版数: 1.0
- 作成日: 2026-07-03
- ステータス: 初版
- 関連文書: [02_requirements.md(要件定義書)](./02_requirements.md)

## 1. 調査の目的

「ディズニーランドのスターツアーズのような、宇宙を飛び回る体験ができるアプリ」を作るにあたり、
**テーマパークアトラクション・ゲーム・映画/映像・Web/VR作品**から「なぜあの体験は気持ちいいのか」を分解し、
本アプリの要件に落とし込める**体験要素**として抽出する。

抽出した要素は、要件定義書の各要件に「由来」として紐付けている(トレーサビリティ)。

---

## 2. テーマパークアトラクション

### 2.1 スターツアーズ(Star Tours / The Adventures Continue)— 本プロジェクトの原点

参照: [Wikipedia: Star Tours](https://en.wikipedia.org/wiki/Star_Tours) /
[Wikipedia: Star Tours – The Adventures Continue](https://en.wikipedia.org/wiki/Star_Tours_%E2%80%93_The_Adventures_Continue) /
[Theatrecrafts: Simulator Rides](https://www.theatrecrafts.com/pages/home/topics/themed-entertainment/disneyland-resort/simulator-rides/) /
[Enchanted Insider: Star Tours Disneyland](https://www.enchantedinsider.com/star-tours-disneyland/)

**仕組み**

- 油圧式6自由度モーションベース「ATLAS」に約40席のキャビンを載せ、正面の固定スクリーンの映像と筐体の動きを同期させる。
- ライド時間は約4分半。モーションプログラマーが映像を見ながらジョイスティックで動きを"演奏"して同期を作り込んだ。
- 現行版(The Adventures Continue)は3D映像化に加え、**シーンをモジュール化してランダムに組み合わせる**方式を採用。
  開業時点で54通り、その後のシーン追加で100通り以上の組み合わせがあり、「乗るたびに違う旅」になる。

**体験構造の分解**

| 要素 | 内容 | 本アプリへの示唆 |
|---|---|---|
| 「乗客」という役割 | 操縦者ではなくツアー客。誰でも楽しめる受動的体験 | オートパイロットの「ツアーモード」を主軸に |
| ガイドキャラクター | C-3PO(現行)や新米パイロット(初代)が実況し、感情を代弁する | ガイドAI(音声/字幕)による実況ナビ |
| ハプニングの物語装置 | 「手違いで危険区域へ」等、逸脱が非日常のスリルを正当化する | 航路イベント(小惑星帯突入など)の演出 |
| ランダム分岐 | 出発/経由/目的地の組み合わせで再搭乗価値を生む | シーンモジュール組み合わせ方式 |
| 待ち行列も体験 | 搭乗前の世界観演出(整備ドロイド、案内放送)で没入を助走させる | 発進前ブリーフィング画面 |
| モーション同期 | 映像と身体感覚の一致 | Webでは代替手段(カメラワーク、FOV演出、振動API、音)で体感を作る |

> **注意(IP)**: スターツアーズおよびスター・ウォーズはディズニー/ルーカスフィルムのIP。
> 本プロジェクトが参考にするのは**体験構造**のみであり、キャラクター・名称・音楽・世界観は一切使用しない。

### 2.2 その他のアトラクション

- **ミッション:SPACE(EPCOT)**: 遠心力で発射Gを再現。「発射シーケンス」自体が体験のクライマックスになり得ることを示す。カウントダウン→点火→加速の"儀式"は要件化する価値がある。
- **ソアリン**: 巨大視野への没入と「風・匂い」などの多感覚演出。Webでは視野(FOV)演出と音響設計が対応物になる。

---

## 3. ゲーム

参照: [Space.com: Best space flight simulation games](https://www.space.com/entertainment/space-games/best-space-flight-simulation-games-ranked) /
[GameRant: Sci-Fi Games With The Best Space Combat](https://gamerant.com/sci-fi-games-best-space-combat/) /
[Wikipedia: スターフォックスシリーズ](https://ja.wikipedia.org/wiki/%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A9%E3%83%83%E3%82%AF%E3%82%B9%E3%82%B7%E3%83%AA%E3%83%BC%E3%82%BA) /
[Next Player: レールシューター再注目の背景](https://nextplayer.jp/star-fox-style-indie-rail-shooter/)

### 3.1 スターフォックス64 — レール上で「自由に飛んでいる感覚」を作る教科書

- 強制前進(レール)でありながら、上下左右の回避・ブースト/ブレーキ・バレルロールで「操縦している実感」を与える。
- ルート分岐(惑星の選択)が周回プレイの動機になる。スターツアーズのランダム分岐の「能動版」。
- 僚機との無線会話が、一人プレイでも「賑やかな旅」にする。**実況・無線は没入の安価で強力な装置**。
- 「映画のような演出」をゲームに持ち込んだ記念碑的作品。カメラを操作から一時的に取り上げてでも見せ場を作る。

### 3.2 スター・ウォーズ:スコードロン — コックピット没入の到達点

- 完全コックピット視点+計器が実際に動くことで「機体に乗っている」実感が生まれる。
- VR対応でも酔いにくいのは**コックピットという固定参照枠**があるため(→ §5 酔い対策)。
- パワー配分などのシム要素は本アプリのスコープ外だが、「計器が生きている」ことの価値は取り入れる。

### 3.3 Everspace 2 / No Man's Sky / Elite Dangerous — ビジュアルとスケールの基準

- **Everspace 2**: 色彩豊かな星雲・小惑星帯の密度感。「宇宙=真っ黒」ではなく、絵になる宇宙の作り方の参考。
- **No Man's Sky**: 惑星への**シームレスな降下**が最大の快感ポイント。ロード画面を挟まない連続性は魔法。
- **Elite Dangerous**: 実スケールの銀河がもたらす畏怖。ただし移動の退屈さも示しており、**「リアルな距離」より「体感的なスケール感」を優先すべき**という反面教師でもある。

### 3.4 その他

- **Outer Wilds**: 手作りの小さな太陽系+好奇心駆動の探索。「全天体に個性と発見がある」設計。
- **Rez Infinite (Area X)**: 音と映像の共感覚、浮遊感。BGMとイベントの同期は体験の質を大きく上げる。
- **エースコンバットシリーズ**: ミッションブリーフィング→出撃→帰投という「儀式」の構造。無線劇。
- **SpaceEngine / Titans of Space**([Space.com: Best VR space experiences](https://www.space.com/best-vr-space-experiences)):
  実天文データに基づくプラネタリウム的体験。**「本物の宇宙である」ことが教育的価値と驚きを両立させる**。

---

## 4. 映画・映像

参照: [National Air and Space Museum: The Making of 2001's Star Gate Sequence](https://airandspace.si.edu/stories/editorial/making-2001s-star-gate-sequence)

| 作品 | シーン/技法 | 抽出する要素 |
|---|---|---|
| 2001年宇宙の旅 (1968) | スターゲイト(スリットスキャン)、ドッキングのワルツ | 抽象的な光のトンネル=ワープ演出の原型。静寂+音楽の対比 |
| スター・ウォーズ | ハイパースペース(星が線に伸びる)、デス・スター渓谷 | **最も記号として通じるワープ表現**。地形すれすれの高速飛行の爽快感 |
| インターステラー (2014) | ワームホール/ブラックホール「ガルガンチュア」(物理監修に基づく重力レンズ描画)、無音の宇宙 | 科学的に正しいビジュアルは驚異になる。船外は無音・船内に音、という音響設計 |
| ゼロ・グラビティ (2013) | 長回しの浮遊感、三人称→一人称へのシームレス切替 | カット割りしないカメラが没入を作る。視点遷移の演出 |
| ガーディアンズ・オブ・ギャラクシー | カラフルな宇宙、音楽との融合 | 宇宙を「楽しい色」で描いてよいという許可。BGM主導の演出 |

**共通の学び**: 映画の宇宙は「正確さ」と「嘘」の配合で成立している。
星の密度、音、色彩は現実より誇張し、スケール感と物理の説得力(慣性、光の挙動)は丁寧に守る。

---

## 5. Web / VR 作品(実現可能性と快適性の根拠)

### 5.1 ブラウザ(WebGL/Three.js)での先行事例

参照: [Awwwards: Equinox - A WebGL Space Adventure](https://www.awwwards.com/sites/equinox-a-webgl-space-adventure) /
[Awwwards: Space aesthetic collection](https://www.awwwards.com/inspiration/space-aesthetic) /
[EVE Frontier Map Blog: Three.js Rendering — 3D Starfield for 200,000 Systems](https://ef-map.com/blog/threejs-rendering-3d-starfield)

- 「Equinox」(Awwwards SOTD)や「Solar Journey」など、**ブラウザだけで成立する宇宙体験**は既に受賞レベルの事例が多数ある。
- Three.jsのポイントクラウドで20万個規模の星野をリアルタイム描画した技術記事もあり、性能面の実現可能性は高い。
- スクロール/カメラパス駆動の「シネマティックな移動」はWeb体験の定番パターンとして確立している。

### 5.2 VR宇宙体験

参照: [Magnopus: Mission: ISS](https://www.magnopus.com/projects/mission-iss) / [Space.com: Best VR space experiences](https://www.space.com/best-vr-space-experiences)

- **Mission: ISS**(エミー賞ノミネート、約500万人が体験)は「ガイド付きで宇宙に居る」体験の完成形。
- **Titans of Space**は約60分のガイドツアー形式で、プラネタリウム的な学びと驚きを両立。
- いずれも「ツアー形式+ガイド」という本アプリの方向性を裏付ける。VRは将来拡張(WebXR)として視野に入れる。

### 5.3 3D酔い(モーションシックネス)対策の知見

参照: [UploadVR: Five ways to reduce motion sickness in VR](https://www.uploadvr.com/five-ways-to-reduce-motion-sickness-in-vr/) /
[VRC: VR Motion Sickness — What Actually Works](https://vrc.org.au/blog/2026-03-29-vr-motion-sickness-mitigation/) /
[Seisan: Managing Motion Sickness in VR Applications](https://seisan.com/managing-motion-sickness-in-vr-applications/)

- 酔いの主因は**ベクション**(視覚は動いているのに前庭感覚は静止している不一致)。
- **コックピットなどの固定参照枠**が周辺視野に常に見えていると、脳が静止物を基準にでき、酔いが有意に減る。
- **急加速・急回転が最も酔いを誘発**する。等速移動は比較的安全。加減速はイベントとして短く、予告付きで。
- FOV制限(トンネリング)、モーション低減設定などの快適性オプションを標準装備すべき。
- → 本アプリは非VRのブラウザ体験でも同じ原理が働くため、**コックピット視点を標準**とし、快適性設定を必須要件とする。

---

## 6. 抽出した体験要素マトリクス

調査から抽出した、本アプリが実装すべき「体験の核」。IDは要件定義書から参照される。

| ID | 体験要素 | 主な由来 | 一言定義 |
|---|---|---|---|
| EX-01 | 搭乗感 | スターツアーズ、スコードロン | コックピット/キャビンという「居場所」があること |
| EX-02 | 発進の儀式 | ミッション:SPACE、エースコンバット | カウントダウン→点火→加速のクライマックス化 |
| EX-03 | ワープのカタルシス | スター・ウォーズ、2001年 | 溜め→解放の光のトンネル演出 |
| EX-04 | スケールの畏怖 | インターステラー、SpaceEngine、Elite | 惑星の巨大さ・距離を体感させる(体感優先の誇張は可) |
| EX-05 | ガイドされる安心 | スターツアーズ、Mission: ISS、Titans of Space | 実況・解説が感情の道筋を示す |
| EX-06 | ハプニングのスリル | スターツアーズ、スターフォックス | 「予定外」演出が非日常を正当化する |
| EX-07 | 再搭乗価値 | スターツアーズ(54〜100通り以上)、スターフォックス64 | シーン組み合わせ・分岐で毎回違う旅 |
| EX-08 | 音と映像の同期 | Rez Infinite、ガーディアンズ、2001年 | BGM・SE・イベントの同期。船外無音/船内音響の使い分け |
| EX-09 | シームレスな連続性 | No Man's Sky、ゼロ・グラビティ | ロード画面・カットを見せない一続きの体験 |
| EX-10 | 発見と学び | Outer Wilds、SpaceEngine、Titans of Space | 実在天体の知識が驚きを増幅する |
| EX-11 | 操縦の実感(限定的) | スターフォックス64 | レール上でも「自分で避けた/覗き込んだ」実感 |
| EX-12 | 快適性(酔わない) | VR酔い研究、スコードロン | 固定参照枠・等速基調・快適性設定 |

## 7. 結論(要件定義への引き継ぎ)

1. 主軸は**「ツアーモード」= レール(オートパイロット)上のシネマティック宇宙遊覧**。スターツアーズの体験構造(乗客・ガイド・ハプニング・ランダム分岐)を継承する。
2. ただしゲーム由来の**限定的な操作介入**(視点の自由・ちょい避け)を加え、映像視聴ではなく「体験」にする。
3. ビジュアルは映画由来の**「誇張された本物」**路線(実在太陽系×映画的演出)。
4. **コックピット固定参照枠と快適性設定**を初期から必須とする(酔い対策は後付けできない)。
5. ブラウザ(Three.js/WebGL)で受賞レベルの宇宙体験が成立することは先行事例が証明済み。**Web版をMVPとし、WebXR(VR)は将来拡張**とする。

詳細な要件は [02_requirements.md](./02_requirements.md) を参照。
