"""
強化されたログ設定モジュール
要件6.2, 6.4: 詳細ログ出力とX-Ray統合
"""
import logging
import logging.config
import os
import sys
import json
import uuid
import time
from datetime import datetime
from typing import Dict, Any, Optional

def setup_logging():
    """強化されたログ設定をセットアップ"""
    
    # 環境変数からログレベルを取得
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    environment = os.getenv('FLASK_ENV', 'development')
    
    # ログディレクトリの作成
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # ログファイルパス（日付付き）
    today = datetime.now().strftime('%Y-%m-%d')
    app_log_file = os.path.join(log_dir, f'app-{today}.log')
    error_log_file = os.path.join(log_dir, f'error-{today}.log')
    security_log_file = os.path.join(log_dir, f'security-{today}.log')
    performance_log_file = os.path.join(log_dir, f'performance-{today}.log')
    
    # ログ設定
    logging_config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'detailed': {
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s - [%(filename)s:%(lineno)d] - REQ:%(request_id)s',
                'datefmt': '%Y-%m-%d %H:%M:%S'
            },
            'simple': {
                'format': '%(levelname)s - %(message)s'
            },
            'json': {
                '()': 'backend.shared.logging_config.EnhancedJSONFormatter'
            },
            'security': {
                '()': 'backend.shared.logging_config.EnhancedJSONFormatter'
            }
        },
        'filters': {
            'context': {
                '()': 'backend.shared.logging_config.EnhancedContextFilter'
            },
            'security': {
                '()': 'backend.shared.logging_config.SecurityFilter'
            },
            'performance': {
                '()': 'backend.shared.logging_config.PerformanceFilter'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': log_level,
                'formatter': 'detailed' if environment == 'development' else 'json',
                'stream': sys.stdout,
                'filters': ['context']
            },
            'app_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': log_level,
                'formatter': 'json',
                'filename': app_log_file,
                'maxBytes': 50 * 1024 * 1024,  # 50MB
                'backupCount': 10,
                'encoding': 'utf8',
                'filters': ['context']
            },
            'error_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'ERROR',
                'formatter': 'json',
                'filename': error_log_file,
                'maxBytes': 50 * 1024 * 1024,  # 50MB
                'backupCount': 10,
                'encoding': 'utf8',
                'filters': ['context']
            },
            'security_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'WARNING',
                'formatter': 'security',
                'filename': security_log_file,
                'maxBytes': 50 * 1024 * 1024,  # 50MB
                'backupCount': 10,
                'encoding': 'utf8',
                'filters': ['context', 'security']
            },
            'performance_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'INFO',
                'formatter': 'json',
                'filename': performance_log_file,
                'maxBytes': 50 * 1024 * 1024,  # 50MB
                'backupCount': 5,
                'encoding': 'utf8',
                'filters': ['context', 'performance']
            }
        },
        'loggers': {
            '': {  # Root logger
                'level': log_level,
                'handlers': ['console', 'app_file', 'error_file'],
                'propagate': False
            },
            'security': {
                'level': 'WARNING',
                'handlers': ['console', 'security_file', 'error_file'],
                'propagate': False
            },
            'performance': {
                'level': 'INFO',
                'handlers': ['performance_file'],
                'propagate': False
            },
            'boto3': {
                'level': 'WARNING',
                'handlers': ['console'],
                'propagate': False
            },
            'botocore': {
                'level': 'WARNING',
                'handlers': ['console'],
                'propagate': False
            },
            'urllib3': {
                'level': 'WARNING',
                'handlers': ['console'],
                'propagate': False
            },
            'werkzeug': {
                'level': 'WARNING',
                'handlers': ['console'],
                'propagate': False
            }
        }
    }
    
    # ログ設定を適用
    logging.config.dictConfig(logging_config)
    
    # 初期化ログ
    logger = logging.getLogger(__name__)
    logger.info(f"Enhanced logging configured", extra={
        'log_level': log_level,
        'environment': environment,
        'log_files': {
            'app': app_log_file,
            'error': error_log_file,
            'security': security_log_file,
            'performance': performance_log_file
        }
    })
    
    return logger

