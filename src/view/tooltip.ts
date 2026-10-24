/* ============================================================
   買ったカードの詳しい表示（吹き出し）
   ------------------------------------------------------------
   ・席の色のマス（トークンとボーナス）にカーソルを当てると、
     その色で買ったカードの一覧を吹き出しで出す
   ・「▮〇枚」に当てると、買ったカードを色ごとに全部出す
   ・スマホではタップで出し、もう一度どこかをタップすると消える
   ゲームの状態を読むだけで、ルールには触れない。
   ============================================================ */
import { store } from '../app/state.ts';
import { COLORS, JP } from '../game/constants.ts';
import { getBonus } from '../game/rules.ts';
import type { Card, GemColor, TokenColor } from '../game/types.ts';
import { cardHTML } from './components.ts';
import { $ } from './dom.ts';

let shownFor: HTMLElement | null = null;

function cardsHTML(cards: Card[]): string {
  return `<div class="tip-cards">${cards.map(c => cardHTML(c, { tag: 'div', cls: 'tip-card' })).join('')}</div>`;
}

/** 吹き出しの中身 */
function tipBody(pi: number, color: TokenColor | 'all'): string {
  const p = store.game?.players[pi];
  if (!p) return '';
  const pts = (cards: Card[]) => cards.reduce((s, c) => s + c.points, 0);
  if (color === 'all') {
    const groups = COLORS.map(c => ({ c, cards: p.cards.filter(x => x.color === c) })).filter(g => g.cards.length);
    if (!groups.length) return `<div class="tip-head">${p.name}が買ったカード</div><div class="tip-none">まだありません</div>`;
    return `<div class="tip-head">${p.name}が買ったカード（${p.cards.length}枚・カードの点 ${pts(p.cards)}点）</div>
      ${groups.map(g => `<div class="tip-sub">${JP[g.c]} ${g.cards.length}枚</div>${cardsHTML(g.cards)}`).join('')}`;
  }
  if (color === 'gold') {
    return `<div class="tip-head">${p.name}の金トークン ${p.tokens.gold}個</div><div class="tip-none">金はどの色の代わりにも使えます（予約でもらえる）</div>`;
  }
  const cards = p.cards.filter(x => x.color === color);
  const bonus = getBonus(p)[color as GemColor];
  return `<div class="tip-head">${p.name}の${JP[color]}：トークン${p.tokens[color]}個・ボーナス${bonus}</div>
    ${cards.length ? `<div class="tip-sub">買った${JP[color]}のカード ${cards.length}枚（${pts(cards)}点）</div>${cardsHTML(cards)}`
      : `<div class="tip-none">${JP[color]}のカードはまだ買っていません</div>`}`;
}

/** el（data-pi・data-color を持つ要素）の近くに吹き出しを出す */
export function showCardTip(el: HTMLElement): void {
  const pi = Number(el.dataset.pi);
  const color = (el.dataset.color ?? 'all') as TokenColor | 'all';
  const tip = $('#cardTip');
  tip.innerHTML = tipBody(pi, color);
  tip.hidden = false;
  shownFor = el;
  // 席が下（自分）なら上に、上（相手）なら下に出す。左右は画面からはみ出さないように
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(window.innerWidth - t.width - margin, Math.max(margin, r.left + r.width / 2 - t.width / 2));
  const below = r.top < window.innerHeight / 2;
  const top = below ? r.bottom + 6 : r.top - t.height - 6;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(Math.max(margin, Math.min(window.innerHeight - t.height - margin, top)))}px`;
}

export function hideCardTip(): void {
  shownFor = null;
  const tip = document.querySelector<HTMLElement>('#cardTip');
  if (tip) tip.hidden = true;
}

/** タップのとき：同じ所をもう一度タップしたら消す */
export function toggleCardTip(el: HTMLElement): void {
  if (shownFor === el && !$('#cardTip').hidden) hideCardTip();
  else showCardTip(el);
}

/** カーソル（マウス）を当てたら出し、離れたら消す */
export function initCardTip(): void {
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
    if (el && el !== shownFor) showCardTip(el);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType !== 'mouse' || !shownFor) return;
    const to = e.relatedTarget as Node | null;
    if (to && shownFor.contains(to)) return;
    const from = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
    if (from === shownFor) hideCardTip();
  });
}
