/* ============================================================
   勝敗の画面（ゲームが終わったときに重ねて出す）
   ------------------------------------------------------------
   ・勝ったとき：回る光・紙吹雪・花火・トロフィーで盛大にお祝いする
   ・CPUに負けたとき：落ち着いた画面で結果だけを見せる
   ・2人対戦：勝った人をお祝いする
   ルールには触れず、終わった GameState を読むだけ。
   ============================================================ */
import { settings } from '../app/state.ts';
import { duckBgm } from '../audio/engine.ts';
import { sfx } from '../audio/sfx.ts';
import { COLORS } from '../game/constants.ts';
import { getPoints } from '../game/rules.ts';
import type { GameState, TokenColor } from '../game/types.ts';
import { gemShape } from './components.ts';
import { $ } from './dom.ts';
import { reducedMotion } from './fx.ts';

type Mood = 'win' | 'lose' | 'draw';

let shownFor: GameState | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;

/** 終わったゲームの結果を、まだ見せていなければ見せる（演出が終わるのを待ってから） */
export function showResultOnce(game: GameState, delay: number): void {
  if (game.phase !== 'gameover' || shownFor === game) return;
  shownFor = game;
  if (showTimer) clearTimeout(showTimer);
  showTimer = setTimeout(() => { showTimer = null; showResult(game); }, delay);
}

/** 勝敗の画面を閉じる（盤面を見たいとき） */
export function hideResult(): void {
  if (showTimer) { clearTimeout(showTimer); showTimer = null; }
  const el = $('#resultScreen');
  el.hidden = true;
  el.innerHTML = '';
}

function moodOf(game: GameState): Mood {
  const w = game.result?.winner;
  if (w === null || w === undefined) return 'draw';
  if (settings.mode === 'cpu' && w === settings.cpuIndex) return 'lose';
  return 'win';
}

/** 勝敗の画面を出す */
export function showResult(game: GameState): void {
  const mood = moodOf(game);
  const w = game.result?.winner ?? null;
  const winner = w !== null ? game.players[w] : null;
  const calm = reducedMotion();
  // 勝敗の音を目立たせるため、そのあいだ BGM は小さくする
  duckBgm(mood === 'win' ? 4 : 3);
  sfx(mood);

  const title = mood === 'win' ? '勝利！' : mood === 'lose' ? '負けてしまった…' : '引き分け';
  const sub = mood === 'win'
    ? (settings.mode === 'cpu' ? 'おめでとう！ あなたの勝ちです' : `おめでとう！ ${winner?.name ?? ''}の勝ち！`)
    : mood === 'lose' ? `${winner?.name ?? 'CPU'}の勝ち。次はきっと勝てる！` : 'どちらも一歩もゆずらない名勝負！';

  const scores = game.players.map((p, pi) => `
    <div class="res-player p${pi} ${w === pi ? 'won' : ''}">
      ${w === pi ? '<span class="res-medal">WIN</span>' : ''}
      <div class="res-name">${p.name}</div>
      <div class="res-pts"><span class="count" data-to="${getPoints(p)}">${calm ? getPoints(p) : 0}</span><small>点</small></div>
      <div class="res-meta">カード${p.cards.length}枚・貴族${p.nobles.length}</div>
    </div>`).join('<div class="res-vs">VS</div>');

  const party = mood === 'win' && !calm ? confetti(70) + fireworks(6) : mood === 'draw' && !calm ? fireworks(3) : '';
  const trophy = mood === 'lose'
    ? `<div class="res-icon lose">${gemShape('blue')}</div>`
    : `<div class="res-icon"><span class="res-crown"></span><span class="res-gems">${gemShape('red')}${gemShape('gold')}${gemShape('blue')}</span></div>`;

  const el = $('#resultScreen');
  el.className = `overlay result ${mood}`;
  el.innerHTML = `
    ${mood !== 'lose' ? '<div class="res-rays"></div>' : ''}
    <div class="res-party" aria-hidden="true">${party}</div>
    <div class="res-box" role="dialog" aria-label="ゲームの結果">
      ${trophy}
      <div class="res-title" data-text="${title}">${title}</div>
      <div class="res-sub">${sub}</div>
      <div class="res-scores">${scores}</div>
      <div class="res-detail">${game.result?.detail ?? ''}　（${game.round}ラウンド）</div>
      <div class="res-btns">
        <button class="btn primary big" data-act="newgame">もう一度遊ぶ</button>
        <button class="btn big" data-act="closeResult">盤面を見る</button>
      </div>
    </div>`;
  el.hidden = false;
  el.scrollTop = 0;
  if (!calm) countUp(el);
}

// 得点の数字を 0 から数え上げる
function countUp(root: HTMLElement): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('.count'));
  const start = performance.now() + 500; // タイトルが出てから数え始める
  const dur = 1200;
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / dur));
    const e = 1 - Math.pow(1 - t, 3);
    els.forEach(x => { x.textContent = String(Math.round(Number(x.dataset.to) * e)); });
    if (t < 1 && !root.hidden) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const PARTY_COLORS: TokenColor[] = [...COLORS, 'gold', 'gold'];

// 紙吹雪：宝石の形をした小さな粒が、ゆらゆら降り続ける
function confetti(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const c = PARTY_COLORS[i % PARTY_COLORS.length]!;
    const x = (Math.random() * 100).toFixed(1);
    const size = Math.round(8 + Math.random() * 10);
    const dur = (2.6 + Math.random() * 2.6).toFixed(2);
    const delay = (-Math.random() * 5).toFixed(2);
    const sway = Math.round(-40 + Math.random() * 80);
    s += `<i class="confetti gem-shape s-${c} c-${c}" style="--x:${x}vw;--gs:${size}px;--dur:${dur}s;--delay:${delay}s;--sway:${sway}px"></i>`;
  }
  return s;
}

// 花火：画面のあちこちで、光の粒が丸く広がる（くり返し）
function fireworks(n: number): string {
  const hues = ['255, 211, 110', '120, 200, 255', '255, 120, 140', '140, 255, 180', '220, 160, 255'];
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = (10 + Math.random() * 80).toFixed(0);
    const y = (8 + Math.random() * 45).toFixed(0);
    const delay = (i * 0.45 + Math.random() * 0.3).toFixed(2);
    const rgb = hues[i % hues.length]!;
    let sparks = '';
    for (let k = 0; k < 18; k++) sparks += `<i style="--a:${k * 20}deg"></i>`;
    s += `<span class="firework" style="left:${x}%;top:${y}%;--delay:${delay}s;--rgb:${rgb}">${sparks}</span>`;
  }
  return s;
}
