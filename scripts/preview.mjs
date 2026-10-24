/* ============================================================
   ビルド結果（dist/）を公開ページと同じ形で確かめるためのサーバー
   使い方: npm run build → npm run preview → http://localhost:4173 を開く
   （Service Worker も動くので、オフラインの確認もできる）
   ============================================================ */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { ROOT } from './site.mjs';

const dist = join(ROOT, 'dist');
const port = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.map': 'application/json', '.ico': 'image/x-icon',
};

if (!existsSync(dist)) {
  console.error('dist/ がありません。先に npm run build を実行してください');
  process.exit(1);
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(dist, url));
  if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`🔍 ビルド結果を表示中: http://localhost:${port}（止めるときは Ctrl + C）`);
});
