# Mercari Arbitrage Monitor

Cloudflare Workers + Supabase ベースで、以下を自動化するためのリポジトリです。

- メルカリの売却済み商品を日次収集
- セカスト / BAZZSTORE / OFF MALL の在庫を巡回
- 正規化した商品情報を比較し、粗利候補を算出
- 直近30日相場と仕入れ候補を Supabase に保存
- 管理画面 `/admin` からカテゴリ・seed URL・実行設定を DB 管理

## 前提

この実装は **自動出品・自動購入をしません**。人が最終判断し、メルカリ・eBay 等への出品作業は手動で行う運用を前提にしています。

## セットアップ

1. Supabase プロジェクトを作成
2. このチャットで渡した SQL を順に実行
3. Cloudflare に `SUPABASE_URL` `SUPABASE_SERVICE_ROLE_KEY` `RUN_TOKEN` を設定
4. `/admin` でログインしてカテゴリ・seed URL を登録

## エンドポイント

- `GET /health`
- `GET /admin`
- `GET /admin/config`
- `POST /tasks/mercari-daily?token=...`
- `POST /tasks/suppliers?token=...`
- `POST /tasks/match?token=...`
- `POST /tasks/full-sync?token=...`

## 補足

- 対象カテゴリと seed URL は DB 管理です
- cron trigger 自体は `wrangler.toml` の Cloudflare 側設定です
- 管理画面の cron 文字列は DB 保存用で、trigger の自動書き換えまではしません
