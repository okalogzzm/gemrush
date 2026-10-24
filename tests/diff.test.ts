import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffPlayer, hasChange, newBoardCardIds, snapshot } from '../src/game/diff.ts';
import { actBuy, actReserve, actTakeTokens } from '../src/game/rules.ts';
import { makeCard, seededGame } from './helpers.ts';

test('宝石を取った変化がわかる', () => {
  const g = seededGame();
  const s = snapshot(g);
  actTakeTokens(g, ['red', 'blue', 'green']);
  const ch = diffPlayer(s, g, 0);
  assert.deepEqual(ch.gained.sort(), ['blue', 'green', 'red']);
  assert.equal(ch.bought.length, 0);
  assert.equal(hasChange(ch), true);
  assert.equal(ch.log.length, 1);
  assert.deepEqual(newBoardCardIds(s, g), [], '場のカードは変わらない');
  assert.equal(hasChange(diffPlayer(s, g, 1)), false, '相手は何も変わらない');
});

test('購入したカード・支払い・補充されたカードがわかる', () => {
  const g = seededGame();
  const card = makeCard('red', 1, { white: 2 });
  g.board[1][2] = card;
  g.players[0]!.tokens.white = 2;
  const s = snapshot(g);
  actBuy(g, { type: 'board', level: 1, index: 2 });
  const ch = diffPlayer(s, g, 0);
  assert.equal(ch.bought[0]!.id, card.id);
  assert.equal(ch.spent.white, 2);
  const ids = newBoardCardIds(s, g);
  assert.equal(ids.length, 1);
  assert.equal(ids[0], g.board[1][2]!.id);
});

test('予約したカードと金がわかる', () => {
  const g = seededGame();
  const card = g.board[2][3]!;
  const s = snapshot(g);
  actReserve(g, { type: 'board', level: 2, index: 3 });
  const ch = diffPlayer(s, g, 0);
  assert.equal(ch.reserved[0]!.id, card.id);
  assert.deepEqual(ch.gained, ['gold']);
  assert.equal(newBoardCardIds(s, g).length, 1);
});
