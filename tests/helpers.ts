/* テスト用の小道具 */
import { ALL_TOKENS, COLORS, LEVELS } from '../src/game/constants.ts';
import { createGame, getPoints } from '../src/game/rules.ts';
import type { Card, GameState, GemColor, Level, Noble, TokenMap } from '../src/game/types.ts';
import { createSeededRandom, emptyCost, setRandomSource } from '../src/game/utils.ts';

/** 毎回同じ結果になるように乱数を固定してゲームを作る */
export function seededGame(seed = 1, names = ['あなた', 'CPU']): GameState {
  setRandomSource(createSeededRandom(seed));
  const g = createGame(names);
  // テストで手番を決めやすいよう、先手を0番にそろえる
  g.current = 0;
  g.startPlayer = 0;
  return g;
}

let nextId = 1000;
/** 好きな内容のカードを作る */
export function makeCard(color: GemColor, points: number, cost: Partial<Record<GemColor, number>>, level: Level = 1): Card {
  return { id: 't' + nextId++, level, color, points, cost: { ...emptyCost(), ...cost }, unsure: false };
}

export function makeNoble(id: string, req: Partial<Record<GemColor, number>>): Noble {
  return { id, points: 3, req: { ...emptyCost(), ...req } };
}

/** 場・山札・手持ち・予約にあるカードの合計枚数 */
export function totalCards(g: GameState): number {
  let n = 0;
  for (const lv of LEVELS) n += g.decks[lv].length + g.board[lv].filter(Boolean).length;
  g.players.forEach(p => { n += p.cards.length + p.reserved.length; });
  return n;
}

/** 銀行＋全員の手持ちのトークン数（色ごと） */
export function totalTokens(g: GameState): TokenMap {
  const t = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
  ALL_TOKENS.forEach(c => {
    t[c] = g.bank[c] + g.players.reduce((s, p) => s + p.tokens[c], 0);
  });
  return t;
}

export function scoreOf(g: GameState, pi: number): number {
  return getPoints(g.players[pi]!);
}

export { COLORS };
