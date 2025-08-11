# デプロイメントガイド

## 概要

このドキュメントでは、写真共有アプリケーションの本番環境へのデプロイ手順について説明します。

## 前提条件

### 必要なツール

- AWS CLI v2.0以上
- SAM CLI v1.0以上
- Node.js v18以上
- Python 3.9以上
- Docker

### AWS権限

デプロイを実行するIAMユーザーまたはロールには、以下の権限が必要です：

- CloudFormation: フルアクセス
- Lambda: フルアクセス
- API Gateway: フルアクセス
- DynamoDB: フルアクセス
- S3: フルアクセス
- CloudFront: フルアクセス
- Route53: フルアクセス
- Cognito: フルアクセス
- WAF: フルアクセス
- CloudWatch: フルアクセス
- X-Ray: フルアクセス
- Secrets Manager: フルアクセス

## デプロイ手順

### 1. 事前準備

#### SSL証明書の取得

```bash
# AWS Certificate Manager で SSL証明書を取得
aws acm request-certificate \
    --domain-name example.com \
    --subject-alternative-names "*.example.com" \
    --validation-method DNS \
    --region us-east-1  # CloudFront用は us-east-1 必須
```

#### ドメインの準備

Route53でホストゾーンを作成するか、既存のドメインのDNS設定を準備します。

### 2. 設定ファイルの準備

#### 環境変数の設定

```bash
export AWS_REGION=ap-northeast-1
export DOMAIN_NAME=your-domain.com
export CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id
```

### 3. デプロイの実行

#### 本番環境へのデプロイ

```bash
# 実行権限の付与
chmod +x scripts/deploy.sh

# デプロイ実行
./scripts/deploy.sh \
    --environment production \
    --domain your-domain.com \
    --certificate arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id
```

#### ステージング環境へのデプロイ

```bash
./scripts/deploy.sh \
    --environment staging \
    --domain staging.your-domain.com \
    --certificate arn:aws:acm:us-east-1:123456789012:certificate/your-staging-cert-id
```

#### ドライラン（変更内容の確認）

```bash
./scripts/deploy.sh \
    --domain your-domain.com \
    --certificate arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id \
    --dry-run
```

### 4. デプロイ後の確認

#### ヘルスチェック

```bash
# API ヘルスチェック
curl https://api.your-domain.com/health

# ウェブサイトの確認
curl -I https://your-domain.com
```

#### CloudWatch ダッシュボードの確認

AWS コンソールでCloudWatchダッシュボードを確認し、メトリクスが正常に収集されていることを確認します。

## 環境別設定

### Development

- 最小限のリソース構成
- 短いキャッシュ時間
- 詳細なログ出力

### Staging

- 本番に近い構成
- 本番データのサブセットでテスト
- パフォーマンステスト実行

### Production

- 高可用性構成
- 自動スケーリング
- 包括的なモニタリング

## トラブルシューティング

### よくある問題

#### 1. SSL証明書のエラー

```
Certificate ARN is not valid
```

**解決方法:**
- 証明書がus-east-1リージョンで作成されていることを確認
- 証明書のステータスが「発行済み」であることを確認

#### 2. ドメイン名の解決エラー

```
Domain name resolution failed
```

**解決方法:**
- Route53のホストゾーンが正しく設定されていることを確認
- DNSの伝播を待つ（最大48時間）

#### 3. Lambda関数のタイムアウト

```
Task timed out after 30.00 seconds
```

**解決方法:**
- Lambda関数のタイムアウト設定を増加
- コードの最適化
- DynamoDBのキャパシティ設定を確認

### ログの確認

```bash
# Lambda関数のログ
aws logs tail /aws/lambda/photo-sharing-app-production-api --follow

# CloudFormationスタックのイベント
aws cloudformation describe-stack-events \
    --stack-name photo-sharing-app-production
```

## ロールバック手順

### 前のバージョンへのロールバック

```bash
# CloudFormationスタックの更新を取り消し
aws cloudformation cancel-update-stack \
    --stack-name photo-sharing-app-production

# または前のテンプレートで再デプロイ
git checkout previous-version
./scripts/deploy.sh --environment production --domain your-domain.com --certificate your-cert-arn
```

### 緊急時の対応

1. CloudFrontディストリビューションの無効化
2. API Gatewayのステージを前のバージョンに切り替え
3. DynamoDBのポイントインタイムリカバリを使用

## セキュリティ考慮事項

### 本番環境でのセキュリティ設定

1. **WAF設定の確認**
   - レート制限ルールの有効化
   - 一般的な攻撃パターンのブロック

2. **DynamoDBの暗号化**
   - 保存時暗号化の有効化
   - 転送時暗号化の確認

3. **S3バケットのセキュリティ**
   - パブリックアクセスのブロック
   - バケットポリシーの最小権限設定

4. **Lambda関数のセキュリティ**
   - 環境変数の暗号化
   - VPC設定（必要に応じて）

## モニタリングとアラート

### 設定されるアラーム

- API エラー率
- API レスポンス時間
- DynamoDB スロットリング
- Lambda 関数エラー

### カスタムメトリクス

- ユーザー登録数
- 投稿数
- いいね数
- コメント数

## バックアップとリカバリ

### 自動バックアップ

- DynamoDB: ポイントインタイムリカバリ（35日間）
- S3: バージョニング有効化

### 手動バックアップ

```bash
# DynamoDBテーブルのバックアップ
aws dynamodb create-backup \
    --table-name photo-sharing-app-production-users \
    --backup-name users-backup-$(date +%Y%m%d)
```

## パフォーマンス最適化

### DynamoDB最適化

- 適切なキャパシティ設定
- GSIの効率的な使用
- ホットパーティションの回避

### CloudFront最適化

- 適切なキャッシュ設定
- 圧縮の有効化
- エッジロケーションの活用

## コスト最適化

### リソース使用量の監視

- CloudWatch Cost Anomaly Detection
- AWS Cost Explorer での分析
- 予算アラートの設定

### 最適化の推奨事項

- 未使用リソースの削除
- 適切なインスタンスサイズの選択
- Reserved Instancesの活用（該当する場合）