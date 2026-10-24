/* ============================================================
   アプリの状態（ゲームの状態とは別に管理するもの）
   ============================================================ */
import type { CpuLevel } from '../cpu/index.ts';
import type { PlayerChange } from '../game/diff.ts';
import type { CardSource, GameState, TokenColor } from '../game/types.ts';

export interface Settings {
  mode: 'cpu' | 'pvp';   // CPU対戦 / 2人対戦
  level: CpuLevel;       // CPUの強さ
  cpuIndex: number;      // CPUのプレイヤー番号（players[1]。players[0]が「あなた」）
}

/** 演出に使う「直前の行動で起きたこと」 */
export interface Fx {
  pi: number;
  name: string;
  tokens: TokenColor[];
  spent: TokenColor[];                  // 払った・返したトークン（場へ戻る演出）
  cards: PlayerChange['bought'];
  nobles: PlayerChange['nobles'];
  reserved: boolean;
  reservedCards: PlayerChange['reserved'];
  src: CardSource | null;               // 買った・予約したカードがあった場所（飛ぶ演出の出発点）
}

export interface UiState {
  tokens: TokenColor[];            // 選択中の宝石（例 ['red','blue']）
  target: CardSource | null;       // 選択中のカード
  message: string;                 // 表示するメッセージ
  msgType: 'error' | 'info';
  msgSeq: number;                  // メッセージを出し直した回数（同じ文でももう一度見せるため）
  fx: Fx | null;                   // 直前の行動の演出（1回だけ出す）
  recent: PlayerChange | null;     // 最後に終わった手番の内容（「直前」の表示用）
  newCards: Set<string>;           // 前の自分の手番から、新しく場に出たカード
}

export const store: { game: GameState | null } = { game: null };

export const settings: Settings = { mode: 'cpu', level: 'normal', cpuIndex: 1 };

export const ui: UiState = {
  tokens: [],
  target: null,
  message: '',
  msgType: 'info',
  msgSeq: 0,
  fx: null,
  recent: null,
  newCards: new Set(),
};

export function resetSelection(): void { ui.tokens = []; ui.target = null; }

export function showMessage(text: string, type: UiState['msgType'] = 'error'): void {
  ui.message = text;
  ui.msgType = type;
  ui.msgSeq++;
}

/** 今がCPUの番か */
export function isCpuTurn(): boolean {
  const g = store.game;
  return !!g && settings.mode === 'cpu' && g.phase !== 'gameover' && g.current === settings.cpuIndex;
}

/** プレイヤー pi の伏せ札を、画面に表向きで出してよいか */
export function canSee(pi: number): boolean {
  if (settings.mode === 'cpu') return pi !== settings.cpuIndex; // CPUの伏せ札は見せない
  return pi === store.game?.current;                          // 2人対戦では手番の人だけ
}
