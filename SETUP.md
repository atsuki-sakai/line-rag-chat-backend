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

#### オプション1: Dify Cloud（推奨）
1. [Dify](https://dify.ai)にログイン
2. アプリケーションを作成
3. API Keyを取得
4. エンドポイントURL: `https://api.dify.ai/v1`

#### オプション2: XserverのVPSにDifyを自己ホスト

##### 🖥️ VPS要件
- **最小スペック**: 6GB RAM以上、4コア以上、150GB以上のストレージ
- **OS**: Ubuntu 20.04以上
- **ポート**: 80, 443, 3000番ポートの開放
- **SSL証明書**: 無料提供

##### 💰 Xserver VPS料金（Dify対応プラン）
- **6GB プラン**: 月額 / 通常1,700円 
  - vCPU: 4コア、NVMe SSD: 150GB、Dify最小構成
- **12GB プラン**: 月額 / 通常3,201円
  - vCPU: 6コア、NVMe SSD: 400GB、推奨構成
- **24GB プラン**: 月額 / 通常7,200円
  - vCPU: 8コア、NVMe SSD: 800GB、本格運用

##### 📋 デプロイ手順

1. **XserverのVPS申し込み**
- [Xserver VPS Dify専用ページ](https://vps.xserver.ne.jp/dify.php)からお申し込み
- VPS初期設定時にDifyの自動インストールを選択
- SSL証明書も自動で設定されます

##### 🔧 メンテナンス
- メンテナンス手順(https://vps.xserver.ne.jp/support/manual/man_server_app_use_dify.php)

# バックアップ
docker compose exec postgres pg_dump -U dify dify > backup_$(date +%Y%m%d).sql
```

##### ⚠️ 注意事項
- 定期的なセキュリティアップデートを実施
- データベースの定期バックアップを設定
- ファイアウォール設定でセキュリティを強化
- リソース監視を実装（CPU、メモリ、ディスク使用量）

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

## 💰 総運用費用見積もり

### Cloudflare
- **Workers Free Plan**: 月100,000リクエスト無料
- **Workers Paid Plan**: $5/月 + 超過分$0.50/100万リクエスト
- **D1 Database**: 5GB無料、超過分$0.75/GB
- **Workflows**: 10,000ステップ/月無料、超過分$0.50/100万ステップ

#### 例: 月10万メッセージの場合
- Workers: $5 + 追加料金なし
- D1: 無料枠内
- Workflows: 無料枠内
- **合計**: 約$5/月（約750円）

### Dify選択肢別費用

#### Dify Cloud
- **SelfHost**: 無料(別途サーバー費用)
- **Sandbox Plan**: 無料（制限あり）
- **Professional Plan**: $59/月（無制限メッセージ）
- **Team Plan**: $159/月（チーム機能付き）

#### Xserver VPS + セルフホスト（Dify含む）
- **6GB VPS**: 月額 / 通常1,700円
- **12GB VPS**: 月額 / 通常3,201円
- **24GB VPS**: 月額 / 通常7,200円
- **SSL証明書**: 更新・無料
- **ドメイン**: 独自ドメイン利用時のみ年額8,000円程度

#### 総費用比較（月額）

| 構成 | Cloudflare | Dify | 合計 |
|------|------------|------|------|
| 最小構成（Dify Cloud） | 750円 | 無料〜$59 | 750円〜5,190円 |
| 自己ホスト（6GB VPS） | 750円 | 1,190円 | 1,940円 |
| 推奨構成（12GB VPS） | 750円 | 2,240円 | 2,990円 |
| 本格運用（24GB VPS） | 750円 | 5,040円 | 5,790円 |

### その他の費用
- **LINE Messaging API**: 無料（基本機能）
- **独自ドメイン**: 年額1,000〜3,000円
- **監視・ログ**: Cloudflare Analytics無料

## 📚 参考資料

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/)
- [Dify API](https://docs.dify.ai/guides/application-orchestrate/api-based-extension)
- [Hono Framework](https://hono.dev/)
- [Chanfana OpenAPI](https://chanfana.com/)
- [Xserver VPS](https://vps.xserver.ne.jp/support/manual/man_server_app_use_dify.php/)