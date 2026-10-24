/* ============================================================
   手番の途中の判断（トークン返却・貴族選択）
   ============================================================ */
import { ALL_TOKENS, COLORS } from '../game/constants.ts';
import { actChooseNoble, actDiscard, getBonus } from '../game/rules.ts';
import type { GameState, TokenColor } from '../game/types.ts';
import { emptyCost, randomPick } from '../game/utils.ts';
import { nobleProgress, planTargets } from './heuristics.ts';

export type CpuLevel = 'easy' | 'normal' | 'hard';

// トークン返却や貴族選択が残っていれば、CPUの判断で済ませる
export function resolvePending(state: GameState, pi: number, level: CpuLevel): void {
  let guard = 0;
  while (state.current === pi && guard++ < 30) {
    if (state.phase === 'discard') actDiscard(state, chooseDiscardColor(state, pi, level));
    else if (state.phase === 'noble') actChooseNoble(state, chooseNobleId(state, pi));
    else break;
  }
}

// 返すトークンを選ぶ：目標カードに要らない色から返し、金は最後まで残す
export function chooseDiscardColor(state: GameState, pi: number, level: CpuLevel): TokenColor {
  const p = state.players[pi]!;
  const have = ALL_TOKENS.filter(c => p.tokens[c] > 0);
  if (level === 'easy') return randomPick(have);
  const bonus = getBonus(p);
  const need = emptyCost();
  planTargets(state, p).slice(0, 2).forEach(t => {
    COLORS.forEach(c => { need[c] = Math.max(need[c], t.card.cost[c] - bonus[c]); });
  });
  let best = have[0] as TokenColor;
  let bestScore = -Infinity;
  have.forEach(c => {
    const s = c === 'gold' ? -99 : p.tokens[c] - need[c];
    if (s > bestScore) { bestScore = s; best = c; }
  });
  return best;
}

// 貴族を選ぶ：相手が一番近づいている貴族を取って邪魔をする
export function chooseNobleId(state: GameState, pi: number): string {
  const oppBonus = getBonus(state.players[1 - pi]!);
  const list = state.nobles.filter(n => state.nobleChoices.includes(n.id));
  list.sort((a, b) => nobleProgress(b, oppBonus) - nobleProgress(a, oppBonus));
  return list[0]!.id;
}
