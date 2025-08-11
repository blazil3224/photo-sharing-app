#!/bin/bash

# 写真共有アプリ - 本番デプロイスクリプト
# 要件6.4: 本番環境デプロイスクリプト作成

set -e  # エラー時に停止

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# デフォルト値
ENVIRONMENT="production"
STACK_NAME="photo-sharing-app"
REGION="ap-northeast-1"
DOMAIN_NAME=""
CERTIFICATE_ARN=""
SKIP_TESTS=false
DRY_RUN=false

# ヘルプ表示
show_help() {
    cat << EOF
写真共有アプリ デプロイスクリプト

使用方法:
    $0 [オプション]

オプション:
    -e, --environment ENV     デプロイ環境 (development|staging|production) [デフォルト: production]
    -s, --stack-name NAME     CloudFormationスタック名 [デフォルト: photo-sharing-app]
    -r, --region REGION       AWSリージョン [デフォルト: ap-northeast-1]
    -d, --domain DOMAIN       ドメイン名 (必須)
    -c, --certificate ARN     SSL証明書のARN (必須)
    --skip-tests             テストをスキップ
    --dry-run                実際のデプロイを行わず、変更内容のみ表示
    -h, --help               このヘルプを表示

例:
    $0 -d example.com -c arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
    $0 -e staging -d staging.example.com -c arn:aws:acm:us-east-1:123456789012:certificate/87654321-4321-4321-4321-210987654321
EOF
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -c|--certificate)
            CERTIFICATE_ARN="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "不明なオプション: $1"
            show_help
            exit 1
            ;;
    esac
done

# オプションパラメータのチェック
if [[ -z "$DOMAIN_NAME" ]]; then
    log_warning "ドメイン名が指定されていません。CloudFrontのデフォルトドメインを使用します。"
    DOMAIN_NAME=""
fi

if [[ -z "$CERTIFICATE_ARN" ]]; then
    log_warning "SSL証明書のARNが指定されていません。HTTPSは使用できません。"
    CERTIFICATE_ARN=""
fi

# 環境の検証
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "無効な環境: $ENVIRONMENT"
    exit 1
fi

# AWS CLI の確認
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI がインストールされていません"
    exit 1
fi

# SAM CLI の確認
if ! command -v sam &> /dev/null; then
    log_error "SAM CLI がインストールされていません"
    exit 1
fi

# Node.js の確認
if ! command -v node &> /dev/null; then
    log_error "Node.js がインストールされていません"
    exit 1
fi

# Python の確認
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 がインストールされていません"
    exit 1
fi

# AWS認証情報の確認
log_info "AWS認証情報を確認中..."
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS認証情報が設定されていません"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log_success "AWS Account ID: $ACCOUNT_ID"

# プロジェクトルートディレクトリの確認
if [[ ! -f "template.yaml" ]]; then
    log_error "template.yaml が見つかりません。プロジェクトルートで実行してください。"
    exit 1
fi

# デプロイ前のテスト実行
if [[ "$SKIP_TESTS" == false ]]; then
    log_info "テストを実行中..."
    
    # バックエンドテスト
    log_info "バックエンドテストを実行中..."
    cd backend
    if [[ -f "requirements.txt" ]]; then
        python3 -m pip install -r requirements.txt --quiet
    fi
    python3 -m pytest tests/ -v
    cd ..
    
    # フロントエンドテスト
    log_info "フロントエンドテストを実行中..."
    cd frontend
    if [[ -f "package.json" ]]; then
        npm ci --silent
        npm run test:ci
    fi
    cd ..
    
    log_success "すべてのテストが成功しました"
else
    log_warning "テストをスキップしました"
fi

# フロントエンドビルド
log_info "フロントエンドをビルド中..."
cd frontend
npm run build
cd ..

# バックエンドの依存関係インストール
log_info "バックエンドの依存関係をインストール中..."
cd backend
pip3 install -r requirements.txt -t .
cd ..

# SAM ビルド
log_info "SAM アプリケーションをビルド中..."
sam build --use-container

# パラメータファイルの作成
PARAMS_FILE="deploy-params-${ENVIRONMENT}.json"
cat > "$PARAMS_FILE" << EOF
[
    {
        "ParameterKey": "Environment",
        "ParameterValue": "$ENVIRONMENT"
    },
    {
        "ParameterKey": "DomainName",
        "ParameterValue": "$DOMAIN_NAME"
    },
    {
        "ParameterKey": "CertificateArn",
        "ParameterValue": "$CERTIFICATE_ARN"
    }
]
EOF

