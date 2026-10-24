/* ============================================================
   音の設定（BGM・効果音のオン／オフ）
   ------------------------------------------------------------
   ・ゲームの保存データ（gemrush-save-v1）とは別のキーに保存する
     （保存データの形を変えずにすむように）
   ・読み書きに失敗しても、ゲームが止まらないように try/catch で囲む
   ============================================================ */

export const SOUND_KEY = 'gemrush-sound-v1';

export interface SoundSettings {
  bgm: boolean;  // BGM
  se: boolean;   // 効果音
}

/** 保存先（テストでは偽物を渡せる） */
export type SoundStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** はじめて遊ぶ人は、どちらもオン */
export const DEFAULT_SOUND: SoundSettings = { bgm: true, se: true };

function defaultStorage(): SoundStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** 保存された文字列を読む（壊れていたら初めの設定に戻す） */
export function parseSoundSettings(text: string | null): SoundSettings {
  if (!text) return { ...DEFAULT_SOUND };
  try {
    const v = JSON.parse(text) as Partial<SoundSettings> | null;
    return {
      bgm: typeof v?.bgm === 'boolean' ? v.bgm : DEFAULT_SOUND.bgm,
      se: typeof v?.se === 'boolean' ? v.se : DEFAULT_SOUND.se,
    };
  } catch {
    return { ...DEFAULT_SOUND };
  }
}

export function loadSoundSettings(storage = defaultStorage()): SoundSettings {
  try { return parseSoundSettings(storage?.getItem(SOUND_KEY) ?? null); } catch { return { ...DEFAULT_SOUND }; }
}

export function saveSoundSettings(s: SoundSettings, storage = defaultStorage()): void {
  try { storage?.setItem(SOUND_KEY, JSON.stringify({ bgm: s.bgm, se: s.se })); } catch { /* 保存できなくても音は切り替わる */ }
}
