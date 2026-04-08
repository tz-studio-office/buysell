# Mercari Arbitrage Monitor (Workers)

Cloudflare Workers + Supabase ベースで、以下を自動化するためのリポジトリです。

- メルカリの売却済み商品を日次収集
- セカスト / BAZZSTORE / OFF MALL の在庫を巡回
- 正規化した商品情報を比較し、粗利候補を算出
- 直近30日相場と仕入れ候補を Supabase に保存
- 管理画面 `/admin` からカテゴリ・seed URL・実行設定を DB 管理

## このリポジトリの前提

- Cloudflare **Workers** 用です
- Cloudflare **Pages 用ではありません**
- `dist` フォルダは不要です
- GitHub リポジトリの **直下** にこのファイル群を置く想定です

## 最低限必要な環境変数

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RUN_TOKEN`

## 任意の環境変数

- `APP_NAME`
- `MERCARI_MAX_PAGES_PER_CATEGORY`
- `SUPPLIER_MAX_PAGES_PER_SOURCE`
- `HTTP_TIMEOUT_MS`
- `HTTP_RETRY_COUNT`
- `ENABLE_DETAIL_ENRICHMENT`
- `MARKETPLACE_FEE_RATE`
- `DEFAULT_SHIPPING_COST_YEN`
- `RUN_MERCARI_CRON`
- `RUN_SUPPLIERS_CRON`
- `RUN_MATCH_CRON`

## ローカル実行

```bash
npm install
npm run typecheck
npm run dev
```

`.dev.vars` は `.dev.vars.example` を元に作成してください。

## デプロイ

```bash
npm install
npx wrangler login
npx wrangler deploy
```

または Cloudflare Workers の Git integration を使用してください。

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
- `offmoll` という綴りはコード側の内部キーに合わせています
