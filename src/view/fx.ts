/* ============================================================
   演出（光とアニメーション）
   ------------------------------------------------------------
   行動の前後でプレイヤーの状態を比べ、増えたもの（トークン・カード・貴族）に
   合わせて演出を出します。ルール処理には一切手を加えません。

   1つの行動の演出は、次の順で進みます。
     ① 画面の真ん中に「だれが・何をしたか」を大きく出す（名前の色の帯）
     ② 取った宝石・買ったカードが、場からその人の手元へ飛んでいく
        （買ったときは、払った宝石が手元から場へ戻っていく）
     ③ 貴族が来たら、金色の光と一緒に貴族を大きく出す
     ④ 得点が増えたら、得点の横に「+2点」が浮かぶ
     ⑤ 次が人の番なら「〇〇の番です」を出す
   それぞれの場面で、効果音も一緒に鳴らします（src/audio/sfx.ts）。
   ============================================================ */
import { settings, type Fx } from '../app/state.ts';
import { sfx } from '../audio/sfx.ts';
import { JP } from '../game/constants.ts';
import type { Card, GameState, TokenColor } from '../game/types.ts';
import { flyingBirdSVG } from './birds.ts';
import { cardBackHTML, cardHTML, nobleHTML, tokenHTML } from './components.ts';
import { $ } from './dom.ts';

export function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// 予約中の演出のタイマー（次の演出が始まったら、前の分は片付ける）
let timers: ReturnType<typeof setTimeout>[] = [];

function later(ms: number, fn: () => void): void {
  timers.push(setTimeout(fn, ms));
}

function clearFx(): void {
  timers.forEach(t => clearTimeout(t));
  timers = [];
  $('#fxLayer').innerHTML = '';
}

// 演出用の要素を出して、時間がたったら消す
function spawnFx(html: string, ms: number, cls = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.innerHTML = html;
  $('#fxLayer').appendChild(el);
  later(ms, () => el.remove());
  return el;
}

// 光の粒（放射状に飛び散る）
function sparkles(n: number, spread = 1): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = Math.round((i / n) * 360 + Math.random() * 20);
    const d = Math.round((90 + Math.random() * 90) * spread);
    s += `<i class="spark" style="--a:${a}deg;--d:${d}px;--t:${(Math.random() * 0.15).toFixed(2)}s"></i>`;
  }
  return s;
}

/** 手番の人の手元（上の席か下の席か） */
function seatOf(pi: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(pi === 0 ? '#me' : '#opp');
}

function rectOf(el: Element | null | undefined): DOMRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/**
 * 物が from から to へ飛んでいく演出。
 * html は飛ぶ物の見た目。大きさは from の大きさから始めて、to の大きさに縮む。
 */
