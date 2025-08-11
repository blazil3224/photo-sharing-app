"""
セキュリティ機能モジュール
要件6.1, 6.3: セキュリティ機能とアクセス制御の実装
"""

import re
import html
import hashlib
import hmac
import time
import json
from functools import wraps
from collections import defaultdict, deque
from datetime import datetime, timedelta
from flask import request, jsonify, current_app, session
from werkzeug.exceptions import TooManyRequests, BadRequest, Forbidden
import bleach
from urllib.parse import urlparse

from .logging_config import get_logger
from .error_handler import ValidationError, SecurityError

logger = get_logger(__name__)

class SecurityManager:
    """セキュリティ管理クラス"""
    
    def __init__(self):
        self.rate_limiter = RateLimiter()
        self.input_sanitizer = InputSanitizer()
        self.csrf_protection = CSRFProtection()
        
    def init_app(self, app):
        """Flaskアプリケーションにセキュリティ機能を初期化"""
        app.config.setdefault('SECRET_KEY', 'your-secret-key-change-in-production')
        app.config.setdefault('CSRF_TOKEN_EXPIRY', 3600)  # 1時間
        app.config.setdefault('RATE_LIMIT_STORAGE', {})
        
        # CORS設定
        self._setup_cors(app)
        
        # セキュリティヘッダー設定
        self._setup_security_headers(app)
        
        # レート制限初期化
        self.rate_limiter.init_app(app)
        
        # CSRF保護初期化
        self.csrf_protection.init_app(app)

    def _setup_cors(self, app):
        """CORS設定"""
        @app.after_request
        def after_request(response):
            # 開発環境用の設定
            if app.config.get('ENV') == 'development':
                response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
            else:
                # 本番環境では特定のドメインのみ許可
                allowed_origins = app.config.get('ALLOWED_ORIGINS', [])
                origin = request.headers.get('Origin')
                if origin in allowed_origins:
                    response.headers['Access-Control-Allow-Origin'] = origin
            
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'  # 24時間
            
            return response

    def _setup_security_headers(self, app):
        """セキュリティヘッダー設定"""
        @app.after_request
        def set_security_headers(response):
            # XSS保護
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['X-XSS-Protection'] = '1; mode=block'
            
            # HTTPS強制（本番環境）
            if not app.config.get('DEBUG'):
                response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            
            # Content Security Policy
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://cdn.jsdelivr.net; "
                "connect-src 'self' https://api.example.com"
            )
            response.headers['Content-Security-Policy'] = csp
            
            return response


class RateLimiter:
    """レート制限機能"""
    
    def __init__(self):
        self.storage = defaultdict(lambda: deque())
        self.limits = {
            'default': {'requests': 100, 'window': 3600},  # 1時間に100リクエスト
            'auth': {'requests': 5, 'window': 300},         # 5分間に5回の認証試行
            'upload': {'requests': 10, 'window': 3600},     # 1時間に10回のアップロード
            'api': {'requests': 1000, 'window': 3600},      # 1時間に1000回のAPI呼び出し
        }
    
    def init_app(self, app):
        """Flaskアプリケーションに初期化"""
        self.app = app
        
    def is_allowed(self, key, limit_type='default'):
        """リクエストが許可されるかチェック"""
        now = time.time()
        limit_config = self.limits.get(limit_type, self.limits['default'])
        window = limit_config['window']
        max_requests = limit_config['requests']
        
        # 古いエントリを削除
        requests = self.storage[key]
        while requests and requests[0] < now - window:
            requests.popleft()
        
        # リクエスト数チェック
        if len(requests) >= max_requests:
            logger.warning(f"Rate limit exceeded for key: {key}, type: {limit_type}")
            return False
        
        # 新しいリクエストを記録
        requests.append(now)
        return True
    
    def get_client_key(self):
        """クライアント識別キーを生成"""
        # IPアドレスベースの識別
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        if client_ip:
            client_ip = client_ip.split(',')[0].strip()
        
        # ユーザーIDがある場合は併用
        user_id = getattr(request, 'user_id', None)
        if user_id:
            return f"user:{user_id}:{client_ip}"
        
        return f"ip:{client_ip}"


