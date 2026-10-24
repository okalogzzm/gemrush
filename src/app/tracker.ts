/* ============================================================
   手番の変化を記録する（「直前の行動」と「NEW」表示のため）
   ------------------------------------------------------------
   ・行動の前に beginAction() で控えを取り、後で endAction() で比べる
   ・手番の最初の行動のときに、その手番の控えも取っておく
     （返却・貴族選択まで含めた「手番全体」の変化を出すため）
   ============================================================ */
import { diffPlayer, newBoardCardIds, snapshot, type Snapshot } from '../game/diff.ts';
import { ALL_TOKENS } from '../game/constants.ts';
import type { CardSource, GameState, TokenColor } from '../game/types.ts';
import { settings, ui, type Fx } from './state.ts';

let turnStart: { pi: number; snap: Snapshot } | null = null;

/** 行動の直前に呼ぶ。返り値は endAction() に渡す */
export function beginAction(state: GameState): Snapshot {
  const snap = snapshot(state);
  if (state.phase === 'action') {
    // 新しい手番の始まり
    turnStart = { pi: state.current, snap };
    // 「NEW」は、あなたの前の手番からの分を出す。
    // CPU対戦ではあなたの手番の始まりで、2人対戦では毎手番の始まりでリセット
    if (settings.mode === 'pvp' || state.current !== settings.cpuIndex) ui.newCards.clear();
  }
  return snap;
}

/**
 * 行動が成功したあとに呼ぶ。演出の内容を返す
 * @param src 買った・予約したカードの場所（飛ぶ演出の出発点。なければ null）
 */
export function endAction(before: Snapshot, state: GameState, pi: number, src: CardSource | null = null): Fx | null {
  newBoardCardIds(before, state).forEach(id => ui.newCards.add(id));
  if (turnStart && turnStart.pi === pi) ui.recent = diffPlayer(turnStart.snap, state, pi);

  const ch = diffPlayer(before, state, pi);
  if (!ch.gained.length && !ch.bought.length && !ch.nobles.length && !ch.reserved.length) return null;
  const spent: TokenColor[] = [];
  for (const c of ALL_TOKENS) for (let k = 0; k < ch.spent[c]; k++) spent.push(c);
  return {
    pi,
    name: ch.name,
    tokens: ch.gained,
    spent,
    cards: ch.bought,
    nobles: ch.nobles,
    reserved: ch.reserved.length > 0 && ch.bought.length === 0,
    reservedCards: ch.reserved,
    src,
  };
}

/** 新しいゲーム・続きからのときに記録を消す */
export function resetTracking(): void {
  turnStart = null;
  ui.recent = null;
  ui.newCards.clear();
}

/** 「直前の行動」を表示してよいか（手番が終わっているときだけ） */
export function recentIsDone(state: GameState): boolean {
  return !!ui.recent && (state.phase === 'gameover' || state.current !== ui.recent.pi);
}
