/* ============================================================
   ゲーム画面の表示（state を見て HTML を作るだけ。ルールは変えない）
   ============================================================ */
import { canSee, isCpuTurn, store, ui } from '../app/state.ts';
import { recentIsDone } from '../app/tracker.ts';
import { ALL_TOKENS, COLORS, JP, LEVELS, RULES } from '../game/constants.ts';
import type { PlayerChange } from '../game/diff.ts';
import {
  calcPayment, checkBuy, checkReserve, checkTakeTokens, currentPlayer, getBonus, getCardAt, getPoints,
  hasAnyLegalAction, tokenCount,
} from '../game/rules.ts';
import type { CardSource, GameState, TokenColor } from '../game/types.ts';
import { cardLabel, sameSource, tokensText } from '../game/utils.ts';
import { validateCardData } from '../game/validate.ts';
import { NEW_BADGE, cardBackHTML, cardHTML, gemShape, nobleHTML, tokenHTML } from './components.ts';
import { $ } from './dom.ts';

/** 画面全体を描き直す */
export function render(): void {
  const game = store.game;
  if (!game) return;
  renderBanner(game);
  renderNobles(game);
  renderBank(game);
  renderCardRows(game);
  // 上に相手（プレイヤー2）、下に自分（プレイヤー1）。自分の手元を操作パネルの近くに置く
  renderSeat(game, 1, $('#opp'));
  renderSeat(game, 0, $('#me'));
  renderRecent(game);
  renderControls(game);
  renderLog(game);
}

/** 終わった手番の変化（なければ null） */
function doneRecent(game: GameState): PlayerChange | null {
  return recentIsDone(game) ? ui.recent : null;
}

function countOf(list: readonly TokenColor[], c: TokenColor): number {
  return list.filter(x => x === c).length;
}

// 上部：今の手番
function renderBanner(game: GameState): void {
  const el = $('#banner');
  const menuBtn = `<button class="icon-btn" data-act="menu" aria-label="メニューを開く">☰ メニュー</button>`;
  if (game.phase === 'gameover') {
    el.className = '';
    el.innerHTML = `<div class="turn-wrap"><div class="turn">ゲーム終了</div><div class="sub">${game.result?.text ?? ''}</div></div>${menuBtn}`;
    return;
  }
  const p = currentPlayer(game);
  el.className = 'p' + game.current;
  const sub = `R${game.round}` + (game.finalRound ? '・<b>最終ラウンド</b>' : '');
  const thinking = isCpuTurn() ? ' <span class="thinking">考え中…</span>' : '';
  el.innerHTML = `<div class="turn-wrap"><span class="turn-dot p${game.current}"></span>
    <div class="turn">${p.name}の番${thinking}</div><div class="sub">${sub}</div></div>${menuBtn}`;
}

function renderNobles(game: GameState): void {
  $('#nobles').innerHTML = (game.nobles.length
    ? game.nobles.map(n => nobleHTML(n, '', 'slim')).join('')
    : '<span class="hint">貴族は残っていません</span>') + '<span class="nobles-note">貴族<br>各3点</span>';
}

// 銀行（場のトークン）
function renderBank(game: GameState): void {
  const canSelect = game.phase === 'action' && !isCpuTurn();
  const fx = ui.fx;
  const recent = doneRecent(game);
  $('#bank').innerHTML = ALL_TOKENS.map(c => {
    const selN = countOf(ui.tokens, c);
    const pop = fx && fx.tokens.includes(c) ? 'fx-pop' : '';
    // 直前の手番で取られた数（どの色が減ったかを残しておく）
    const took = recent ? countOf(recent.gained, c) : 0;
    const tookTag = took ? `<span class="took-tag p${recent!.pi}" title="${recent!.name}が${took}個取った">−${took}</span>` : '';
    return `<button class="bank-btn ${selN ? 'sel' : ''} ${pop} ${took ? 'was-taken' : ''}" data-act="bank" data-color="${c}" ${canSelect ? '' : 'disabled'}
        aria-label="${JP[c]} 残り${game.bank[c]}個${took ? `（直前に${took}個取られた）` : ''}">
      ${tokenHTML(c)}
      <span class="bank-count">${game.bank[c]}</span>
      ${selN ? `<span class="sel-badge">+${selN}</span>` : ''}${tookTag}
    </button>`;
  }).join('');
}

function isSelected(src: CardSource): boolean {
  return sameSource(ui.target, src);
}

