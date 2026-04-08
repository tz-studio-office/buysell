# Mercari Arbitrage Monitor (Workers v2)

Cloudflare Workers + Supabase ベースで、以下を自動化するためのリポジトリです。

- メルカリの売却済み商品を日次収集
- セカスト / BAZZSTORE / OFF MALL の在庫を巡回
- 正規化した商品情報を比較し、粗利候補を算出
- 直近30日相場と仕入れ候補を Supabase に保存
- 管理画面 `/admin` から「広い入口URL」を DB 管理

## 今回の設計方針

前の版は「ブランド別 seed URL / メルカリカテゴリを細かく登録する」寄りでした。
この v2 は、ユーザー要件に合わせて次の方針へ寄せています。

- メルカリはまず **ファッション全体の売り切れ一覧URL** を登録して広く集める
- 仕入れサイトも **ファッション一覧 / メンズ一覧 / レディース一覧などの入口URL** を登録する
- ブランド・カテゴリ・サイズ・状態は **取得後に DB 側で整形** する
- 管理画面の文言も `seed URL` より `scope URL / entry URL` 寄りに修正

## セットアップ

1. Supabase プロジェクトを作成
2. このチャットで渡した SQL を実行
3. Cloudflare に `SUPABASE_URL` `SUPABASE_SERVICE_ROLE_KEY` `RUN_TOKEN` を設定
4. `/admin/config` でメルカリと各仕入れ先の入口URLを登録

## エンドポイント

- `GET /health`
- `GET /admin`
- `GET /admin/config`
- `POST /tasks/mercari-daily?token=...`
- `POST /tasks/suppliers?token=...`
- `POST /tasks/match?token=...`
- `POST /tasks/full-sync?token=...`

## 補足

- DBスキーマは前版と互換です。今回の組み替えは主に UI と mercari の scope 取扱いです。
- 既存の `crawl_targets` テーブルをそのまま使えます。
- cron trigger 自体は `wrangler.toml` の Cloudflare 側設定です。
