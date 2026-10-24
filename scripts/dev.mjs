/* ============================================================
   開発用サーバー：ファイルを保存すると自動でブラウザが更新される
   使い方: npm run dev → 表示された http://localhost:5173 を開く
   （スマホで確認するときは、同じWi-Fiで「ネットワーク」のアドレスを開く）
   ============================================================ */
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { ROOT, cleanDir, copyPublic, esbuild, esbuildOptions, writeHtml } from './site.mjs';

const outdir = join(ROOT, '.dev');
const port = Number(process.env.PORT) || 5173;

cleanDir(outdir);
copyPublic(outdir);
// 開発中はファイル名を固定（main.js / main.css）にして、保存のたびに自動更新させる
const liveReload = `\n<script>new EventSource('/esbuild').addEventListener('change', () => location.reload());</script>`;
writeHtml(outdir, { js: 'assets/main.js', css: 'assets/main.css' }, liveReload);

const ctx = await esbuild.context(esbuildOptions({ dev: true, outdir }));
await ctx.watch();
await ctx.serve({ servedir: outdir, port, host: '0.0.0.0' });

const lan = Object.values(networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${port}`);
console.log(`🎮 開発サーバーを起動しました`);
console.log(`   このパソコン: http://localhost:${port}`);
lan.forEach(u => console.log(`   ネットワーク: ${u}`));
console.log(`   止めるときは Ctrl + C`);
