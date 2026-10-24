/* ============================================================
   行動の前後の比較（演出と「直前の変化」の表示に使う）
   ------------------------------------------------------------
   ルール処理には手を加えず、行動の前に状態を控えておき、
   行動の後と比べて「誰が何を得たか」「場に何が新しく出たか」を調べる。
   ============================================================ */
import { ALL_TOKENS, LEVELS } from './constants.ts';
import type { Card, GameState, Noble, TokenColor, TokenMap } from './types.ts';
import { emptyTokens } from './utils.ts';

export interface Snapshot {
  players: { tokens: TokenMap; cardIds: string[]; nobleIds: string[]; reservedIds: string[] }[];
  boardIds: string[];
  logLength: number;
}

/** 行動の前に、比べるための控えを取る */
export function snapshot(state: GameState): Snapshot {
  const boardIds: string[] = [];
  for (const lv of LEVELS) state.board[lv].forEach(c => { if (c) boardIds.push(c.id); });
  return {
    players: state.players.map(p => ({
      tokens: { ...p.tokens },
      cardIds: p.cards.map(c => c.id),
      nobleIds: p.nobles.map(n => n.id),
      reservedIds: p.reserved.map(c => c.id),
    })),
    boardIds,
    logLength: state.log.length,
  };
}

/** あるプレイヤーの変化 */
export interface PlayerChange {
  pi: number;
  name: string;
  gained: TokenColor[];   // 増えたトークン（返した分は差し引き）。例 ['red','red']
  spent: TokenMap;        // 減ったトークン（支払い・返却）
  bought: Card[];         // 買ったカード
  reserved: Card[];       // 新しく予約したカード
  nobles: Noble[];        // 来た貴族
  log: string[];          // この間に増えたログ
}

/** 控えと今を比べて、プレイヤー pi の変化を調べる */
export function diffPlayer(before: Snapshot, state: GameState, pi: number): PlayerChange {
  const p = state.players[pi]!;
  const b = before.players[pi]!;
  const gained: TokenColor[] = [];
  const spent = emptyTokens();
  for (const c of ALL_TOKENS) {
    const d = p.tokens[c] - b.tokens[c];
    for (let k = 0; k < d; k++) gained.push(c);
    if (d < 0) spent[c] = -d;
  }
  return {
    pi,
    name: p.name,
    gained,
    spent,
    bought: p.cards.filter(c => !b.cardIds.includes(c.id)),
    reserved: p.reserved.filter(c => !b.reservedIds.includes(c.id)),
    nobles: p.nobles.filter(n => !b.nobleIds.includes(n.id)),
    log: state.log.slice(before.logLength),
  };
}

/** 何か変化があったか */
export function hasChange(ch: PlayerChange): boolean {
  return ch.gained.length > 0 || ch.bought.length > 0 || ch.reserved.length > 0 || ch.nobles.length > 0;
}

/** 控えのときには場になかった（＝新しく補充された）カードのid */
export function newBoardCardIds(before: Snapshot, state: GameState): string[] {
  const ids: string[] = [];
  for (const lv of LEVELS) {
    state.board[lv].forEach(c => { if (c && !before.boardIds.includes(c.id)) ids.push(c.id); });
  }
  return ids;
}
