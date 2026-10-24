/* ============================================================
   タップ操作の受け付けと、画面の更新の流れ
   ------------------------------------------------------------
   refresh() が画面更新の唯一の入口：
     描き直し → 自動保存 → 演出 → CPUの番なら行動を予約
   ============================================================ */
import { CPU_LEVELS, type CpuLevel } from '../cpu/index.ts';
import { JP, RULES } from '../game/constants.ts';
import {
  actBuy, actChooseNoble, actDiscard, actPass, actReserve, actTakeTokens, createGame,
} from '../game/rules.ts';
import type { CardSource, GemColor, Level, Result, TokenColor } from '../game/types.ts';
import { sameSource } from '../game/utils.ts';
import { $ } from '../view/dom.ts';
import { playFx } from '../view/fx.ts';
import { render, renderDataCheck } from '../view/render.ts';
import { hideResult, showResult, showResultOnce } from '../view/result.ts';
import { hideCardTip, initCardTip, showCardTip, toggleCardTip } from '../view/tooltip.ts';
import { openMenu, openRules, renderStartScreen } from '../view/screens.ts';
import { scheduleCpu, stopCpu } from './cpuRunner.ts';
import { checkStorage, clearSave, loadSave, saveGame } from './save.ts';
import { isCpuTurn, resetSelection, settings, showMessage, store, ui } from './state.ts';
import { beginAction, endAction, resetTracking } from './tracker.ts';

/** 画面を更新する（描き直し・保存・演出・CPUの予約） */
export function refresh(): void {
  if (!store.game) return;
  const game = store.game;
  render();
  saveGame(game, settings);         // 1手ごと（画面が変わるたび）に自動保存
  const fx = ui.fx;
  ui.fx = null;                     // 演出は1回だけ
  const fxMs = playFx(fx, game);
  // 勝負がついたら、行動の演出が終わってから勝敗の画面を出す
  showResultOnce(game, fxMs + 300);
  // CPUは、演出が終わるのを待ってから考え始める（演出が重ならないように）
  scheduleCpu(refresh, () => !$('#startScreen').hidden, fxMs);
}

// ルールの行動を実行し、結果に合わせて画面を更新（演出もここで準備）
function run(action: () => Result): void {
  const game = store.game;
  if (!game) return;
  const pi = game.current;
  const src = ui.target;            // 買う・予約するカードの場所（演出の出発点）
  const before = beginAction(game);
  const result = action();
  if (result.ok) {
    resetSelection();
    ui.message = '';
    ui.fx = endAction(before, game, pi, src);
  } else {
    showMessage(result.msg, 'error');
  }
  refresh();
}

// 銀行の宝石をタップしたとき（選択だけ。取るのは「取る」ボタン）
function onTapBank(color: TokenColor): void {
  const game = store.game;
  if (!game) return;
  if (game.phase !== 'action') { showMessage('今は宝石を選べません'); return refresh(); }
  ui.target = null;
  if (color === 'gold') { showMessage('金は予約したときだけもらえます'); return refresh(); }
  const sel = ui.tokens;
  const isDouble = sel.length === 2 && sel[0] === sel[1];

  if (sel.includes(color)) {
    if (sel.length === 1) {
      // 同じ色をもう一度 → 2個取りにする
      if (game.bank[color] < RULES.TAKE_TWO_MIN) {
        showMessage(`同じ色2個は残り4個のときだけ（${JP[color]}は残り${game.bank[color]}個）`);
        return refresh();
      }
      ui.tokens = [color, color];
    } else {
      ui.tokens = sel.filter(c => c !== color); // 選択を外す
    }
  } else {
    if (isDouble) { showMessage('同じ色2個と、他の色は一緒に取れません'); return refresh(); }
    if (sel.length >= 3) { showMessage('取れるのは3個までです'); return refresh(); }
    if (game.bank[color] <= 0) { showMessage(`${JP[color]}は残っていません`); return refresh(); }
    ui.tokens = [...sel, color];
  }
  ui.message = '';
  refresh();
}

// カード・山札・予約カードをタップしたとき
function onTapCard(src: CardSource): void {
  const game = store.game;
  if (!game) return;
  if (game.phase !== 'action') { showMessage('今はカードを選べません'); return refresh(); }
  ui.tokens = [];
  ui.target = sameSource(ui.target, src) ? null : src;
  ui.message = '';
  refresh();
}

// CPUの番でも使える操作（メニューや画面の切り替え）
const ALWAYS_ALLOWED = [
  'newgame', 'start', 'resume', 'rules', 'closeRules', 'menu', 'closeMenu', 'toStart', 'backdrop', 'log', 'closeLog', 'closeResult', 'cardsTip',
];

