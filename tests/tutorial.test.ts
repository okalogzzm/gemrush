/* チュートリアルの盤面と、案内どおりに進めたときの流れ */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { store } from '../src/app/state.ts';
import {
  BUY_TARGET, OPP_MOVES, RESERVE_TARGET, STEPS, buildTutorialGame, nextStep, prevStep, prevStepIndex, startTutorial,
  stopTutorial, syncTutorial, tutorial,
} from '../src/app/tutorial.ts';
import { applyMove } from '../src/cpu/index.ts';
import { actBuy, actReserve, actTakeTokens, getBonus } from '../src/game/rules.ts';

test('チュートリアル：決めたカードが決めた場所にあり、先手は「あなた」', () => {
  const g = buildTutorialGame();
  const card = g.board[BUY_TARGET.level][BUY_TARGET.index];
  assert.ok(card);
  assert.equal(card.color, 'black');
  assert.deepEqual(card.cost, { white: 1, blue: 2, green: 1, red: 1, black: 0 });
  assert.equal(g.current, 0);
  assert.equal(g.players[1]?.name, 'CPU Lv1');
});

test('チュートリアル：案内どおりの操作と相手の決まった手が、すべてルールどおりに通る', () => {
  const g = buildTutorialGame();
  const opp = (i: number) => {
    const m = OPP_MOVES[i];
    assert.ok(m);
    assert.deepEqual(applyMove(g, m), { ok: true });
    assert.equal(g.current, 0);
  };
  assert.deepEqual(actTakeTokens(g, ['white', 'green', 'red']), { ok: true });
  opp(0);
  assert.deepEqual(actTakeTokens(g, ['blue', 'blue']), { ok: true });
  opp(1);
  assert.deepEqual(actBuy(g, { type: 'board', ...BUY_TARGET }), { ok: true });
  assert.equal(getBonus(g.players[0]!).black, 1);
  opp(2);
  assert.deepEqual(actReserve(g, { type: 'board', ...RESERVE_TARGET }), { ok: true });
  assert.equal(g.players[0]!.tokens.gold, 1);
  opp(3);
  assert.equal(g.phase, 'action');
  // 相手の手の数と、案内の「相手の番を待つ」の数がそろっている
  assert.equal(STEPS.filter(s => s.kind === 'wait').length, OPP_MOVES.length);
});

test('チュートリアル：相手の番の案内は10秒出しておき、「次へ」で飛ばせる', () => {
  startTutorial();
  nextStep(); nextStep();                         // 2つの説明を読む
  const g = store.game!;
  assert.deepEqual(actTakeTokens(g, ['white', 'green', 'red']), { ok: true });
  syncTutorial(g);
  assert.equal(STEPS[tutorial.step]?.kind, 'wait');
  assert.equal(STEPS[tutorial.step]?.minMs, 10000);
  applyMove(g, OPP_MOVES[0]!);
  syncTutorial(g);
  assert.equal(STEPS[tutorial.step]?.kind, 'wait'); // 相手が打っても、すぐには次へ進まない
  nextStep();
  syncTutorial(g);
  assert.equal(STEPS[tutorial.step]?.kind, 'do');   // 「次へ」で進む
  stopTutorial();
});

test('チュートリアル：「戻る」で1つ前の案内と盤面に戻る（相手の番の案内は飛ばす）', () => {
  startTutorial();
  assert.equal(prevStepIndex(), -1);                // 最初は戻れない
  nextStep(); nextStep();
  const g = store.game!;
  actTakeTokens(g, ['white', 'green', 'red']);
  syncTutorial(g);                                  // 相手の番の案内へ
  prevStep();
  assert.equal(tutorial.step, 2);                   // 宝石を取る案内へ戻る
  assert.equal(store.game!.current, 0);
  assert.equal(store.game!.players[0]!.tokens.white, 0);
  prevStep();
  assert.equal(tutorial.step, 1);
  stopTutorial();
});
