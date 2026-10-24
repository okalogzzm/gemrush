/* ============================================================
   効果音
   ------------------------------------------------------------
   ・宝石は色ごとに違う高さの「キン」。同じ音階（ペンタトニック）から選んで、
     いくつ重なってもきれいに聞こえるようにする
   ・カードを選ぶと小鳥が「チュチュッ」、自分の番になったときもさえずる
   ・delayMs を渡すと、演出の動き（宝石が届く時など）に合わせて少しあとで鳴る
   ============================================================ */
import type { TokenColor } from '../game/types.ts';
import { seOut } from './engine.ts';
import { chirp, hz, tone, whoosh } from './synth.ts';

export type SfxName =
  | 'tap' | 'pick' | 'unpick' | 'select' | 'error'
  | 'take' | 'gemLand' | 'buy' | 'cardLand' | 'reserve' | 'gold' | 'returnGem'
  | 'noble' | 'points' | 'yourTurn' | 'win' | 'lose' | 'draw'
  | 'flap' | 'birdLand' | 'firework';

export interface SfxOptions {
  color?: TokenColor;      // 宝石の色（pick・gemLand）
  colors?: TokenColor[];   // 取った宝石（take）
  delayMs?: number;        // 何ミリ秒あとに鳴らすか
  ms?: number;             // 鳴らし続ける長さ（flap）
}

// 宝石の色ごとの高さ（C・D・E・G・A の5音から）
const GEM_NOTE: Record<TokenColor, string> = {
  white: 'C6', blue: 'D6', green: 'E6', red: 'G6', black: 'A5', gold: 'C7',
};

// 鈴のような音（倍音を少し混ぜる）
const BELL = { partials: [1, 0.3, 0.12] };

/** 効果音を鳴らす（音がオフ・まだ準備できていないときは何もしない） */
export function sfx(name: SfxName, opt: SfxOptions = {}): void {
  const o = seOut();
  if (!o) return;
  const { ctx, out } = o;
  const t = ctx.currentTime + 0.01 + Math.max(0, opt.delayMs ?? 0) / 1000;
  const gem = (c: TokenColor | undefined): number => hz(GEM_NOTE[c ?? 'white']);

  switch (name) {
    case 'tap':        // ボタンを押した「コツ」
      tone(ctx, out, t, 1200, 0.05, { vol: 0.08, freqTo: 800 });
      break;
    case 'pick':       // 宝石を選んだ
      tone(ctx, out, t, gem(opt.color), 0.35, { vol: 0.16, ...BELL });
      break;
    case 'unpick':     // 選んだ宝石を外した（低く、短く）
      tone(ctx, out, t, gem(opt.color) / 2, 0.15, { vol: 0.1 });
      break;
    case 'select':     // カードを選んだ：小鳥が「チュチュッ」
      chirp(ctx, out, t, 2, 0.1);
      break;
    case 'error':      // できない操作「ブブッ」（こわくない、やわらかい音）
      tone(ctx, out, t, 220, 0.12, { type: 'square', vol: 0.05, lowpass: 900 });
      tone(ctx, out, t + 0.14, 185, 0.16, { type: 'square', vol: 0.05, lowpass: 900 });
      break;
    case 'take':       // 宝石を取った：選んだ色の音を順に
      (opt.colors ?? []).forEach((c, i) => tone(ctx, out, t + i * 0.09, gem(c), 0.5, { vol: 0.15, ...BELL }));
      break;
    case 'gemLand':    // 宝石が手元に届いた「キン」
      tone(ctx, out, t, gem(opt.color) * 2, 0.18, { vol: 0.08 });
      break;
    case 'buy':        // カードを買った：上がっていく和音
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(ctx, out, t + i * 0.07, hz(n), 0.6, { vol: 0.14, ...BELL }));
      whoosh(ctx, out, t, 0.35, 800, 3000, 0.06);
      break;
    case 'cardLand':   // カードが置かれた「ポン」
      tone(ctx, out, t, 330, 0.12, { type: 'triangle', vol: 0.16, freqTo: 220 });
      break;
    case 'reserve':    // 予約：カードを手元へ「シュッ」
      whoosh(ctx, out, t, 0.3, 2500, 600, 0.12);
      tone(ctx, out, t + 0.05, hz('G5'), 0.3, { vol: 0.08, ...BELL });
      break;
    case 'gold':       // 金をもらった：明るい2つの音
      tone(ctx, out, t, hz('E6'), 0.4, { vol: 0.13, ...BELL });
      tone(ctx, out, t + 0.08, hz('C7'), 0.6, { vol: 0.12, ...BELL });
      break;
    case 'returnGem':  // 払った・返した宝石が場へ戻る（下がっていく）
      ['G6', 'E6', 'C6'].forEach((n, i) => tone(ctx, out, t + i * 0.06, hz(n), 0.15, { vol: 0.06 }));
      break;
    case 'noble':      // 貴族が来た：ラッパ風のファンファーレ
      fanfare(ctx, out, t, [['C5', 0], ['E5', 0.12], ['G5', 0.24], ['C6', 0.4]], 0.7);
      chirp(ctx, out, t + 0.9, 3, 0.07);
      break;
    case 'points':     // 得点が増えた「ピロン」
      tone(ctx, out, t, hz('G5'), 0.2, { vol: 0.12, ...BELL });
      tone(ctx, out, t + 0.1, hz('D6'), 0.4, { vol: 0.12, ...BELL });
      break;
    case 'yourTurn':   // 自分の番になった：小鳥のさえずり
      chirp(ctx, out, t, 3, 0.08, 3100);
      break;
    case 'win':        // 勝った：太鼓・2つの音を重ねたファンファーレ・大きな和音・小鳥たちの合唱（約5秒）
      victory(ctx, out, t);
      break;
    case 'flap':       // 羽ばたき「パタパタ」（ms のあいだ）
      for (let i = 0, n = Math.max(2, Math.round((opt.ms ?? 800) / 140)); i < n; i++) {
        whoosh(ctx, out, t + i * 0.14, 0.09, 700, 1600, 0.07 * (1 - i / (n + 2)));
      }
      break;
    case 'birdLand':   // 枝にとまって「チュチュッ」
      tone(ctx, out, t, 260, 0.08, { type: 'triangle', vol: 0.08, freqTo: 200 });
      chirp(ctx, out, t + 0.05, 3, 0.1, 2800);
      break;
    case 'firework':   // 花火「パーン」と、パチパチ
      whoosh(ctx, out, t, 0.35, 900, 200, 0.22);
      tone(ctx, out, t, 140, 0.3, { vol: 0.12, freqTo: 70 });
      for (let i = 0; i < 6; i++) tone(ctx, out, t + 0.12 + i * 0.05 + (i % 3) * 0.013, 2400 + i * 330, 0.05, { vol: 0.035 });
      break;
    case 'lose':       // 負けた：ゆっくり下がっていく、やさしい音
      ['E5', 'D5', 'C5', 'A4'].forEach((n, i) => tone(ctx, out, t + i * 0.35, hz(n), 0.9, { vol: 0.14, ...BELL }));
      break;
    case 'draw':       // 引き分け
      tone(ctx, out, t, hz('E5'), 0.6, { vol: 0.13, ...BELL });
      tone(ctx, out, t + 0.3, hz('E5'), 0.9, { vol: 0.13, ...BELL });
      break;
  }
}

