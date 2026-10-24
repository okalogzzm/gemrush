/* ============================================================
   ルール処理（ゲームの状態 state を読む・変える関数）
   ------------------------------------------------------------
   ※ ここの関数は画面を一切触りません。
     CPUも、同じ関数を呼んで同じルールで動きます。
   ・check〜：行動できるかを調べるだけ（状態は変えない）
   ・act〜  ：check〜 と同じ確認をしてから、状態を変える
   ============================================================ */
import { ALL_TOKENS, COLORS, JP, LEVELS, RULES } from './constants.ts';
import type {
  Card, CardSource, CostMap, GameState, GemColor, Level, Player, Result, TokenColor,
} from './types.ts';
import {
  buildCards, buildNobles, cardLabel, emptyCost, emptyTokens, fail, ok, random, shuffle, tokensText,
} from './utils.ts';

// 新しいゲームの状態を作る
export function createGame(names: readonly string[] = ['プレイヤー1', 'プレイヤー2']): GameState {
  // 山札を作ってシャッフル
  const decks: Record<Level, Card[]> = { 1: [], 2: [], 3: [] };
  shuffle(buildCards()).forEach(c => decks[c.level].push(c));

  // 各レベル4枚を場に並べる
  const board: Record<Level, (Card | null)[]> = { 1: [], 2: [], 3: [] };
  for (const lv of LEVELS) {
    for (let i = 0; i < RULES.BOARD_SIZE; i++) board[lv].push(decks[lv].pop() ?? null);
  }

  // 銀行（場のトークン）
  const bank = emptyTokens();
  COLORS.forEach(c => (bank[c] = RULES.TOKENS_PER_COLOR));
  bank.gold = RULES.GOLD_TOKENS;

  // 先手はランダム
  const start = random() < 0.5 ? 0 : 1;

  const state: GameState = {
    players: names.map(name => ({ name, tokens: emptyTokens(), cards: [], reserved: [], nobles: [] })),
    bank,
    decks,
    board,
    nobles: shuffle(buildNobles()).slice(0, RULES.NOBLE_COUNT),
    current: start,
    startPlayer: start,
    round: 1,
    phase: 'action',
    nobleChoices: [],
    pendingDiscard: emptyTokens(),
    finalRound: false,
    result: null,
    log: [],
  };
  addLog(state, `ゲーム開始！先手はランダムで${playerAt(state, start).name}に決まりました`);
  return state;
}

export function addLog(state: GameState, text: string): void { state.log.push(text); }

export function playerAt(state: GameState, index: number): Player {
  const p = state.players[index];
  if (!p) throw new Error(`プレイヤー${index}がいません`);
  return p;
}

export function currentPlayer(state: GameState): Player { return playerAt(state, state.current); }

// プレイヤーのボーナス（購入済みカードの色ごとの枚数）
export function getBonus(player: Player): CostMap {
  const b = emptyCost();
  player.cards.forEach(card => b[card.color]++);
  return b;
}

// プレイヤーの得点（カード + 貴族）
export function getPoints(player: Player): number {
  return player.cards.reduce((sum, c) => sum + c.points, 0)
       + player.nobles.reduce((sum, n) => sum + n.points, 0);
}

// 手持ちトークンの合計
export function tokenCount(player: Player): number {
  return ALL_TOKENS.reduce((sum, c) => sum + player.tokens[c], 0);
}

export interface Payment {
  canPay: boolean;
  pay: Record<TokenColor, number>;
  shortage: number;  // 金を使っても足りない数
}

// カードを買うときの支払い内容を計算（ボーナスで割引→足りない分を金で）
export function calcPayment(player: Player, card: Card): Payment {
  const bonus = getBonus(player);
  const pay = emptyTokens();
  let goldNeed = 0;
  for (const c of COLORS) {
    const need = Math.max(0, card.cost[c] - bonus[c]); // 割引後に必要な数
    const use = Math.min(need, player.tokens[c]);      // 手持ちで払える数
    pay[c] = use;
    goldNeed += need - use;                            // 足りない分は金で
  }
  pay.gold = goldNeed;
  return { canPay: goldNeed <= player.tokens.gold, pay, shortage: goldNeed - player.tokens.gold };
}

