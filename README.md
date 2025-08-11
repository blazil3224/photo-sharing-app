# 写真共有アプリケーション

React と Flask を使用したモダンな写真共有プラットフォームです。ユーザーは写真をアップロードし、他のユーザーとインタラクション（いいね・コメント）を楽しむことができます。

## 🚀 主な機能

- **ユーザー認証**: 安全な登録・ログイン機能
- **写真アップロード**: ドラッグ&ドロップ対応の直感的なアップロード
- **タイムライン**: 無限スクロール対応の投稿一覧
- **インタラクション**: いいね・コメント機能
- **プロフィール管理**: ユーザープロフィールの表示・編集
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **パフォーマンス最適化**: 画像遅延読み込み、コード分割

## 🛠 技術スタック

### フロントエンド
- **React 18.2.0** - UIライブラリ
- **React Router 6.8.0** - ルーティング
- **Bootstrap 5.2.3** - UIフレームワーク
- **Axios** - HTTP通信
- **Context API** - 状態管理

### バックエンド
- **Flask** - Webフレームワーク
- **DynamoDB** - NoSQLデータベース
- **S3** - 画像ストレージ
- **JWT** - 認証トークン
- **Pillow** - 画像処理

### インフラストラクチャ
- **AWS Lambda** - サーバーレス実行環境
- **API Gateway** - APIエンドポイント
- **CloudFront** - CDN
- **Route53** - DNS管理
- **CloudWatch** - モニタリング
- **X-Ray** - 分散トレーシング

### 開発・運用
- **Docker** - コンテナ化
- **GitHub Actions** - CI/CD
- **AWS SAM** - サーバーレスアプリケーション管理
- **Jest** - テストフレームワーク

## 📋 前提条件

### 開発環境
- **Docker Desktop** 4.0以上
- **Node.js** 18.0以上
- **Python** 3.9以上
- **AWS CLI** 2.0以上（本番デプロイ用）
- **SAM CLI** 1.0以上（本番デプロイ用）

### 本番環境
- **AWSアカウント**
- **ドメイン名**
- **SSL証明書**（AWS Certificate Manager）

## 🚀 クイックスタート

### 1. リポジトリのクローン
```bash
git clone https://github.com/your-username/photo-sharing-app.git
cd photo-sharing-app
```

### 2. 開発環境の起動
```bash
# Windows
setup-dev.bat

# macOS/Linux
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

### 3. アプリケーションへのアクセス
- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:5000
- **DynamoDB Admin**: http://localhost:8001

## 📁 プロジェクト構造

```
photo-sharing-app/
├── frontend/                    # Reactアプリケーション
│   ├── src/
│   │   ├── components/         # Reactコンポーネント
│   │   ├── pages/             # ページコンポーネント
│   │   ├── hooks/             # カスタムフック
│   │   ├── contexts/          # Context API
│   │   ├── services/          # API通信
│   │   ├── utils/             # ユーティリティ
│   │   └── __tests__/         # テストファイル
│   ├── public/                # 静的ファイル
│   └── package.json
├── backend/                     # Flaskアプリケーション
│   ├── shared/                # 共通ライブラリ
│   ├── tests/                 # テストファイル
│   ├── scripts/               # ユーティリティスクリプト
│   ├── app.py                 # メインアプリケーション
│   └── requirements.txt
├── scripts/                     # デプロイ・セットアップスクリプト
├── .github/workflows/           # GitHub Actions
├── template.yaml               # AWS SAMテンプレート
├── docker-compose.yml          # Docker設定
└── README.md
```

## 🧪 テスト

### 全テストの実行
```bash
# フロントエンド
cd frontend
npm run test:all

# バックエンド
cd backend
python -m pytest tests/ -v
```

### テストスイート別実行
```bash
# フロントエンド
npm run test:unit          # 単体テスト
npm run test:integration   # 統合テスト
npm run test:e2e          # E2Eテスト
npm run test:performance  # パフォーマンステスト
npm run test:security     # セキュリティテスト

# バックエンド
python -m pytest tests/unit/        # 単体テスト
python -m pytest tests/integration/ # 統合テスト
```

### カバレッジレポート
```bash
cd frontend
npm run test:coverage
```

## 🚀 デプロイ

### 本番環境へのデプロイ
```bash
# SSL証明書の作成（初回のみ）
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS \
  --region us-east-1

# デプロイ実行
chmod +x scripts/deploy.sh
./scripts/deploy.sh \
  -d your-domain.com \
  -c arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id
```

### ステージング環境へのデプロイ
```bash
./scripts/deploy.sh \
  -e staging \
  -d staging.your-domain.com \
  -c arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id
