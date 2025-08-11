# API 仕様書 - 写真共有アプリケーション

## 📋 概要

写真共有アプリケーションのREST API仕様書です。すべてのAPIエンドポイント、リクエスト・レスポンス形式、認証方法について説明します。

## 🔗 ベースURL

- **本番環境**: `https://api.your-domain.com`
- **ステージング環境**: `https://api.staging.your-domain.com`
- **開発環境**: `http://localhost:5000`

## 🔐 認証

### JWT認証
すべての保護されたエンドポイントは、JWTトークンによる認証が必要です。

#### ヘッダー形式
```
Authorization: Bearer <JWT_TOKEN>
```

#### トークンの取得
ログインAPIからJWTトークンを取得し、以降のリクエストで使用します。

## 📝 共通レスポンス形式

### 成功レスポンス
```json
{
  "success": true,
  "message": "操作が成功しました",
  "data": {
    // レスポンスデータ
  }
}
```

### エラーレスポンス
```json
{
  "success": false,
  "message": "エラーメッセージ",
  "error_code": "ERROR_CODE",
  "details": {
    // エラー詳細（オプション）
  }
}
```

### HTTPステータスコード
- `200`: 成功
- `201`: 作成成功
- `400`: リクエストエラー
- `401`: 認証エラー
- `403`: 権限エラー
- `404`: リソースが見つからない
- `429`: レート制限
- `500`: サーバーエラー

## 🔑 認証API

### POST /api/auth/register
新規ユーザー登録

