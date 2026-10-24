/* ============================================================
   小さな便利関数
   ============================================================ */
import { ALL_TOKENS, COLORS, JP, RULES } from './constants.ts';
import { CARD_DATA, NOBLE_DATA } from './data.ts';
import type { Card, CardSource, CostMap, Noble, Result, TokenMap } from './types.ts';

// 結果を返す形をそろえる（ok: 成功したか / msg: 失敗の理由）
export function ok(): Result { return { ok: true }; }
export function fail(msg: string): Result { return { ok: false, msg }; }

// ---------- 乱数 ----------
// テストで結果を再現できるように、乱数の出どころを差し替えられるようにしている
let rng: () => number = Math.random;

export function random(): number { return rng(); }

export function setRandomSource(fn: () => number): void { rng = fn; }

/** 種（seed）から毎回同じ並びになる乱数を作る（mulberry32） */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)] as T;
}

// 配列をシャッフルした新しい配列を返す（フィッシャー–イェーツ法）
export function shuffle<T>(array: readonly T[]): T[] {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

// ---------- 入れ物 ----------
export function emptyTokens(): TokenMap {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

export function emptyCost(): CostMap {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0 };
}

// カードデータ（配列）を扱いやすいオブジェクトに変換
export function buildCards(): Card[] {
  return CARD_DATA.map((d, i) => ({
    id: 'c' + i,
    level: d[0],
    color: d[1],
    points: d[2],
    cost: { white: d[3], blue: d[4], green: d[5], red: d[6], black: d[7] },
    unsure: d[8] === '要確認',
  }));
}

// 貴族データをオブジェクトに変換
export function buildNobles(): Noble[] {
  return NOBLE_DATA.map((d, i) => ({
    id: 'n' + i,
    points: RULES.NOBLE_POINTS,
    req: { white: d[0], blue: d[1], green: d[2], red: d[3], black: d[4] },
  }));
}

// ---------- 文章 ----------
// 「赤2・金1」のような文章にする
export function tokensText(t: Partial<TokenMap>): string {
  const parts = ALL_TOKENS.filter(c => (t[c] ?? 0) > 0).map(c => JP[c] + t[c]);
  return parts.length ? parts.join('・') : 'なし';
}

// 「レベル2・青・1点のカード」のような文章にする
export function cardLabel(card: Pick<Card, 'level' | 'color' | 'points'>): string {
  return `レベル${card.level}・${JP[card.color]}・${card.points}点のカード`;
}

// ---------- カードの場所 ----------
/** 2つの場所が同じかどうか */
export function sameSource(a: CardSource | null, b: CardSource | null): boolean {
  if (!a || !b || a.type !== b.type) return false;
  const lvA = 'level' in a ? a.level : 0;
  const lvB = 'level' in b ? b.level : 0;
  const ixA = 'index' in a ? a.index : -1;
  const ixB = 'index' in b ? b.index : -1;
  return lvA === lvB && ixA === ixB;
}

/** 宝石5色だけを数える */
export function gemCount(t: TokenMap): number {
  return COLORS.reduce((sum, c) => sum + t[c], 0);
}