// 場所（src）にあるカードを取り出す（見るだけ）
export function getCardAt(state: GameState, src: CardSource | null): Card | null {
  if (!src) return null;
  if (src.type === 'board') return state.board[src.level]?.[src.index] ?? null;
  if (src.type === 'deck') {
    const d = state.decks[src.level] ?? [];
    return d[d.length - 1] ?? null;
  }
  return currentPlayer(state).reserved[src.index] ?? null;
}

// 場の空いた所を山札から補充（山札がなければ空のまま）
function refillBoard(state: GameState, level: Level, index: number): void {
  state.board[level][index] = state.decks[level].pop() ?? null;
}

// ---------- 行動できるかのチェック（状態は変えない） ----------

// 宝石を取れるか（colors: 例 ['red','blue','green'] や ['red','red']）
export function checkTakeTokens(state: GameState, colors: readonly TokenColor[]): Result {
  if (state.phase !== 'action') return fail('今は宝石を取れません');
  if (!colors || colors.length === 0) return fail('取る宝石を選んでください');
  if (colors.includes('gold')) return fail('金は予約したときだけもらえます');
  if (colors.some(c => !COLORS.includes(c as GemColor))) return fail('その宝石は取れません');

  // 同じ色を2個
  if (colors.length === 2 && colors[0] === colors[1]) {
    const c = colors[0] as GemColor;
    if (state.bank[c] < RULES.TAKE_TWO_MIN) {
      return fail(`同じ色2個は残り4個のときだけ（${JP[c]}は残り${state.bank[c]}個）`);
    }
    return ok();
  }

  // 異なる色
  if (new Set(colors).size !== colors.length) return fail('同じ色を2個取るときは、その色だけを選んでください');
  if (colors.length > 3) return fail('取れるのは3個までです');
  for (const c of colors) {
    if (state.bank[c] <= 0) return fail(`${JP[c]}は残っていません`);
  }
  // 残っている色が3色未満のときだけ、少ない数でもOK
  const available = COLORS.filter(c => state.bank[c] > 0).length;
  const required = Math.min(3, available);
  if (colors.length < required) return fail(`異なる色を${required}個選んでください`);
  return ok();
}

// 予約できるか
export function checkReserve(state: GameState, src: CardSource | null): Result {
  if (state.phase !== 'action') return fail('今は予約できません');
  if (!src || (src.type !== 'board' && src.type !== 'deck')) return fail('予約できるのは場のカードか山札です');
  if (currentPlayer(state).reserved.length >= RULES.MAX_RESERVED) return fail('予約は3枚までです');
  if (!getCardAt(state, src)) return fail(src.type === 'deck' ? '山札がもうありません' : 'そこにカードはありません');
  return ok();
}

// 購入できるか
export function checkBuy(state: GameState, src: CardSource | null): Result {
  if (state.phase !== 'action') return fail('今は購入できません');
  if (!src || (src.type !== 'board' && src.type !== 'reserved')) return fail('山札のカードは直接買えません');
  const card = getCardAt(state, src);
  if (!card) return fail('そこにカードはありません');
  const p = calcPayment(currentPlayer(state), card);
  if (!p.canPay) return fail(`宝石が足りません（あと${p.shortage}個分）`);
  return ok();
}

// 何か1つでも行動できるか（できないときだけパスを許可）
export function hasAnyLegalAction(state: GameState): boolean {
  if (state.phase !== 'action') return false;
  if (COLORS.some(c => state.bank[c] > 0)) return true;
  const p = currentPlayer(state);
  if (p.reserved.length < RULES.MAX_RESERVED) {
    for (const lv of LEVELS) {
      if (state.decks[lv].length > 0 || state.board[lv].some(c => c)) return true;
    }
  }
  for (const lv of LEVELS) {
    for (let i = 0; i < RULES.BOARD_SIZE; i++) {
      if (checkBuy(state, { type: 'board', level: lv, index: i }).ok) return true;
    }
  }
  for (let i = 0; i < p.reserved.length; i++) {
    if (checkBuy(state, { type: 'reserved', index: i }).ok) return true;
  }
  return false;
}

