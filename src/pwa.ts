/* ============================================================
   アプリ化（PWA）：オフラインで動くための仕組み（Service Worker）の登録
   ------------------------------------------------------------
   ・公開ページ（https）でだけ登録する。開発中（npm run dev）は登録しない
   ・新しい版を公開すると、次に開いたときから新しい版になる
   ============================================================ */
export function registerServiceWorker(): void {
  if (__DEV__) return;
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      // 登録できなくてもゲームは遊べる
      console.warn('Service Worker を登録できませんでした', err);
    });
  });
}