class EnhancedJSONFormatter(logging.Formatter):
    """強化されたJSON構造化ログフォーマッター"""
    
    def format(self, record):
        """ログレコードを構造化JSONとしてフォーマット"""
        
        # ベースログエントリ
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'process_id': os.getpid(),
            'thread_id': record.thread,
            'environment': os.getenv('FLASK_ENV', 'development')
        }
        
        # 例外情報の追加
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info)
            }
        
        # パフォーマンス情報の追加
        try:
            import psutil
            process = psutil.Process()
            log_entry['performance'] = {
                'memory_usage_mb': round(process.memory_info().rss / 1024 / 1024, 2),
                'cpu_percent': psutil.cpu_percent()
            }
        except Exception:
            pass
        
        # リクエストコンテキスト情報の追加
        try:
            from flask import request, g
            if request:
                log_entry['request'] = {
                    'id': getattr(g, 'request_id', None),
                    'method': request.method,
                    'path': request.path,
                    'remote_addr': request.remote_addr,
                    'user_agent': request.headers.get('User-Agent', ''),
                    'referer': request.headers.get('Referer', ''),
                    'content_length': request.content_length
                }
                
                # ユーザー情報の追加
                if hasattr(request, 'current_user') and request.current_user:
                    log_entry['user'] = {
                        'id': request.current_user.user_id,
                        'username': request.current_user.username
                    }
                    
        except (ImportError, RuntimeError):
            pass
        
        # 追加フィールドの処理
        extra_fields = {}
        excluded_keys = {
            'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
            'filename', 'module', 'lineno', 'funcName', 'created', 
            'msecs', 'relativeCreated', 'thread', 'threadName', 
            'processName', 'process', 'getMessage', 'exc_info', 
            'exc_text', 'stack_info'
        }
        
        for key, value in record.__dict__.items():
            if key not in excluded_keys:
                extra_fields[key] = value
        
        if extra_fields:
            log_entry['extra'] = extra_fields
        
        # X-Ray トレース情報の追加
        try:
            from aws_xray_sdk.core import xray_recorder
            trace_id = xray_recorder.current_trace_id()
            if trace_id:
                log_entry['trace_id'] = trace_id
        except Exception:
            pass
        
        return json.dumps(log_entry, ensure_ascii=False, default=str, separators=(',', ':'))

class EnhancedContextFilter(logging.Filter):
    """強化されたコンテキスト情報フィルター"""
    
    def filter(self, record):
        """ログレコードにコンテキスト情報を追加"""
        
        # リクエストIDの追加
        try:
            from flask import g
            if hasattr(g, 'request_id'):
                record.request_id = g.request_id
            else:
                record.request_id = str(uuid.uuid4())[:8]
                g.request_id = record.request_id
        except (ImportError, RuntimeError):
            record.request_id = str(uuid.uuid4())[:8]
        
        # セッション情報の追加
        try:
            from flask import session
            if session:
                record.session_id = session.get('session_id', 'anonymous')
        except (ImportError, RuntimeError):
            record.session_id = 'anonymous'
        
        # タイムスタンプの追加
        record.timestamp_ms = int(time.time() * 1000)
        
        return True

class SecurityFilter(logging.Filter):
    """セキュリティ関連ログフィルター"""
    
    def filter(self, record):
        """セキュリティ関連ログのみを通す"""
        security_keywords = [
            'security', 'auth', 'login', 'logout', 'unauthorized', 
            'forbidden', 'csrf', 'xss', 'injection', 'attack',
            'suspicious', 'blocked', 'rate_limit'
        ]
        
        message = record.getMessage().lower()
        return any(keyword in message for keyword in security_keywords)

class PerformanceFilter(logging.Filter):
    """パフォーマンス関連ログフィルター"""
    
    def filter(self, record):
        """パフォーマンス関連ログのみを通す"""
        performance_keywords = [
            'performance', 'slow', 'timeout', 'memory', 'cpu',
            'execution_time', 'response_time', 'query_time'
        ]
        
        message = record.getMessage().lower()
        return any(keyword in message for keyword in performance_keywords)