# デプロイ実行
FULL_STACK_NAME="${STACK_NAME}-${ENVIRONMENT}"

if [[ "$DRY_RUN" == true ]]; then
    log_info "ドライランモード: 変更内容を表示中..."
    sam deploy \
        --template-file .aws-sam/build/template.yaml \
        --stack-name "$FULL_STACK_NAME" \
        --parameter-overrides file://"$PARAMS_FILE" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region "$REGION" \
        --no-execute-changeset \
        --no-confirm-changeset
else
    log_info "デプロイを実行中..."
    sam deploy \
        --template-file .aws-sam/build/template.yaml \
        --stack-name "$FULL_STACK_NAME" \
        --parameter-overrides file://"$PARAMS_FILE" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region "$REGION" \
        --no-confirm-changeset \
        --tags Environment="$ENVIRONMENT" Application=PhotoSharingApp
fi

# デプロイ後の処理
if [[ "$DRY_RUN" == false ]]; then
    # スタック出力の取得
    log_info "デプロイ結果を取得中..."
    
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "$FULL_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text)
    
    WEBSITE_URL=$(aws cloudformation describe-stacks \
        --stack-name "$FULL_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
        --output text)
    
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
        --stack-name "$FULL_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
        --output text)
    
    # フロントエンドのデプロイ
    log_info "フロントエンドをS3にアップロード中..."
    
    WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "$FULL_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucket`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$WEBSITE_BUCKET" ]]; then
        # 環境変数を含むビルド設定ファイルの作成
        cat > frontend/.env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_ENVIRONMENT=$ENVIRONMENT
REACT_APP_REGION=$REGION
EOF
        
        # 再ビルド（環境変数を反映）
        cd frontend
        npm run build
        cd ..
        
        # S3にアップロード
        aws s3 sync frontend/build/ s3://"$WEBSITE_BUCKET"/ \
            --region "$REGION" \
            --delete \
            --cache-control "public, max-age=31536000" \
            --exclude "*.html" \
            --exclude "service-worker.js"
        
        # HTMLファイルは短いキャッシュ時間で
        aws s3 sync frontend/build/ s3://"$WEBSITE_BUCKET"/ \
            --region "$REGION" \
            --cache-control "public, max-age=0, must-revalidate" \
            --include "*.html" \
            --include "service-worker.js"
        
        # CloudFront キャッシュの無効化
        if [[ -n "$CLOUDFRONT_ID" ]]; then
            log_info "CloudFrontキャッシュを無効化中..."
            aws cloudfront create-invalidation \
                --distribution-id "$CLOUDFRONT_ID" \
                --paths "/*" \
                --region "$REGION" > /dev/null
        fi
    fi
    
    # デプロイ完了メッセージ
    log_success "デプロイが完了しました！"
    echo
    echo "=== デプロイ情報 ==="
    echo "環境: $ENVIRONMENT"
    echo "スタック名: $FULL_STACK_NAME"
    echo "リージョン: $REGION"
    echo "ウェブサイトURL: $WEBSITE_URL"
    echo "API URL: $API_URL"
    echo
    
    # ヘルスチェック
    log_info "ヘルスチェックを実行中..."
    sleep 10  # デプロイ完了を待機
    
    if curl -f -s "$API_URL/health" > /dev/null; then
        log_success "APIヘルスチェック: OK"
    else
        log_warning "APIヘルスチェック: 失敗（数分後に再試行してください）"
    fi
    
    # 後処理の推奨事項
    echo
    echo "=== 次のステップ ==="
    echo "1. DNS設定の確認: $DOMAIN_NAME が CloudFront を指していることを確認"
    echo "2. SSL証明書の確認: HTTPS接続が正常に動作することを確認"
    echo "3. モニタリング設定: CloudWatch ダッシュボードとアラームの確認"
    echo "4. セキュリティ設定: WAF ルールとセキュリティグループの確認"
    echo
fi

# 一時ファイルのクリーンアップ
rm -f "$PARAMS_FILE"
rm -f frontend/.env.production

log_success "デプロイスクリプトが完了しました"