/* ============================================================
   Service Worker（オフラインで遊べるようにする仕組み）
   ------------------------------------------------------------
   このファイルはひな形です。npm run build のときに
   版の印と、保存するファイルの一覧が埋め込まれて dist/sw.js になります。
   ・最初に開いたとき、ゲームに必要なファイルをすべて端末に保存する
   ・ページ本体はネットを優先し、つながらないときは保存した物を使う
   ・それ以外（JS・CSS・アイコン）は保存した物を優先する（名前に版の印が入っているため）
   ============================================================ */
const CACHE = 'gemrush-__CACHE_VERSION__';
const PRECACHE = __PRECACHE_FILES__;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gemrush-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // ページ本体：ネット優先 → だめなら保存した index.html
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./').then(r => r || caches.match('index.html'))),
    );
    return;
  }

  // それ以外：保存した物を優先 → なければネット
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
