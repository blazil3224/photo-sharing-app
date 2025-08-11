# 運用ドキュメント - 写真共有アプリケーション

## 📋 概要

このドキュメントは、写真共有アプリケーションの本番環境における運用手順、監視、トラブルシューティングについて説明します。

## 🏗 アーキテクチャ概要

### システム構成
```
Internet
    ↓
CloudFront (CDN)
    ↓
Route53 (DNS)
    ↓
API Gateway
    ↓
Lambda Functions
    ↓
DynamoDB + S3
```

### 主要コンポーネント
- **CloudFront**: 静的コンテンツ配信とキャッシュ
- **API Gateway**: APIエンドポイント管理
- **Lambda**: サーバーレス実行環境
- **DynamoDB**: NoSQLデータベース
- **S3**: 画像ストレージ
- **CloudWatch**: 監視とログ
- **X-Ray**: 分散トレーシング

## 🚀 デプロイメント

### 本番デプロイ手順

#### 1. 事前準備
```bash
# AWS認証情報の設定
aws configure

# 必要なツールのインストール確認
aws --version
sam --version
node --version
python3 --version
```

#### 2. SSL証明書の作成（初回のみ）
```bash
# us-east-1リージョンで証明書を作成（CloudFront用）
aws acm request-certificate \
  --domain-name your-domain.com \
  --subject-alternative-names "*.your-domain.com" \
  --validation-method DNS \
  --region us-east-1

# 証明書の検証
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id \
  --region us-east-1
```

#### 3. デプロイ実行
```bash
# 本番環境デプロイ
./scripts/deploy.sh \
  -e production \
  -d your-domain.com \
  -c arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id

# ステージング環境デプロイ
./scripts/deploy.sh \
  -e staging \
  -d staging.your-domain.com \
  -c arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id
```

#### 4. デプロイ後の確認
```bash
# ヘルスチェック
curl -f https://api.your-domain.com/health

# CloudFront動作確認
curl -I https://your-domain.com

# DNS設定確認
nslookup your-domain.com
```

### ロールバック手順

#### 1. 緊急ロールバック
```bash
# 前のバージョンのスタックに戻す
aws cloudformation update-stack \
  --stack-name photo-sharing-app-production \
  --use-previous-template \
  --parameters ParameterKey=Environment,UsePreviousValue=true

# CloudFrontキャッシュの無効化
aws cloudfront create-invalidation \
  --distribution-id E1234567890123 \
  --paths "/*"
```

#### 2. コードレベルのロールバック
```bash
# 前のコミットに戻す
git revert HEAD
git push origin main

# 自動デプロイが実行される（GitHub Actions）
```

## 📊 監視とアラート

### CloudWatch メトリクス

#### API メトリクス
- **リクエスト数**: `AWS/ApiGateway` - `Count`
- **エラー率**: `AWS/ApiGateway` - `4XXError`, `5XXError`
- **レスポンス時間**: `AWS/ApiGateway` - `Latency`

#### Lambda メトリクス
- **実行時間**: `AWS/Lambda` - `Duration`
- **エラー数**: `AWS/Lambda` - `Errors`
- **同時実行数**: `AWS/Lambda` - `ConcurrentExecutions`
- **スロットリング**: `AWS/Lambda` - `Throttles`

#### DynamoDB メトリクス
- **読み込み容量**: `AWS/DynamoDB` - `ConsumedReadCapacityUnits`
- **書き込み容量**: `AWS/DynamoDB` - `ConsumedWriteCapacityUnits`
- **スロットリング**: `AWS/DynamoDB` - `ReadThrottles`, `WriteThrottles`

### アラート設定

#### 重要度: Critical
```bash
# API エラー率 > 5%
aws cloudwatch put-metric-alarm \
  --alarm-name "API-HighErrorRate" \
  --alarm-description "API error rate is too high" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

#### 重要度: Warning
```bash
# レスポンス時間 > 2秒
aws cloudwatch put-metric-alarm \
  --alarm-name "API-HighLatency" \
  --alarm-description "API latency is too high" \
  --metric-name Latency \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --threshold 2000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3