def get_logger(name: str = None) -> logging.Logger:
    """設定済みロガーインスタンスを取得"""
    logger = logging.getLogger(name)
    
    # コンテキストフィルターが未追加の場合は追加
    if not any(isinstance(f, EnhancedContextFilter) for f in logger.filters):
        logger.addFilter(EnhancedContextFilter())
    
    return logger

def get_security_logger() -> logging.Logger:
    """セキュリティ専用ロガーを取得"""
    return logging.getLogger('security')

def get_performance_logger() -> logging.Logger:
    """パフォーマンス専用ロガーを取得"""
    return logging.getLogger('performance')

class LogContext:
    """ログコンテキスト管理クラス"""
    
    def __init__(self, logger: logging.Logger, **context):
        self.logger = logger
        self.context = context
    
    def info(self, message: str, **extra):
        """INFO レベルログ出力"""
        self.logger.info(message, extra={**self.context, **extra})
    
    def warning(self, message: str, **extra):
        """WARNING レベルログ出力"""
        self.logger.warning(message, extra={**self.context, **extra})
    
    def error(self, message: str, **extra):
        """ERROR レベルログ出力"""
        self.logger.error(message, extra={**self.context, **extra})
    
    def debug(self, message: str, **extra):
        """DEBUG レベルログ出力"""
        self.logger.debug(message, extra={**self.context, **extra})

def create_log_context(logger: logging.Logger, **context) -> LogContext:
    """ログコンテキストを作成"""
    return LogContext(logger, **context)

def log_performance(operation_name: str):
    """パフォーマンス測定デコレータ"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            performance_logger = get_performance_logger()
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                performance_logger.info(
                    f"Operation completed: {operation_name}",
                    extra={
                        'operation': operation_name,
                        'function': func.__name__,
                        'execution_time_ms': round(execution_time * 1000, 2),
                        'status': 'success'
                    }
                )
                
                return result
            except Exception as e:
                execution_time = time.time() - start_time
                
                performance_logger.error(
                    f"Operation failed: {operation_name}",
                    extra={
                        'operation': operation_name,
                        'function': func.__name__,
                        'execution_time_ms': round(execution_time * 1000, 2),
                        'status': 'error',
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    }
                )
                
                raise
        
        return wrapper
    return decorator

def log_function_call(func):
    """関数呼び出しログデコレータ"""
    def wrapper(*args, **kwargs):
        logger = get_logger(func.__module__)
        
        # 関数開始ログ
        logger.debug(f"Entering {func.__name__}", extra={
            'function': func.__name__,
            'module': func.__module__,
            'args_count': len(args),
            'kwargs_keys': list(kwargs.keys())
        })
        
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # 関数完了ログ
            logger.debug(f"Completed {func.__name__}", extra={
                'function': func.__name__,
                'module': func.__module__,
                'execution_time_ms': round(execution_time * 1000, 2),
                'success': True
            })
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            # 関数エラーログ
            logger.error(f"Error in {func.__name__}: {str(e)}", extra={
                'function': func.__name__,
                'module': func.__module__,
                'execution_time_ms': round(execution_time * 1000, 2),
                'error_type': type(e).__name__,
                'error_message': str(e),
                'success': False
            })
            raise
    
    return wrapper

def log_security_event(event_type: str, details: Dict[str, Any] = None):
    """セキュリティイベントログ"""
    security_logger = get_security_logger()
    security_logger.warning(f"Security event: {event_type}", extra={
        'event_type': event_type,
        'details': details or {},
        'severity': 'high'
    })

def log_user_action(action: str, user_id: str = None, details: Dict[str, Any] = None):
    """ユーザーアクションログ"""
    logger = get_logger('user_actions')
    logger.info(f"User action: {action}", extra={
        'action': action,
        'user_id': user_id,
        'details': details or {}
    })

# Initialize logging when module is imported
if not logging.getLogger().handlers:
    setup_logging()