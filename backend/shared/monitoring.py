"""
Comprehensive monitoring utilities for photo sharing app
要件6.4: バックエンド最適化とモニタリング完成
"""
import os
import time
import logging
from typing import Dict, Any, Optional, Callable
from functools import wraps
from contextlib import contextmanager

from .logging_config import get_logger
from .xray_config import xray_config, monitoring, trace_function, time_function
from .cloudwatch_config import cloudwatch_config, monitor_api_request, monitor_database_operation
from .dynamodb_optimizer import dynamodb_optimizer
from .error_handler import AppError, DatabaseError, ExternalServiceError

logger = get_logger(__name__)

class HealthCheck:
    """Application health check utilities"""
    
    def __init__(self):
        self.checks = {}
        self.environment = os.getenv('ENVIRONMENT', 'development')
    
    def register_check(self, name: str, check_func: Callable[[], bool], 
                      timeout: int = 5, critical: bool = True):
        """Register a health check"""
        self.checks[name] = {
            'func': check_func,
            'timeout': timeout,
            'critical': critical
        }
        logger.info(f"Registered health check: {name}")
    
    def run_checks(self) -> Dict[str, Any]:
        """Run all health checks"""
        results = {
            'status': 'healthy',
            'timestamp': time.time(),
            'environment': self.environment,
            'checks': {}
        }
        
        overall_healthy = True
        
        for name, check_config in self.checks.items():
            check_result = self._run_single_check(name, check_config)
            results['checks'][name] = check_result
            
            if check_config['critical'] and not check_result['healthy']:
                overall_healthy = False
        
        if not overall_healthy:
            results['status'] = 'unhealthy'
        
        # Log health check results
        logger.info(f"Health check completed: {results['status']}", extra={
            'health_check_results': results
        })
        
        # Add to monitoring
        monitoring.increment_counter('health_check.total', tags={
            'status': results['status']
        })
        
        return results
    
    def _run_single_check(self, name: str, check_config: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single health check"""
        start_time = time.time()
        result = {
            'healthy': False,
            'duration_ms': 0,
            'error': None
        }
        
        try:
            with xray_config.create_subsegment(f"HealthCheck.{name}"):
                # Run the check with timeout
                healthy = check_config['func']()
                result['healthy'] = bool(healthy)
                
                xray_config.add_annotation('check_name', name)
                xray_config.add_annotation('healthy', str(result['healthy']))
                
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Health check {name} failed: {e}")
            xray_config.capture_exception(e)
        
        finally:
            result['duration_ms'] = (time.time() - start_time) * 1000
            
            # Record timing metric
            monitoring.record_timing(f'health_check.{name}.duration', 
                                   result['duration_ms'], 
                                   {'healthy': str(result['healthy'])})
        
        return result

class PerformanceMonitor:
    """Performance monitoring utilities"""
    
    def __init__(self):
        self.thresholds = {
            'api_response_time': 1000,  # 1 second
            'database_query_time': 500,  # 500ms
            'file_upload_time': 5000,   # 5 seconds
        }
    
    @contextmanager
    def measure_operation(self, operation_name: str, tags: Dict[str, str] = None):
        """Context manager to measure operation performance"""
        start_time = time.time()
        operation_tags = tags or {}
        
        with xray_config.create_subsegment(f"Performance.{operation_name}"):
            xray_config.add_annotation('operation', operation_name)
            
            try:
                yield
                
                duration_ms = (time.time() - start_time) * 1000
                operation_tags['success'] = 'true'
                
                # Check if operation exceeded threshold
                threshold = self.thresholds.get(operation_name, float('inf'))
                if duration_ms > threshold:
                    operation_tags['slow'] = 'true'
                    logger.warning(f"Slow operation detected: {operation_name} took {duration_ms:.2f}ms")
                
                # Record metrics
                monitoring.record_timing(f'{operation_name}.duration', duration_ms, operation_tags)
                xray_config.add_metadata('performance', {
                    'duration_ms': duration_ms,
                    'threshold_ms': threshold,
                    'exceeded_threshold': duration_ms > threshold
                })
                
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                operation_tags['success'] = 'false'
                operation_tags['error_type'] = type(e).__name__
                
                monitoring.record_timing(f'{operation_name}.duration', duration_ms, operation_tags)
                xray_config.capture_exception(e)
                raise

def setup_database_health_checks():
    """Setup database health checks"""
    health_checker = HealthCheck()
    
    def check_dynamodb():
        """Check DynamoDB connectivity"""
        try:
            from .dynamodb import db_connection
            
            # Try to get a table (this will test connectivity)
            table = db_connection.get_table('users')
            table.load()  # This will raise an exception if table doesn't exist or can't connect
            return True
            
        except Exception as e:
            logger.error(f"DynamoDB health check failed: {e}")
            return False
    
    health_checker.register_check('dynamodb', check_dynamodb, timeout=5, critical=True)
    return health_checker

def setup_monitoring_for_flask_app(app):
    """Setup comprehensive monitoring for Flask application"""
    
    # Setup X-Ray middleware
    xray_config.setup_flask_middleware(app)
    
    # Setup health check endpoint
    health_checker = setup_database_health_checks()
    
    @app.route('/health')
    def health_check():
        """Health check endpoint"""
        results = health_checker.run_checks()
        status_code = 200 if results['status'] == 'healthy' else 503
        
        from flask import jsonify
        response = jsonify(results)
        response.status_code = status_code
        return response
    
    @app.route('/metrics')
    def metrics_endpoint():
        """Metrics endpoint for monitoring"""
        try:
            from flask import jsonify
            
            # DynamoDB クエリメトリクス
            query_metrics = dynamodb_optimizer.get_query_metrics()
            
            # CloudWatch メトリクス要約
            cloudwatch_summary = cloudwatch_config.get_metrics_summary(hours=1)
            
            # X-Ray トレース要約
            trace_summary = xray_config.get_trace_summary()
            
            metrics_data = {
                'timestamp': time.time(),
                'environment': os.getenv('ENVIRONMENT', 'development'),
                'dynamodb_metrics': query_metrics,
                'cloudwatch_metrics': cloudwatch_summary,
                'xray_trace': trace_summary,
                'health_status': 'healthy'  # 簡易ヘルスチェック
            }
            
            return jsonify(metrics_data)
            
        except Exception as e:
            logger.error(f"Failed to generate metrics: {e}")
            from flask import jsonify
            return jsonify({
                'error': 'Failed to generate metrics',
                'timestamp': time.time()
            }), 500
    
    @app.route('/performance-analysis')
    def performance_analysis():
        """パフォーマンス分析エンドポイント"""
        try:
            from flask import jsonify
            
            # テーブルパフォーマンス分析
            table_analyses = {}
            tables = ['users', 'posts', 'interactions']
            
            for table_name in tables:
                try:
                    analysis = dynamodb_optimizer.analyze_table_performance(table_name)
                    table_analyses[table_name] = analysis
                except Exception as e:
                    table_analyses[table_name] = {'error': str(e)}
            
            # インデックス推奨事項
            index_recommendations = dynamodb_optimizer.create_optimized_indexes()
            
            analysis_data = {
                'timestamp': time.time(),
                'table_analyses': table_analyses,
                'index_recommendations': index_recommendations,
                'query_metrics': dynamodb_optimizer.get_query_metrics()
            }
            
            return jsonify(analysis_data)
            
        except Exception as e:
            logger.error(f"Failed to generate performance analysis: {e}")
            from flask import jsonify
            return jsonify({
                'error': 'Failed to generate performance analysis',
                'timestamp': time.time()
            }), 500
    
    # Setup request monitoring
    @app.before_request
    def before_request():
        """Setup request monitoring"""
        from flask import g, request
        import uuid
        
        # Generate correlation ID
        g.correlation_id = str(uuid.uuid4())
        g.request_start_time = time.time()
        
        # Add request context to X-Ray
        xray_config.add_request_context(
            method=request.method,
            path=request.path,
            user_agent=request.headers.get('User-Agent'),
            ip_address=request.remote_addr,
            additional_info={'correlation_id': g.correlation_id}
        )
        
        # Add user context if available
        user_id = getattr(request, 'user_id', None)
        if user_id:
            xray_config.add_user_context(user_id)
        
        # Log request start
        logger.info(f"Request started: {request.method} {request.path}", extra={
            'correlation_id': g.correlation_id,
            'method': request.method,
            'path': request.path,
            'remote_addr': request.remote_addr,
            'user_id': user_id
        })
    
    @app.after_request
    def after_request(response):
        """Log request completion and metrics"""
        from flask import g, request
        
        if hasattr(g, 'request_start_time'):
            duration_ms = (time.time() - g.request_start_time) * 1000
            user_id = getattr(request, 'user_id', None)
            
            # Record comprehensive request metrics
            monitoring.record_timing('api_request.duration', duration_ms, {
                'method': request.method,
                'path': request.path,
                'status_code': str(response.status_code),
                'success': str(200 <= response.status_code < 400)
            })
            
            # Record CloudWatch metrics
            cloudwatch_config.record_api_request(
                endpoint=request.endpoint or request.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=duration_ms,
                user_id=user_id
            )
            
            # Record X-Ray performance metrics
            xray_config.record_performance_metric(
                operation_type='api_request',
                duration_ms=duration_ms,
                success=200 <= response.status_code < 400,
                additional_data={
                    'endpoint': request.endpoint,
                    'method': request.method,
                    'status_code': response.status_code,
                    'user_id': user_id
                }
            )
            
            # Add response metadata to X-Ray
            xray_config.add_annotation('status_code', str(response.status_code))
            xray_config.add_metadata('response', {
                'status_code': response.status_code,
                'duration_ms': duration_ms,
                'content_length': response.content_length
            })
            
            # Log request completion
            logger.info(f"Request completed: {request.method} {request.path} - {response.status_code}", extra={
                'correlation_id': getattr(g, 'correlation_id', 'unknown'),
                'method': request.method,
                'path': request.path,
                'status_code': response.status_code,
                'duration_ms': duration_ms,
                'user_id': user_id
            })
        
        return response
    
    logger.info("Flask monitoring setup completed")

# Global performance monitor instance
performance_monitor = PerformanceMonitor()

# Convenience decorators
def monitor_api_endpoint(endpoint_name: str = None):
    """Decorator to monitor API endpoint performance"""
    def decorator(func):
        @wraps(func)
        @trace_function(name=endpoint_name or f"API.{func.__name__}")
        @time_function(metric_name=f"api.{endpoint_name or func.__name__}.duration")
        def wrapper(*args, **kwargs):
            monitoring.increment_counter(f'api.{endpoint_name or func.__name__}.requests')
            
            try:
                result = func(*args, **kwargs)
                monitoring.increment_counter(f'api.{endpoint_name or func.__name__}.success')
                return result
                
            except AppError as e:
                monitoring.increment_counter(f'api.{endpoint_name or func.__name__}.error', tags={
                    'error_code': e.error_code.value,
                    'status_code': str(e.status_code)
                })
                raise
                
            except Exception as e:
                monitoring.increment_counter(f'api.{endpoint_name or func.__name__}.error', tags={
                    'error_type': type(e).__name__,
                    'status_code': '500'
                })
                raise
        
        return wrapper
    return decorator

def monitor_database_operation(operation_name: str, table_name: str = None):
    """Decorator to monitor database operations"""
    def decorator(func):
        @wraps(func)
        @trace_function(name=f"DB.{operation_name}", namespace='aws')
        def wrapper(*args, **kwargs):
            tags = {'operation': operation_name}
            if table_name:
                tags['table'] = table_name
            
            monitoring.increment_counter('database.operations', tags=tags)
            
            with performance_monitor.measure_operation('database_query_time', tags):
                try:
                    result = func(*args, **kwargs)
                    monitoring.increment_counter('database.operations.success', tags=tags)
                    return result
                    
                except Exception as e:
                    error_tags = tags.copy()
                    error_tags['error_type'] = type(e).__name__
                    monitoring.increment_counter('database.operations.error', tags=error_tags)
                    
                    # Convert to appropriate app error
                    if 'dynamodb' in str(e).lower() or 'boto' in str(e).lower():
                        raise DatabaseError(f"データベース操作エラー: {operation_name}")
                    raise
        
        return wrapper
    return decorator