```

### デプロイオプション
- `-e, --environment`: デプロイ環境（development|staging|production）
- `-d, --domain`: ドメイン名
- `-c, --certificate`: SSL証明書ARN
- `--skip-tests`: テストをスキップ
- `--dry-run`: 変更内容のみ表示

## 🔧 開発ガイド

### 新機能の追加
1. **フロントエンド**:
   ```bash
   cd frontend/src/components
   # 新しいコンポーネントを作成
   # テストファイルも同時に作成
   ```

2. **バックエンド**:
   ```bash
   cd backend
   # 新しいAPIエンドポイントを追加
   # テストファイルも同時に作成
   ```

### コードスタイル
- **ESLint** と **Prettier** を使用（フロントエンド）
- **Black** と **flake8** を使用（バックエンド）
- **pre-commit** フックで自動チェック

### Git ワークフロー
1. `develop` ブランチから機能ブランチを作成
2. 機能実装とテスト作成
3. プルリクエスト作成
4. コードレビュー後にマージ
5. `main` ブランチへのマージで本番デプロイ

## 📊 モニタリング

### CloudWatch ダッシュボード
- **API メトリクス**: リクエスト数、エラー率、レスポンス時間
- **データベース**: 読み書き容量、スロットリング
- **インフラ**: Lambda実行時間、メモリ使用量

### アラート設定
- API エラー率 > 5%
- レスポンス時間 > 2秒
- データベースエラー > 3件/5分

### ログ確認
```bash
# API ログ
aws logs tail /aws/lambda/photo-sharing-app-production-api --follow

# 画像処理ログ
aws logs tail /aws/lambda/photo-sharing-app-production-image-processing --follow
```

## 🔒 セキュリティ

### 実装済みセキュリティ機能
- **JWT認証**: 安全なトークンベース認証
- **CORS設定**: 適切なオリジン制限
- **入力検証**: XSS・SQLインジェクション対策
- **レート制限**: DDoS攻撃対策
- **WAF**: Web Application Firewall
- **暗号化**: データ暗号化（保存時・転送時）

### セキュリティベストプラクティス
- 定期的な依存関係更新
- セキュリティスキャンの実行
- 最小権限の原則
- 監査ログの記録

## 🐛 トラブルシューティング

### よくある問題

#### 1. Docker コンテナが起動しない
```bash
# Docker Desktop の再起動
# ポート競合の確認
docker ps -a
docker-compose down
docker-compose up -d
```

#### 2. API接続エラー
```bash
# バックエンドサーバーの状態確認
curl http://localhost:5000/health

# DynamoDB Local の確認
curl http://localhost:8000
```

#### 3. フロントエンドビルドエラー
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 4. 本番デプロイエラー
```bash
# AWS認証情報の確認
aws sts get-caller-identity

# SAM設定の確認
sam --version

# CloudFormation スタックの状態確認
aws cloudformation describe-stacks --stack-name photo-sharing-app-production
```

### ログの確認方法
```bash
# 開発環境
docker-compose logs -f backend
docker-compose logs -f frontend

# 本番環境
aws logs tail /aws/lambda/photo-sharing-app-production-api --follow
```

## 📈 パフォーマンス最適化

### フロントエンド
- **コード分割**: React.lazy による動的インポート
- **画像最適化**: WebP対応、遅延読み込み
- **キャッシュ戦略**: Service Worker、CDN
- **バンドル最適化**: Tree shaking、圧縮

### バックエンド
- **データベース**: インデックス最適化、クエリ最適化
- **キャッシュ**: Redis、CloudFront
- **画像処理**: 非同期処理、複数サイズ生成
- **モニタリング**: X-Ray、CloudWatch

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### コントリビューションガイドライン
- コードスタイルガイドに従う
- テストを追加する
- ドキュメントを更新する
- コミットメッセージは明確に記述する

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 👥 チーム

- **開発者**: [Your Name](https://github.com/your-username)
- **デザイナー**: [Designer Name](https://github.com/designer-username)

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/your-username/photo-sharing-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/photo-sharing-app/discussions)
- **Email**: support@your-domain.com

## 🗺 ロードマップ

### v2.0 (予定)
- [ ] リアルタイム通知
- [ ] ストーリー機能
- [ ] ダークモード
- [ ] 多言語対応

### v2.1 (予定)
- [ ] AI による画像タグ付け
- [ ] 高度な検索機能
- [ ] ソーシャルログイン

---

**写真共有アプリケーション** - モダンで安全な写真共有プラットフォーム 📸✨