```

### ダッシュボード設定

#### CloudWatch ダッシュボードの作成
```bash
# ダッシュボード作成
aws cloudwatch put-dashboard \
  --dashboard-name "PhotoSharingApp-Production" \
  --dashboard-body file://dashboard-config.json
```

## 🔍 ログ管理

### ログの種類と場所

#### API ログ
```bash
# リアルタイムログ監視
aws logs tail /aws/lambda/photo-sharing-app-production-api --follow

# 特定期間のログ検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/photo-sharing-app-production-api \
  --start-time 1640995200000 \
  --filter-pattern "ERROR"
```

#### 画像処理ログ
```bash
# 画像処理ログ監視
aws logs tail /aws/lambda/photo-sharing-app-production-image-processing --follow
```

#### API Gateway ログ
```bash
# API Gateway アクセスログ
aws logs tail /aws/apigateway/photo-sharing-app-production --follow
```

### ログ分析

#### よく使用するフィルターパターン
```bash
# エラーログのみ
--filter-pattern "ERROR"

# 特定ユーザーのアクション
--filter-pattern "{ $.user_id = \"user-123\" }"

# レスポンス時間が長いリクエスト
--filter-pattern "{ $.duration > 2000 }"

# 特定のAPIエンドポイント
--filter-pattern "{ $.path = \"/api/posts\" }"
```

## 🔧 メンテナンス

### 定期メンテナンス

#### 週次メンテナンス
1. **ログの確認**
   ```bash
   # エラーログの確認
   aws logs filter-log-events \
     --log-group-name /aws/lambda/photo-sharing-app-production-api \
     --start-time $(date -d '7 days ago' +%s)000 \
     --filter-pattern "ERROR"
   ```

2. **メトリクスの確認**
   ```bash
   # 過去7日間のメトリクス取得
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name Count \
     --start-time $(date -d '7 days ago' --iso-8601) \
     --end-time $(date --iso-8601) \
     --period 86400 \
     --statistics Sum
   ```

3. **セキュリティ更新**
   ```bash
   # 依存関係の脆弱性チェック
   cd frontend && npm audit
   cd backend && pip-audit
   ```

#### 月次メンテナンス
1. **コスト分析**
   ```bash
   # 月次コスト確認
   aws ce get-cost-and-usage \
     --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-01) \
     --granularity MONTHLY \
     --metrics BlendedCost
   ```

2. **パフォーマンス分析**
   ```bash
   # X-Ray トレース分析
   aws xray get-trace-summaries \
     --time-range-type TimeRangeByStartTime \
     --start-time $(date -d '1 month ago' --iso-8601) \
     --end-time $(date --iso-8601)
   ```

### データベースメンテナンス

#### DynamoDB 最適化
```bash
# テーブル使用状況の確認
aws dynamodb describe-table --table-name photo-sharing-app-production-users
aws dynamodb describe-table --table-name photo-sharing-app-production-posts
aws dynamodb describe-table --table-name photo-sharing-app-production-interactions

# 容量の調整（必要に応じて）
aws dynamodb update-table \
  --table-name photo-sharing-app-production-posts \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10
```

#### バックアップの確認
```bash
# ポイントインタイムリカバリの状態確認
aws dynamodb describe-continuous-backups \
  --table-name photo-sharing-app-production-users
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. API レスポンスが遅い
**症状**: API のレスポンス時間が 2秒以上

**調査手順**:
```bash
# Lambda 実行時間の確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/photo-sharing-app-production-api \
  --filter-pattern "{ $.duration > 2000 }"

# DynamoDB スロットリングの確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ReadThrottles \
  --dimensions Name=TableName,Value=photo-sharing-app-production-posts \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Sum
```

**解決方法**:
- DynamoDB 容量の増加
- Lambda メモリサイズの調整
- クエリの最適化

#### 2. 画像アップロードが失敗する
**症状**: 画像アップロード時にエラーが発生

**調査手順**:
```bash
# S3 アップロードエラーの確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/photo-sharing-app-production-api \
  --filter-pattern "S3"

# 画像処理ログの確認
aws logs tail /aws/lambda/photo-sharing-app-production-image-processing --follow
```

