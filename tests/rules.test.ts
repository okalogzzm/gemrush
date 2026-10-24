import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { COLORS, LEVELS, RULES } from '../src/game/constants.ts';
import {
  actBuy, actChooseNoble, actDiscard, actPass, actReserve, actTakeTokens, calcPayment,
  checkTakeTokens, getPoints, hasAnyLegalAction, tokenCount,
} from '../src/game/rules.ts';
import { makeCard, makeNoble, seededGame, totalCards } from './helpers.ts';

describe('準備', () => {
  test('2人用の初期配置', () => {
    const g = seededGame(1);
    COLORS.forEach(c => assert.equal(g.bank[c], 4));
    assert.equal(g.bank.gold, 5);
    LEVELS.forEach(lv => assert.equal(g.board[lv].filter(Boolean).length, 4));
    assert.equal(g.decks[1].length, 36);
    assert.equal(g.decks[2].length, 26);
    assert.equal(g.decks[3].length, 16);
    assert.equal(g.nobles.length, 3);
    assert.equal(totalCards(g), 90);
    assert.equal(g.phase, 'action');
  });
});

describe('宝石を取る', () => {
  test('違う色を3個取れる', () => {
    const g = seededGame();
    assert.ok(actTakeTokens(g, ['white', 'blue', 'green']).ok);
    const p = g.players[0]!;
    assert.deepEqual([p.tokens.white, p.tokens.blue, p.tokens.green], [1, 1, 1]);
    assert.equal(g.bank.white, 3);
    assert.equal(g.current, 1, '手番が相手に移る');
  });

  test('違う色を2個だけは取れない（3色以上残っているとき）', () => {
    const g = seededGame();
    assert.equal(checkTakeTokens(g, ['white', 'blue']).ok, false);
  });

  test('残りが2色しかなければ2個でもよい', () => {
    const g = seededGame();
    g.bank.green = 0; g.bank.red = 0; g.bank.black = 0;
    assert.ok(checkTakeTokens(g, ['white', 'blue']).ok);
  });

  test('同じ色2個は、残り4個のときだけ', () => {
    const g = seededGame();
    assert.ok(checkTakeTokens(g, ['red', 'red']).ok);
    g.bank.red = 3;
    const r = checkTakeTokens(g, ['red', 'red']);
    assert.equal(r.ok, false);
  });

  test('金は取れない', () => {
    const g = seededGame();
    assert.equal(checkTakeTokens(g, ['gold', 'red', 'blue']).ok, false);
  });

  test('4個以上は取れない', () => {
    const g = seededGame();
    assert.equal(checkTakeTokens(g, ['white', 'blue', 'green', 'red']).ok, false);
  });
});

describe('予約する', () => {
  test('場のカードを予約すると金が1個もらえ、場が補充される', () => {
    const g = seededGame();
    const card = g.board[1][0]!;
    const deckBefore = g.decks[1].length;
    assert.ok(actReserve(g, { type: 'board', level: 1, index: 0 }).ok);
    const p = g.players[0]!;
    assert.equal(p.reserved[0]!.id, card.id);
    assert.equal(p.tokens.gold, 1);
    assert.equal(g.bank.gold, 4);
    assert.notEqual(g.board[1][0]!.id, card.id);
    assert.equal(g.decks[1].length, deckBefore - 1);
  });

  test('山札から予約したカードは伏せ札になる', () => {
    const g = seededGame();
    assert.ok(actReserve(g, { type: 'deck', level: 3 }).ok);
    assert.equal(g.players[0]!.reserved[0]!.hidden, true);
  });

  test('予約は3枚まで', () => {
    const g = seededGame();
    for (let i = 0; i < 3; i++) {
      g.current = 0; g.phase = 'action';
      assert.ok(actReserve(g, { type: 'deck', level: 1 }).ok);
    }
    g.current = 0; g.phase = 'action';
    assert.equal(actReserve(g, { type: 'deck', level: 1 }).ok, false);
  });

  test('金が品切れでも予約はできる', () => {
    const g = seededGame();
    g.bank.gold = 0;
    assert.ok(actReserve(g, { type: 'board', level: 2, index: 1 }).ok);
    assert.equal(g.players[0]!.tokens.gold, 0);
    assert.match(g.log.at(-1)!, /品切れ/);
  });
});

describe('購入する', () => {
  test('ボーナスで割引され、足りない分は金で払う', () => {
    const g = seededGame();
    const p = g.players[0]!;
    p.cards.push(makeCard('red', 0, { white: 1 }));  // 赤のボーナス1
    p.tokens.red = 1;
    p.tokens.black = 1;
    p.tokens.gold = 1;
    const target = makeCard('blue', 2, { red: 2, black: 2 }, 2);
    // 赤: 2-1=1 → 赤1 / 黒: 2 → 黒1＋金1
    const pay = calcPayment(p, target);
    assert.equal(pay.canPay, true);
    assert.deepEqual(pay.pay, { white: 0, blue: 0, green: 0, red: 1, black: 1, gold: 1 });

    g.board[2][0] = target;
    const bankBefore = { ...g.bank };
    assert.ok(actBuy(g, { type: 'board', level: 2, index: 0 }).ok);
    assert.equal(getPoints(p), 2);
    assert.equal(g.bank.red, bankBefore.red + 1);
    assert.equal(g.bank.gold, bankBefore.gold + 1);
    assert.equal(tokenCount(p), 0);
  });

  test('足りなければ買えない', () => {
    const g = seededGame();
    g.board[1][0] = makeCard('white', 0, { red: 3 });
    assert.equal(actBuy(g, { type: 'board', level: 1, index: 0 }).ok, false);
  });

  test('予約したカードを買える', () => {
    const g = seededGame();
    const p = g.players[0]!;
    const c = makeCard('green', 1, { white: 1 });
    p.reserved.push(c);
    p.tokens.white = 1;
    assert.ok(actBuy(g, { type: 'reserved', index: 0 }).ok);
    assert.equal(p.reserved.length, 0);
    assert.equal(p.cards[0]!.id, c.id);
  });

  test('山札のカードは直接買えない', () => {
    const g = seededGame();
    assert.equal(actBuy(g, { type: 'deck', level: 1 }).ok, false);
  });
});

