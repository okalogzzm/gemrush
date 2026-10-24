/* ============================================================
   強さ別：手の選び方
   ============================================================ */
import { COLORS, RULES } from '../game/constants.ts';
import { getCardAt, tokenCount } from '../game/rules.ts';
import type { CostMap, GameState, Level, Move } from '../game/types.ts';
import { emptyCost, random, randomPick, shuffle } from '../game/utils.ts';
import { cardWorth, evaluate, planTargets, shortfall } from './heuristics.ts';
import { applyMove, listLegalMoves } from './moves.ts';
import { resolvePending } from './pending.ts';

export const HARD = {
  MAX_DEPTH: 3,     // 最大で何手先まで読むか（自分→相手→自分）
  TIME_LIMIT: 800,  // 考える時間の上限（ミリ秒）。スマホで重くならないように
  BEAM: 8,          // 各局面で読む候補手を上位いくつに絞るか
  ROOT_BEAM: 14,    // 最初の局面で比べる候補手の数
} as const;

// ---------- かんたん ----------
// 買えるなら高確率で買う。それ以外はほぼランダム（予約は少なめ）
export function chooseEasy(moves: Move[]): Move {
  const buys = moves.filter(m => m.type === 'buy');
  if (buys.length && random() < 0.85) return randomPick(buys);
  const weighted = moves.map(m => ({ m, w: m.type === 'reserve' ? 0.2 : 1 }));
  let r = random() * weighted.reduce((a, x) => a + x.w, 0);
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.m; }
  return moves[0]!;
}

// ---------- ふつう ----------
// 目標カードを決めて、そのための宝石を集める
export function chooseNormal(state: GameState, pi: number, moves: Move[]): Move {
  const p = state.players[pi]!;
  const targets = planTargets(state, p);
  const top = targets[0];

  // (1) 買えるカードがあれば、基本的に一番価値の高いものを買う
  //     （目標があと1個で買えるのに、価値の低いカードで宝石を使ってしまう場合だけは見送る）
  const buys = moves
    .filter((m): m is Extract<Move, { type: 'buy' }> => m.type === 'buy')
    .map(m => ({ m, w: cardWorth(state, p, getCardAt(state, m.src)!) }))
    .sort((a, b) => b.w - a.w);
  const bestBuy = buys[0];
  if (bestBuy && !(top && top.miss === 1 && bestBuy.w < top.worth * 0.3)) return bestBuy.m;

  // (2) 目標カードに足りない色を優先して取る（2番目・3番目の候補に要る色も少し加点）
  const need0: CostMap = top ? shortfall(p, top.card) : emptyCost();
  const needOther = emptyCost();
  targets.slice(1, 3).forEach(t => { const s = shortfall(p, t.card); COLORS.forEach(c => (needOther[c] += s[c])); });
  const room = RULES.MAX_TOKENS - tokenCount(p);
  let bestTake: Move | null = null;
  let bestScore = -Infinity;
  moves.forEach(m => {
    if (m.type !== 'take') return;
    const cnt = emptyCost();
    m.colors.forEach(c => (cnt[c] += 1));
    let s = 0;
    for (const c of COLORS) {
      if (!cnt[c]) continue;
      const a = Math.min(cnt[c], need0[c]);          // 目標に使える数
      const b = Math.min(cnt[c] - a, needOther[c]);  // 他の候補に使える数
      s += a * 3 + b + (cnt[c] - a - b) * 0.2;
    }
    const over = m.colors.length - room;           // 10個を超えて返すことになる数
    if (over > 0) s -= over * 2.5;
    s += random() * 0.1;                            // 同点のときに少しばらつかせる
    if (s > bestScore) { bestScore = s; bestTake = m; }
  });

  // (3) 宝石では目標に近づけないときだけ、点数のあるカードを予約（金ももらえる）
  if (p.reserved.length < 2 && bestScore < 1 && tokenCount(p) < RULES.MAX_TOKENS) {
    const t = targets.find(x => x.src.type === 'board' && x.card.points >= 1);
    const m = t && moves.find(x => x.type === 'reserve' && x.src.type === 'board' && t.src.type === 'board' &&
      x.src.level === t.src.level && x.src.index === t.src.index);
    if (m) return m;
  }
  if (bestTake) return bestTake;
  if (bestBuy) return bestBuy.m;
  return moves.find(m => m.type === 'reserve') ?? moves[0]!;
}