#### リクエスト
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```

#### レスポンス
```json
{
  "success": true,
  "message": "ユーザー登録が完了しました",
  "data": {
    "user": {
      "user_id": "user-123",
      "username": "testuser",
      "email": "test@example.com",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### バリデーション
- `username`: 3-20文字、英数字とアンダースコアのみ
- `email`: 有効なメールアドレス形式
- `password`: 8文字以上、大文字・小文字・数字・記号を含む

### POST /api/auth/login
ユーザーログイン

#### リクエスト
```json
{
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```

#### レスポンス
```json
{
  "success": true,
  "message": "ログインしました",
  "data": {
    "user": {
      "user_id": "user-123",
      "username": "testuser",
      "email": "test@example.com",
      "profile_image": "https://example.com/avatar.jpg",
      "bio": "こんにちは！"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /api/auth/logout
ユーザーログアウト

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "message": "ログアウトしました"
}
```

### GET /api/auth/me
現在のユーザー情報取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "user-123",
      "username": "testuser",
      "email": "test@example.com",
      "profile_image": "https://example.com/avatar.jpg",
      "bio": "こんにちは！",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

## 📸 投稿API

### GET /api/posts/timeline
タイムライン取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### クエリパラメータ
- `limit` (optional): 取得件数（デフォルト: 20、最大: 50）
- `last_key` (optional): ページネーション用キー

#### レスポンス
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "post_id": "post-123",
        "user_id": "user-123",
        "user": {
          "user_id": "user-123",
          "username": "testuser",
          "profile_image": "https://example.com/avatar.jpg"
        },
        "image_url": "https://example.com/image.jpg",
        "caption": "素晴らしい写真です！",
        "likes_count": 15,
        "comments_count": 3,
        "user_liked": true,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "last_key": "next-page-key",
    "has_more": true
  }
}
```

### GET /api/posts/{post_id}
投稿詳細取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "post_id": "post-123",
    "user_id": "user-123",
    "user": {
      "user_id": "user-123",
      "username": "testuser",
      "profile_image": "https://example.com/avatar.jpg"
    },
    "image_url": "https://example.com/image.jpg",
    "caption": "素晴らしい写真です！",
    "likes_count": 15,
    "comments_count": 3,
    "user_liked": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/posts
新規投稿作成

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### リクエスト
```json
{
  "image_key": "uploads/user-123/image-456.jpg",
  "caption": "素晴らしい写真です！"
}
```

#### レスポンス
```json
{
  "success": true,
  "message": "投稿を作成しました",
  "data": {
    "post_id": "post-123",
    "user_id": "user-123",
    "image_url": "https://example.com/image.jpg",
    "caption": "素晴らしい写真です！",
    "likes_count": 0,
    "comments_count": 0,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### DELETE /api/posts/{post_id}
投稿削除

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "message": "投稿を削除しました"
}
```

### GET /api/posts/user/{user_id}
ユーザーの投稿一覧取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### クエリパラメータ
- `limit` (optional): 取得件数（デフォルト: 20、最大: 50）
- `last_key` (optional): ページネーション用キー

#### レスポンス
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "post_id": "post-123",
        "user_id": "user-123",
        "image_url": "https://example.com/image.jpg",
        "caption": "素晴らしい写真です！",
        "likes_count": 15,
        "comments_count": 3,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "last_key": "next-page-key",
    "has_more": true
  }
}
```

## 💝 インタラクションAPI

### POST /api/interactions/like
いいね切り替え

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### リクエスト
```json
{
  "post_id": "post-123"
}
```

#### レスポンス
```json
{
  "success": true,
  "message": "いいねしました",
  "data": {
    "liked": true,
    "likes_count": 16
  }
}
```

### POST /api/interactions/comment
コメント投稿

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### リクエスト
```json
{
  "post_id": "post-123",
  "content": "素晴らしい写真ですね！"
}
```

#### レスポンス
```json
{
  "success": true,
  "message": "コメントを投稿しました",
  "data": {
    "interaction_id": "comment-456",
    "post_id": "post-123",
    "user_id": "user-123",
    "content": "素晴らしい写真ですね！",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### GET /api/interactions/comments/{post_id}
コメント一覧取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### クエリパラメータ
- `limit` (optional): 取得件数（デフォルト: 20、最大: 100）

#### レスポンス
```json
{
  "success": true,
  "data": [
    {
      "interaction_id": "comment-456",
      "post_id": "post-123",
      "user_id": "user-123",
      "user": {
        "user_id": "user-123",
        "username": "testuser",
        "profile_image": "https://example.com/avatar.jpg"
      },
      "content": "素晴らしい写真ですね！",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### DELETE /api/interactions/comment/{interaction_id}
コメント削除

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "message": "コメントを削除しました"
}
```

## 👤 プロフィールAPI

### GET /api/profile/{user_id}
プロフィール取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "user_id": "user-123",
    "username": "testuser",
    "email": "test@example.com",
    "profile_image": "https://example.com/avatar.jpg",
    "bio": "こんにちは！写真が好きです。",
    "posts_count": 25,
    "followers_count": 150,
    "following_count": 75,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### PUT /api/profile
プロフィール更新

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### リクエスト
```json
{
  "username": "newusername",
  "bio": "新しい自己紹介文です",
  "profile_image": "https://example.com/new-avatar.jpg"
}
```

#### レスポンス
```json
{
  "success": true,
  "message": "プロフィールを更新しました",
  "data": {
    "user_id": "user-123",
    "username": "newusername",
    "email": "test@example.com",
    "profile_image": "https://example.com/new-avatar.jpg",
    "bio": "新しい自己紹介文です",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 📤 アップロードAPI

### POST /api/upload/presigned-url
署名付きURL取得

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### リクエスト
```json
{
  "file_name": "image.jpg",
  "file_type": "image/jpeg",
  "file_size": 1024000
}
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "upload_url": "https://s3.amazonaws.com/bucket/uploads/user-123/image-456.jpg?signature=...",
    "image_key": "uploads/user-123/image-456.jpg",
    "expires_in": 3600
  }
}
```

#### ファイル制限
- **対応形式**: JPEG, PNG, WebP
- **最大サイズ**: 10MB
- **最大解像度**: 4096x4096px

## 🔍 検索API

### GET /api/search/users
ユーザー検索

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### クエリパラメータ
- `q`: 検索クエリ（必須）
- `limit` (optional): 取得件数（デフォルト: 20、最大: 50）

#### レスポンス
```json
{
  "success": true,
  "data": [
    {
      "user_id": "user-123",
      "username": "testuser",
      "profile_image": "https://example.com/avatar.jpg",
      "bio": "こんにちは！"
    }
  ]
}
```

### GET /api/search/posts
投稿検索

#### ヘッダー
```
Authorization: Bearer <JWT_TOKEN>
```

#### クエリパラメータ
- `q`: 検索クエリ（必須）
- `limit` (optional): 取得件数（デフォルト: 20、最大: 50）

#### レスポンス
```json
{
  "success": true,
  "data": [
    {
      "post_id": "post-123",
      "user_id": "user-123",
      "user": {
        "user_id": "user-123",
        "username": "testuser",
        "profile_image": "https://example.com/avatar.jpg"
      },
      "image_url": "https://example.com/image.jpg",
      "caption": "素晴らしい写真です！",
      "likes_count": 15,
      "comments_count": 3,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 🏥 ヘルスチェックAPI

### GET /health
サービス状態確認

#### レスポンス
```json
{
  "status": "healthy",
  "service": "photo-sharing-backend",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "storage": "healthy"
  }
}
```

### GET /api/metrics
メトリクス取得（管理者のみ）

#### ヘッダー
```
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-01T00:00:00Z",
    "environment": "production",
    "dynamodb_metrics": {
      "timeline_query": {
        "total_queries": 1250,
        "avg_time": 45.2,
        "slow_query_percentage": 2.1
      }
    },
    "cloudwatch_metrics": {
      "APIRequests": 15420,
      "APIErrors": 23,
      "APIResponseTime": 156.7
    }
  }
}
```

## ⚠️ エラーコード一覧

### 認証エラー
- `AUTH_001`: 無効なトークン
- `AUTH_002`: トークンの有効期限切れ
- `AUTH_003`: 認証情報が不正
- `AUTH_004`: アカウントが無効

### バリデーションエラー
- `VALID_001`: 必須フィールドが不足
- `VALID_002`: フィールド形式が不正
- `VALID_003`: 値が範囲外
- `VALID_004`: 重複データ

### リソースエラー
- `RESOURCE_001`: リソースが見つからない
- `RESOURCE_002`: リソースへのアクセス権限なし
- `RESOURCE_003`: リソースが削除済み

### サーバーエラー
- `SERVER_001`: データベース接続エラー
- `SERVER_002`: 外部サービス接続エラー
- `SERVER_003`: 内部処理エラー

## 🚦 レート制限

### 制限値
- **認証API**: 10リクエスト/分
- **投稿API**: 30リクエスト/分
- **インタラクションAPI**: 60リクエスト/分
- **その他API**: 100リクエスト/分

### レスポンスヘッダー
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### 制限超過時のレスポンス
```json
{
  "success": false,
  "message": "レート制限に達しました",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retry_after": 60
  }
}
```

## 📝 使用例

### JavaScript (Axios)
```javascript
// ログイン
const loginResponse = await axios.post('/api/auth/login', {
  email: 'test@example.com',
  password: 'password123'
});

const token = loginResponse.data.data.token;

// 認証が必要なAPIの呼び出し
const timelineResponse = await axios.get('/api/posts/timeline', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Python (requests)
```python
import requests

# ログイン
login_response = requests.post('/api/auth/login', json={
    'email': 'test@example.com',
    'password': 'password123'
})

token = login_response.json()['data']['token']

# 認証が必要なAPIの呼び出し
timeline_response = requests.get('/api/posts/timeline', headers={
    'Authorization': f'Bearer {token}'
})
```

### cURL
```bash
# ログイン
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 認証が必要なAPIの呼び出し
curl -X GET https://api.your-domain.com/api/posts/timeline \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

このAPI仕様書は定期的に更新され、最新の仕様を反映します。質問や不明点がある場合は、開発チームまでお問い合わせください。