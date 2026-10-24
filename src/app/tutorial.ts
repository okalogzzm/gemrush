/* ============================================================
   チュートリアル（はじめての人のための練習）
   ------------------------------------------------------------
   ・決まった盤面で、案内に合わせて1手ずつ実際に操作してもらう
   ・案内の手番では、言われた操作だけを受け付ける（ほかは理由を出して止める）
   ・相手（CPU）は決まった手だけを打つ。ルールの関数（applyMove）で動かす
   ・練習なので保存はしない（「続きから」の保存データも消さない）
   ・「戻る」で1つ前の案内へ戻れるように、案内ごとに盤面の控えを取っておく
   ============================================================ */
import { applyMove, CPU_LEVELS, listLegalMoves, resolvePending } from '../cpu/index.ts';
import { createGame } from '../game/rules.ts';
import type { Card, GameState, GemColor, Level, Move } from '../game/types.ts';
import { createSeededRandom, setRandomSource } from '../game/utils.ts';
import { resetSelection, store, ui } from './state.ts';
import { beginAction, endAction, resetTracking } from './tracker.ts';

const YOU = 0;
const OPP = 1;

/** 買ってもらうカード（Lv1・黒・白1 青2 緑1 赤1）を置く場所 */
export const BUY_TARGET = { level: 1 as Level, index: 0 };
/** 予約してもらうカードの場所 */
export const RESERVE_TARGET = { level: 2 as Level, index: 1 };

/** 相手が打つ手（順番に1つずつ） */
export const OPP_MOVES: readonly Move[] = [
  { type: 'take', colors: ['black', 'black'] },
  { type: 'take', colors: ['white', 'green', 'black'] },
  { type: 'take', colors: ['red', 'red'] },
  { type: 'take', colors: ['white', 'blue', 'green'] },
];

/**
 * 案内の種類
 *  info：読んで「次へ」 / do：言われた操作をする（終わると相手の番になる） /
 *  wait：相手の番を待つ（相手が打ち終わり、決めた時間がたつか「次へ」で次へ） / end：おしまい
 */
type StepKind = 'info' | 'do' | 'wait' | 'end';

