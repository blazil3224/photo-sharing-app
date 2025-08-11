"""
強化されたエラーハンドリングユーティリティ
要件6.2, 6.4: 統一的なエラーレスポンス形式と詳細ログ出力
"""
import logging
import traceback
import uuid
import time
import psutil
import os
from typing import Dict, Any, Optional
from enum import Enum
from datetime import datetime
from flask import jsonify, request, g
from .logging_config import get_logger

logger = get_logger(__name__)

class ErrorCode(Enum):
    """Standard error codes for the application"""
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
    NOT_FOUND_ERROR = "NOT_FOUND_ERROR"
    DUPLICATE_ERROR = "DUPLICATE_ERROR"
    FILE_ERROR = "FILE_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"

class AppError(Exception):
    """強化されたベースアプリケーションエラークラス"""
    
    def __init__(self, message: str, error_code: ErrorCode = ErrorCode.INTERNAL_ERROR, 
                 status_code: int = 500, details: Optional[Dict[str, Any]] = None,
                 user_message: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.user_message = user_message or message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        self.timestamp = datetime.utcnow().isoformat()
        self.error_id = str(uuid.uuid4())[:8]
        self.request_id = getattr(g, 'request_id', None)
    
    def to_dict(self, include_debug: bool = False) -> Dict[str, Any]:
        """Convert error to dictionary for JSON response"""
        error_dict = {
            "success": False,
            "error": {
                "code": self.error_code.value,
                "message": self.user_message,
                "error_id": self.error_id,
                "timestamp": self.timestamp
            }
        }
        
        if self.request_id:
            error_dict["error"]["request_id"] = self.request_id
        
        if include_debug:
            error_dict["error"]["debug_message"] = self.message
            error_dict["error"]["details"] = self.details
            
        return error_dict

class ValidationError(AppError):
    """Validation error"""
    def __init__(self, message: str, field: str = None, details: Dict[str, Any] = None,
                 user_message: str = None):
        error_details = details or {}
        if field:
            error_details["field"] = field
        super().__init__(
            message, 
            ErrorCode.VALIDATION_ERROR, 
            400, 
            error_details,
            user_message or "入力内容に問題があります"
        )

class AuthenticationError(AppError):
    """Authentication error"""
    def __init__(self, message: str = "認証が必要です"):
        super().__init__(message, ErrorCode.AUTHENTICATION_ERROR, 401)

class AuthorizationError(AppError):
    """Authorization error"""
    def __init__(self, message: str = "この操作を実行する権限がありません"):
        super().__init__(message, ErrorCode.AUTHORIZATION_ERROR, 403)

class NotFoundError(AppError):
    """Resource not found error"""
    def __init__(self, message: str, resource_type: str = None):
        details = {"resource_type": resource_type} if resource_type else {}
        super().__init__(message, ErrorCode.NOT_FOUND_ERROR, 404, details)

class DuplicateError(AppError):
    """Duplicate resource error"""
    def __init__(self, message: str, field: str = None):
        details = {"field": field} if field else {}
        super().__init__(message, ErrorCode.DUPLICATE_ERROR, 409, details)

class FileError(AppError):
    """File processing error"""
    def __init__(self, message: str, file_type: str = None):
        details = {"file_type": file_type} if file_type else {}
        super().__init__(message, ErrorCode.FILE_ERROR, 400, details)

class DatabaseError(AppError):
    """Database operation error"""
    def __init__(self, message: str = "データベースエラーが発生しました"):
        super().__init__(message, ErrorCode.DATABASE_ERROR, 500)

class ExternalServiceError(AppError):
    """External service error"""
    def __init__(self, message: str, service_name: str = None):
        details = {"service": service_name} if service_name else {}
        super().__init__(message, ErrorCode.EXTERNAL_SERVICE_ERROR, 502, details)

class ErrorContext:
    """エラーコンテキスト情報を収集するクラス"""
    
    @staticmethod
    def get_request_context():
        """リクエストコンテキスト情報を取得"""
        context = {
            'timestamp': datetime.utcnow().isoformat(),
            'request_id': getattr(g, 'request_id', None),
            'path': getattr(request, 'path', None),
            'method': getattr(request, 'method', None),
            'remote_addr': getattr(request, 'remote_addr', None),
            'user_agent': request.headers.get('User-Agent') if request else None,
            'referer': request.headers.get('Referer') if request else None,
        }
        
        # ユーザー情報（認証済みの場合）
        if hasattr(request, 'current_user') and request.current_user:
            context['user_id'] = request.current_user.user_id
            context['username'] = request.current_user.username
        
        # リクエストボディサイズ
        if request and hasattr(request, 'content_length'):
            context['content_length'] = request.content_length
        
        return context
    
    @staticmethod
    def get_system_context():
        """システムコンテキスト情報を取得"""
        try:
            process = psutil.Process()
            return {
                'process_id': os.getpid(),
                'memory_usage_mb': process.memory_info().rss / 1024 / 1024,
                'cpu_percent': psutil.cpu_percent(),
                'disk_usage_percent': psutil.disk_usage('/').percent,
                'load_average': os.getloadavg() if hasattr(os, 'getloadavg') else None,
            }
        except Exception:
            return {}

class ErrorMetrics:
    """エラーメトリクス収集クラス"""
    
    def __init__(self):
        self.error_counts = {}
        self.error_rates = {}
        self.last_reset = time.time()
    
    def record_error(self, error_code: str, status_code: int):
        """エラーを記録"""
        key = f"{error_code}_{status_code}"
        self.error_counts[key] = self.error_counts.get(key, 0) + 1
        
        # 1時間ごとにリセット
        if time.time() - self.last_reset > 3600:
            self.reset_metrics()
    
    def get_error_rate(self, error_code: str, status_code: int) -> int:
        """エラー率を取得"""
        key = f"{error_code}_{status_code}"
        return self.error_counts.get(key, 0)
    
    def reset_metrics(self):
        """メトリクスをリセット"""
        self.error_counts.clear()
        self.last_reset = time.time()
    
    def get_top_errors(self, limit: int = 10) -> list:
        """上位エラーを取得"""
        sorted_errors = sorted(
            self.error_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        return sorted_errors[:limit]

# グローバルエラーメトリクスインスタンス
error_metrics = ErrorMetrics()

def handle_app_error(error: AppError):
    """強化されたアプリケーションエラーハンドリング"""
    request_context = ErrorContext.get_request_context()
    system_context = ErrorContext.get_system_context()
    
    # エラーメトリクス記録
    error_metrics.record_error(error.error_code.value, error.status_code)
    
    # 詳細ログ出力
    logger.error(
        f"Application error [{error.error_id}]: {error.message}",
        extra={
            'error_id': error.error_id,
            'error_code': error.error_code.value,
            'status_code': error.status_code,
            'error_details': error.details,
            'request_context': request_context,
            'system_context': system_context,
            'error_timestamp': error.timestamp
        }
    )
    
    # セキュリティ関連エラーの場合は追加ログ
    if error.error_code in [ErrorCode.AUTHORIZATION_ERROR, ErrorCode.AUTHENTICATION_ERROR]:
        logger.warning(
            f"Security incident [{error.error_id}]: {error.message}",
            extra={
                'incident_type': 'security_error',
                'error_code': error.error_code.value,
                'request_context': request_context,
                'severity': 'high'
            }
        )
    
    # 開発環境では詳細情報を含める
    include_debug = os.getenv('FLASK_ENV') == 'development'
    response_data = error.to_dict(include_debug=include_debug)
    
    # レスポンス構築
    response = jsonify(response_data)
    response.status_code = error.status_code
    
    # レート制限エラーの場合はRetry-Afterヘッダーを追加
    if error.error_code == ErrorCode.VALIDATION_ERROR and 'retry_after' in error.details:
        response.headers['Retry-After'] = str(error.details['retry_after'])
    
    return response

def handle_generic_error(error: Exception):
    """強化された汎用エラーハンドリング"""
    error_id = str(uuid.uuid4())[:8]
    request_context = ErrorContext.get_request_context()
    system_context = ErrorContext.get_system_context()
    
    # エラーメトリクス記録
    error_metrics.record_error('INTERNAL_ERROR', 500)
    
    # 詳細ログ出力
    logger.error(
        f"Unhandled error [{error_id}]: {str(error)}",
        extra={
            'error_id': error_id,
            'error_type': type(error).__name__,
            'error_message': str(error),
            'traceback': traceback.format_exc(),
            'request_context': request_context,
            'system_context': system_context,
            'severity': 'critical'
        }
    )
    
    # 本番環境では詳細なエラー情報を隠す
    is_development = os.getenv('FLASK_ENV') == 'development'
    user_message = "サーバー内部エラーが発生しました。しばらく後でお試しください。"
    
    response_data = {
        "success": False,
        "error": {
            "code": ErrorCode.INTERNAL_ERROR.value,
            "message": user_message,
            "error_id": error_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    }
    
    # 開発環境では詳細情報を含める
    if is_development:
        response_data["error"]["debug_message"] = str(error)
        response_data["error"]["error_type"] = type(error).__name__
    
    response = jsonify(response_data)
    response.status_code = 500
    return response

def log_error_metrics():
    """エラーメトリクスをログ出力"""
    top_errors = error_metrics.get_top_errors()
    if top_errors:
        logger.info(
            "Error metrics summary",
            extra={
                'top_errors': top_errors,
                'total_errors': sum(error_metrics.error_counts.values()),
                'unique_error_types': len(error_metrics.error_counts),
                'metrics_period': 'last_hour'
            }
        )

def register_error_handlers(app):
    """Register error handlers with Flask app"""
    
    @app.errorhandler(AppError)
    def handle_app_error_handler(error):
        return handle_app_error(error)
    
    @app.errorhandler(Exception)
    def handle_generic_error_handler(error):
        return handle_generic_error(error)
    
    @app.errorhandler(404)
    def handle_not_found(error):
        return handle_app_error(NotFoundError("リソースが見つかりません"))
    
    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        return handle_app_error(ValidationError("許可されていないHTTPメソッドです"))
    
    logger.info("Error handlers registered successfully")