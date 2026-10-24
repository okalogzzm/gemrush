/* ============================================================
   画面の部品（HTMLの文字列を作るだけ）
   ============================================================ */
import { COLORS, JP } from '../game/constants.ts';
import type { Card, Noble, TokenColor } from '../game/types.ts';
import { cardLabel } from '../game/utils.ts';

/** 宝石のモチーフ（色ごとに形が違う） */
export function gemShape(color: TokenColor, cls = ''): string {
  return `<span class="gem-shape s-${color} c-${color} ${cls}"></span>`;
}

/** 丸い宝石トークン（inner：中に表示するもの） */
export function tokenHTML(
  color: TokenColor, inner: string | number = gemShape(color), cls = '', attrs = '', tag: 'span' | 'button' = 'span',
): string {
  return `<${tag} class="tok c-${color} ${cls}" ${attrs}>${inner}</${tag}>`;
}

export interface CardOptions {
  attrs?: string;
  cls?: string;
  tag?: 'button' | 'div' | 'span';
  /** カードの上に重ねる印（NEW など） */
  badge?: string;
}

type CardLike = Pick<Card, 'level' | 'color' | 'points' | 'cost'>;

/** 発展カード1枚分 */
export function cardHTML(card: CardLike, opts: CardOptions = {}): string {
  const { attrs = '', cls = '', tag = 'button', badge = '' } = opts;
  const costs = COLORS.filter(c => card.cost[c] > 0)
    .map(c => tokenHTML(c, card.cost[c], 'mini', `title="${JP[c]}${card.cost[c]}"`)).join('');
  return `<${tag} class="card c-${card.color} ${cls}" ${attrs} aria-label="${cardLabel(card)}">
    ${gemShape(card.color, 'bg-gem')}
    <div class="card-head"><span class="card-pts">${card.points || ''}</span>${gemShape(card.color)}</div>
    <div class="card-cost">${costs}</div>${badge}
  </${tag}>`;
}

/** 伏せ札（中身が見えないカード） */
export function cardBackHTML(level: number, cls = '', badge = ''): string {
  return `<div class="card back ${cls}"><span>Lv${level}<br>伏せ札</span>${badge}</div>`;
}

/** 貴族タイル1枚分（attrs があればボタンにする） */
export function nobleHTML(n: Pick<Noble, 'points' | 'req'>, attrs = '', cls = ''): string {
  const req = COLORS.filter(c => n.req[c] > 0)
    .map(c => `<span class="req-chip c-${c}" title="${JP[c]}のボーナス${n.req[c]}枚">${n.req[c]}</span>`).join('');
  const tag = attrs ? 'button' : 'div';
  return `<${tag} class="noble ${cls}" ${attrs}><span class="noble-top"><span class="crown"></span><span class="np">${n.points}</span></span><span class="req">${req}</span></${tag}>`;
}

/** 新しく出たカードに付ける印 */
export const NEW_BADGE = '<span class="new-badge" aria-label="新しいカード">NEW</span>';