// ---------- 行動（状態を変える） ----------

// 行動1・2：宝石を取る
export function actTakeTokens(state: GameState, colors: readonly TokenColor[]): Result {
  const r = checkTakeTokens(state, colors);
  if (!r.ok) return r;
  const p = currentPlayer(state);
  colors.forEach(c => { state.bank[c]--; p.tokens[c]++; });
  if (colors.length === 2 && colors[0] === colors[1]) {
    addLog(state, `${p.name}が${JP[colors[0] as GemColor]}を2個取った`);
  } else {
    addLog(state, `${p.name}が${colors.map(c => JP[c]).join('・')}を取った`);
  }
  afterAction(state);
  return ok();
}

// 行動3：予約する
export function actReserve(state: GameState, src: CardSource | null): Result {
  const r = checkReserve(state, src);
  if (!r.ok || !src || src.type === 'reserved') return r;
  const p = currentPlayer(state);
  let card: Card;
  if (src.type === 'deck') {
    card = state.decks[src.level].pop() as Card;
    card.hidden = true; // 山札から伏せたまま予約（相手には見えない）
  } else {
    card = state.board[src.level][src.index] as Card;
    card.hidden = false;
    refillBoard(state, src.level, src.index);
  }
  p.reserved.push(card);

  let goldText = '（金は品切れ）';
  if (state.bank.gold > 0) {
    state.bank.gold--;
    p.tokens.gold++;
    goldText = '（金+1）';
  }
  if (src.type === 'deck') {
    addLog(state, `${p.name}がレベル${src.level}の山札から1枚予約した${goldText}`);
  } else {
    addLog(state, `${p.name}が${cardLabel(card)}を予約した${goldText}`);
  }
  afterAction(state);
  return ok();
}

// 行動4：購入する
export function actBuy(state: GameState, src: CardSource | null): Result {
  const r = checkBuy(state, src);
  if (!r.ok || !src || src.type === 'deck') return r;
  const p = currentPlayer(state);
  const card = getCardAt(state, src) as Card;
  const { pay } = calcPayment(p, card);

  // 支払ったトークンは銀行に戻る
  ALL_TOKENS.forEach(c => { p.tokens[c] -= pay[c]; state.bank[c] += pay[c]; });

  // カードを手元へ
  if (src.type === 'board') {
    refillBoard(state, src.level, src.index);
  } else {
    p.reserved.splice(src.index, 1);
  }
  card.hidden = false;
  p.cards.push(card);

  const from = src.type === 'reserved' ? '予約から' : '';
  addLog(state, `${p.name}が${from}${cardLabel(card)}を購入した（支払い: ${tokensText(pay)}）`);
  afterAction(state);
  return ok();
}

// どの行動もできないときだけパス
export function actPass(state: GameState): Result {
  if (state.phase !== 'action') return fail('今はパスできません');
  if (hasAnyLegalAction(state)) return fail('まだできる行動があるのでパスできません');
  addLog(state, `${currentPlayer(state).name}はできる行動がないのでパスした`);
  afterAction(state);
  return ok();
}

// トークンを1個返す（10個を超えたとき）
export function actDiscard(state: GameState, color: TokenColor): Result {
  if (state.phase !== 'discard') return fail('今はトークンを返す場面ではありません');
  const p = currentPlayer(state);
  if (!ALL_TOKENS.includes(color) || p.tokens[color] <= 0) return fail('その宝石は持っていません');
  p.tokens[color]--;
  state.bank[color]++;
  state.pendingDiscard[color]++;
  if (tokenCount(p) <= RULES.MAX_TOKENS) {
    addLog(state, `${p.name}が${tokensText(state.pendingDiscard)}を返した（10個を超えたため）`);
    state.pendingDiscard = emptyTokens();
    checkNobleVisit(state);
  }
  return ok();
}