const toLevel = (v: string | undefined): Level => (v === '2' ? 2 : v === '3' ? 3 : 1);

// 画面全体で1つのクリック受付（data-act を見て振り分け）
function onClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  const el = target?.closest<HTMLElement>('[data-act]');
  // 吹き出しは、ほかの所をタップしたら消す
  if (el?.dataset.act !== 'cardsTip') hideCardTip();
  if (!el || (el as HTMLButtonElement).disabled) return;
  const d = el.dataset;
  // 重ねた画面の外側（暗い部分）をタップしたら閉じる
  if (d.act === 'backdrop') {
    if (e.target === el) el.hidden = true;
    return;
  }
  // CPUの番の間は、メニュー操作以外を受け付けない
  if (isCpuTurn() && !ALWAYS_ALLOWED.includes(d.act ?? '')) {
    showMessage('CPUの番です。少し待ってください');
    refresh();
    return;
  }
  const game = store.game;
  switch (d.act) {
    case 'start':      startGame(d.level ?? 'normal'); break;
    case 'resume':     resumeGame(); break;
    case 'rules':      openRules(); break;
    case 'closeRules': $('#rulesScreen').hidden = true; break;
    case 'menu':       openMenu(); break;
    case 'closeMenu':  $('#menuScreen').hidden = true; break;
    case 'toStart':    $('#menuScreen').hidden = true; showStartScreen(); break;
    case 'log':        $('#menuScreen').hidden = true; $('#logScreen').hidden = false; $('#logScreen').scrollTop = 0; break;
    case 'closeLog':   $('#logScreen').hidden = true; break;
    case 'showResult': if (game) showResult(game); break;
    case 'closeResult': hideResult(); break;
    // マウスはカーソルを当てた時点で出ているので、クリックで消さない
    case 'cardsTip':   if ((e as PointerEvent).pointerType === 'mouse') showCardTip(el); else toggleCardTip(el); break;
    case 'bank':       onTapBank(d.color as TokenColor); break;
    case 'card':       onTapCard({ type: 'board', level: toLevel(d.level), index: Number(d.index) }); break;
    case 'deck':       onTapCard({ type: 'deck', level: toLevel(d.level) }); break;
    case 'reserved':   onTapCard({ type: 'reserved', index: Number(d.index) }); break;
    case 'take':       if (game) run(() => actTakeTokens(game, ui.tokens.slice() as GemColor[])); break;
    case 'buy':        if (game) run(() => actBuy(game, ui.target)); break;
    case 'reserve':    if (game) run(() => actReserve(game, ui.target)); break;
    case 'discard':    if (game) run(() => actDiscard(game, d.color as TokenColor)); break;
    case 'noble':      if (game) run(() => actChooseNoble(game, d.id ?? '')); break;
    case 'pass':       if (game) run(() => actPass(game)); break;
    case 'clear':      resetSelection(); ui.message = ''; refresh(); break;
    case 'newgame':    showStartScreen(); break;
  }
}

const isCpuLevel = (v: string): v is CpuLevel => v === 'easy' || v === 'normal' || v === 'hard';

// 開始画面で強さを選んだとき
function startGame(level: string): void {
  // 保存された続きがある場合は、消してよいか確認する
  if (loadSave() && !confirm('保存されている続きは消えます。新しく始めますか？')) return;
  stopCpu();
  clearSave();
  if (level === 'pvp' || !isCpuLevel(level)) {
    settings.mode = 'pvp';
    store.game = createGame(['プレイヤー1', 'プレイヤー2']);
  } else {
    settings.mode = 'cpu';
    settings.level = level;
    store.game = createGame(['あなた', `CPU（${CPU_LEVELS[level]}）`]);
  }
  resetSelection();
  resetTracking();
  ui.message = '';
  $('#startScreen').hidden = true;
  refresh();
}

// 保存データから続きを始める
function resumeGame(): void {
  const save = loadSave();
  if (!save) { renderStartScreen(null); return; }
  stopCpu();
  Object.assign(settings, save.settings);
  store.game = save.game;
  resetSelection();
  resetTracking();
  showMessage('前回の続きから再開しました', 'info');
  $('#startScreen').hidden = true;
  refresh();
}

function showStartScreen(): void {
  stopCpu();
  hideResult();
  renderStartScreen(loadSave());
  $('#startScreen').hidden = false;
}

/** 起動 */
export function init(): void {
  document.addEventListener('click', onClick);
  initCardTip();
  renderDataCheck();
  checkStorage();
  showStartScreen();
}
