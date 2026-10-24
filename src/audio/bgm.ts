/* ============================================================
   BGM（森の朝のような、ゆったりしたオルゴール風の曲）
   ------------------------------------------------------------
   ・音のファイルは使わず、楽譜からプログラムで波の形を計算して作る
   ・起動のあと一度だけ作って、それをくり返し流す。
     鳴らしている間は計算しないので、スマホの負担（発熱）が少ない
   ・Web Audio の部品を何百個もつないで作ると時間がかかる（パソコンでも数秒）ので、
     波の数字を直接計算する（スマホでも一瞬で終わる）
   ・曲の終わりからはみ出した余韻は、曲の頭に重ねる。
     くり返したときに、つなぎ目で音がぷつっと切れないように
   ============================================================ */
import { hz } from './synth.ts';

const BPM = 92;
const EIGHTH = 60 / BPM / 2;   // 8分音符1つの秒数
const BAR = EIGHTH * 8;        // 1小節（4拍）の秒数

// 1小節に1つの和音。C → G → Am → F …（明るく、のんびりした進み方）
const CHORDS = ['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C', 'F', 'G', 'Em', 'Am', 'F', 'G', 'G', 'C'] as const;
type Chord = typeof CHORDS[number];

// 分散和音（ポロン、ポロンと流れる伴奏）に使う4つの音と、低い音
const ARP: Record<Chord, [string, string, string, string]> = {
  C: ['C4', 'G4', 'C5', 'E5'],
  G: ['G3', 'D4', 'G4', 'B4'],
  Am: ['A3', 'E4', 'A4', 'C5'],
  F: ['F3', 'C4', 'F4', 'A4'],
  Em: ['E4', 'B4', 'E5', 'G5'],
};
const BASS: Record<Chord, [string, string]> = {
  C: ['C3', 'G2'], G: ['G2', 'D3'], Am: ['A2', 'E3'], F: ['F2', 'C3'], Em: ['E3', 'B2'],
};
// 1小節の中で分散和音を弾く順番（8分音符8つ）
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 1];

// メロディ。「音名:長さ（8分音符いくつ分）」を小節ごとに | で区切る。R は休み
const MELODY = `
E5:3 D5:1 C5:2 E5:2 | D5:3 C5:1 B4:2 G4:2 | C5:2 E5:2 A5:3 G5:1 | F5:2 E5:2 C5:4 |
E5:3 D5:1 C5:2 G5:2 | A5:3 G5:1 F5:2 A5:2 | G5:2 F5:2 E5:2 D5:2 | C5:6 R:2 |
A5:2 C6:2 A5:2 F5:2 | G5:2 B5:2 D6:3 C6:1 | B5:2 G5:2 E5:2 G5:2 | A5:6 R:2 |
F5:2 A5:2 C6:2 A5:2 | G5:2 F5:2 E5:2 D5:2 | D5:3 E5:1 F5:2 B4:2 | C5:6 R:2`;

// 小鳥のさえずりを入れる場所（小節・何番目の8分音符）。メロディが休んでいる所
const CHIRPS: [number, number][] = [[3, 5], [7, 6], [11, 6], [15, 6]];

/** 1回分の長さ（秒） */
export const BGM_LOOP_SEC = BAR * CHORDS.length;
/** BGM は高い音が少ないので、この細かさで十分（作る時間と記憶を節約） */
export const BGM_RATE = 22050;

interface Note {
  vol: number;
  attack: number;
  partials?: number[];   // 倍音の強さ
  tri?: boolean;         // 三角波（少し明るい音）
  freqTo?: number;       // 高さを動かす（さえずり）
  glide?: number;
}

const TWO_PI = Math.PI * 2;
const tri = (ph: number): number => 1 - 4 * Math.abs(ph - Math.floor(ph + 0.5));

/**
 * 1つの音を、波の数字に足しこむ。曲の終わりをこえた分は、曲の頭へ回りこませる
 * @param dur 小さくなって消えるまでの秒数
 */
function addNote(buf: Float32Array, start: number, freq: number, dur: number, n: Note): void {
  const rate = BGM_RATE;
  const total = buf.length;
  const s0 = Math.round(start * rate);
  const atk = Math.max(1, Math.round(n.attack * rate));
  const len = atk + Math.round(dur * rate);
  const decay = Math.pow(1e-4, 1 / (len - atk));  // 1つ進むごとに、音量をこれだけ掛ける
  const partials = n.partials ?? [1];
  let env = 0;
  let ph = 0;
  for (let i = 0; i < len; i++) {
    env = i < atk ? n.vol * (i / atk) : env * decay;
    let f = freq;
    if (n.freqTo) f = freq * Math.pow(n.freqTo / freq, Math.min(1, i / ((n.glide ?? dur) * rate)));
    ph += f / rate;
    let v = 0;
    for (let k = 0; k < partials.length; k++) {
      const p = ph * (k + 1);
      v += partials[k]! * (n.tri ? tri(p) : Math.sin(TWO_PI * p));
    }
    buf[(s0 + i) % total]! += v * env;
  }
}

