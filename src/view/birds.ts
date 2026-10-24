/* ============================================================
   カードの鳥の絵（SVG をプログラムで描く。画像ファイルは使わない）
   ------------------------------------------------------------
   ・宝石の色（ボーナスの色）× レベル で、15種類の鳥を決める
   ・どの鳥も同じ「枝にとまった小鳥」の形を使い、色・くちばし・尾の長さ・
     冠羽などを変えて描き分ける
   ・グラデーションで丸みと陰を、細い線で羽を描いて、本物らしく見せる
   ・絵は「尾（奥）／枝（真ん中）／体（手前）」の3枚に分けて重ね、
     CSS で奥行きをつけて回すと、立体的に向きを変えて動いて見える（board.css）
   ============================================================ */
import type { GemColor } from '../game/types.ts';

type Beak = 'cone' | 'thin' | 'dagger' | 'hook';

interface Species {
  name: string;
  back: string;       // 背中・全体の色
  crown?: string;     // 頭の上
  face?: string;      // 顔（目のまわり）
  throat?: string;    // のど
  breast: string;     // 胸
  belly: string;      // おなか
  flank?: string;     // わき腹
  wing: string;       // つばさ
  wingbar?: string;   // つばさの帯
  primaries: string;  // 風切羽（つばさの先）
  tail: string;
  tailLen: number;    // 尾の長さ（10〜60）
  beak: Beak;
  beakColor: string;
  beakLower?: string; // 下のくちばし（色が違う鳥だけ）
  legs: string;
  eyeRing?: string;   // 目のまわりの輪
  mask?: string;      // 目を通る黒い帯
  brow?: string;      // 眉のような線
  cheek?: string;     // ほおの模様
  crest?: boolean;    // 冠羽（とさか）
  spots?: string;     // おなかの斑点
  sheen?: string;     // 羽のつや（光の当たる色）
}