// ---------- つよい ----------
// 数手先まで読む（ミニマックス法＋アルファベータ枝刈り）

export interface HardOptions {
  /** 考える時間の上限（ミリ秒）。テストでは長くして結果を安定させる */
  timeLimit?: number;
}

interface SearchContext { deadline: number; timedOut: boolean }
interface Child { move: Move; child: GameState; score: number }

export function chooseHard(state: GameState, pi: number, moves: Move[], opts: HardOptions = {}): Move {
  const ctx: SearchContext = { deadline: Date.now() + (opts.timeLimit ?? HARD.TIME_LIMIT), timedOut: false };
  // 山札の中身は分からないので、先読み用のコピーでは山札を混ぜ直す
  const root = cloneState(state, true);
  const rootMoves = orderMoves(root, pi, HARD.ROOT_BEAM);
  if (rootMoves.length === 0) return chooseNormal(state, pi, moves);
  let bestMove = rootMoves[0]!.move;
  // 1手先 → 2手先 → 3手先 と、時間が許す限り深く読む
  for (let depth = 1; depth <= HARD.MAX_DEPTH; depth++) {
    let best = -Infinity;
    let bm: Move | null = null;
    for (const k of rootMoves) {
      const v = search(k.child, depth - 1, best, Infinity, pi, ctx);
      if (ctx.timedOut) break;
      if (v > best) { best = v; bm = k.move; }
    }
    if (ctx.timedOut) break; // 読み切れなかった深さの結果は使わない
    if (bm) bestMove = bm;
  }
  return bestMove;
}

// 先読み本体：CPUの番は点数が最大、相手の番は最小になる手を選ぶと考える
function search(state: GameState, depth: number, alpha: number, beta: number, pi: number, ctx: SearchContext): number {
  if (depth === 0 || state.phase === 'gameover') return evaluate(state, pi, pi);
  if (Date.now() > ctx.deadline) { ctx.timedOut = true; return 0; }
  const kids = orderMoves(state, pi, HARD.BEAM);
  if (kids.length === 0) return evaluate(state, pi, pi);
  if (state.current === pi) {
    let best = -Infinity;
    for (const k of kids) {
      const v = search(k.child, depth - 1, alpha, beta, pi, ctx);
      if (ctx.timedOut) return 0;
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break; // これ以上読んでも結果が変わらないので打ち切り
    }
    return best;
  }
  let best = Infinity;
  for (const k of kids) {
    const v = search(k.child, depth - 1, alpha, beta, pi, ctx);
    if (ctx.timedOut) return 0;
    best = Math.min(best, v);
    beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return best;
}

// 候補手を実際に試して、手番の人にとって良さそうな順に並べ、上位だけ残す
function orderMoves(state: GameState, pi: number, limit: number): Child[] {
  const mover = state.current;
  let moves = listLegalMoves(state, { noDeck: true, hideHidden: mover !== pi });
  if (moves.length === 0) moves = listLegalMoves(state);
  return moves
    .map(m => { const child = simulate(state, m); return { move: m, child, score: evaluate(child, mover, pi) }; })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// 先読み用に状態をコピーする（本物のゲームは変えない）
export function cloneState(s: GameState, shuffleDecks: boolean): GameState {
  const deck = (lv: Level) => (shuffleDecks ? shuffle(s.decks[lv]) : s.decks[lv].slice());
  const decks = { 1: deck(1), 2: deck(2), 3: deck(3) };
  const board = { 1: s.board[1].slice(), 2: s.board[2].slice(), 3: s.board[3].slice() };
  return {
    ...s,
    players: s.players.map(p => ({
      name: p.name,
      tokens: { ...p.tokens },
      cards: p.cards.slice(),
      reserved: p.reserved.map(c => ({ ...c })),
      nobles: p.nobles.slice(),
    })),
    bank: { ...s.bank },
    decks,
    board,
    nobles: s.nobles.slice(),
    nobleChoices: s.nobleChoices.slice(),
    pendingDiscard: { ...s.pendingDiscard },
    log: [],
  };
}

// コピーの上で手を試す（返却・貴族選択も自動で済ませる）
function simulate(state: GameState, move: Move): GameState {
  const s = cloneState(state, false);
  applyMove(s, move);
  resolvePending(s, s.current, 'normal');
  return s;
}