describe('手番の終わり', () => {
  test('10個を超えたら返却の場面になり、10個で手番が終わる', () => {
    const g = seededGame();
    const p = g.players[0]!;
    p.tokens.white = 3; p.tokens.blue = 3; p.tokens.green = 3; // 9個
    assert.ok(actTakeTokens(g, ['red', 'black', 'white']).ok); // 12個
    assert.equal(g.phase, 'discard');
    assert.equal(g.current, 0);
    assert.ok(actDiscard(g, 'white').ok);
    assert.equal(g.phase, 'discard');
    assert.ok(actDiscard(g, 'white').ok);
    assert.equal(tokenCount(p), RULES.MAX_TOKENS);
    assert.equal(g.phase, 'action');
    assert.equal(g.current, 1);
  });

  test('貴族の条件を満たすと自動で来る', () => {
    const g = seededGame();
    const p = g.players[0]!;
    g.nobles = [makeNoble('nx', { red: 1 })];
    g.board[1][0] = makeCard('red', 0, { white: 1 });
    p.tokens.white = 1;
    assert.ok(actBuy(g, { type: 'board', level: 1, index: 0 }).ok);
    assert.equal(p.nobles.length, 1);
    assert.equal(getPoints(p), 3);
    assert.equal(g.nobles.length, 0);
  });

  test('2枚同時に満たしたら選ぶ（1手番に1枚だけ）', () => {
    const g = seededGame();
    const p = g.players[0]!;
    g.nobles = [makeNoble('na', { red: 1 }), makeNoble('nb', { red: 1 }), makeNoble('nc', { blue: 9 })];
    g.board[1][0] = makeCard('red', 0, { white: 1 });
    p.tokens.white = 1;
    assert.ok(actBuy(g, { type: 'board', level: 1, index: 0 }).ok);
    assert.equal(g.phase, 'noble');
    assert.deepEqual(g.nobleChoices.sort(), ['na', 'nb']);
    assert.equal(actChooseNoble(g, 'nc').ok, false);
    assert.ok(actChooseNoble(g, 'nb').ok);
    assert.equal(p.nobles.length, 1);
    assert.equal(g.current, 1);
  });
});

describe('ゲームの終わり', () => {
  test('15点で最終ラウンドに入り、後手の手番のあとで終わる', () => {
    const g = seededGame();
    const p0 = g.players[0]!;
    p0.cards.push(makeCard('white', 14, { red: 1 }, 3));
    g.board[1][0] = makeCard('blue', 1, { white: 1 });
    p0.tokens.white = 1;
    assert.ok(actBuy(g, { type: 'board', level: 1, index: 0 }).ok);
    assert.equal(g.finalRound, true);
    assert.equal(g.phase, 'action', '後手の手番が残っている');
    assert.equal(g.current, 1);
    assert.ok(actTakeTokens(g, ['white', 'blue', 'green']).ok);
    assert.equal(g.phase, 'gameover');
    assert.equal(g.result!.winner, 0);
  });

  test('同点なら購入カードが少ない方の勝ち', () => {
    const g = seededGame();
    const [p0, p1] = g.players as [typeof g.players[0], typeof g.players[0]];
    p0.cards.push(makeCard('white', 15, { red: 1 }, 3), makeCard('white', 0, { red: 1 }));
    p1.cards.push(makeCard('blue', 15, { red: 1 }, 3));
    g.finalRound = true;
    g.current = 1; // 後手の手番を終えると終了
    assert.ok(actTakeTokens(g, ['white', 'blue', 'green']).ok);
    assert.equal(g.phase, 'gameover');
    assert.equal(g.result!.winner, 1);
    assert.match(g.result!.text, /購入カードが少ない/);
  });

  test('得点もカード数も同じなら引き分け', () => {
    const g = seededGame();
    g.players[0]!.cards.push(makeCard('white', 15, { red: 1 }, 3));
    g.players[1]!.cards.push(makeCard('blue', 15, { red: 1 }, 3));
    g.finalRound = true;
    g.current = 1;
    assert.ok(actTakeTokens(g, ['white', 'blue', 'green']).ok);
    assert.equal(g.result!.winner, null);
  });
});

describe('パス', () => {
  test('何か行動できるときはパスできない', () => {
    const g = seededGame();
    assert.equal(actPass(g).ok, false);
  });

  test('どの行動もできないときだけパスできる', () => {
    const g = seededGame();
    COLORS.forEach(c => (g.bank[c] = 0));
    g.players[0]!.reserved = [makeCard('red', 0, { white: 9 }), makeCard('red', 0, { white: 9 }), makeCard('red', 0, { white: 9 })];
    LEVELS.forEach(lv => { g.board[lv] = g.board[lv].map(() => makeCard('red', 0, { white: 9 })); });
    assert.equal(hasAnyLegalAction(g), false);
    assert.ok(actPass(g).ok);
    assert.equal(g.current, 1);
  });
});