/** 色ごとに、レベル1・2・3の鳥 */
const SPECIES: Record<GemColor, [Species, Species, Species]> = {
  white: [
    { name: 'シマエナガ', back: '#3a3436', crown: '#fbfaf6', face: '#fbfaf6', throat: '#fbfaf6', breast: '#f7f3ee', belly: '#eadbd3', flank: '#e2c3bd',
      wing: '#2e2a2b', wingbar: '#d8b2ad', primaries: '#1f1c1d', tail: '#1f1c1d', tailLen: 36, beak: 'cone', beakColor: '#222', legs: '#3b3335' },
    { name: 'ハクセキレイ', back: '#8f969e', crown: '#1d1d1f', face: '#fafafa', throat: '#fafafa', breast: '#1d1d1f', belly: '#f6f6f4',
      wing: '#2a2a2c', wingbar: '#f2f2f2', primaries: '#1b1b1d', tail: '#1d1d1f', tailLen: 32, beak: 'thin', beakColor: '#1d1d1f', legs: '#2a2a2a', mask: '#1d1d1f' },
    { name: 'ユキホオジロ', back: '#efe9dc', crown: '#e9d6b4', face: '#f8f4ea', throat: '#fbf8f0', breast: '#f8f4ea', belly: '#ffffff', cheek: '#e3c193',
      wing: '#1e1e1e', wingbar: '#fbfbf8', primaries: '#151515', tail: '#2a2a2a', tailLen: 20, beak: 'cone', beakColor: '#e8b04a', legs: '#2a2a2a' },
  ],
  blue: [
    { name: 'ルリビタキ', back: '#2f5fbf', crown: '#4a86e0', face: '#24489a', throat: '#fbf8f0', breast: '#f8f4ea', belly: '#f4f1ea', flank: '#f08a2a',
      wing: '#28509f', primaries: '#1c3876', tail: '#2a56b0', tailLen: 24, beak: 'thin', beakColor: '#222', legs: '#3a3a3a' },
    { name: 'オオルリ', back: '#1d4fb8', crown: '#3d95f2', face: '#0f1b33', throat: '#0f1b33', breast: '#14213c', belly: '#fafafa',
      wing: '#173f96', primaries: '#0f2a66', tail: '#1d4fb8', tailLen: 28, beak: 'thin', beakColor: '#151515', legs: '#2a2a2a', sheen: '#7fd0ff' },
    { name: 'カワセミ', back: '#19a3d9', crown: '#1b78b8', face: '#e8803a', throat: '#fff6e6', breast: '#e8803a', belly: '#e0742c', cheek: '#fff1dc',
      wing: '#1579b2', wingbar: '#5fd2f5', primaries: '#0f4f7a', tail: '#1572a8', tailLen: 12, beak: 'dagger', beakColor: '#1b1b1b', beakLower: '#c4402a', legs: '#e0452f', sheen: '#8ff0ff' },
  ],
  green: [
    { name: 'メジロ', back: '#86a52f', crown: '#94b336', face: '#8fae33', throat: '#f0d43a', breast: '#e6dfc0', belly: '#efeadb', flank: '#cdbf9f',
      wing: '#6e8a26', primaries: '#4f6420', tail: '#6e8a26', tailLen: 24, beak: 'thin', beakColor: '#3a3a2a', legs: '#5a5a5a', eyeRing: '#ffffff' },
    { name: 'ウグイス', back: '#7f7a45', crown: '#837e49', face: '#8a8550', throat: '#ece6cd', breast: '#ddd6b8', belly: '#ece6d0',
      wing: '#6c6838', primaries: '#55522b', tail: '#6c6838', tailLen: 30, beak: 'thin', beakColor: '#5a4a3a', legs: '#c9a58a', brow: '#ece6cd' },
    { name: 'ヤイロチョウ', back: '#3fa356', crown: '#b07a3a', face: '#1b1b1b', throat: '#ffffff', breast: '#e8d6a6', belly: '#e8414f',
      wing: '#3a9a50', wingbar: '#4fc3f0', primaries: '#1d1d1d', tail: '#2d2d2d', tailLen: 10, beak: 'thin', beakColor: '#2a2a2a', legs: '#e3a6a0', mask: '#1b1b1b', brow: '#e2c48a' },
  ],
  red: [
    { name: 'ベニマシコ', back: '#c25a50', crown: '#eaa9b2', face: '#de5b5c', throat: '#f2bcc4', breast: '#df525b', belly: '#ec9696',
      wing: '#5a3a34', wingbar: '#f4ecec', primaries: '#3c2724', tail: '#4a2f2b', tailLen: 28, beak: 'cone', beakColor: '#d9b48c', legs: '#6a4a3a' },
    { name: 'アカショウビン', back: '#c8562a', crown: '#d8662e', face: '#d8662e', throat: '#f3a466', breast: '#e98a4a', belly: '#f0a060',
      wing: '#a8441f', primaries: '#7a3015', tail: '#b04a22', tailLen: 12, beak: 'dagger', beakColor: '#e3271c', legs: '#e3271c', sheen: '#ffb380' },
    { name: 'コウカンチョウ', back: '#b8232a', crown: '#dc2c33', face: '#d82a31', throat: '#141414', breast: '#d82a31', belly: '#cf3a3f',
      wing: '#a51d24', primaries: '#6e1217', tail: '#a51d24', tailLen: 28, beak: 'cone', beakColor: '#f08a2a', legs: '#7a4a3a', mask: '#141414', crest: true },
  ],
  black: [
    { name: 'クロツグミ', back: '#1f1f24', crown: '#1f1f24', face: '#1f1f24', throat: '#1f1f24', breast: '#25252a', belly: '#f2f0ec', spots: '#1f1f24',
      wing: '#151519', primaries: '#0d0d10', tail: '#151519', tailLen: 24, beak: 'thin', beakColor: '#f2b62a', legs: '#d9a77a', eyeRing: '#f2b62a' },
    { name: 'ハシブトガラス', back: '#17171d', crown: '#1b1b22', face: '#17171d', throat: '#17171d', breast: '#1a1a20', belly: '#1d1d24',
      wing: '#121217', primaries: '#0b0b0e', tail: '#121217', tailLen: 28, beak: 'hook', beakColor: '#141414', legs: '#141414', sheen: '#5a6ad0' },
    { name: 'サンコウチョウ', back: '#3b2d3a', crown: '#141418', face: '#141418', throat: '#141418', breast: '#2a2630', belly: '#f2f0f2',
      wing: '#2a2228', primaries: '#16121a', tail: '#1d1820', tailLen: 60, beak: 'thin', beakColor: '#3a7ad8', legs: '#2a2a2a', eyeRing: '#3a8ef0', crest: true, sheen: '#8f7ad8' },
  ],
};

