import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAVE_KEY } from '../src/app/save.ts';
import { DEFAULT_SOUND, SOUND_KEY, loadSoundSettings, parseSoundSettings, saveSoundSettings, type SoundStorage } from '../src/audio/settings.ts';
import { BGM_LOOP_SEC, BGM_RATE, composeBgm } from '../src/audio/bgm.ts';
import { hz } from '../src/audio/synth.ts';

function memoryStorage(): SoundStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

test('音の設定：はじめては BGM・効果音ともオン', () => {
  assert.deepEqual(parseSoundSettings(null), { bgm: true, se: true });
  assert.deepEqual(DEFAULT_SOUND, { bgm: true, se: true });
});

test('音の設定：保存して読み直すと同じになる', () => {
  const st = memoryStorage();
  saveSoundSettings({ bgm: false, se: true }, st);
  assert.deepEqual(loadSoundSettings(st), { bgm: false, se: true });
});

test('音の設定：壊れたデータや足りない項目は、初めの設定で補う', () => {
  assert.deepEqual(parseSoundSettings('こわれた'), { bgm: true, se: true });
  assert.deepEqual(parseSoundSettings('{"se":false}'), { bgm: true, se: false });
  assert.deepEqual(parseSoundSettings('{"bgm":"no"}'), { bgm: true, se: true });
});

test('音の設定：ゲームの保存データとは別のキー', () => {
  assert.notEqual(SOUND_KEY, SAVE_KEY);
});

test('音名から周波数', () => {
  assert.equal(hz('A4'), 440);
  assert.ok(Math.abs(hz('C4') - 261.63) < 0.01);
  assert.ok(Math.abs(hz('Bb3') - 233.08) < 0.01);
  assert.ok(Math.abs(hz('F#5') - 739.99) < 0.01);
});

test('BGM：1回分の長さで、音が割れない（-1〜1 に収まる）', () => {
  const t0 = performance.now();
  const wave = composeBgm();
  const ms = performance.now() - t0;
  assert.equal(wave.length, Math.round(BGM_LOOP_SEC * BGM_RATE));
  let peak = 0;
  let sum = 0;
  for (const v of wave) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  assert.ok(peak < 0.95, `いちばん大きい所 ${peak}`);
  assert.ok(Math.sqrt(sum / wave.length) > 0.01, '音が入っている');
  // スマホで重くならないように、パソコンでは一瞬で作れること
  assert.ok(ms < 2000, `作るのにかかった時間 ${Math.round(ms)}ms`);
});

test('BGM：くり返しのつなぎ目で、音が急に飛ばない', () => {
  const wave = composeBgm();
  const jump = Math.abs(wave[0]! - wave[wave.length - 1]!);
  assert.ok(jump < 0.1, `つなぎ目の差 ${jump}`);
});
