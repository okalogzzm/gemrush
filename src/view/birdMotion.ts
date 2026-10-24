/* ============================================================
   小鳥をときどき動かす
   ------------------------------------------------------------
   ・全部の鳥がずっと動いていると、スマホが休めずに熱くなる。
     そこで、同時に動くのは6羽までにして、少しずつ時間をずらして1羽ずつ選び、1回だけ動かす
   ・アプリが裏にあるとき・行動の演出の最中は、新しく動かさない
   ・メニューなどの画面が上に重なっているときは、その画面の中の鳥だけを動かす
     （下に隠れたゲーム画面の鳥は動かさない）
   ・画面を描き直すと鳥の要素は作り直されるので、動いている途中だった鳥は
     resumeBirds() で続きから動かし直す
   ============================================================ */
import { random } from '../game/utils.ts';
import { $ } from './dom.ts';
import { reducedMotion } from './fx.ts';

/** 1回の動きの長さ（board.css の .bird3d.moving と同じ6秒） */
const MOTION_MS = 6000;
/** 同時に動かす鳥の数（これより少なければ、もう1羽動かす） */
const MAX_MOVING = 6;
/** 次の鳥を動かすまでの間（この範囲でばらつかせて、動き出しがそろわないようにする） */
const GAP_MIN_MS = 500;
const GAP_MAX_MS = 1200;
/** 同じ鳥がすぐにまた動かないように、動いたあとは少し休ませる */
const REST_MS = 4000;

const started = new Map<string, number>(); // 鳥の目印（data-bird）→ 動き始めた時刻
let timer: ReturnType<typeof setTimeout> | null = null;

/** ときどき鳥を動かす仕組みを始める（起動のときに1回） */
export function startBirdMotion(): void {
  // アプリが裏に回ったら止め、戻ってきたらまた始める
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer();
    else schedule();
  });
  schedule();
}

/** 描き直したあと、動いている途中だった鳥を続きから動かす */
export function resumeBirds(): void {
  const now = Date.now();
  for (const el of document.querySelectorAll<HTMLElement>('.bird3d[data-bird]')) {
    const t = started.get(el.dataset.bird ?? '');
    if (t !== undefined && now - t < MOTION_MS) play(el, now - t);
  }
}

function schedule(): void {
  stopTimer();
  timer = setTimeout(tick, GAP_MIN_MS + random() * (GAP_MAX_MS - GAP_MIN_MS));
}

function stopTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

function tick(): void {
  schedule();
  if (document.hidden || reducedMotion() || $('#fxLayer').childElementCount > 0) return;
  const now = Date.now();
  // 古い記録は消す（休み終わった鳥は、また選ばれてよい）
  for (const [key, t] of started) if (now - t > MOTION_MS + REST_MS) started.delete(key);
  const birds = visibleBirds();
  const movingNow = birds.filter(el => now - (started.get(el.dataset.bird ?? '') ?? -Infinity) < MOTION_MS).length;
  if (movingNow >= MAX_MOVING) return;
  const free = birds.filter(el => !started.has(el.dataset.bird ?? ''));
  if (free.length === 0) return;
  const el = free[Math.floor(random() * free.length)]!;
  started.set(el.dataset.bird ?? '', now);
  play(el, 0);
}

// いま見えている鳥。上に重なった画面があれば、いちばん上の画面の中の鳥だけ
function visibleBirds(): HTMLElement[] {
  const overlays = document.querySelectorAll<HTMLElement>('.overlay:not([hidden])');
  const root: ParentNode = overlays[overlays.length - 1] ?? document;
  return [...root.querySelectorAll<HTMLElement>('.bird3d[data-bird]')]
    .filter(el => el.getClientRects().length > 0 && !el.closest('#fxLayer'));
}

// elapsed ミリ秒だけ進んだところから、1回だけ動かす
function play(el: HTMLElement, elapsed: number): void {
  el.style.setProperty('--bd', `${(-elapsed / 1000).toFixed(2)}s`);
  el.classList.remove('moving');
  void el.offsetWidth; // 付け直したときに、動きが最初からやり直しになるように
  el.classList.add('moving');
  // 動き終わったら外す（止まっている鳥は、画面の描き直しの負担にならない）
  el.onanimationend = e => { if (e.target === el) el.classList.remove('moving'); };
}