/** 鳥の名前 */
export function birdName(color: GemColor, level: number): string {
  return SPECIES[color][Math.min(3, Math.max(1, level)) - 1]!.name;
}

// くちばし（左向き。付け根は x=24 あたり）
const BEAKS: Record<Beak, [string, string]> = {
  cone: ['M25,37.5 Q17,38.5 14.5,42.6 L25,42.6 Z', 'M25,42.6 L14.5,42.6 Q18,46.5 25,46.5 Z'],
  thin: ['M25,39 L12,42.2 L25,42.6 Z', 'M25,42.6 L12,42.2 L25,44.8 Z'],
  dagger: ['M26,37.5 L1,42 L26,42.7 Z', 'M26,42.7 L1,42 L26,47 Z'],
  hook: ['M26,36 Q13,35 8,43.5 Q14,41.2 26,42.6 Z', 'M26,42.6 Q16,43 10,44.2 Q17,47.5 26,47.5 Z'],
};

let serial = 0; // 1枚ごとに違う id にする（同じ id が画面に何個もあると、隠れた方を参照して絵が消えることがあるため）

// 決まった並びの「でたらめ」な数（毎回同じ絵になるように、乱数は使わない）
function jitter(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// 胸・おなかの細かい羽（短い線をたくさん）
const BREAST_STROKES = Array.from({ length: 26 }, (_, i) => {
  const x = 31 + jitter(i + 1) * 26;
  const y = 36 + jitter(i + 41) * 40;
  return `M${x.toFixed(1)},${y.toFixed(1)} q1.2,1.6 0.6,3.2`;
}).join(' ');

// 背中とつばさの付け根の、うろこのような羽（3段）
const SCALLOPS = [0, 1, 2].flatMap(r => [0, 1, 2, 3].map(c => {
  const x = 50 + c * 4.6 + r * 2.6;
  const y = 37 + r * 4.6 + c * 2.2;
  return `M${x.toFixed(1)},${y.toFixed(1)} q2.3,2.6 4.6,0`;
})).join(' ');

/**
 * 鳥の絵（3枚の SVG を重ねた HTML の文字列）
 * @param seed カードごとに違う数。描き直したあとも「どの鳥が動いている途中か」を見分けるのに使う（birdMotion.ts）
 */
export function birdSVG(color: GemColor, level: number, seed = 0): string {
  const s = SPECIES[color][Math.min(3, Math.max(1, level)) - 1]!;
  const p = `b${(serial++).toString(36)}`;
  // 尾：腰 (80,60) から右下へ伸ばす（枝の向こうへ垂れる）
  const L = s.tailLen;
  const tx = 80 + L * 0.78, ty = 60 + L * 0.6;
  const tail = `M80,58 L${tx.toFixed(1)},${(ty - 2).toFixed(1)} L${(tx - 3).toFixed(1)},${(ty + 4).toFixed(1)} L74,70 Z`;
  // 体の輪郭（少し起き上がって枝にとまる姿勢。頭→背中→腰→おなか→胸→のど）
  const body = 'M29,23.5 C30,15.5 38,12.5 44,13.5 C51,15 54.5,21 54.5,27.5 C62,33.5 74,45 80,60 L75,70 C68,76.5 58,80 50,79 C38,78 30,68 29,56 C28,46 30,38 31,33 C30,31.5 29,31 29,30.5 Z';
  const [up, low] = BEAKS[s.beak];
  // くちばしは元の座標で作ってあるので、頭の位置へ動かす
  const beakT = 'translate(29.6,27) scale(.95,.8) translate(-25,-42)';
  const tailLines = [0.25, 0.5, 0.75].map(k =>
    `<path d="M${77 + k * 2},${61 + k * 6} L${(tx - 3 * k).toFixed(1)},${(ty - 2 + 6 * k).toFixed(1)}" stroke="rgba(0,0,0,.28)" stroke-width=".6"/>`).join('');
  const spots = s.spots
    ? [[37, 52], [43, 56], [50, 60], [36, 60], [44, 64], [52, 68], [40, 70], [56, 73], [33, 46]]
      .map(([x, y]) => `<path d="M${x},${y} l-1.4,2.2 l2.8,0 Z" fill="${s.spots}" opacity=".85"/>`).join('')
    : '';
  const streamers = s.tailLen > 45
    ? `<path d="M79,62 Q96,84 ${(tx + 6).toFixed(1)},${(ty - 6).toFixed(1)}" stroke="${s.tail}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M79,62 Q94,88 ${(tx - 2).toFixed(1)},${(ty + 6).toFixed(1)}" stroke="${s.tail}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` : '';

  // 色の境目をやわらかくする。ぼかしのフィルターはスマホでは重く、発熱の原因になるので、
  // 「まわりが透明になっていくグラデーション」を塗った楕円で代わりにする
  let softN = 0;
  const soft = (cx: number, cy: number, rx: number, ry: number, color: string, edge: number): string => {
    const id = `${p}s${softN++}`;
    const r = Math.min(rx, ry);
    const inner = Math.max(0, r - edge) / (r + edge);
    return `<radialGradient id="${id}"><stop offset="${inner.toFixed(2)}" stop-color="${color}"/><stop offset="${((inner + 1) / 2).toFixed(2)}" stop-color="${color}" stop-opacity=".5"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
      + `<ellipse cx="${cx}" cy="${cy}" rx="${rx + edge}" ry="${ry + edge}" fill="url(#${id})"/>`;
  };
  const vb = 'viewBox="14 1 106 94" preserveAspectRatio="xMidYMid meet"';

  // 奥：影と尾（枝の向こうへ垂れる）
  const back = `<svg class="bl-back" ${vb}>
<defs><linearGradient id="${p}tl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.tail}"/><stop offset="1" stop-color="${s.primaries}"/></linearGradient></defs>
<ellipse cx="56" cy="88" rx="22" ry="2.2" fill="#000" opacity=".12"/>
${streamers}
<path d="${tail}" fill="url(#${p}tl)"/>${tailLines}
</svg>`;

  // 真ん中：枝と葉
  const mid = `<svg class="bl-mid" ${vb}>
<defs><linearGradient id="${p}br" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a07a52"/><stop offset=".5" stop-color="#6e4f32"/><stop offset="1" stop-color="#432e1b"/></linearGradient></defs>
<path d="M-2,91 C30,86 70,87.5 142,80" stroke="url(#${p}br)" stroke-width="6.5" fill="none" stroke-linecap="round"/>
<path d="M8,89.5 l9,-1 M34,87.6 l11,-.4 M70,86.8 l8,-.6 M100,85 l9,-1 M124,82.6 l8,-1" stroke="#2f1f10" stroke-width=".7" opacity=".55"/>
<path d="M14,90.6 l6,-.6 M86,87 l6,-.5" stroke="#d9b98f" stroke-width=".6" opacity=".5"/>
<path d="M92,85.5 q7,-8 15,-10" stroke="#5a4028" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M106,75.5 q7,-7 12,1 q-7,5 -12,-1 Z" fill="#7da34a"/><path d="M106,75.5 q6,-1 12,1" stroke="#4f7230" stroke-width=".5" fill="none"/>
<path d="M99,80 q2,-10 10,-12 q-1,9 -10,12 Z" fill="#94b85a"/><path d="M99,80 q4,-7 10,-12" stroke="#5f8236" stroke-width=".45" fill="none"/>
</svg>`;

  // 手前：体・つばさ・頭
  const front = `<svg class="bl-front" ${vb}>
<defs>
<linearGradient id="${p}bk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.sheen ?? '#fff'}" stop-opacity="${s.sheen ? 0.5 : 0.12}"/><stop offset=".5" stop-color="${s.back}" stop-opacity="0"/></linearGradient>
<radialGradient id="${p}hl" cx=".3" cy=".22" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}sd" x1="0" y1="0" x2=".3" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
<linearGradient id="${p}wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s.wing}"/><stop offset=".55" stop-color="${s.wing}"/><stop offset="1" stop-color="${s.primaries}"/></linearGradient>
<radialGradient id="${p}ey" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#050505"/></radialGradient>
<clipPath id="${p}c"><path d="${body}"/></clipPath>
</defs>
<path d="${body}" fill="${s.back}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
<g clip-path="url(#${p}c)">
<rect x="0" y="0" width="140" height="100" fill="url(#${p}bk)"/>
<path d="M18,44 L33,50 C38,62 52,71 80,67 L92,110 L0,110 Z" fill="${s.belly}" stroke="${s.belly}" stroke-width="3" stroke-opacity=".4"/>
${s.flank ? soft(53, 65, 8, 7, s.flank, 2) : ''}
${soft(37, 44, 11.5, 13, s.breast, 2)}
${s.throat ? soft(33, 33, 6, 5.5, s.throat, 2) : ''}
${s.crown ? soft(44, 15, 12, 6, s.crown, 2) : ''}
${s.face ? soft(38, 23, 7.5, 5.5, s.face, 2) : ''}
${s.cheek ? soft(39, 29.5, 7, 3, s.cheek, 0.8) : ''}
${s.mask ? `<path d="M26,21 Q37,16.5 50,22 Q39,26.5 26,27 Z" fill="${s.mask}"/>` : ''}
${s.brow ? `<path d="M31,17.5 Q40,14 50.5,18" stroke="${s.brow}" stroke-width="1.6" fill="none"/>` : ''}
${spots}
<path d="${BREAST_STROKES}" stroke="rgba(0,0,0,.09)" stroke-width=".5" fill="none"/>
<path d="M44,18 q3,1 6,0 M47,22 q3,1.4 6,.6 M55,30 q4,2 8,1.5 M60,36 q4,2 8,1.5" stroke="rgba(255,255,255,.22)" stroke-width=".6" fill="none"/>
<rect x="0" y="0" width="140" height="100" fill="url(#${p}hl)"/>
<rect x="0" y="0" width="140" height="100" fill="url(#${p}sd)"/>
</g>
${s.crest ? `<path d="M39,15.5 Q43,0 54,3 Q50,10 54.5,22 Z" fill="${s.crown ?? s.back}"/><path d="M43,13 Q46,4 53,4" stroke="rgba(0,0,0,.22)" stroke-width=".6" fill="none"/>` : ''}
<g stroke="${s.legs}" stroke-width="1.7" stroke-linecap="round" fill="none"><path d="M50,77 L49,86.3 M49,86.3 l-4.2,1.2 M49,86.3 l3.4,1.8 M49,86.3 l-1,2.6"/><path d="M58,76 L58.5,86 M58.5,86 l-4.2,1.2 M58.5,86 l3.4,1.8 M58.5,86 l-1,2.6"/></g>
<path d="M47,31 C58,29.5 70,40 78,57 L87,76 C76,74.5 64,68.5 56,60 C49,52 45,42 47,31 Z" fill="url(#${p}wg)"/>
<path d="${SCALLOPS}" stroke="rgba(0,0,0,.28)" stroke-width=".6" fill="none"/>
<path d="${SCALLOPS}" stroke="rgba(255,255,255,.18)" stroke-width=".5" fill="none" transform="translate(0,-.8)"/>
${s.wingbar ? `<path d="M51,46 Q60,50 67,58" stroke="${s.wingbar}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` : ''}
<g stroke="rgba(0,0,0,.4)" stroke-width=".65" fill="none"><path d="M68,55 L86.5,75.5"/><path d="M66,58.5 L83.5,76"/><path d="M64,61.5 L80,75.5"/><path d="M62,64 L76,74"/></g>
<path d="M69,54 L86,73" stroke="rgba(255,255,255,.16)" stroke-width=".55"/>
<g transform="${beakT}"><path d="${up}" fill="${s.beakColor}"/><path d="${low}" fill="${s.beakLower ?? s.beakColor}" opacity="${s.beakLower ? 1 : 0.82}"/>
<path d="M25,39.6 L16,41.6" stroke="rgba(255,255,255,.35)" stroke-width=".7" fill="none"/></g>
${s.eyeRing ? `<circle cx="37.5" cy="21.5" r="3.9" fill="${s.eyeRing}"/>` : ''}
<circle cx="37.5" cy="21.5" r="2.6" fill="url(#${p}ey)"/><circle cx="36.6" cy="20.6" r=".85" fill="#fff" opacity=".95"/>
</svg>`;

  return `<span class="bird3d" data-bird="${color}${level}-${seed}" aria-hidden="true">${back}${mid}${front}</span>`;
}

// 飛んでいる姿のくちばしの長さ（とまっている絵と、だいたい同じ見た目にする）
const FLY_BEAK: Record<Beak, number> = { cone: 7, thin: 9, dagger: 17, hook: 9 };

/**
 * 羽を広げて飛んでいる鳥の絵（カードを買ったとき、カードの枝まで飛んでくる）。
 * 色は、とまっている絵と同じ鳥にそろえる。左向き。
 * 2枚のつばさは CSS（fx.css の .bird-fly）で上下に羽ばたかせる
 */
export function flyingBirdSVG(color: GemColor, level: number): string {
  const s = SPECIES[color][Math.min(3, Math.max(1, level)) - 1]!;
  const p = `f${(serial++).toString(36)}`;
  const body = 'M22,40 C22,32 30,30 36,32 C48,34 70,34 84,40 C78,48 62,56 46,56 C34,56 24,50 22,40 Z';
  const tx = 82 + s.tailLen * 0.5;
  const tail = `M80,39 L${tx.toFixed(1)},33 L${(tx + 2).toFixed(1)},43 L${(tx - 4).toFixed(1)},46 L78,47 Z`;
  const bl = FLY_BEAK[s.beak];
  const wing = 'M44,40 C40,24 50,8 70,2 C68,10 74,12 80,10 C74,22 66,32 60,40 Z';
  const streamers = s.tailLen > 45
    ? `<path d="M84,42 Q100,52 ${(tx + 10).toFixed(1)},50" stroke="${s.tail}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` : '';
  return `<span class="bird-fly" aria-hidden="true"><svg viewBox="0 -4 ${Math.max(120, tx + 14).toFixed(0)} 72" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="${p}w" x1="0" y1="1" x2=".6" y2="0"><stop offset="0" stop-color="${s.wing}"/><stop offset=".55" stop-color="${s.wing}"/><stop offset="1" stop-color="${s.primaries}"/></linearGradient>
<linearGradient id="${p}sd" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
<clipPath id="${p}c"><path d="${body}"/><circle cx="30" cy="40" r="11"/></clipPath>
</defs>
<g class="wing far"><path d="${wing}" fill="${s.primaries}" opacity=".85" transform="translate(7,-1)"/></g>
${streamers}
<path d="${tail}" fill="${s.tail}"/>
<path d="${body}" fill="${s.back}"/><circle cx="30" cy="40" r="11" fill="${s.crown ?? s.back}"/>
<g clip-path="url(#${p}c)">
<ellipse cx="48" cy="54" rx="22" ry="7" fill="${s.belly}"/>
${s.flank ? `<ellipse cx="58" cy="51" rx="7" ry="4" fill="${s.flank}"/>` : ''}
<ellipse cx="32" cy="50" rx="10" ry="7" fill="${s.breast}"/>
${s.throat ? `<ellipse cx="25" cy="47" rx="6" ry="4" fill="${s.throat}"/>` : ''}
${s.face ? `<ellipse cx="28" cy="41" rx="7" ry="4.5" fill="${s.face}"/>` : ''}
${s.cheek ? `<ellipse cx="30" cy="45" rx="6" ry="2.4" fill="${s.cheek}"/>` : ''}
${s.mask ? `<path d="M17,39 Q27,36 37,40 Q27,44 17,43 Z" fill="${s.mask}"/>` : ''}
<rect x="0" y="0" width="140" height="70" fill="url(#${p}sd)"/>
</g>
<path d="M21,39.5 L${21 - bl},42.6 L21,42.8 Z" fill="${s.beakColor}"/><path d="M21,42.8 L${21 - bl},42.6 L21,45 Z" fill="${s.beakLower ?? s.beakColor}"/>
${s.eyeRing ? `<circle cx="26" cy="39.5" r="3" fill="${s.eyeRing}"/>` : ''}
<circle cx="26" cy="39.5" r="2" fill="#111"/><circle cx="25.4" cy="38.9" r=".7" fill="#fff"/>
<g class="wing near"><path d="${wing}" fill="url(#${p}w)"/>
${s.wingbar ? `<path d="M50,30 Q60,26 70,24" stroke="${s.wingbar}" stroke-width="2" fill="none" stroke-linecap="round"/>` : ''}
<path d="M64,8 L58,30 M70,10 L62,32 M75,12 L66,34" stroke="rgba(0,0,0,.3)" stroke-width=".7" fill="none"/></g>
</svg></span>`;
}
