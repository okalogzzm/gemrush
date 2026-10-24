/* ============================================================
   CPU の入口
   ============================================================ */
import type { GameState, Move } from '../game/types.ts';
import { listLegalMoves } from './moves.ts';
import type { CpuLevel } from './pending.ts';
import { chooseEasy, chooseHard, chooseNormal, type HardOptions } from './strategies.ts';

export type { CpuLevel } from './pending.ts';
export { resolvePending } from './pending.ts';
export { applyMove, listLegalMoves } from './moves.ts';

export const CPU_LEVELS: Readonly<Record<CpuLevel, string>> = { easy: 'かんたん', normal: 'ふつう', hard: 'つよい' };

/** 強さに応じて手を1つ選ぶ（合法手がなければ null） */
export function chooseCpuMove(state: GameState, pi: number, level: CpuLevel, hardOpts?: HardOptions): Move | null {
  const moves = listLegalMoves(state);
  if (moves.length === 0) return null;
  if (level === 'easy') return chooseEasy(moves);
  if (level === 'normal') return chooseNormal(state, pi, moves);
  return chooseHard(state, pi, moves, hardOpts);
}
