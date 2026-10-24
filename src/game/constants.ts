/* ============================================================
   ゲームの定数（2人用ルール）
   ============================================================ */
import type { GemColor, Level, TokenColor } from './types.ts';

/** 宝石5色 */
export const COLORS: readonly GemColor[] = ['white', 'blue', 'green', 'red', 'black'];
/** 金を含む6種類 */
export const ALL_TOKENS: readonly TokenColor[] = [...COLORS, 'gold'];
/** カードのレベル */
export const LEVELS: readonly Level[] = [1, 2, 3];

export const JP: Readonly<Record<TokenColor, string>> = {
  white: '白', blue: '青', green: '緑', red: '赤', black: '黒', gold: '金',
};

export const RULES = {
  TOKENS_PER_COLOR: 4,  // 各色のトークン数（2人用）
  GOLD_TOKENS: 5,       // 金の数
  NOBLE_COUNT: 3,       // 場に出す貴族の数（2人用）
  NOBLE_POINTS: 3,      // 貴族1枚の点数
  WIN_POINTS: 15,       // 終了条件の点数
  MAX_TOKENS: 10,       // 手持ちトークンの上限
  MAX_RESERVED: 3,      // 予約できる最大枚数
  BOARD_SIZE: 4,        // 各レベルで場に並べる枚数
  TAKE_TWO_MIN: 4,      // 同じ色2個取りに必要な残り数
} as const;
