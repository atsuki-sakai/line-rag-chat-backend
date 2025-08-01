# LINE RAG Chat Backend セットアップガイド

## 🚀 クイックスタート

このプロジェクトは、LINE Messaging API、Dify AI、Cloudflare Workers、D1データベースを統合したRAGチャットバックエンドです。

## 📋 前提条件

- Node.js 18以上
- npm または pnpm
- Cloudflareアカウント
- LINE Developersアカウント
- Dify AIアカウント

## 🔧 環境設定

### 1. プロジェクトのクローンとインストール

```bash
git clone https://github.com/atsuki-sakai/line-rag-chat-backend.git
cd line-rag-chat-backend
npm install
```

### 2. 設定ファイルの準備

#### wrangler.jsonc の設定
```bash
cp wrangler.jsonc.example wrangler.jsonc
```

`wrangler.jsonc`を編集して以下の値を設定：

```jsonc
{
  "name": "your-project-name",  // プロジェクト名を変更
  "vars": {
    "LINE_CHANNEL_SECRET": "your_line_channel_secret_here",
    "LINE_CHANNEL_ACCESS_TOKEN": "your_line_channel_access_token_here", 
    "DIFY_API_KEY": "your_dify_api_key_here",
    "DIFY_API_ENDPOINT": "https://api.dify.ai/v1"  // または独自のDifyインスタンス
  },
  "d1_databases": [
    {
      "database_name": "your-database-name",
      "database_id": "your-database-id-here"  // ステップ3で取得
    }
  ]
}
```

#### .dev.vars の設定（ローカル開発用）
```bash
cp .dev.vars.example .dev.vars  # 存在する場合
```

### 3. Cloudflare D1 データベースの作成

```bash
# D1データベースを作成
npx wrangler d1 create line-rag-chat-db

# 出力されたdatabase_idをwrangler.joncのdatabase_idに設定
```

### 4. データベースマイグレーション

```bash
# ローカル環境のマイグレーション
npm run seedLocalDb

# 本番環境のマイグレーション（デプロイ時）
npx wrangler d1 migrations apply DB --remote
```

## 🔑 外部サービスの設定

### LINE Developers Console

1. [LINE Developers Console](https://developers.line.biz/console/)にログイン
2. 新しいProviderを作成
3. Messaging API Channelを作成
4. 以下の情報を取得：
   - `Channel Secret`
   - `Channel Access Token`

#### Webhook URL設定
```
https://your-worker-name.your-subdomain.workers.dev/line/webhook
```

### Dify AI設定

1. [Dify](https://dify.ai)にログインまたは独自インスタンスを準備
2. アプリケーションを作成
3. API Keyを取得
4. エンドポイントURLを確認

## 🧪 開発・テスト

### ローカル開発サーバー起動
```bash
npm run dev
```

### テスト実行
```bash
npm run test
```

### スキーマ生成
```bash
npm run schema
```

## 🚀 デプロイ

### 本番環境へのデプロイ
```bash
# マイグレーション適用
npm run predeploy

# デプロイ実行
npm run deploy
```

## 📁 プロジェクト構造

```
line-rag-chat-backend/
├── src/
│   ├── endpoints/           # APIエンドポイント
│   │   ├── line/           # LINE Webhook関連
│   │   └── tasks/          # タスク管理API
│   ├── workflows/          # Cloudflare Workflows
│   ├── db/                 # データベース設定・スキーマ
│   └── types.ts           # 型定義
├── migrations/             # D1マイグレーション
├── tests/                  # テストファイル
├── wrangler.jsonc.example  # 設定テンプレート
└── SETUP.md               # このファイル
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. D1_TYPE_ERROR: Type 'undefined' not supported
**解決方法**: データベースバインド時にundefinedを渡さないよう、適切なフォールバック値を設定

#### 2. Workflow Parameter Passing エラー
**解決方法**: `payload`ではなく`params`を使用してWorkflowインスタンスを作成

#### 3. LINE Webhook署名検証エラー
**解決方法**: Channel Secretが正しく設定されているか確認

### ログの確認
```bash
# ローカルログ
npm run dev

# 本番ログ  
npx wrangler tail
```

## 📊 パフォーマンス最適化

このプロジェクトには以下の最適化が実装されています：

- **並列処理**: データベース保存とLINE送信を同時実行
- **クエリ最適化**: ウィンドウ関数による効率的なページネーション
- **タイムアウト制御**: API呼び出しの信頼性向上
- **エラーハンドリング**: Promise.allSettledによる堅牢性向上

## 🔒 セキュリティ

- Webhook署名検証実装済み
- 環境変数による機密情報管理
- リクエストサイズ制限（8MB）
- メッセージ長制限（Dify: 10,000文字、LINE: 5,000文字）

## 📚 参考資料

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [Dify API](https://docs.dify.ai/guides/application-orchestrate/api-based-extension)
- [Hono Framework](https://hono.dev/)
- [Chanfana OpenAPI](https://chanfana.com/)

## 🆘 サポート

問題が発生した場合は、GitHubのIssuesでお知らせください。