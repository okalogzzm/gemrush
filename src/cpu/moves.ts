/* ============================================================
   手（move）の一覧づくりと実行
   ------------------------------------------------------------
   CPUは「合法手の一覧を作る → 1つ選ぶ → ルール処理の関数で実行する」だけ。
   ルール処理（src/game/rules.ts）は変えない。
   ============================================================ */
import { COLORS, LEVELS, RULES } from '../game/constants.ts';
import {
  actBuy, actPass, actReserve, actTakeTokens, checkBuy, checkReserve, checkTakeTokens,
  currentPlayer, hasAnyLegalAction,
} from '../game/rules.ts';
import type { GameState, Move, Result } from '../game/types.ts';
import { fail, ok } from '../game/utils.ts';

// 配列から k 個を選ぶ組み合わせをすべて作る
export function combinations<T>(arr: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  arr.forEach((x, i) => combinations(arr.slice(i + 1), k - 1).forEach(rest => out.push([x, ...rest])));
  return out;
}

// 手が合法かを、ルールのチェック関数で確かめる
export function checkMove(state: GameState, m: Move): Result {
  switch (m.type) {
    case 'take':    return checkTakeTokens(state, m.colors);
    case 'reserve': return checkReserve(state, m.src);
    case 'buy':     return checkBuy(state, m.src);
    case 'pass':    return hasAnyLegalAction(state) ? fail('パスできません') : ok();
  }
}

// 手を、ルールの行動関数で実行する
export function applyMove(state: GameState, m: Move): Result {
  switch (m.type) {
    case 'take':    return actTakeTokens(state, m.colors);
    case 'reserve': return actReserve(state, m.src);
    case 'buy':     return actBuy(state, m.src);
    case 'pass':    return actPass(state);
  }
}

export interface MoveOptions {
  /** 山札からの予約を含めない（先読みでは山札の中身が分からないため） */
  noDeck?: boolean;
  /** 伏せて予約したカードの購入を含めない（相手の伏せ札は見えないため） */
  hideHidden?: boolean;
}

// 今の手番プレイヤーが選べる合法手の一覧
export function listLegalMoves(state: GameState, opts: MoveOptions = {}): Move[] {
  if (state.phase !== 'action') return [];
  const p = currentPlayer(state);
  const cands: Move[] = [];
  // 宝石を取る（異なる色）
  const avail = COLORS.filter(c => state.bank[c] > 0);
  combinations(avail, Math.min(3, avail.length)).forEach(cs => cands.push({ type: 'take', colors: cs }));
  // 宝石を取る（同じ色2個）
  COLORS.forEach(c => cands.push({ type: 'take', colors: [c, c] }));
  // 場のカードの予約・購入、山札の予約
  for (const lv of LEVELS) {
    for (let i = 0; i < RULES.BOARD_SIZE; i++) {
      const src = { type: 'board', level: lv, index: i } as const;
      cands.push({ type: 'reserve', src }, { type: 'buy', src });
    }
    if (!opts.noDeck) cands.push({ type: 'reserve', src: { type: 'deck', level: lv } });
  }
  // 予約カードの購入
  p.reserved.forEach((card, i) => {
    if (opts.hideHidden && card.hidden) return;
    cands.push({ type: 'buy', src: { type: 'reserved', index: i } });
  });
  // ルールのチェックを通ったものだけ残す
  const moves = cands.filter(m => checkMove(state, m).ok);
  if (moves.length === 0 && !hasAnyLegalAction(state)) moves.push({ type: 'pass' });
  return moves;
}