// 発展カードの列（上からレベル3・2・1）
function renderCardRows(game: GameState): void {
  const acting = game.phase === 'action' && !isCpuTurn();
  const p = currentPlayer(game);
  let html = '';
  for (const lv of [...LEVELS].reverse()) {
    const n = game.decks[lv].length;
    const deckSel = isSelected({ type: 'deck', level: lv }) ? 'sel' : '';
    html += `<div class="row">
      <button class="deck lv${lv} ${deckSel}" data-act="deck" data-level="${lv}" ${n && acting ? '' : 'disabled'} aria-label="レベル${lv}の山札 ${n}枚">
        <span class="deck-dots">${'◆'.repeat(lv)}</span><span>Lv${lv}</span><span class="deck-n">${n}枚</span></button>`;
    game.board[lv].forEach((card, i) => {
      if (!card) { html += `<div class="card fit empty"><span>なし</span></div>`; return; }
      const src: CardSource = { type: 'board', level: lv, index: i };
      const isNew = ui.newCards.has(card.id);
      const cls = [
        'fit',
        isSelected(src) ? 'sel' : '',
        acting && calcPayment(p, card).canPay ? 'afford' : '',
        isNew ? 'is-new' : '',
      ].join(' ');
      html += cardHTML(card, {
        attrs: `data-act="card" data-level="${lv}" data-index="${i}" ${acting ? '' : 'disabled'}`,
        cls,
        badge: isNew ? NEW_BADGE : '',
      });
    });
    html += `</div>`;
  }
  $('#cardRows').innerHTML = html;
}

// プレイヤー情報（1人分。場所が決まっているので、演出の飛び先にも使う）
function renderSeat(game: GameState, pi: number, el: HTMLElement): void {
  const p = game.players[pi];
  if (!p) return;
  const fx = ui.fx;
  const recent = doneRecent(game);
  const active = pi === game.current && game.phase !== 'gameover';
  const bonus = getBonus(p);
  const discarding = active && game.phase === 'discard' && !isCpuTurn();
  const myFx = fx && fx.pi === pi ? fx : null;
  const myRecent = recent && recent.pi === pi ? recent : null;
  const newColors = myFx ? myFx.cards.map(c => c.color) : [];
  const cells = ALL_TOKENS.map(c => {
    const gain = myFx && myFx.tokens.includes(c) ? 'fx-gain' : '';
    const gotN = myRecent ? countOf(myRecent.gained, c) : 0;
    const gotTag = gotN ? `<span class="got-tag">+${gotN}</span>` : '';
    const chip = tokenHTML(c, p.tokens[c], `pchip ${p.tokens[c] ? '' : 'zero'} ${gain}`);
    let b = '';
    if (c !== 'gold') {
      const boughtN = myRecent ? myRecent.bought.filter(card => card.color === c).length : 0;
      const boughtTag = boughtN ? `<span class="got-tag">+${boughtN}</span>` : '';
      b = `<span class="bonus-wrap"><span class="bonus-card c-${c} ${bonus[c] ? '' : 'zero'} ${newColors.includes(c) ? 'fx-shine' : ''} ${boughtN ? 'was-got' : ''}" title="${JP[c]}のボーナス（カード）">${gemShape(c)}${bonus[c]}</span>${boughtTag}</span>`;
    }
    const inner = `<span class="chip-wrap ${gotN ? 'was-got' : ''}">${chip}${gotTag}</span>${b}`;
    // 返却の場面では、マス全体を押せるボタンにする（小さなトークンでも押しやすいように）
    if (discarding && p.tokens[c] > 0) {
      return `<button class="pcell can-discard" data-color="${c}" data-act="discard" aria-label="${JP[c]}を1個返す">${inner}</button>`;
    }
    return `<div class="pcell" data-color="${c}" aria-label="${JP[c]} トークン${p.tokens[c]}個・ボーナス${c === 'gold' ? 0 : bonus[c]}">${inner}</div>`;
  }).join('');

  // 予約カード（手番の人は自分の予約カードをタップできる）。空き枠も出して、場所が動かないようにする
  const slots: string[] = p.reserved.map((card, i) => {
    const isNew = !!myRecent && myRecent.reserved.some(r => r.id === card.id);
    const badge = isNew ? NEW_BADGE : '';
    const newCls = isNew ? 'is-new' : '';
    if (!canSee(pi) && card.hidden) return cardBackHTML(card.level, `fit ${newCls}`, badge);
    const src: CardSource = { type: 'reserved', index: i };
    if (active && game.phase === 'action' && !isCpuTurn()) {
      const cls = ['fit', isSelected(src) ? 'sel' : '', calcPayment(p, card).canPay ? 'afford' : '', newCls].join(' ');
      return cardHTML(card, { attrs: `data-act="reserved" data-index="${i}"`, cls, badge });
    }
    return cardHTML(card, { attrs: 'disabled', cls: `fit ${newCls}`, badge });
  });
  while (slots.length < RULES.MAX_RESERVED) slots.push('<span class="card fit empty slot"><span>予約</span></span>');

  const glow = myFx && (myFx.nobles.length || myFx.cards.some(c => c.points > 0)) ? 'fx-glow' : '';
  const nobles = p.nobles.length
    ? `<span class="p-nobles ${myRecent && myRecent.nobles.length ? 'was-got' : ''}" title="来た貴族">${'<span class="crown"></span>'.repeat(p.nobles.length)}</span>` : '';
  el.className = `seat player p${pi} ${active ? 'active' : ''} ${myRecent ? 'just-moved' : ''}`;
  el.innerHTML = `<div class="ph">
      <span class="name">${p.name}</span>${active ? '<span class="turn-chip">手番</span>' : ''}${nobles}
      <span class="pinfo"><span title="トークンの数（10個まで）">●${tokenCount(p)}/${RULES.MAX_TOKENS}</span><span title="買ったカードの枚数">▮${p.cards.length}枚</span></span>
      <span class="pts ${glow}">${getPoints(p)}<small>点</small></span>
    </div>
    <div class="pbody"><div class="pgrid">${cells}</div><div class="reserved" aria-label="予約中のカード">${slots.join('')}</div></div>`;
}

