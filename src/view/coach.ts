/* ============================================================
   チュートリアルの案内（吹き出し）と、操作する場所を光らせる表示
   ------------------------------------------------------------
   ゲーム画面を描き直したあとに呼ぶ（描き直すと光らせた印が消えるため）
   ============================================================ */
import { STEPS, currentStep, prevStepIndex, tutorial } from '../app/tutorial.ts';
import { birdSVG } from './birds.ts';
import { $ } from './dom.ts';

let shownStep: number | null = null; // 今出している案内（同じなら作り直さず、出てくる動きをくり返さない）

export function renderCoach(): void {
  const el = $('#coach');
  const s = currentStep();
  document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
  if (!s) {
    shownStep = null;
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  for (const sel of s.focus?.() ?? []) document.querySelector(sel)?.classList.add('tut-focus');
  if (shownStep !== tutorial.step || el.hidden) {
    shownStep = tutorial.step;
    buildCoach(el);
  }
  placeNear();
}

function buildCoach(el: HTMLElement): void {
  const s = STEPS[tutorial.step];
  if (!s) return;
  const back = prevStepIndex() >= 0 ? '<button class="btn" data-act="tutBack">◀ 戻る</button>' : '';
  let btns = '';
  if (s.kind === 'end') {
    btns = `<button class="btn primary" data-act="start" data-level="easy">CPU Lv1と対戦する</button>
      <button class="btn" data-act="tutQuit">開始画面へ</button>${back}`;
  } else {
    // 相手の番の案内も「次へ」で飛ばせる（相手がまだなら、すぐ打たせる）
    const next = s.kind === 'info' || s.kind === 'wait' ? '<button class="btn primary" data-act="tutNext">次へ ▶</button>' : '';
    btns = `<button class="btn ghost" data-act="tutQuit">やめる</button><span class="coach-gap"></span>${back}${next}`;
  }
  el.className = `coach ${s.place} k-${s.kind}`;
  el.style.top = '';
  el.hidden = false;
  el.innerHTML = `<div class="coach-box" role="dialog" aria-label="チュートリアル">
    <span class="coach-arrow" hidden></span>
    <span class="coach-bird">${birdSVG('white', 1, 3)}</span>
    <div class="coach-main">
      <div class="coach-step">チュートリアル ${tutorial.step + 1} / ${STEPS.length}</div>
      <p class="coach-text">${s.text}</p>
      <div class="coach-btns">${btns}</div>
    </div>
  </div>`;
}

// 「near」の案内：光らせた所のすぐ下（入らなければすぐ上）に置き、矢印でその場所を指す
function placeNear(): void {
  const el = $('#coach');
  if (!el.classList.contains('near')) return;
  const target = document.querySelector('.tut-focus');
  const box = el.querySelector<HTMLElement>('.coach-box');
  const arrow = el.querySelector<HTMLElement>('.coach-arrow');
  if (!target || !box || !arrow) return;
  const t = target.getBoundingClientRect();
  const h = box.offsetHeight;
  const gap = 14; // 矢印の分のすき間
  const below = t.bottom + gap + h <= innerHeight - 4;
  const top = below ? t.bottom + gap : Math.max(4, t.top - gap - h);
  el.style.top = `${Math.round(top)}px`;
  el.classList.toggle('below', below);
  el.classList.toggle('above', !below);
  const b = box.getBoundingClientRect();
  const x = Math.min(Math.max(t.left + t.width / 2 - b.left, 18), b.width - 18);
  arrow.style.left = `${Math.round(x)}px`;
  arrow.hidden = false;
}

// 画面の向きや大きさが変わったら置き直す
addEventListener('resize', () => { if (currentStep()) placeNear(); });
