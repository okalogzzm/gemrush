/* ============================================================
   カードデータの自動チェック
   ============================================================ */
import { COLORS, JP, LEVELS } from './constants.ts';
import { NOBLE_DATA } from './data.ts';
import type { GemColor, Level } from './types.ts';
import { buildCards } from './utils.ts';

export interface DataCheck {
  allOk: boolean;
  lines: string[];
  table: Record<GemColor, Record<Level, number>>;
}

export function validateCardData(): DataCheck {
  const lines: string[] = [];
  let allOk = true;
  const check = (cond: boolean, text: string) => {
    lines.push((cond ? '✅ ' : '❌ ') + text);
    if (!cond) allOk = false;
  };

  const cards = buildCards();
  check(cards.length === 90, `カード総数: ${cards.length}枚（正しくは90枚）`);

  const expectLv: Record<Level, number> = { 1: 40, 2: 30, 3: 20 };
  const expectPer: Record<Level, number> = { 1: 8, 2: 6, 3: 4 };
  for (const lv of LEVELS) {
    const n = cards.filter(c => c.level === lv).length;
    check(n === expectLv[lv], `レベル${lv}: ${n}枚（正しくは${expectLv[lv]}枚）`);
  }

  // 色×レベルの表
  const table = {} as Record<GemColor, Record<Level, number>>;
  COLORS.forEach(c => { table[c] = { 1: 0, 2: 0, 3: 0 }; });
  cards.forEach(c => { if (table[c.color]) table[c.color][c.level]++; });
  for (const c of COLORS) {
    const t = table[c];
    const total = t[1] + t[2] + t[3];
    const good = total === 18 && t[1] === expectPer[1] && t[2] === expectPer[2] && t[3] === expectPer[3];
    check(good, `${JP[c]}: ${total}枚（Lv1:${t[1]} / Lv2:${t[2]} / Lv3:${t[3]}、正しくは18枚 = 8/6/4）`);
  }

  // データ形式の誤り（色の書き間違い、コストが全部0 など）
  const bad = cards.filter(c =>
    !COLORS.includes(c.color) || !LEVELS.includes(c.level) ||
    COLORS.some(k => !(Number.isInteger(c.cost[k]) && c.cost[k] >= 0)) ||
    COLORS.every(k => c.cost[k] === 0) || !Number.isInteger(c.points));
  check(bad.length === 0, `データ形式の誤り: ${bad.length}件`);

  // 完全に同じカードが2枚ないか
  const seen = new Set<string>();
  let dup = 0;
  cards.forEach(c => {
    const key = [c.level, c.color, c.points, ...COLORS.map(k => c.cost[k])].join(',');
    if (seen.has(key)) dup++;
    seen.add(key);
  });
  check(dup === 0, `同じ内容のカードの重複: ${dup}件`);

  check(NOBLE_DATA.length === 10, `貴族タイル: ${NOBLE_DATA.length}種（正しくは10種）`);

  const unsure = cards.filter(c => c.unsure).length;
  lines.push(`ℹ️ 「要確認」のカード: ${unsure}枚（src/game/data.ts のコメント参照）`);

  return { allOk, lines, table };
}