function parseMelody(): { t: number; note: string; len: number }[] {
  const out: { t: number; note: string; len: number }[] = [];
  MELODY.split('|').forEach((bar, bi) => {
    let pos = 0;
    for (const item of bar.trim().split(/\s+/)) {
      const [note, len] = item.split(':');
      const n = Number(len);
      if (note && note !== 'R') out.push({ t: bi * BAR + pos * EIGHTH, note, len: n });
      pos += n;
    }
  });
  return out;
}

// 曲を作る仕事を「音1つずつ」に分けた一覧（少しずつ休みながら作れるように）
function noteJobs(dry: Float32Array): (() => void)[] {
  const jobs: (() => void)[] = [];
  CHORDS.forEach((ch, bi) => {
    const t0 = bi * BAR;
    ARP_ORDER.forEach((k, i) => {
      jobs.push(() => addNote(dry, t0 + i * EIGHTH, hz(ARP[ch][k]!), 0.55, { vol: 0.055, attack: 0.01, tri: true }));
    });
    BASS[ch].forEach((n, i) => {
      jobs.push(() => addNote(dry, t0 + i * BAR / 2, hz(n), BAR / 2 * 0.9, { vol: 0.13, attack: 0.02, tri: true, partials: [1, 0.5, 0.25] }));
    });
  });
  for (const m of parseMelody()) {
    // オルゴールのように、少し長めに響かせる
    jobs.push(() => addNote(dry, m.t, hz(m.note), Math.max(0.9, m.len * EIGHTH * 1.2), { vol: 0.2, attack: 0.008, partials: [1, 0.22, 0.08] }));
  }
  for (const [bar, pos] of CHIRPS) {
    for (let i = 0; i < 3; i++) {
      const f = 2900 * (1 + (i % 2) * 0.12);
      jobs.push(() => addNote(dry, bar * BAR + pos * EIGHTH + i * 0.11, f, 0.07, { vol: 0.05, attack: 0.004, freqTo: f * 1.45, glide: 0.05 }));
    }
  }
  return jobs;
}

const newWave = (): Float32Array => new Float32Array(Math.round(BGM_LOOP_SEC * BGM_RATE));

/** 曲を1回分、波の数字で作る（-1〜1）。Web Audio がなくても動く（テストできるように） */
export function composeBgm(): Float32Array<ArrayBuffer> {
  const dry = newWave();
  for (const job of noteJobs(dry)) job();
  return addEcho(dry);
}

// 同じ曲を、少しずつ休みながら作る（作っている間も、画面やタップが止まらないように）
async function composeBgmSlowly(): Promise<Float32Array<ArrayBuffer>> {
  const dry = newWave();
  const jobs = noteJobs(dry);
  for (let i = 0; i < jobs.length; i++) {
    jobs[i]!();
    if (i % 24 === 23) await new Promise(r => setTimeout(r, 0));
  }
  await new Promise(r => setTimeout(r, 0));
  return addEcho(dry);
}

// こだま：少し遅れて、小さく、こもった音がくり返し返ってくる。
// 曲は輪のようにつながっているので、2周して、頭の部分にも終わりからのこだまを入れる
function addEcho(dry: Float32Array): Float32Array<ArrayBuffer> {
  const n = dry.length;
  const d = Math.round(EIGHTH * 3 * BGM_RATE);
  const fb = 0.28;
  const wet = 0.3;
  const a = 1 - Math.exp(-TWO_PI * 2200 / BGM_RATE);  // こもらせる強さ（2200Hz より高い音を弱める）
  const echo = new Float32Array(n);
  let lp = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const j = (i - d + n) % n;
      lp += a * (dry[j]! + fb * echo[j]! - lp);
      echo[i] = lp;
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (dry[i]! + wet * echo[i]!) * 0.85;
  return out;
}

let cache: Promise<Float32Array<ArrayBuffer>> | null = null;

/** BGM 1回分の音（1度だけ作って、あとは使い回す） */
export async function renderBgm(ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    cache ??= composeBgmSlowly();
    const wave = await cache;
    const buf = ctx.createBuffer(1, wave.length, BGM_RATE);
    buf.copyToChannel(wave, 0);
    return buf;
  } catch {
    return null;
  }
}