function fly(html: string, from: DOMRect | null, to: DOMRect | null, delay: number, dur: number, onLand?: () => void): void {
  if (!from || !to) return;
  later(delay, () => {
    const el = document.createElement('div');
    el.className = 'fx-fly';
    el.innerHTML = html;
    Object.assign(el.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    $('#fxLayer').appendChild(el);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const s = Math.max(0.3, Math.min(1.2, to.width / from.width));
    // 少し持ち上げてから、弧をえがいて飛ばす
    const anim = el.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.2 },
      { transform: 'translate(0, -14px) scale(1.25)', opacity: 1, offset: 0.18 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 40}px) scale(${(1 + s) / 2 + 0.15})`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.9 },
    ], { duration: dur, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
    anim.onfinish = () => { el.remove(); onLand?.(); };
    later(dur + 400, () => el.remove());
  });
}

// 着いた場所をぴかっと光らせる
function landFlash(target: Element | null): void {
  if (!(target instanceof HTMLElement)) return;
  target.classList.remove('fx-land');
  void target.offsetWidth;
  target.classList.add('fx-land');
}

// 着いた場所の上に、小さく光の輪を出す
function ringAt(r: DOMRect | null, color = '255, 230, 140'): void {
  if (!r) return;
  const el = spawnFx('', 700, 'fx-ring-wrap');
  Object.assign(el.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, inset: 'auto' });
  el.style.setProperty('--rgb', color);
}

/**
 * 小鳥が画面の右上の外から羽ばたいて飛んできて、大きなカードの枝にとまる。
 * delay：飛び始める時刻、ms：飛んでいる時間
 */
function birdArrives(ann: HTMLElement, card: Pick<Card, 'color' | 'level'>, delay: number, ms: number): void {
  const big = ann.querySelector<HTMLElement>('.fx-big-card');
  // 何かあっても、最後には必ず鳥がとまった姿にする
  const land = (): void => {
    if (!big?.classList.contains('await-bird')) return;
    big.classList.remove('await-bird');
    big.classList.add('bird-landed');
  };
  later(delay, () => {
    const perch = rectOf(big?.querySelector('.card-bird'));
    if (!perch) { land(); return; }
    const el = document.createElement('div');
    el.className = 'fx-bird';
    el.innerHTML = flyingBirdSVG(card.color, card.level);
    // 羽を広げているので、とまった絵より少し横に大きく
    const w = perch.width * 1.15;
    const h = perch.height * 0.8;
    const x = perch.left + (perch.width - w) / 2;
    const y = perch.top + (perch.height - h) / 2 - perch.height * 0.08;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    $('#fxLayer').appendChild(el);
    // 右上の外 → 少し下がりながら近づく → 枝の少し上でふわっと止まる → とまる
    const sx = window.innerWidth - x + 30;
    const sy = -(y + h) - 20;
    const anim = el.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(0.6) rotate(-12deg)` },
      { transform: `translate(${sx * 0.45}px, ${sy * 0.12 + 36}px) scale(0.9) rotate(6deg)`, offset: 0.55 },
      { transform: 'translate(12px, -20px) scale(1.04) rotate(-8deg)', offset: 0.86 },
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
    ], { duration: ms, easing: 'cubic-bezier(.3, .1, .3, 1)', fill: 'forwards' });
    sfx('flap', { ms: ms * 0.85 });
    later(ms * 0.75, () => el.classList.add('gliding'));
    anim.onfinish = () => {
      el.remove();
      land();
      sfx('birdLand');
      ringAt(perch);
    };
    later(ms + 400, () => { el.remove(); land(); });
  });
  later(delay + ms + 600, land);
}

function cardSlot(fx: Fx): DOMRect | null {
  const src = fx.src;
  if (!src) return null;
  if (src.type === 'board') return rectOf(document.querySelector(`#cardRows [data-level="${src.level}"][data-index="${src.index}"]`));
  if (src.type === 'deck') return rectOf(document.querySelector(`#cardRows .deck[data-level="${src.level}"]`));
  return rectOf(seatOf(fx.pi)?.querySelector('.reserved'));
}

function bankTok(c: TokenColor): DOMRect | null {
  return rectOf(document.querySelector(`#bank [data-color="${c}"] .tok`));
}

function seatCell(pi: number, c: TokenColor, part: '.tok' | '.bonus-card'): Element | null {
  return seatOf(pi)?.querySelector(`.pcell[data-color="${c}"] ${part}`) ?? null;
}

/** カードの見た目（伏せ札は裏のまま） */
function cardFace(card: Card, pi: number): string {
  const hidden = card.hidden && settings.mode === 'cpu' && pi === settings.cpuIndex;
  return hidden ? cardBackHTML(card.level) : cardHTML(card, { tag: 'div' });
}

/**
 * 演出を出す。返り値は、演出が終わるまでのおおよその時間（ミリ秒）。
 * CPUは、この時間だけ待ってから考え始める（演出が重ならないように）。
 */
