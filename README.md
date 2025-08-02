# LINE RAG Chat Backend

LINE Messaging API、Dify AI、Cloudflare Workersを統合したリアルタイムチャットバックエンドシステム

## 🚀 概要

このプロジェクトは、LINE Bot、Dify AI、Cloudflare Workersを組み合わせて、高性能でスケーラブルなRAG（Retrieval-Augmented Generation）チャットバックエンドを提供します。

### 主要機能

- **LINE Messaging API統合**: LINEユーザーとのリアルタイム対話
- **Dify AI RAG処理**: 知識ベースに基づく高精度AI応答
- **Cloudflare Workflows**: 非同期メッセージ処理とワークフロー管理
- **D1データベース**: 会話履歴と状態管理
- **管理機能**: 管理ダッシュボード、Basic認証、CSV出力
- **OpenAPI 3.1対応**: 自動API仕様生成とバリデーション

## 📋 技術スタック

- **Cloudflare Workers**: エッジコンピューティングプラットフォーム
- **Hono**: 高速WebフレームワークとAPI構築
- **Chanfana**: OpenAPI自動生成・リクエスト検証
- **Drizzle ORM**: 型安全なD1データベースクエリ
- **Cloudflare Workflows**: 耐久性実行エンジン
- **Vitest**: Workers環境でのテスト実行

## 🔧 プロジェクト構成

```
line-rag-chat-backend/
├── src/
│   ├── endpoints/              # APIエンドポイント
│   │   ├── admin/             # 管理機能（メッセージ統計、CSV出力等）
│   │   └── line/              # LINE Webhook・メッセージング
│   ├── workflows/             # Cloudflare Workflows
│   │   └── lineMessageWorkflow.ts
│   ├── db/                    # データベース設定
│   │   ├── index.ts          # Drizzle設定
│   │   └── schema.ts         # テーブル定義
│   ├── types.ts              # 共通型定義
│   └── index.ts              # メインルーター
├── migrations/               # D1データベースマイグレーション
│   ├── 0002_add_line_messages_table.sql
│   └── 0003_add_performance_indexes.sql
├── tests/                   # 統合テスト
├── wrangler.jsonc          # Cloudflare設定
├── CLAUDE.md              # AI開発者向け指示
└── SETUP.md              # セットアップガイド
```

## ⚡ クイックスタート

### 1. 前提条件

- Node.js 18+
- npm または pnpm
- Cloudflareアカウント
- LINE Developersアカウント
- Dify AIアカウント

### 2. インストール

```bash
git clone https://github.com/atsuki-sakai/line-rag-chat-backend.git
cd line-rag-chat-backend
npm install
```

### 3. 環境設定

#### D1データベース作成
```bash
npx wrangler d1 create line-rag-chat-db
```

出力された`database_id`を`wrangler.jsonc`に設定

#### 環境変数設定
`.dev.vars`ファイルを作成：
```bash
LINE_CHANNEL_SECRET="your_line_channel_secret"
LINE_CHANNEL_ACCESS_TOKEN="your_line_channel_access_token"
DIFY_API_KEY="your_dify_api_key"
DIFY_API_ENDPOINT="https://api.dify.ai/v1"
```

*** ダッシュボードでの追加とwrangler secret put で確実に追加する。 wrangler secret listで確認できる ***

#### データベースマイグレーション
```bash
# ローカル環境
npm run seedLocalDb

# 本番環境（デプロイ時自動実行）
npm run predeploy
```

### 4. 開発開始

```bash
# 開発サーバー起動
npm run dev

# テスト実行
npm test

# OpenAPIスキーマ生成
npm run schema
```

### 5. デプロイ

```bash
npm run deploy
```

## 🔗 外部サービス設定

### LINE Developers

1. [LINE Developers Console](https://developers.line.biz/console/)でMessaging API Channel作成
2. Webhook URL設定: `https://your-worker.workers.dev/line/webhook`
3. Channel SecretとAccess Tokenを取得

### Dify AI

1. [Dify](https://dify.ai)でアプリケーション作成
2. API Keyを取得
3. エンドポイントURL確認

## 🏗️ アーキテクチャ

### データフロー

1. **LINE Webhook** → メッセージ受信 (`src/endpoints/line/webhook.ts`)
2. **LineMessageWorkflow** → Dify AI処理・DB保存の非同期実行
3. **Dify API** → RAG処理によるAI応答生成
4. **D1 Database** → 会話履歴とメタデータ保存
5. **LINE Reply** → ユーザーへの応答送信

### データベーススキーマ

#### line_messages テーブル
```sql
CREATE TABLE line_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT,
  image_url TEXT,
  dify_response TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 管理機能API

- **GET /admin/messages**: メッセージ一覧取得（ページネーション対応）
- **GET /admin/messages/stats**: メッセージ統計情報
- **GET /admin/messages/csv**: CSV形式でメッセージ出力
- **GET /admin/messages/{id}**: 個別メッセージ詳細
- **DELETE /admin/messages/{id}**: メッセージ削除

## 🧪 テスト

```bash
# 全テスト実行（デプロイ検証含む）
npm test

# Vitestのみ実行
npx vitest run --config tests/vitest.config.mts
```

テストは`@cloudflare/vitest-pool-workers`を使用してWorkers環境で実行されます。

## 📊 パフォーマンス最適化

- **並列処理**: データベース保存とLINE送信の同時実行
- **クエリ最適化**: ウィンドウ関数による効率的なページネーション  
- **タイムアウト制御**: API呼び出しの信頼性向上
- **エラーハンドリング**: Promise.allSettledによる堅牢性

## 🔒 セキュリティ

- **Webhook署名検証**: HMAC-SHA256による改ざん防止
- **環境変数管理**: 機密情報の安全な管理
- **リクエスト制限**: 8MBサイズ制限
- **メッセージ長制限**: Dify 10,000文字・LINE 5,000文字

## 🔧 重要な実装ポイント

### Cloudflare Workflows

```typescript
// ✅ 正しい - paramsを使用
await workflowBinding.create({ params: workflowParams })

// ❌ 間違い - payloadは使用しない
await workflowBinding.create({ payload: workflowParams })
```

### D1データベース

```typescript
// ✅ 正しい - undefinedを回避
message_content: messageContent || null,
dify_response: difyResult.answer || "",

// ❌ 間違い - undefinedでエラー発生
message_content: messageContent,
dify_response: difyResult.answer,
```

## 📚 参考資料

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [Dify API](https://docs.dify.ai/)
- [Hono Framework](https://hono.dev/)
- [Chanfana OpenAPI](https://chanfana.com/)

## 🆘 トラブルシューティング

### よくある問題

1. **D1_TYPE_ERROR**: undefinedをバインドパラメータに渡している
2. **Workflow Parameter Passing**: `payload`ではなく`params`を使用
3. **LINE署名検証エラー**: Channel Secretの設定確認

### ログ確認

```bash
# ローカル
npm run dev

# 本番
npx wrangler tail
```

## 🤝 コントリビューション

Issues・Pull Requestsをお待ちしています！

## 📄 ライセンス

MIT License