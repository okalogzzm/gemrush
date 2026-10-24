/* ============================================================
   本番用のビルド：dist/ に公開用のファイル一式を作る
   使い方: npm run build
   ============================================================ */
import { join } from 'node:path';
import {
  ROOT, cleanDir, copyPublic, esbuild, esbuildOptions, findOutputs, writeHtml, writeServiceWorker,
} from './site.mjs';

const outdir = join(ROOT, 'dist');
cleanDir(outdir);
copyPublic(outdir);
const result = await esbuild.build(esbuildOptions({ dev: false, outdir }));
const outputs = findOutputs(result.metafile, outdir);
writeHtml(outdir, outputs);
const sw = writeServiceWorker(outdir);

const size = f => (result.metafile.outputs[Object.keys(result.metafile.outputs).find(k => k.endsWith(f))]?.bytes ?? 0);
console.log(`✅ ビルド完了 → dist/`);
console.log(`   ${outputs.js}（${(size(outputs.js) / 1024).toFixed(1)} KB）`);
console.log(`   ${outputs.css}（${(size(outputs.css) / 1024).toFixed(1)} KB）`);
console.log(`   sw.js（オフライン用・${sw.count}ファイル・版 ${sw.version}）`);
