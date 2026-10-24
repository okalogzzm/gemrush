/* ============================================================
   CPUの手番の進行（画面側）
   ------------------------------------------------------------
   CPUの番になったら「考え中…」を出したまま約1秒待ち、行動させる。
   ============================================================ */
import { applyMove, chooseCpuMove, listLegalMoves, resolvePending } from '../cpu/index.ts';
import type { Move } from '../game/types.ts';
import { isCpuTurn, resetSelection, settings, store, ui } from './state.ts';
import { beginAction, endAction } from './tracker.ts';

export const CPU_DELAY = 1000; // CPUが行動するまでの待ち時間（考える時間も含む・ミリ秒）

let cpuTimer: ReturnType<typeof setTimeout> | null = null;
let gameSerial = 0; // 新しいゲームのたびに増やす（前のゲームのCPU予約を無効にする）

export function stopCpu(): void {
  if (cpuTimer) clearTimeout(cpuTimer);
  cpuTimer = null;
  gameSerial++;
}

/**
 * CPUの番なら行動を予約する。
 * @param onMoved 行動のあとに呼ぶ（画面の描き直し）
 * @param isPaused true の間は動かさない（開始画面を開いている間など）
 * @param waitFx 直前の演出が終わるまでの時間（ミリ秒）。この分だけ長く待つ
 */
export function scheduleCpu(onMoved: () => void, isPaused: () => boolean, waitFx = 0): void {
  if (!isCpuTurn() || cpuTimer || isPaused()) return;
  const serial = gameSerial;
  const startedAt = Date.now();
  // まず画面に「考え中…」を出してから考え始める
  cpuTimer = setTimeout(() => {
    if (serial !== gameSerial || !store.game) return;
    let move: Move | null = null;
    try { move = chooseCpuMove(store.game, settings.cpuIndex, settings.level); } catch (err) { console.error(err); }
    const wait = Math.max(0, waitFx + CPU_DELAY - (Date.now() - startedAt));
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      if (serial !== gameSerial) return;
      runCpuMove(move);
      onMoved();
    }, wait);
  }, 50);
}

// 選んだ手を実行する（返却・貴族選択もCPUが済ませる）
function runCpuMove(move: Move | null): void {
  const game = store.game;
  if (!game) return;
  const pi = settings.cpuIndex;
  const before = beginAction(game);
  const r = move ? applyMove(game, move) : { ok: false as const, msg: '手がありません' };
  if (!r.ok) {
    // 念のため：選んだ手が使えなければ、合法手の先頭で代わりに行動
    const m = listLegalMoves(game)[0];
    if (m) applyMove(game, m);
  }
  resolvePending(game, pi, settings.level);
  resetSelection();
  ui.message = '';
  const src = move && (move.type === 'buy' || move.type === 'reserve') ? move.src : null;
  ui.fx = endAction(before, game, pi, src);
}
