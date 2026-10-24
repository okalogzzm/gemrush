/* ============================================================
   サイトを組み立てる共通の処理（build.mjs と dev.mjs から使う）
   ------------------------------------------------------------
   1. src/main.ts からたどれるプログラムとCSSを esbuild で1つずつにまとめる
   2. public/ の中身（アイコン・manifest）をそのままコピー
   3. index.html の目印を、まとめたファイルへの読み込みに置き換える
   4. （本番のみ）オフライン用の sw.js を、ファイル一覧つきで作る
   ============================================================ */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

// Windows でも正しく動くように、URL からパスへ変換する
export const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');

/** esbuild の設定 */
export function esbuildOptions({ dev, outdir }) {
  return {
    absWorkingDir: ROOT,
    entryPoints: [join(ROOT, 'src/main.ts')],
    bundle: true,
    format: 'esm',
    target: ['es2020', 'chrome90', 'firefox90', 'safari15'], // aspect-ratio が使える世代以降
    outdir: join(outdir, 'assets'),
    entryNames: dev ? '[name]' : '[name]-[hash]',
    minify: !dev,
    sourcemap: true,
    metafile: true,
    define: { __DEV__: JSON.stringify(dev) },
    logLevel: 'warning',
  };
}

/** まとめた結果から、JS と CSS のファイル名を探す */
export function findOutputs(metafile, outdir) {
  const files = Object.keys(metafile.outputs).map(f => relative(outdir, join(ROOT, f)).split(sep).join('/'));
  const js = files.find(f => f.endsWith('.js'));
  const css = files.find(f => f.endsWith('.css'));
  if (!js || !css) throw new Error('ビルド結果に JS か CSS が見つかりません');
  return { js, css };
}

/** index.html を書き出す */
export function writeHtml(outdir, { js, css }, extraScript = '') {
  let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<!-- app:css[^>]*-->/, `<link rel="stylesheet" href="${css}">`);
  html = html.replace(/<!-- app:js[^>]*-->/, `<script type="module" src="${js}"></script>${extraScript}`);
  writeFileSync(join(outdir, 'index.html'), html);
}

/** public/ をコピー */
export function copyPublic(outdir) {
  const pub = join(ROOT, 'public');
  if (existsSync(pub)) cpSync(pub, outdir, { recursive: true });
}

export function cleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/** フォルダの中のファイルを全部列挙（/ 区切り） */
function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p).split(sep).join('/')];
  });
}

/** オフライン用の Service Worker を作る（キャッシュするファイルの一覧と版の印を埋め込む） */
export function writeServiceWorker(outdir) {
  const files = listFiles(outdir).filter(f => !f.endsWith('.map') && f !== 'sw.js');
  const hash = createHash('sha256');
  for (const f of files.sort()) hash.update(f).update(readFileSync(join(outdir, f)));
  const version = hash.digest('hex').slice(0, 12);
  const template = readFileSync(join(ROOT, 'scripts/sw-template.js'), 'utf8');
  const sw = template
    .replace('__CACHE_VERSION__', version)
    .replace('__PRECACHE_FILES__', JSON.stringify(['./', ...files], null, 2));
  writeFileSync(join(outdir, 'sw.js'), sw);
  return { version, count: files.length };
}

export { esbuild };