export interface TutorialStep {
  kind: StepKind;
  /**
   * 案内の吹き出しを出す場所（光らせる所を隠さないように）
   * near：光らせる所のすぐ上か下に、矢印つきで出す
   */
  place: 'top' | 'bottom' | 'center' | 'near';
  text: string;
  /** 光らせる場所（CSS のセレクタ）。選んでいる途中で変わるので関数にする */
  focus?: () => string[];
  /** do の手番：その操作をしてよいか。だめなら理由を返す */
  gate?: (act: string, d: DOMStringMap) => string | null;
  /** wait の手番：最低この時間（ミリ秒）は案内を出しておく（「次へ」で飛ばせる） */
  minMs?: number;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

// 宝石を取る手番：決めた色だけ選べて、そろったら「取る」を押せる
function takeStep(colors: GemColor[], hint: string): Pick<TutorialStep, 'focus' | 'gate'> {
  const unique = [...new Set(colors)];
  return {
    focus: () => {
      if (sameSet(ui.tokens, colors)) return ['#ctrlBody [data-act="take"]'];
      const left = unique.filter(c => ui.tokens.filter(t => t === c).length < colors.filter(t => t === c).length);
      return left.map(c => `#bank [data-color="${c}"]`);
    },
    gate: (act, d) => {
      if (act === 'bank') return unique.includes(d.color as GemColor) ? null : hint;
      if (act === 'take') return sameSet(ui.tokens, colors) ? null : hint;
      if (act === 'clear') return null;
      return hint;
    },
  };
}

// カードを選んで「購入する」か「予約」を押す手番
function cardStep(target: { level: Level; index: number }, act: 'buy' | 'reserve', hint: string): Pick<TutorialStep, 'focus' | 'gate'> {
  const cardSel = `#cardRows [data-act="card"][data-level="${target.level}"][data-index="${target.index}"]`;
  const isTarget = (d: DOMStringMap) => d.level === String(target.level) && d.index === String(target.index);
  return {
    focus: () => {
      const t = ui.target;
      const picked = t?.type === 'board' && t.level === target.level && t.index === target.index;
      return picked ? [`#ctrlBody [data-act="${act}"]`] : [cardSel];
    },
    gate: (a, d) => {
      if (a === 'card') return isTarget(d) ? null : hint;
      if (a === act || a === 'clear') return null;
      return hint;
    },
  };
}

const NEXT_HINT = '案内を読んで「次へ」を押してください';

export const STEPS: readonly TutorialStep[] = [
  { kind: 'info', place: 'center',
    text: '<b>ようこそ！</b><br>宝石を集めて<b>小鳥のカード</b>を買い、<b>先に15点</b>をとった人の勝ちです。<br>実際に動かしながら、遊び方をおぼえましょう。' },
  { kind: 'info', place: 'near', focus: () => [`#cardRows [data-act="card"][data-level="${BUY_TARGET.level}"][data-index="${BUY_TARGET.index}"]`],
    text: 'これが<b>カード</b>です。<b>下の丸</b>が買うのに必要な宝石、<b>左上の数字</b>が得点（空白は0点）、<b>右上の宝石</b>が買うともらえる色です。' },
  { kind: 'do', place: 'top', ...takeStep(['white', 'green', 'red'], '白・緑・赤を1つずつ選んで「取る」を押してください'),
    text: '自分の番では、4つの行動から<b>1つだけ</b>できます。まずは<b>違う色の宝石を3個</b>。<b>白・緑・赤</b>をタップして「取る」！<br>※ 宝石は<b>10個まで</b>しか持てません（こえたら10個になるまで返します）。' },
  { kind: 'wait', place: 'bottom', minMs: 10000,
    text: '<b>相手（CPU）の番</b>です。相手が何をしたかは、画面の真ん中に大きく出ます。取られた宝石には<b>−</b>、相手の手元には<b>＋</b>の印が付き、下の<b>「直前」</b>の欄にも残ります。' },
  { kind: 'do', place: 'top', ...takeStep(['blue', 'blue'], '青を2回タップして「取る」を押してください'),
    text: '<b>同じ色を2個</b>とることもできます（その色が<b>4個残っている</b>ときだけ）。<b>青を2回</b>タップして「取る」！' },
  { kind: 'wait', place: 'bottom', text: '相手の番です。少し待ちましょう。' },
  { kind: 'do', place: 'top', ...cardStep(BUY_TARGET, 'buy', '光っているカードを選んで「購入する」を押してください'),
    text: '宝石がそろいました！<b>「買える」</b>の印が付いたカードをタップして、<b>「購入する」</b>。払った宝石は場に戻ります。' },
  { kind: 'wait', place: 'bottom', text: 'カードを買えました！ 相手の番を待ちましょう。' },
  { kind: 'info', place: 'near', focus: () => ['#me .bonus-card.c-black'],
    text: '買ったカードは<b>ボーナス</b>になり、次から<b>黒の宝石を1個ずっと割引</b>してくれます。安いカードを集めて、高い点のカードを目指しましょう。' },
  { kind: 'do', place: 'top', ...cardStep(RESERVE_TARGET, 'reserve', '光っているカードを選んで「予約」を押してください'),
    text: 'カードを<b>予約</b>すると、手元にキープできて、<b>金</b>（何色の代わりにもなる宝石）が1個もらえます。光っているカードを予約しましょう。' },
  { kind: 'wait', place: 'bottom', text: '予約したカードは、手元の右側に置かれ、あとで買えます（3枚まで）。' },
  { kind: 'info', place: 'near', focus: () => ['#nobles'],
    text: '<b>貴族</b>は、書かれた数だけ<b>ボーナス（買ったカード）</b>を集めると、自動で来てくれて<b>3点</b>もらえます。' },
  { kind: 'info', place: 'near', focus: () => ['#banner [data-act="menu"]'],
    text: 'だれかが<b>15点</b>に届いたら、その周の最後まで遊んで、点数の多い人の勝ち。<br>困ったら<b>☰ メニュー</b>の「ルール説明」を見てください。' },
  { kind: 'end', place: 'center',
    text: '<b>チュートリアルはここまで！</b><br>まずはいちばんやさしい<b>CPU Lv1</b>と対戦してみましょう。' },
];

export const tutorial = {
  active: false,
  step: 0,
  oppTurn: 0,    // 相手が何手目まで打ったか
  stepAt: 0,     // 今の案内を出した時刻
  skip: false,   // 相手の番の案内で「次へ」が押された
};

/** 案内ごとの盤面の控え（「戻る」で使う） */
const history: { game: GameState; oppTurn: number }[] = [];

let oppTimer: ReturnType<typeof setTimeout> | null = null;
let waitTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers(): void {
  if (oppTimer) clearTimeout(oppTimer);
  if (waitTimer) clearTimeout(waitTimer);
  oppTimer = null;
  waitTimer = null;
}

// 案内を切り替える（その時点の盤面の控えも取る）
function setStep(n: number): void {
  tutorial.step = n;
  tutorial.stepAt = Date.now();
  tutorial.skip = false;
  if (store.game) history[n] = { game: structuredClone(store.game), oppTurn: tutorial.oppTurn };
}

export function currentStep(): TutorialStep | null {
  return tutorial.active ? STEPS[tutorial.step] ?? null : null;
}

/** チュートリアル用の盤面を作る（毎回同じ並び） */
export function buildTutorialGame(): GameState {
  setRandomSource(createSeededRandom(2024));
  const game = createGame(['あなた', CPU_LEVELS.easy]);
  setRandomSource(Math.random);
  game.current = YOU;
  game.startPlayer = YOU;
  game.log = ['チュートリアル（練習用の盤面です）'];
  // 買ってもらうカードを、決めた場所に置く
  placeCard(game, BUY_TARGET.level, BUY_TARGET.index,
    c => c.color === 'black' && c.points === 0 && c.cost.white === 1 && c.cost.blue === 2 && c.cost.green === 1 && c.cost.red === 1 && c.cost.black === 0);
  return game;
}

// 条件に合うカードを山札か場から探して、決めた場所と入れ替える
function placeCard(game: GameState, level: Level, index: number, match: (c: Card) => boolean): void {
  const row = game.board[level];
  const deck = game.decks[level];
  const bi = row.findIndex(c => !!c && match(c));
  if (bi >= 0) { [row[index], row[bi]] = [row[bi] ?? null, row[index] ?? null]; return; }
  const di = deck.findIndex(match);
  if (di < 0) return;
  const old = row[index];
  row[index] = deck[di] ?? null;
  if (old) deck[di] = old; else deck.splice(di, 1);
}

export function startTutorial(): void {
  stopTutorial();
  store.game = buildTutorialGame();
  tutorial.active = true;
  tutorial.oppTurn = 0;
  history.length = 0;
  setStep(0);
}

export function stopTutorial(): void {
  clearTimers();
  tutorial.active = false;
}

/** 「次へ」。相手の番の案内では、相手がまだならすぐ打たせて、案内を飛ばす */
export function nextStep(): void {
  const s = currentStep();
  if (s?.kind === 'info') setStep(tutorial.step + 1);
  if (s?.kind === 'wait') {
    tutorial.skip = true;
    clearTimers(); // 待ち時間を取り消す（scheduleTutorial が、すぐ打つように予約し直す）
  }
}

/** 戻れる1つ前の案内（相手の番の案内は飛ばす）。なければ -1 */
export function prevStepIndex(): number {
  for (let i = tutorial.step - 1; i >= 0; i--) {
    if (STEPS[i]?.kind !== 'wait' && history[i]) return i;
  }
  return -1;
}

/** 「戻る」：1つ前の案内と、そのときの盤面に戻す */
export function prevStep(): void {
  const i = prevStepIndex();
  const h = history[i];
  if (!h) return;
  clearTimers();
  store.game = structuredClone(h.game);
  tutorial.oppTurn = h.oppTurn;
  history.length = i; // これより先の控えは、進み直したときに取り直す
  setStep(i);
  resetSelection();
  resetTracking();
  ui.message = '';
  ui.fx = null;
}

// 相手の番の案内を、もう閉じてよいか（相手が打ち終わり、決めた時間がたったか「次へ」が押された）
function waitDone(s: TutorialStep, game: GameState): boolean {
  return game.current === YOU && (tutorial.skip || Date.now() - tutorial.stepAt >= (s.minMs ?? 0));
}

/** 手番が進んだら、それに合わせて案内も進める（画面を描き直す前に呼ぶ） */
export function syncTutorial(game: GameState): void {
  for (;;) {
    const s = currentStep();
    if (s?.kind === 'do' && game.current === OPP && game.phase === 'action') setStep(tutorial.step + 1);
    else if (s?.kind === 'wait' && waitDone(s, game)) setStep(tutorial.step + 1);
    else return;
  }
}

/**
 * チュートリアル中に、その操作をしてよいか（null ならよい・文字列なら止める理由）
 * メニューなどの画面の切り替えは、いつでもできる
 */
export function tutorialBlock(act: string, d: DOMStringMap): string | null {
  const s = currentStep();
  if (!s) return null;
  const GAME_ACTS = ['bank', 'card', 'deck', 'reserved', 'take', 'buy', 'reserve', 'discard', 'noble', 'pass', 'clear'];
  if (!GAME_ACTS.includes(act)) return null;
  if (s.kind === 'do' && s.gate) return s.gate(act, d);
  return act === 'clear' ? null : NEXT_HINT;
}

/**
 * 相手の番の案内のあいだの進行（cpuRunner の代わり）
 *  ・相手がまだなら、決めた手を少し待ってから打つ（「次へ」が押されたらすぐ）
 *  ・相手が打ち終わったら、決めた時間がたったところで次の案内へ
 */
export function scheduleTutorial(onMoved: () => void, isPaused: () => boolean, waitFx = 0): void {
  const game = store.game;
  const s = currentStep();
  if (!tutorial.active || !game || isPaused() || s?.kind !== 'wait') return;
  if (game.current === YOU) {
    if (waitTimer || waitDone(s, game)) return;
    const left = (s.minMs ?? 0) - (Date.now() - tutorial.stepAt);
    waitTimer = setTimeout(() => { waitTimer = null; onMoved(); }, Math.max(0, left) + 50);
    return;
  }
  if (oppTimer || game.current !== OPP || game.phase !== 'action') return;
  oppTimer = setTimeout(() => {
    oppTimer = null;
    if (!tutorial.active || store.game !== game) return;
    const move = OPP_MOVES[tutorial.oppTurn++];
    const before = beginAction(game);
    const r = move ? applyMove(game, move) : { ok: false as const, msg: '' };
    if (!r.ok) {
      // 念のため：決めた手が使えなければ、合法手の先頭で代わりに行動
      const m = listLegalMoves(game)[0];
      if (m) applyMove(game, m);
    }
    resolvePending(game, OPP, 'easy');
    resetSelection();
    ui.message = '';
    ui.fx = endAction(before, game, OPP, null);
    onMoved();
  }, tutorial.skip ? 300 : waitFx + 1400);
}
