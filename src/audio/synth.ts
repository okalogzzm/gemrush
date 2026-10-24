/* ============================================================
   音を作る道具（音のファイルは使わず、Web Audio で波を合成する）
   ------------------------------------------------------------
   ・BGM（前もって一度だけ作る）と効果音（その場で鳴らす）の両方で使う
   ・どの音も「すぐ立ち上がって、だんだん小さくなる」形にして、
     オルゴールや鈴のような、やさしい音にする
   ============================================================ */

export interface Voice {
  type?: OscillatorType;   // 波の形（sine：やわらかい / triangle：少し明るい / sawtooth：ラッパ風）
  vol?: number;            // 音量（0〜1）
  attack?: number;         // 鳴り始めてから一番大きくなるまでの秒数
  freqTo?: number;         // 音の高さをここまで動かす（小鳥の「チュッ」など）
  glide?: number;          // 高さを動かす秒数（なければ音の長さ全部）
  partials?: number[];     // 倍音の強さ（[1, .3] なら、2倍の高さの音を少し混ぜる）
  lowpass?: number;        // これより高い音を削る（ラッパ風の音を丸くする）
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 音名（'C5'・'F#4'・'Bb3'）を周波数に。A4 = 440Hz */
export function hz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const semi = SEMI[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 1つの音を、時刻 t から dur 秒かけて消えるように鳴らす */
export function tone(ac: BaseAudioContext, out: AudioNode, t: number, freq: number, dur: number, v: Voice = {}): void {
  const vol = v.vol ?? 0.3;
  const attack = v.attack ?? 0.005;
  const end = t + attack + dur;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  let dest: AudioNode = g;
  if (v.lowpass) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = v.lowpass;
    f.connect(g);
    dest = f;
  }
  g.connect(out);
  (v.partials ?? [1]).forEach((amp, i) => {
    if (!amp) return;
    const o = ac.createOscillator();
    o.type = v.type ?? 'sine';
    o.frequency.setValueAtTime(freq * (i + 1), t);
    if (v.freqTo) o.frequency.exponentialRampToValueAtTime(v.freqTo * (i + 1), t + (v.glide ?? dur));
    if (amp === 1) {
      o.connect(dest);
    } else {
      const pg = ac.createGain();
      pg.gain.value = amp;
      o.connect(pg);
      pg.connect(dest);
    }
    o.start(t);
    o.stop(end + 0.02);
  });
}

// ざらざらした音（紙がこすれる・風を切る音）のもと。同じ物を使い回す
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ac: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ac);
  if (!b) {
    b = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = b.getChannelData(0);
    // 毎回同じ音になるように、決まった並びの「でたらめ」な数を使う
    let x = 1;
    for (let i = 0; i < d.length; i++) {
      x = (x * 16807) % 2147483647;
      d[i] = (x / 2147483647) * 2 - 1;
    }
    noiseCache.set(ac, b);
  }
  return b;
}

/** 「シュッ」という音。from から to へ、響く高さを動かす */
export function whoosh(ac: BaseAudioContext, out: AudioNode, t: number, dur: number, from: number, to: number, vol = 0.2): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** 小鳥の「チュッ」。count 回くり返す */
export function chirp(ac: BaseAudioContext, out: AudioNode, t: number, count = 2, vol = 0.12, base = 2600): void {
  for (let i = 0; i < count; i++) {
    const s = t + i * 0.11;
    const f = base * (1 + (i % 2) * 0.12);
    tone(ac, out, s, f, 0.07, { vol, attack: 0.004, freqTo: f * 1.45, glide: 0.05 });
  }
}