def rate_limit(limit_type='default'):
    """レート制限デコレータ"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(current_app, 'security_manager'):
                return f(*args, **kwargs)
            
            rate_limiter = current_app.security_manager.rate_limiter
            client_key = rate_limiter.get_client_key()
            
            if not rate_limiter.is_allowed(client_key, limit_type):
                logger.warning(f"Rate limit exceeded for {client_key}")
                raise TooManyRequests("リクエスト制限に達しました。しばらく後でお試しください。")
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


class InputSanitizer:
    """入力値サニタイゼーション"""
    
    def __init__(self):
        # 許可するHTMLタグ（コメントなど用）
        self.allowed_tags = ['p', 'br', 'strong', 'em', 'u']
        self.allowed_attributes = {}
        
        # 危険なパターン
        self.dangerous_patterns = [
            r'<script[^>]*>.*?</script>',
            r'javascript:',
            r'vbscript:',
            r'onload\s*=',
            r'onerror\s*=',
            r'onclick\s*=',
            r'onmouseover\s*=',
        ]
    
    def sanitize_html(self, text):
        """HTMLをサニタイズ"""
        if not text:
            return text
        
        # 危険なパターンを除去
        for pattern in self.dangerous_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)
        
        # bleachを使用してHTMLをクリーンアップ
        cleaned = bleach.clean(
            text,
            tags=self.allowed_tags,
            attributes=self.allowed_attributes,
            strip=True
        )
        
        return cleaned
    
    def sanitize_string(self, text, max_length=None):
        """文字列をサニタイズ"""
        if not text:
            return text
        
        # HTMLエスケープ
        sanitized = html.escape(str(text))
        
        # 長さ制限
        if max_length and len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        # 制御文字を除去
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', sanitized)
        
        return sanitized.strip()
    
    def validate_email(self, email):
        """メールアドレスの検証"""
        if not email:
            raise ValidationError("メールアドレスは必須です")
        
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValidationError("有効なメールアドレスを入力してください")
        
        return email.lower().strip()
    
    def validate_username(self, username):
        """ユーザー名の検証"""
        if not username:
            raise ValidationError("ユーザー名は必須です")
        
        # 英数字とアンダースコアのみ許可
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            raise ValidationError("ユーザー名は英数字とアンダースコアのみ使用可能です")
        
        if len(username) < 3 or len(username) > 30:
            raise ValidationError("ユーザー名は3文字以上30文字以内で入力してください")
        
        return username.strip()
    
    def validate_file_upload(self, file):
        """ファイルアップロードの検証"""
        if not file:
            raise ValidationError("ファイルが選択されていません")
        
        # ファイル名の検証
        if not file.filename:
            raise ValidationError("ファイル名が無効です")
        
        # 拡張子チェック
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        file_ext = '.' + file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        
        if file_ext not in allowed_extensions:
            raise ValidationError("JPEG、PNG、GIF形式のファイルのみアップロード可能です")
        
        # ファイルサイズチェック（5MB制限）
        file.seek(0, 2)  # ファイル末尾に移動
        file_size = file.tell()
        file.seek(0)  # ファイル先頭に戻す
        
        if file_size > 5 * 1024 * 1024:  # 5MB
            raise ValidationError("ファイルサイズは5MB以下にしてください")
        
        # MIMEタイプチェック
        allowed_mimes = {'image/jpeg', 'image/png', 'image/gif'}
        if hasattr(file, 'content_type') and file.content_type not in allowed_mimes:
            raise ValidationError("無効なファイル形式です")
        
        return True


class CSRFProtection:
    """CSRF保護機能"""
    
    def __init__(self):
        self.exempt_views = set()
    
    def init_app(self, app):
        """Flaskアプリケーションに初期化"""
        self.app = app
        
        @app.before_request
        def csrf_protect():
            if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                self._validate_csrf_token()
    
    def generate_csrf_token(self):
        """CSRFトークンを生成"""
        if 'csrf_token' not in session:
            session['csrf_token'] = self._generate_token()
            session['csrf_token_time'] = time.time()
        
        return session['csrf_token']
    
    def _generate_token(self):
        """トークン生成"""
        secret_key = current_app.config['SECRET_KEY']
        timestamp = str(int(time.time()))
        message = f"{timestamp}:{request.remote_addr}"
        
        signature = hmac.new(
            secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{timestamp}:{signature}"
    
    def _validate_csrf_token(self):
        """CSRFトークンの検証"""
        # 除外対象のビューをチェック
        endpoint = request.endpoint
        if endpoint in self.exempt_views:
            return
        
        # APIエンドポイントの場合はJWTトークンで代替
        if request.path.startswith('/api/'):
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                return  # JWTトークンがある場合はCSRF検証をスキップ
        
        token = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')
        
        if not token:
            logger.warning(f"CSRF token missing for {request.path}")
            raise Forbidden("CSRFトークンが必要です")
        
        if not self._verify_token(token):
            logger.warning(f"Invalid CSRF token for {request.path}")
            raise Forbidden("無効なCSRFトークンです")
    
    def _verify_token(self, token):
        """トークンの検証"""
        try:
            timestamp_str, signature = token.split(':', 1)
            timestamp = int(timestamp_str)
            
            # トークンの有効期限チェック（1時間）
            if time.time() - timestamp > current_app.config.get('CSRF_TOKEN_EXPIRY', 3600):
                return False
            
            # 署名の検証
            secret_key = current_app.config['SECRET_KEY']
            message = f"{timestamp_str}:{request.remote_addr}"
            expected_signature = hmac.new(
                secret_key.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
            
        except (ValueError, TypeError):
            return False
    
    def exempt(self, view):
        """ビューをCSRF保護から除外"""
        if isinstance(view, str):
            self.exempt_views.add(view)
        else:
            self.exempt_views.add(view.__name__)
        return view


def validate_json_input(required_fields=None, optional_fields=None):
    """JSON入力の検証デコレータ"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                raise BadRequest("Content-Type must be application/json")
            
            try:
                data = request.get_json()
            except Exception:
                raise BadRequest("Invalid JSON format")
            
            if not data:
                raise BadRequest("Request body cannot be empty")
            
            # 必須フィールドのチェック
            if required_fields:
                for field in required_fields:
                    if field not in data:
                        raise ValidationError(f"Required field '{field}' is missing")
            
            # 許可されていないフィールドのチェック
            allowed_fields = set()
            if required_fields:
                allowed_fields.update(required_fields)
            if optional_fields:
                allowed_fields.update(optional_fields)
            
            if allowed_fields:
                for field in data.keys():
                    if field not in allowed_fields:
                        raise ValidationError(f"Unknown field '{field}'")
            
            # サニタイズされたデータをリクエストに追加
            sanitizer = InputSanitizer()
            sanitized_data = {}
            
            for key, value in data.items():
                if isinstance(value, str):
                    sanitized_data[key] = sanitizer.sanitize_string(value)
                else:
                    sanitized_data[key] = value
            
            request.sanitized_json = sanitized_data
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


