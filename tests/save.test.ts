import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAVE_KEY, checkStorage, clearSave, loadSave, saveGame, saveStatus, type StorageLike } from '../src/app/save.ts';
import type { Settings } from '../src/app/state.ts';
import { actTakeTokens } from '../src/game/rules.ts';
import { seededGame } from './helpers.ts';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: k => { data.delete(k); },
  };
}

const settings: Settings = { mode: 'cpu', level: 'hard', cpuIndex: 1 };

test('保存して読み込むと同じ状態に戻る', () => {
  const st = memoryStorage();
  const g = seededGame(4);
  actTakeTokens(g, ['red', 'blue', 'green']);
  saveGame(g, settings, st);
  assert.equal(saveStatus.ok, true);
  const loaded = loadSave(st);
  assert.ok(loaded);
  assert.deepEqual(loaded.game, JSON.parse(JSON.stringify(g)));
  assert.deepEqual(loaded.settings, settings);
});

test('終わったゲームは保存を消す', () => {
  const st = memoryStorage();
  const g = seededGame();
  saveGame(g, settings, st);
  g.phase = 'gameover';
  saveGame(g, settings, st);
  assert.equal(st.data.has(SAVE_KEY), false);
});

test('壊れた保存データは読まない', () => {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, '{こわれている');
  assert.equal(loadSave(st), null);
  st.setItem(SAVE_KEY, JSON.stringify({ version: 2, settings, game: {} }));
  assert.equal(loadSave(st), null);
  clearSave(st);
  assert.equal(loadSave(st), null);
});

test('保存できない環境でも止まらない', () => {
  const broken: StorageLike = {
    getItem: () => { throw new Error('x'); },
    setItem: () => { throw new Error('x'); },
    removeItem: () => { throw new Error('x'); },
  };
  checkStorage(broken);
  assert.equal(saveStatus.ok, false);
  assert.doesNotThrow(() => saveGame(seededGame(), settings, broken));
  assert.equal(loadSave(broken), null);
  assert.doesNotThrow(() => clearSave(broken));
});
