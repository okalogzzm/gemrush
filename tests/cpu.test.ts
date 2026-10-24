import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chooseCpuMove, type CpuLevel } from '../src/cpu/index.ts';
import { checkMove, listLegalMoves, applyMove } from '../src/cpu/moves.ts';
import { resolvePending } from '../src/cpu/pending.ts';
import { RULES } from '../src/game/constants.ts';
import { tokenCount } from '../src/game/rules.ts';
import type { GameState } from '../src/game/types.ts';
import { randomPick } from '../src/game/utils.ts';
import { makeCard, seededGame, totalCards, totalTokens } from './helpers.ts';

/** 1ゲームを最後まで進める。levels[i] が null なら、ランダムな合法手 */
function playOut(g: GameState, levels: (CpuLevel | null)[], check?: (g: GameState) => void, timeLimit = 60_000): GameState {
  let turns = 0;
  while (g.phase !== 'gameover' && turns++ < 400) {
    const pi = g.current;
    const level = levels[pi] ?? null;
    const move = level
      ? chooseCpuMove(g, pi, level, { timeLimit })
      : randomPick(listLegalMoves(g));
    assert.ok(move, '手が見つかる');
    assert.ok(checkMove(g, move).ok, `選んだ手が合法: ${JSON.stringify(move)}`);
    assert.ok(applyMove(g, move).ok);
    resolvePending(g, pi, level ?? 'easy');
    check?.(g);
  }
  return g;
}

describe('合法手', () => {
  test('最初の局面：異なる色3個は10通り・同じ色2個は5通り・予約15通り', () => {
    const g = seededGame(3);
    const moves = listLegalMoves(g);
    assert.equal(moves.filter(m => m.type === 'take' && m.colors.length === 3).length, 10);
    assert.equal(moves.filter(m => m.type === 'take' && m.colors.length === 2).length, 5);
    assert.equal(moves.filter(m => m.type === 'reserve').length, 15);
  });

  test('返却の場面では合法手はない', () => {
    const g = seededGame();
    g.phase = 'discard';
    assert.deepEqual(listLegalMoves(g), []);
  });
});

describe('ランダムな手で通して遊ぶ（数がいつも正しいか）', () => {
  test('100ゲーム：トークンとカードの数が常に正しい', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const g = seededGame(seed);
      playOut(g, [null, null], s => {
        assert.equal(totalCards(s), 90);
        const t = totalTokens(s);
        (['white', 'blue', 'green', 'red', 'black'] as const).forEach(c => assert.equal(t[c], RULES.TOKENS_PER_COLOR));
        assert.equal(t.gold, RULES.GOLD_TOKENS);
        s.players.forEach(p => {
          assert.ok(p.reserved.length <= RULES.MAX_RESERVED);
          if (s.phase === 'action') assert.ok(tokenCount(p) <= RULES.MAX_TOKENS);
        });
      });
    }
  });
});

describe('CPUの強さごと', () => {
  for (const level of ['easy', 'normal', 'hard'] as const) {
    test(`${level}：最後まで合法手で遊び切れる`, () => {
      const g = playOut(seededGame(level.length + 7), [level, level]);
      assert.equal(g.phase, 'gameover');
    });
  }

  // さいきょうは深く読むので時間がかかる。相手を easy にし、考える時間も短くして、合法手だけを確かめる
  test('expert：最後まで合法手で遊び切れる', () => {
    const g = playOut(seededGame(13), ['expert', 'easy'], undefined, 60);
    assert.equal(g.phase, 'gameover');
  });

  test('ふつう：買えるカードがあれば買う', () => {
    const g = seededGame(5);
    g.current = 1;
    const p = g.players[1]!;
    g.board[1][0] = makeCard('red', 1, { white: 1 });
    p.tokens.white = 1;
    const m = chooseCpuMove(g, 1, 'normal');
    assert.equal(m?.type, 'buy');
  });

  for (const level of ['hard', 'expert'] as const) {
    test(`${level}：15点に届く購入を見逃さない`, () => {
      const g = seededGame(6);
      g.current = 1;
      const p = g.players[1]!;
      p.cards.push(makeCard('white', 12, { red: 1 }, 3));
      g.board[3][2] = makeCard('green', 4, { blue: 1 }, 3);
      p.tokens.blue = 1;
      const m = chooseCpuMove(g, 1, level, { timeLimit: 60_000 });
      assert.deepEqual(m, { type: 'buy', src: { type: 'board', level: 3, index: 2 } });
    });
  }

  test('CPUは相手の伏せ札の中身を先読みに使わない（伏せ札を持っていても動ける）', () => {
    const g = seededGame(9);
    g.players[0]!.reserved.push({ ...makeCard('red', 5, { white: 1 }, 3), hidden: true });
    g.current = 1;
    const m = chooseCpuMove(g, 1, 'hard', { timeLimit: 60_000 });
    assert.ok(m && checkMove(g, m).ok);
  });
});