export function playFx(fx: Fx | null, game: GameState): number {
  if (!fx) return 0;
  // 動きを減らす設定の人には、演出は出さず、音だけで何が起きたかを伝える
  if (reducedMotion()) { actionSound(fx, game); return 0; }
  clearFx();
  const isCpu = settings.mode === 'cpu' && fx.pi === settings.cpuIndex;
  // 自分の行動は少しだけ短く（テンポよく遊べるように）
  const k = isCpu ? 1 : 0.85;
  const who = `<div class="fx-who"><span class="turn-dot p${fx.pi}"></span>${fx.name}</div>`;
  const card = fx.cards[0];
  let t = 0;   // 次の演出を始める時刻

  if (card) {
    // ===== カードを買った =====
    // 大きなカードは、はじめ枝と葉だけ。そこへ小鳥が飛んできてとまる
    const pts = card.points ? `<div class="fx-pts">+${card.points}点</div>` : '';
    const dur = 2800 * k;
    const away = dur * 0.62;  // 大きなカードが消え始めて、カードが手元へ飛んでいく時刻
    const ann = spawnFx(`<div class="fx-ann p${fx.pi}" style="--dur:${dur}ms">${who}
        <div class="fx-what">カードを購入！</div>
        <div class="fx-items">${sparkles(16)}${cardHTML(card, { cls: 'fx-shine fx-big-card await-bird', tag: 'div' })}</div>
        <div class="fx-note">${JP[card.color]}のボーナス +1</div>${pts}
      </div>`, dur, 'fx-center');
    sfx('buy');
    // 大きなカードが出そろってから（annIn の 20%）、鳥が飛んでくる
    birdArrives(ann, card, dur * 0.2, 850 * k);
    if (fx.spent.length) sfx('returnGem', { delayMs: away });
    const from = cardSlot(fx);
    const bonusEl = seatCell(fx.pi, card.color, '.bonus-card');
    fly(cardHTML(card, { tag: 'div', cls: 'fit' }), from, rectOf(bonusEl), away, 700 * k, () => {
      sfx('cardLand');
      landFlash(bonusEl);
      ringAt(rectOf(bonusEl));
    });
    // 払った宝石が場に戻っていく
    fx.spent.forEach((c, i) => {
      fly(tokenHTML(c), rectOf(seatCell(fx.pi, c, '.tok')), bankTok(c), away + 60 * i, 650 * k);
    });
    t = away + 700 * k;
  } else if (fx.reserved) {
    // ===== カードを予約した =====
    const r = fx.reservedCards[0];
    const dur = 1400 * k;
    const face = r ? cardFace(r, fx.pi) : '';
    const gold = fx.tokens.includes('gold');
    spawnFx(`<div class="fx-ann p${fx.pi}" style="--dur:${dur}ms">${who}
        <div class="fx-what">カードを予約</div>
        <div class="fx-items"><span class="fx-big-card">${face}</span>${gold ? `<span class="fx-plus">＋</span>${tokenHTML('gold', undefined, 'fx-big-tok')}` : ''}</div>
        <div class="fx-note">${gold ? '金を1個もらった' : '金は品切れ'}${r?.hidden ? '（山札から伏せたまま）' : ''}</div>
      </div>`, dur, 'fx-center');
    sfx('reserve');
    const seat = seatOf(fx.pi);
    const slots = seat?.querySelectorAll('.reserved > .card:not(.slot)');
    const dest = slots && slots.length ? slots[slots.length - 1] : null;
    if (r) fly(cardFace(r, fx.pi).replace('class="card', 'class="card fit'), cardSlot(fx), rectOf(dest), dur * 0.6, 700 * k, () => { sfx('cardLand'); landFlash(dest ?? null); });
    if (gold) {
      const goldEl = seatCell(fx.pi, 'gold', '.tok');
      fly(tokenHTML('gold'), bankTok('gold'), rectOf(goldEl), dur * 0.6 + 120, 650 * k, () => { sfx('gold'); landFlash(goldEl); });
    }
    t = dur * 0.6 + 760 * k;
  } else if (fx.tokens.length) {
    // ===== 宝石を取った =====
    const dur = 1300 * k;
    const two = fx.tokens.length === 2 && fx.tokens[0] === fx.tokens[1];
    const what = two ? `${JP[fx.tokens[0]!]}を2個取った！` : `宝石を${fx.tokens.length}個取った！`;
    spawnFx(`<div class="fx-ann p${fx.pi}" style="--dur:${dur}ms">${who}
        <div class="fx-what">${what}</div>
        <div class="fx-items">${fx.tokens.map((c, i) => tokenHTML(c, undefined, 'fx-big-tok', `style="animation-delay:${i * 90}ms"`)).join('')}</div>
      </div>`, dur, 'fx-center');
    sfx('take', { colors: fx.tokens });
    fx.tokens.forEach((c, i) => {
      const dest = seatCell(fx.pi, c, '.tok');
      fly(tokenHTML(c), bankTok(c), rectOf(dest), dur * 0.58 + i * 90, 650 * k, () => {
        sfx('gemLand', { color: c });
        landFlash(dest);
        ringAt(rectOf(dest));
      });
    });
    t = dur * 0.58 + 650 * k + fx.tokens.length * 90;
  } else if (fx.spent.length) {
    // ===== 宝石を返した（10個をこえたとき） =====
    sfx('returnGem');
  }

  // ===== 貴族が来た =====
  const noble = fx.nobles[0];
  if (noble) {
    const start = t ? t - 150 : 0;
    const dur = 1700;
    later(start, () => {
      sfx('noble');
      spawnFx(`<div class="fx-flash"></div><div class="fx-ann noble p${fx.pi}" style="--dur:${dur}ms">${who}
          <div class="fx-what">貴族が訪問！</div>
          <div class="fx-items">${sparkles(24, 1.4)}<span class="fx-big-noble">${nobleHTML(noble)}</span></div>
          <div class="fx-pts">+${noble.points}点</div>
        </div>`, dur, 'fx-center');
    });
    const ptsEl = seatOf(fx.pi)?.querySelector('.pts') ?? null;
    // 画面の真ん中に出た貴族が、その人の得点へ飛んでいく
    const center = new DOMRect(window.innerWidth / 2 - 50, window.innerHeight / 2 - 40, 100, 80);
    fly(nobleHTML(noble), center, rectOf(ptsEl), start + dur * 0.62, 650);
    t = start + dur * 0.62 + 650;
  }

  // ===== 得点が増えた：得点の横に「+〇点」 =====
  const gained = fx.cards.reduce((s, c) => s + c.points, 0) + fx.nobles.reduce((s, n) => s + n.points, 0);
  if (gained > 0) {
    const ptsEl = seatOf(fx.pi)?.querySelector('.pts') ?? null;
    later(Math.max(0, t - 200), () => {
      const r = rectOf(ptsEl);
      sfx('points');
      if (!r) return;
      const el = spawnFx(`<span class="fx-float p${fx.pi}">+${gained}点</span>`, 1300, 'fx-at');
      Object.assign(el.style, { left: `${r.left + r.width / 2}px`, top: `${r.top}px` });
      landFlash(ptsEl);
    });
    t += 300;
  }

  // ===== 次が人の番なら「〇〇の番です」 =====
  if (game.phase === 'action' && game.current !== fx.pi) {
    const next = game.players[game.current];
    const nextIsHuman = settings.mode === 'pvp' || game.current !== settings.cpuIndex;
    if (next && nextIsHuman) {
      later(t, () => {
        sfx('yourTurn');
        spawnFx(`<div class="fx-turn p${game.current}"><span class="turn-dot p${game.current}"></span>${next.name}の番です</div>`, 1100, 'fx-center');
      });
      t += 500;
    }
  }
  return Math.round(t);
}

// 演出を出さないとき（動きを減らす設定）の音。何が起きたかが分かる音を1つずつ、少しずらして鳴らす
function actionSound(fx: Fx, game: GameState): void {
  let at = 0;
  if (fx.cards.length) { sfx('buy'); at = 500; }
  else if (fx.reserved) { sfx('reserve'); if (fx.tokens.includes('gold')) sfx('gold', { delayMs: 250 }); at = 500; }
  else if (fx.tokens.length) { sfx('take', { colors: fx.tokens }); at = 500; }
  else if (fx.spent.length) { sfx('returnGem'); at = 300; }
  if (fx.nobles.length) { sfx('noble', { delayMs: at }); at += 1200; }
  const nextIsHuman = settings.mode === 'pvp' || game.current !== settings.cpuIndex;
  if (game.phase === 'action' && game.current !== fx.pi && nextIsHuman) sfx('yourTurn', { delayMs: at });
}
