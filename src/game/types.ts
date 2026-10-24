/* ============================================================
   ゲームで使う型（データの形）
   ============================================================ */

/** 宝石5色 */
export type GemColor = 'white' | 'blue' | 'green' | 'red' | 'black';
/** トークン6種類（宝石5色＋金） */
export type TokenColor = GemColor | 'gold';
/** カードのレベル */
export type Level = 1 | 2 | 3;

/** 色ごとのトークン数（金を含む） */
export type TokenMap = Record<TokenColor, number>;
/** 色ごとのコスト・条件（金を含まない） */
export type CostMap = Record<GemColor, number>;

/** 発展カード */
export interface Card {
  id: string;
  level: Level;
  color: GemColor;      // ボーナスの色
  points: number;
  cost: CostMap;
  unsure: boolean;      // 公式との一致に自信がないカード（要確認）
  hidden?: boolean;     // 山札から伏せたまま予約したカード
}

/** 貴族タイル */
export interface Noble {
  id: string;
  points: number;
  req: CostMap;         // 必要なボーナス
}

export interface Player {
  name: string;
  tokens: TokenMap;
  cards: Card[];        // 購入したカード
  reserved: Card[];     // 予約中のカード（3枚まで）
  nobles: Noble[];
}

/** 'action' 行動 / 'discard' トークン返却 / 'noble' 貴族選択 / 'gameover' 終了 */
export type Phase = 'action' | 'discard' | 'noble' | 'gameover';

export interface GameResult {
  winner: number | null;  // 勝った人の番号。引き分けは null
  text: string;
  detail: string;
}

/** ゲームの状態（保存データにもこの形のまま入る） */
export interface GameState {
  players: Player[];
  bank: TokenMap;                          // 場のトークン
  decks: Record<Level, Card[]>;            // 山札（配列の最後が一番上）
  board: Record<Level, (Card | null)[]>;   // 場のカード4枚ずつ（空きは null）
  nobles: Noble[];                         // 残っている貴族
  current: number;                         // 手番のプレイヤー番号（0か1）
  startPlayer: number;                     // 先手のプレイヤー番号
  round: number;
  phase: Phase;
  nobleChoices: string[];                  // 選べる貴族のid
  pendingDiscard: TokenMap;                // 返却中のトークン（ログ用）
  finalRound: boolean;                     // 最終ラウンドに入ったか
  result: GameResult | null;
  log: string[];
}

/** カードの場所 */
export type CardSource =
  | { type: 'board'; level: Level; index: number }   // 場のカード
  | { type: 'deck'; level: Level }                   // 山札の一番上
  | { type: 'reserved'; index: number };             // 自分の予約カード

/** ルール処理の結果 */
export type Result = { ok: true } | { ok: false; msg: string };

/** 手（CPUが選ぶ・ルール処理で実行する単位） */
export type Move =
  | { type: 'take'; colors: GemColor[] }
  | { type: 'reserve'; src: CardSource }
  | { type: 'buy'; src: CardSource }
  | { type: 'pass' };
