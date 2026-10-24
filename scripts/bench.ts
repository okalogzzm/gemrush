/* ============================================================
   CPUどうしの自動対戦（強さの確認用）
   使い方: npm run bench -- [強さA] [強さB] [対戦数]
     例) npm run bench -- hard normal 30
   先手・後手は1戦ごとに入れ替える。
   ============================================================ */
import { chooseCpuMove, CPU_LEVELS, type CpuLevel } from '../src/cpu/index.ts';
import { applyMove, listLegalMoves } from '../src/cpu/moves.ts';
import { resolvePending } from '../src/cpu/pending.ts';
import { createGame } from '../src/game/rules.ts';

const isLevel = (s: string | undefined): s is CpuLevel => s === 'easy' || s === 'normal' || s === 'hard';
const [, , argA, argB, argN] = process.argv;
const a: CpuLevel = isLevel(argA) ? argA : 'normal';
const b: CpuLevel = isLevel(argB) ? argB : 'easy';
const games = Number(argN) > 0 ? Number(argN) : 20;

let winA = 0, winB = 0, draw = 0, rounds = 0, maxThink = 0, totalThink = 0, thinkCount = 0;
for (let i = 0; i < games; i++) {
  const g = createGame(['A', 'B']);
  const levels: CpuLevel[] = i % 2 === 0 ? [a, b] : [b, a];
  g.current = 0;
  g.startPlayer = 0;
  let guard = 0;
  while (g.phase !== 'gameover' && guard++ < 500) {
    const pi = g.current;
    const t0 = performance.now();
    const move = chooseCpuMove(g, pi, levels[pi]!) ?? listLegalMoves(g)[0];
    const dt = performance.now() - t0;
    if (levels[pi] === 'hard') { maxThink = Math.max(maxThink, dt); totalThink += dt; thinkCount++; }
    if (!move) break;
    applyMove(g, move);
    resolvePending(g, pi, levels[pi]!);
  }
  rounds += g.round;
  const w = g.result?.winner ?? null;
  const aIndex = i % 2 === 0 ? 0 : 1;
  if (w === null) draw++;
  else if (w === aIndex) winA++;
  else winB++;
}

console.log(`${CPU_LEVELS[a]} vs ${CPU_LEVELS[b]}：${winA}勝 ${winB}敗 ${draw}分（${games}戦）`);
console.log(`平均ラウンド数：${(rounds / games).toFixed(1)}`);
if (thinkCount) {
  console.log(`つよいの考える時間：平均 ${(totalThink / thinkCount).toFixed(0)}ms ／ 最大 ${maxThink.toFixed(0)}ms`);
}
