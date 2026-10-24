/* ============================================================
   CPUの判断に使う計算（カードの価値・局面の評価）
   ============================================================ */
import { COLORS, LEVELS, RULES } from '../game/constants.ts';
import { getBonus, getPoints } from '../game/rules.ts';
import type { Card, CardSource, CostMap, GameState, Noble, Player } from '../game/types.ts';
import { emptyCost } from '../game/utils.ts';

// 割引と手持ちを使っても、あと何個足りないか（金も考慮）
export function missingFor(player: Player, card: Card): number {
  const bonus = getBonus(player);
  let miss = 0;
  COLORS.forEach(c => { miss += Math.max(0, card.cost[c] - bonus[c] - player.tokens[c]); });
  return Math.max(0, miss - player.tokens.gold);
}

// 色ごとに、あと何個足りないか（金は考えない）
export function shortfall(player: Player, card: Card): CostMap {
  const bonus = getBonus(player);
  const s = emptyCost();
  COLORS.forEach(c => { s[c] = Math.max(0, card.cost[c] - bonus[c] - player.tokens[c]); });
  return s;
}

// 貴族の条件をどれだけ満たしているか（0〜1）
export function nobleProgress(noble: Noble, bonus: CostMap): number {
  let have = 0, total = 0;
  COLORS.forEach(c => { total += noble.req[c]; have += Math.min(bonus[c], noble.req[c]); });
  return total ? have / total : 1;
}

// カードの価値（点数＋割引の役立ち度＋貴族への近づき）
export function cardWorth(state: GameState, player: Player, card: Card): number {
  const bonus = getBonus(player);
  let v = card.points * 3;
  // 割引の価値：場のカードのうち、この色をまだ必要としている枚数
  for (const lv of LEVELS) {
    state.board[lv].forEach(c => { if (c && c.cost[card.color] > bonus[card.color]) v += 0.4; });
  }
  // 貴族の価値：この色が貴族の条件に足りていれば、近づくほど価値が上がる
  state.nobles.forEach(n => {
    if (n.req[card.color] > bonus[card.color]) v += 0.5 + nobleProgress(n, bonus) * 1.5;
  });
  return v;
}

export interface Target {
  card: Card;
  src: CardSource;
  worth: number;
  miss: number;
  score: number;
}

// 狙うカードの候補を「価値÷遠さ」の高い順に並べる
export function planTargets(state: GameState, player: Player): Target[] {
  const list: Target[] = [];
  for (const lv of LEVELS) {
    state.board[lv].forEach((card, i) => {
      if (card) list.push({ card, src: { type: 'board', level: lv, index: i }, worth: 0, miss: 0, score: 0 });
    });
  }
  player.reserved.forEach((card, i) => list.push({ card, src: { type: 'reserved', index: i }, worth: 0, miss: 0, score: 0 }));
  list.forEach(t => {
    t.worth = cardWorth(state, player, t.card);
    t.miss = missingFor(player, t.card);
    // 遠いカードほど大きく割り引く（序盤は安いカードで割引を増やし、後で高得点を狙う）
    t.score = t.worth / Math.pow(t.miss + 1, 1.5) + (t.src.type === 'reserved' ? 0.3 : 0);
  });
  return list.sort((a, b) => b.score - a.score);
}

// 局面の点数（プレイヤー pi から見た有利さ）。viewer は「誰の目線で見えている情報か」
export function evaluate(state: GameState, pi: number, viewer: number): number {
  if (state.phase === 'gameover') {
    const w = state.result?.winner ?? null;
    return w === null ? 0 : (w === pi ? 10000 : -10000);
  }
  return evalPlayer(state, pi, viewer) - evalPlayer(state, 1 - pi, viewer);
}

// 1人分の評価：得点・ボーナス・トークン・貴族への距離・買えそうなカード
function evalPlayer(state: GameState, i: number, viewer: number): number {
  const p = state.players[i]!;
  const bonus = getBonus(p);
  const pts = getPoints(p);
  let v = pts * 10;
  COLORS.forEach(c => { v += Math.min(bonus[c], 5) * 2.5 + Math.max(0, bonus[c] - 5) * 0.5; });
  v += COLORS.reduce((a, c) => a + p.tokens[c], 0) * 0.9 + p.tokens.gold * 1.4;
  state.nobles.forEach(n => { const pr = nobleProgress(n, bonus); v += pr * pr * 9; });
  // 近いうちに買えそうな良いカード（相手のカードを予約で奪うと、相手のここが下がる＝妨害）
  const cards: Card[] = [];
  for (const lv of LEVELS) state.board[lv].forEach(c => { if (c) cards.push(c); });
  p.reserved.forEach(c => { if (!(c.hidden && i !== viewer)) cards.push(c); });
  const vals = cards.map(c => (c.points * 3 + 1.5) / (missingFor(p, c) + 1)).sort((a, b) => b - a);
  v += (vals[0] ?? 0) * 1.2 + (vals[1] ?? 0) * 0.6 + (vals[2] ?? 0) * 0.3;
  if (pts >= RULES.WIN_POINTS) v += 40;
  return v;
}