class DDoSProtection:
    """DDoS攻撃対策"""
    
    def __init__(self):
        self.suspicious_ips = defaultdict(int)
        self.blocked_ips = set()
        self.last_cleanup = time.time()
    
    def is_suspicious_request(self, client_ip):
        """疑わしいリクエストかどうかを判定"""
        now = time.time()
        
        # 定期的にクリーンアップ
        if now - self.last_cleanup > 3600:  # 1時間ごと
            self._cleanup_old_entries()
            self.last_cleanup = now
        
        # ブロックされたIPかチェック
        if client_ip in self.blocked_ips:
            return True
        
        # 疑わしい行動パターンをチェック
        user_agent = request.headers.get('User-Agent', '')
        referer = request.headers.get('Referer', '')
        
        # 疑わしいUser-Agent
        suspicious_agents = [
            'bot', 'crawler', 'spider', 'scraper',
            'curl', 'wget', 'python-requests'
        ]
        
        if any(agent in user_agent.lower() for agent in suspicious_agents):
            self.suspicious_ips[client_ip] += 1
        
        # Refererが不自然
        if referer and not self._is_valid_referer(referer):
            self.suspicious_ips[client_ip] += 1
        
        # 疑わしいスコアが閾値を超えた場合
        if self.suspicious_ips[client_ip] > 10:
            self.blocked_ips.add(client_ip)
            logger.warning(f"IP {client_ip} blocked due to suspicious activity")
            return True
        
        return False
    
    def _is_valid_referer(self, referer):
        """有効なRefererかチェック"""
        try:
            parsed = urlparse(referer)
            allowed_domains = current_app.config.get('ALLOWED_REFERER_DOMAINS', [])
            return parsed.netloc in allowed_domains
        except Exception:
            return False
    
    def _cleanup_old_entries(self):
        """古いエントリをクリーンアップ"""
        # 疑わしいIPのスコアをリセット
        self.suspicious_ips.clear()
        
        # ブロックされたIPも定期的にリセット（24時間後）
        # 実際の実装では永続化ストレージを使用することを推奨
        self.blocked_ips.clear()


def security_check():
    """セキュリティチェックデコレータ"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            if client_ip:
                client_ip = client_ip.split(',')[0].strip()
            
            # DDoS保護チェック
            ddos_protection = DDoSProtection()
            if ddos_protection.is_suspicious_request(client_ip):
                logger.warning(f"Suspicious request blocked from {client_ip}")
                raise Forbidden("アクセスが拒否されました")
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# セキュリティマネージャーのインスタンス
security_manager = SecurityManager()