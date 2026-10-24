/* ============================================================
   音の出口（AudioContext）と、BGM・効果音のオン／オフ
   ------------------------------------------------------------
   ・ブラウザは「画面に一度ふれるまで」音を出させてくれないので、
     最初のタップで音の準備をして、BGM を流し始める
   ・アプリが裏に回ったら音を止め（電池と発熱の節約）、戻ったら再開する
   ・iPhone では「消音モード」のときは鳴らさず、ほかのアプリの音楽とも重ねて鳴らせるようにする
   ============================================================ */
import { renderBgm } from './bgm.ts';
import { loadSoundSettings, saveSoundSettings, type SoundSettings } from './settings.ts';

/** 今の設定（画面のボタンの表示にも使う） */
export const sound: SoundSettings = loadSoundSettings();

const BGM_VOL = 0.32;
const SE_VOL = 0.8;

let ctx: AudioContext | null = null;
let seBus: GainNode | null = null;
let bgmBus: GainNode | null = null;
let bgmSrc: AudioBufferSourceNode | null = null;
let bgmStarting = false;

/** 起動のときに1回。最初のタップを待って、音の準備をする */
export function initAudio(): void {
  const unlock = (): void => { void wake(); };
  // iPhone は click や touchend の中でないと音を出せないことがあるので、いくつかで待つ
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(ev, unlock, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else void wake();
  });
}

// 音の準備（2回目からは再開だけ）
async function wake(): Promise<void> {
  if (document.hidden) return;
  if (!ctx) {
    const Ctx = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    // iPhone：消音モードでは鳴らさず、ほかの音楽と重ねて鳴らせる種類にする
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) { try { session.type = 'ambient'; } catch { /* 対応していない端末はそのまま */ } }
    try { ctx = new Ctx(); } catch { return; }
    seBus = ctx.createGain();
    seBus.gain.value = sound.se ? SE_VOL : 0;
    // たくさんの音が重なっても（勝ったときなど）音が割れないように、大きすぎる所だけ抑える
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -10;
    limit.knee.value = 6;
    limit.ratio.value = 8;
    limit.attack.value = 0.003;
    limit.release.value = 0.2;
    seBus.connect(limit);
    limit.connect(ctx.destination);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0;
    bgmBus.connect(ctx.destination);
  }
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch { return; }
  }
  if (sound.bgm) void startBgm();
}

/** 効果音を鳴らす先（音が使えない・オフのときは null） */
export function seOut(): { ctx: AudioContext; out: AudioNode } | null {
  if (!ctx || !seBus || !sound.se || ctx.state !== 'running') return null;
  return { ctx, out: seBus };
}

async function startBgm(): Promise<void> {
  if (!ctx || !bgmBus || bgmSrc || bgmStarting) return;
  bgmStarting = true;
  const buf = await renderBgm(ctx);
  bgmStarting = false;
  if (!buf || !ctx || !bgmBus || bgmSrc || !sound.bgm) return;
  bgmSrc = ctx.createBufferSource();
  bgmSrc.buffer = buf;
  bgmSrc.loop = true;
  bgmSrc.connect(bgmBus);
  bgmSrc.start();
  fadeBgm(BGM_VOL, 1.5);
}

function stopBgm(): void {
  if (!ctx || !bgmSrc) return;
  const src = bgmSrc;
  bgmSrc = null;
  fadeBgm(0, 0.4);
  try { src.stop(ctx.currentTime + 0.45); } catch { /* もう止まっている */ }
}

function fadeBgm(to: number, sec: number): void {
  if (!ctx || !bgmBus) return;
  const g = bgmBus.gain;
  const now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(to, now + sec);
}

/** 勝敗の音楽を目立たせるため、BGM を少しの間だけ小さくする */
export function duckBgm(sec: number): void {
  if (!ctx || !bgmBus || !bgmSrc) return;
  const g = bgmBus.gain;
  const now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(BGM_VOL * 0.15, now + 0.3);
  g.setValueAtTime(BGM_VOL * 0.15, now + sec);
  g.linearRampToValueAtTime(BGM_VOL, now + sec + 2);
}

export function setBgm(on: boolean): void {
  sound.bgm = on;
  saveSoundSettings(sound);
  if (on) void wake();
  else stopBgm();
}

export function setSe(on: boolean): void {
  sound.se = on;
  saveSoundSettings(sound);
  if (ctx && seBus) seBus.gain.setValueAtTime(on ? SE_VOL : 0, ctx.currentTime);
}