**解決方法**:
- S3 バケットポリシーの確認
- Lambda タイムアウト設定の調整
- 画像サイズ制限の確認

#### 3. CloudFront キャッシュの問題
**症状**: 更新したコンテンツが反映されない

**解決方法**:
```bash
# キャッシュの無効化
aws cloudfront create-invalidation \
  --distribution-id E1234567890123 \
  --paths "/*"

# 無効化の状態確認
aws cloudfront get-invalidation \
  --distribution-id E1234567890123 \
  --id I1234567890123
```

### エラーコード別対応

#### HTTP 500 エラー
1. Lambda ログの確認
2. DynamoDB 接続状態の確認
3. 環境変数の確認

#### HTTP 403 エラー
1. API Gateway 認証設定の確認
2. JWT トークンの有効性確認
3. CORS 設定の確認

#### HTTP 429 エラー
1. レート制限の確認
2. DynamoDB スロットリングの確認
3. Lambda 同時実行制限の確認

## 🔐 セキュリティ運用

### セキュリティ監視

#### 不審なアクセスの検出
```bash
# 異常なリクエスト数の検出
aws logs filter-log-events \
  --log-group-name /aws/apigateway/photo-sharing-app-production \
  --filter-pattern "{ $.responseTime > 5000 || $.status >= 400 }"

# 特定IPからの大量アクセス
aws logs filter-log-events \
  --log-group-name /aws/apigateway/photo-sharing-app-production \
  --filter-pattern "{ $.sourceIp = \"192.168.1.1\" }" \
  --start-time $(date -d '1 hour ago' +%s)000
```

#### WAF ログの確認
```bash
# WAF でブロックされたリクエスト
aws logs filter-log-events \
  --log-group-name aws-waf-logs-photo-sharing-app \
  --filter-pattern "{ $.action = \"BLOCK\" }"
```

### セキュリティ更新

#### 定期的なセキュリティチェック
```bash
# 依存関係の脆弱性スキャン
cd frontend && npm audit --audit-level moderate
cd backend && pip-audit

# AWS Config によるコンプライアンスチェック
aws configservice get-compliance-summary
```

## 📈 パフォーマンス最適化

### 定期的な最適化タスク

#### 1. DynamoDB 最適化
```bash
# 使用されていないインデックスの確認
aws dynamodb describe-table --table-name photo-sharing-app-production-posts \
  --query 'Table.GlobalSecondaryIndexes[?IndexStatus==`ACTIVE`]'

# 容量使用率の確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=photo-sharing-app-production-posts \
  --start-time $(date -d '24 hours ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 3600 \
  --statistics Average,Maximum
```

#### 2. Lambda 最適化
```bash
# メモリ使用量の分析
aws logs filter-log-events \
  --log-group-name /aws/lambda/photo-sharing-app-production-api \
  --filter-pattern "{ $.maxMemoryUsed exists }"
```

#### 3. CloudFront 最適化
```bash
# キャッシュヒット率の確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=E1234567890123 \
  --start-time $(date -d '24 hours ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 3600 \
  --statistics Average
```

## 📞 緊急時対応

### 緊急連絡先
- **開発チーム**: dev-team@your-domain.com
- **インフラチーム**: infra-team@your-domain.com
- **オンコール**: +81-90-1234-5678

### 緊急時対応手順

#### 1. サービス停止時
1. **影響範囲の確認**
2. **ステータスページの更新**
3. **ロールバックの実行**
4. **根本原因の調査**
5. **事後報告書の作成**

#### 2. セキュリティインシデント
1. **影響範囲の特定**
2. **アクセスの遮断**
3. **ログの保全**
4. **関係者への通知**
5. **復旧作業の実施**

### エスカレーション手順
1. **Level 1**: 開発チーム（30分以内）
2. **Level 2**: インフラチーム（1時間以内）
3. **Level 3**: 経営陣（2時間以内）

---

このドキュメントは定期的に更新され、最新の運用手順を反映します。