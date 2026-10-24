import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_DATA, NOBLE_DATA } from '../src/game/data.ts';
import { validateCardData } from '../src/game/validate.ts';
import { buildCards } from '../src/game/utils.ts';

test('カードデータの自動チェックがすべてOK', () => {
  const r = validateCardData();
  assert.equal(r.allOk, true, r.lines.join('\n'));
});

test('カード90枚・貴族10種', () => {
  assert.equal(CARD_DATA.length, 90);
  assert.equal(NOBLE_DATA.length, 10);
});

test('カードのidはすべて違う', () => {
  const ids = buildCards().map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('「要確認」のカードは4枚', () => {
  assert.equal(buildCards().filter(c => c.unsure).length, 4);
});
