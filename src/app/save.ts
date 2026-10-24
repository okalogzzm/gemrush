/* ============================================================
   途中保存（localStorage）
   ------------------------------------------------------------
   ・保存や読み込みに失敗しても、ゲームが止まらないように try/catch で囲む
   ・前の版（1ファイル版）の保存データもそのまま読める（キーと形を変えていない）
   ============================================================ */
import type { GameState } from '../game/types.ts';
import type { Settings } from './state.ts';

export const SAVE_KEY = 'gemrush-save-v1';

export interface SaveData {
  version: 1;
  savedAt: number;
  settings: Settings;
  game: GameState;
}

/** 保存先（テストでは偽物を渡せる） */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** null: 未確認 / true: 保存できた / false: 保存できない */
export const saveStatus: { ok: boolean | null } = { ok: null };

function defaultStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function saveGame(game: GameState | null, settings: Settings, storage = defaultStorage()): void {
  if (!game) return;
  try {
    if (!storage) throw new Error('保存先がありません');
    if (game.phase === 'gameover') {
      storage.removeItem(SAVE_KEY); // 終わったゲームは「続きから」に出さない
    } else {
      const data: SaveData = { version: 1, savedAt: Date.now(), settings, game };
      storage.setItem(SAVE_KEY, JSON.stringify(data));
    }
    saveStatus.ok = true;
  } catch {
    saveStatus.ok = false;
  }
}

/** 保存データを読み込む（なければ・壊れていれば null） */
export function loadSave(storage = defaultStorage()): SaveData | null {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> | null;
    const g = data?.game;
    const valid = !!data && data.version === 1 && !!data.settings && !!g &&
      Array.isArray(g.players) && g.players.length === 2 &&
      !!g.board && !!g.decks && !!g.bank && Array.isArray(g.nobles) && Array.isArray(g.log) &&
      g.phase !== 'gameover';
    return valid ? (data as SaveData) : null;
  } catch {
    return null;
  }
}

export function clearSave(storage = defaultStorage()): void {
  try { storage?.removeItem(SAVE_KEY); } catch { /* 保存できない環境では何もしない */ }
}

/** このブラウザで保存が使えるかを最初に確かめる */
export function checkStorage(storage = defaultStorage()): void {
  try {
    if (!storage) throw new Error('保存先がありません');
    storage.setItem(SAVE_KEY + '-test', '1');
    storage.removeItem(SAVE_KEY + '-test');
    saveStatus.ok = true;
  } catch {
    saveStatus.ok = false;
  }
}