// 貴族を1枚選ぶ（複数が訪問可能なとき）
export function actChooseNoble(state: GameState, nobleId: string): Result {
  if (state.phase !== 'noble') return fail('今は貴族を選ぶ場面ではありません');
  if (!state.nobleChoices.includes(nobleId)) return fail('その貴族は選べません');
  giveNoble(state, nobleId);
  finishTurn(state);
  return ok();
}

// ---------- 手番の終わりの処理 ----------

// 行動の後：トークン上限 → 貴族 → 手番終了 の順に確認
function afterAction(state: GameState): void {
  if (tokenCount(currentPlayer(state)) > RULES.MAX_TOKENS) {
    state.phase = 'discard';
    return;
  }
  checkNobleVisit(state);
}

// 条件を満たす貴族のidの一覧
export function eligibleNobles(state: GameState, player: Player): string[] {
  const bonus = getBonus(player);
  return state.nobles.filter(n => COLORS.every(c => bonus[c] >= n.req[c])).map(n => n.id);
}

// 貴族が訪れるか確認
function checkNobleVisit(state: GameState): void {
  const list = eligibleNobles(state, currentPlayer(state));
  if (list.length === 0) return finishTurn(state);
  if (list.length === 1) {
    giveNoble(state, list[0] as string);
    return finishTurn(state);
  }
  // 2枚以上なら選んでもらう
  state.phase = 'noble';
  state.nobleChoices = list;
}

function giveNoble(state: GameState, nobleId: string): void {
  const p = currentPlayer(state);
  const idx = state.nobles.findIndex(n => n.id === nobleId);
  const noble = state.nobles.splice(idx, 1)[0];
  if (!noble) return;
  p.nobles.push(noble);
  addLog(state, `${p.name}のもとに貴族が訪れた（+${noble.points}点）`);
}

// 手番を終えて次のプレイヤーへ（終了判定もここ）
function finishTurn(state: GameState): void {
  const p = currentPlayer(state);
  state.nobleChoices = [];
  if (!state.finalRound && getPoints(p) >= RULES.WIN_POINTS) {
    state.finalRound = true;
    addLog(state, `${p.name}が${getPoints(p)}点に到達！このラウンドで終了します`);
  }
  const next = (state.current + 1) % state.players.length;
  // 最終ラウンド中に先手へ戻る＝全員の手番数がそろった → 終了
  if (state.finalRound && next === state.startPlayer) {
    endGame(state);
    return;
  }
  state.current = next;
  if (next === state.startPlayer) state.round++;
  state.phase = 'action';
}

// 勝敗を決める（得点が高い方、同点なら購入カードが少ない方）
function endGame(state: GameState): void {
  const scores = state.players.map((p, i) => ({ i, points: getPoints(p), cards: p.cards.length }));
  const sorted = scores.slice().sort((a, b) => b.points - a.points || a.cards - b.cards);
  const a = sorted[0]!;
  const b = sorted[1]!;
  let text: string;
  let winner: number | null = null;
  if (a.points === b.points && a.cards === b.cards) {
    text = `引き分け！（${a.points}点・カード${a.cards}枚で完全に同じ）`;
  } else {
    winner = a.i;
    const reason = a.points === b.points ? '（同点のため、購入カードが少ない方の勝ち）' : '';
    text = `${playerAt(state, a.i).name}の勝ち！${reason}`;
  }
  const detail = scores.map(s => `${playerAt(state, s.i).name}: ${s.points}点・カード${s.cards}枚`).join(' ／ ');
  state.result = { winner, text, detail };
  state.phase = 'gameover';
  addLog(state, `ゲーム終了：${text}　${detail}`);
}