// 操作パネルの上：直前の手番で何をしたか
function renderRecent(game: GameState): void {
  const el = $('#recentBar');
  const r = doneRecent(game);
  if (!r || !r.log.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const items: string[] = [];
  if (r.gained.length) items.push(`<span class="recent-toks">${r.gained.map(c => tokenHTML(c, '', 'mini')).join('')}</span>`);
  r.bought.forEach(card => items.push(cardHTML(card, { tag: 'span', cls: 'recent-card' })));
  r.reserved.forEach(card => items.push(
    card.hidden && !canSee(r.pi)
      ? `<span class="card back recent-card">Lv${card.level}</span>`
      : cardHTML(card, { tag: 'span', cls: 'recent-card' }),
  ));
  r.nobles.forEach(n => items.push(nobleHTML(n, '', 'slim recent-noble')));
  el.className = `recent p${r.pi}`;
  el.hidden = false;
  el.innerHTML = `<span class="recent-tag">直前</span>
    <span class="recent-items">${items.join('')}</span>
    <span class="recent-text">${r.log.join(' → ')}</span>`;
}

// 下部：操作パネル（場面ごとにボタンが変わる）
function renderControls(game: GameState): void {
  renderMessage();
  const body = $('#ctrlBody');
  const p = currentPlayer(game);

  // ゲーム終了
  if (game.phase === 'gameover') {
    body.innerHTML = `<div class="ctrl-line"><b class="hl">${game.result?.text ?? ''}</b> <span class="hint">${game.result?.detail ?? ''}</span></div>
      <div class="ctrl-row"><button class="btn primary" data-act="newgame">もう一度遊ぶ</button><button class="btn" data-act="showResult">結果を見る</button></div>`;
    return;
  }

  // CPUの番（操作はできない）
  if (isCpuTurn()) {
    body.innerHTML = `<div class="thinking-row">${gemShape('gold', 'spin')}<span class="thinking">${p.name}が考え中…</span></div>`;
    return;
  }

  // トークン返却
  if (game.phase === 'discard') {
    const over = tokenCount(p) - RULES.MAX_TOKENS;
    body.innerHTML = `<div class="ctrl-line"><b>トークンが10個を超えました。</b>${p.name}の手元の、点線で光っているトークンをタップして返してください。<b class="hl">あと${over}個</b></div>`;
    return;
  }

  // 貴族選択
  if (game.phase === 'noble') {
    const list = game.nobles.filter(n => game.nobleChoices.includes(n.id));
    body.innerHTML = `<div class="ctrl-line"><b>複数の貴族が訪問できます。1枚選んでください</b></div>
      <div class="ctrl-row">${list.map(n => nobleHTML(n, `data-act="noble" data-id="${n.id}"`, 'slim')).join('')}</div>`;
    return;
  }

  // 宝石を選択中
  if (ui.tokens.length) {
    const r = checkTakeTokens(game, ui.tokens);
    const chips = ui.tokens.map(c => tokenHTML(c, '', 'mini')).join('');
    // 1個だけ選んだときは、次に何をすればよいかを案内する
    const note = ui.tokens.length === 1 && !r.ok
      ? '<span class="hint">別の色を選ぶか、同じ色をもう一度タップで2個取り</span>'
      : (r.ok ? '' : `<span class="ng">${r.msg}</span>`);
    body.innerHTML = `<div class="ctrl-line">選択中:<span class="sel-tokens">${chips}</span> ${note}</div>
      <div class="ctrl-row">
        <button class="btn primary" data-act="take" ${r.ok ? '' : 'disabled'}>取る</button>
        <button class="btn" data-act="clear">選び直す</button>
      </div>`;
    return;
  }

  // カードを選択中
  if (ui.target) {
    const src = ui.target;
    const card = getCardAt(game, src);
    if (!card) {
      ui.target = null;
      renderControls(game);
      return;
    }
    // 1行目：カードの名前と、買える・買えない・予約できない理由
    const rb = src.type !== 'deck' ? checkBuy(game, src) : null;
    const rr = src.type !== 'reserved' ? checkReserve(game, src) : null;
    const notes: string[] = [];
    if (rb) notes.push(rb.ok ? `<span class="hint">支払い: ${tokensText(calcPayment(p, card).pay)}</span>` : `<span class="ng">${rb.msg}</span>`);
    if (rr && !rr.ok) notes.push(`<span class="ng">${rr.msg}</span>`);
    let html = src.type === 'deck'
      ? `<div class="ctrl-line"><b>レベル${src.level}の山札</b> <span class="hint">（伏せたまま予約できます）</span> ${notes.join(' ')}</div>`
      : `<div class="ctrl-line"><b>${cardLabel(card)}</b>${src.type === 'reserved' ? '<span class="hint">（予約中）</span>' : ''} ${notes.join(' ')}</div>`;
    html += '<div class="ctrl-row">';
    if (rb) html += `<button class="btn primary" data-act="buy" ${rb.ok ? '' : 'disabled'}>購入する</button>`;
    if (rr) {
      const goldNote = game.bank.gold > 0 ? '（金+1）' : '（金なし）';
      html += `<button class="btn" data-act="reserve" ${rr.ok ? '' : 'disabled'}>予約${rr.ok ? goldNote : ''}</button>`;
    }
    html += `<button class="btn" data-act="clear">やめる</button></div>`;
    body.innerHTML = html;
    return;
  }

  // 何も選んでいない
  const canPass = !hasAnyLegalAction(game);
  body.innerHTML = `<div class="hint ctrl-line">宝石をタップ（同じ色をもう一度で2個取り）、またはカード・山札をタップして購入／予約</div>
    ${canPass ? '<div class="ctrl-row"><span class="ng">できる行動がありません</span><button class="btn" data-act="pass">パスする</button></div>' : ''}`;
}

// メッセージは画面を押し広げないよう、操作パネルの上に少しの間だけ浮かべる
let shownMessage = '';
let shownSeq = -1;
function renderMessage(): void {
  const msg = $('#message');
  if (ui.message === shownMessage && ui.msgSeq === shownSeq) return;
  shownMessage = ui.message;
  shownSeq = ui.msgSeq;
  msg.textContent = ui.message;
  msg.className = '';
  if (!ui.message) return;
  void msg.offsetWidth; // アニメーションを最初からやり直すため
  msg.className = `${ui.msgType} show`;
}

// 対戦ログ（新しいものが上。直前の手番の分は色を付ける）
function renderLog(game: GameState): void {
  const r = doneRecent(game);
  const recentN = r ? r.log.length : 0;
  $('#log').innerHTML = game.log.slice().reverse()
    .map((t, i) => `<li class="${i < recentN ? `recent-log p${r!.pi}` : ''}">${t}</li>`).join('');
}

// カードデータ確認（最初に1回だけ表示）
export function renderDataCheck(): void {
  const r = validateCardData();
  $('#dataCheckSummary').textContent = `カードデータ確認: ${r.allOk ? 'OK ✅' : '問題あり ❌'}`;
  const rows = COLORS.map(c => {
    const t = r.table[c];
    return `<tr><th>${JP[c]}</th><td>${t[1]}</td><td>${t[2]}</td><td>${t[3]}</td><td>${t[1] + t[2] + t[3]}</td></tr>`;
  }).join('');
  $('#dataCheckBody').innerHTML = r.lines.map(l => `<div>${l}</div>`).join('') +
    `<table><tr><th>色</th><th>Lv1</th><th>Lv2</th><th>Lv3</th><th>計</th></tr>${rows}</table>`;
}