// 勝ったときの曲。ドン・ドン・ドドドド…（太鼓）→ ファンファーレ → 大きな和音 → 小鳥たち
function victory(ctx: AudioContext, out: AudioNode, t: number): void {
  const drum = (at: number, vol = 0.22): void => tone(ctx, out, t + at, 110, 0.35, { vol, freqTo: 55, glide: 0.25 });
  drum(0, 0.28);
  whoosh(ctx, out, t, 0.6, 300, 4000, 0.12);  // 「シャーン」と光が広がる音
  // 1つ目のフレーズ
  const phrase1: [string, number][] = [['G4', 0.1], ['C5', 0.25], ['E5', 0.4], ['G5', 0.55], ['E5', 0.95], ['G5', 1.1], ['C6', 1.25]];
  fanfare(ctx, out, t, phrase1, 0.9);
  // 3度下の音を重ねて、2本のラッパにする
  fanfare(ctx, out, t, [['E4', 0.1], ['G4', 0.25], ['C5', 0.4], ['E5', 0.55], ['C5', 0.95], ['E5', 1.1], ['G5', 1.25]], 0.9);
  [0.55, 1.25].forEach(at => drum(at));
  // 太鼓の連打で盛り上げて…
  for (let i = 0; i < 8; i++) drum(1.9 + i * 0.07, 0.06 + i * 0.02);
  // 2つ目のフレーズ：上がっていって、いちばん高い所で大きな和音
  fanfare(ctx, out, t, [['A5', 2.0], ['B5', 2.15], ['C6', 2.3], ['D6', 2.45], ['E6', 2.6]], 1.9);
  fanfare(ctx, out, t, [['F5', 2.0], ['G5', 2.15], ['A5', 2.3], ['B5', 2.45], ['C6', 2.6]], 1.9);
  drum(2.6, 0.3);
  ['C4', 'G4', 'C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(ctx, out, t + 2.6 + i * 0.015, hz(n), 2.4, { vol: 0.07, ...BELL }));
  tone(ctx, out, t + 2.6, hz('C3'), 2.0, { type: 'triangle', vol: 0.14, partials: [1, 0.5, 0.25] });
  // キラキラ（上から下へ流れる鈴）
  ['C7', 'G6', 'E6', 'C6', 'G5', 'E6', 'G6', 'C7'].forEach((n, i) => tone(ctx, out, t + 2.75 + i * 0.07, hz(n), 0.5, { vol: 0.05, ...BELL }));
  // 小鳥たちの合唱
  [[3.4, 2600], [3.65, 3200], [3.9, 2900], [4.2, 3500], [4.45, 2700]].forEach(([at, f]) => chirp(ctx, out, t + at!, 3, 0.06, f));
}

// ラッパ風（のこぎり波を丸くした音）で、決めた時刻に音を並べる。最後の音は長くのばす
function fanfare(ctx: AudioContext, out: AudioNode, t: number, notes: [string, number][], lastLen: number): void {
  notes.forEach(([n, at], i) => {
    const len = i === notes.length - 1 ? lastLen : 0.22;
    tone(ctx, out, t + at, hz(n), len, { type: 'sawtooth', vol: 0.07, attack: 0.02, lowpass: 2000 });
    tone(ctx, out, t + at, hz(n), len, { vol: 0.08, ...BELL });
  });
}
