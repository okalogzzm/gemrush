# CLAUDE.md

Claude がこのリポジトリで作業するときのガイドです。くわしい仕様は `仕様書.md` を見てください。

## プロジェクト概要

- **ジェムラッシュ**：「宝石の煌き（Splendor）」の公式2人用ルールを元にした、オリジナルデザインのブラウザゲーム
- CPU対戦（かんたん／ふつう／つよい）と2人対戦（同じ画面で交互に操作）
- スマホのホーム画面に追加して、オフラインでも遊べる Web アプリ（PWA）
- 公開先：https://okalogzzm.github.io/gemrush/ （GitHub Pages）
- 技術：TypeScript ＋ esbuild（ビルド）＋ Node 標準のテスト機能。**実行時の外部ライブラリと画像以外の素材は使わない**（見た目はすべて CSS）
- 公式のイラスト・ロゴ・名称は使わない

## よく使うコマンド

```bash
npm install          # 最初に1回（Node.js 22.18 以上が必要）
npm run dev          # 開発サーバー http://localhost:5173（保存すると自動で更新）
npm test             # テスト（tests/*.test.ts）
npm run typecheck    # 型チェック
npm run build        # 公開用ファイルを dist/ に作る
npm run preview      # dist/ を http://localhost:4173 で確認（オフライン動作も確認できる）
npm run check        # 型チェック → テスト → ビルド をまとめて
npm run bench -- hard normal 30   # CPUどうしの自動対戦で強さを確認
```

テストは1つだけ動かすこともできます：`node --test tests/rules.test.ts`

## フォルダ構成

```
src/
  game/        ルール（画面を触らない）。types / constants / data（カード） / rules / diff / validate / utils
  cpu/         CPU。moves（合法手） / heuristics（評価） / strategies（強さ別） / pending（返却・貴族選択）
  app/         アプリの状態と流れ。state / controller（タップ受付・refresh） / cpuRunner / tracker（直前の変化） / save
  view/        HTML を作る部分。components / render / screens（開始・メニュー・ルール） / fx（演出） / result（勝敗の画面）
  styles/      CSS（index.css から読み込む）
  main.ts      入口 / pwa.ts  Service Worker の登録
public/        そのまま公開する物（manifest.webmanifest、icons/）
scripts/       build / dev / preview / bench、sw-template.js（オフライン用のひな形）
tests/         テスト
index.html     画面の骨組み（ビルドで JS・CSS の読み込みが差し込まれる）
.github/workflows/deploy.yml   main に push → テスト → ビルド → Pages に公開
```

## 設計の決まりごと（必ず守る）

- **ルールと画面を分ける**：`src/game/` は `GameState` だけを読み書きし、DOM に触れない。結果は `{ ok: true }` か `{ ok: false, msg }`
- **ルールに合わない操作はさせない**：画面側は `check〜` でボタンを無効にして理由を表示し、`act〜` の中でも同じ確認をもう一度する
- **CPU もルールの関数で動く**：合法手の一覧 → 1つ選ぶ → `applyMove`。CPU 用にルールを変えない
- **CPU は知らない情報を使わない**：先読みでは山札を混ぜ直す。相手の伏せ札・山札の順番は使わない
- **画面の更新は `refresh()` の1か所**：描き直し → 自動保存 → 演出 → CPU の予約
- **クリックの受付も1か所**：`data-act` の値で振り分ける（`src/app/controller.ts`）
- **選択中の情報（`ui`）と設定（`settings`）は `GameState` と分ける**。保存するのは `settings` と `game` だけ
- **保存データの形を変えない**：キー `gemrush-save-v1`、`{ version: 1, savedAt, settings, game }`。前の版の続きが読めなくなるので、`GameState` の形を変えるときは版を上げて読み替えを書く
- 乱数は `src/game/utils.ts` の `random()` を使う（テストで固定できるように）
- import には拡張子 `.ts` を付ける（Node でそのままテストを動かすため）。型だけの import は `import type`
- `enum` や `namespace` など、型を消すだけで動かない書き方は使わない（`erasableSyntaxOnly`）

## コーディング規約

- インデント：スペース2つ、セミコロンあり、文字列はシングルクォート
- 変数・関数は camelCase、型は PascalCase、定数は UPPER_SNAKE_CASE
- コメントと画面の文言は**やさしい日本語**（ユーザーはエンジニアではない）。コメントは「なぜ」を中心に
- ボタンの高さは 44px 以上。ゲーム画面はスクロールなしで1画面に収める（375×548・390×664・844×390 などで縦にも横にもはみ出さないこと）
- 「動きを減らす」設定の人には演出を出さない

## 作業ルール

- 変更したら `npm run check` が通ることを確認する
- ルールや CPU を変えたらテストを追加・更新する。CPU の考え方を変えたら `npm run bench` で強さを比べる
- 画面を変えたら、スマホの縦・横の大きさで実際に開いて確認する（コンソールにエラーが出ないこと）
- カードの内容は `src/game/data.ts` だけを直す（自動チェックがメニューの中とテストで動く）
- 仕様が変わったら `仕様書.md` も更新する

## Git / 公開

- `main` に push すると GitHub Actions がテスト・ビルドして Pages に公開する（1〜2分）
- コミットの作者メールは GitHub の非公開用アドレス（`…@users.noreply.github.com`）を使い、個人のメールアドレスは使わない
- `dist/`・`node_modules/`・`.dev/`・`.claude/` はコミットしない
- `package-lock.json` は、初めて `npm install` したときにできたものをコミットする

## 注意事項

- `dist/` は自動で作られる。直接編集しない
- Service Worker は本番ビルドでだけ登録される（`npm run dev` では登録しない）。公開後に変更が反映されないときは、ページを開き直す（2回目の起動で新しい版になる）
- 「要確認」のカード4枚は公式との照合がまだ（`仕様書.md` 9.2）
