"""
AWS X-Ray integration and monitoring configuration
要件6.4: X-Rayトレーシングの詳細設定完成
"""
import os
import time
import json
import logging
from typing import Dict, Any, Optional, List
from functools import wraps
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Check if X-Ray is available
try:
    from aws_xray_sdk.core import xray_recorder, patch_all
    from aws_xray_sdk.core.context import Context
    from aws_xray_sdk.core.models import http
    from aws_xray_sdk.ext.flask.middleware import XRayMiddleware
    XRAY_AVAILABLE = True
except ImportError:
    logger.warning("AWS X-Ray SDK not available. Monitoring features will be limited.")
    XRAY_AVAILABLE = False

class XRayConfig:
    """X-Ray configuration and utilities"""
    
    def __init__(self):
        self.enabled = self._should_enable_xray()
        self.service_name = os.getenv('XRAY_SERVICE_NAME', 'photo-sharing-app')
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.trace_sampling_rate = float(os.getenv('XRAY_SAMPLING_RATE', '0.1'))  # 10% sampling by default
        self.custom_segments = {}
        self.performance_thresholds = {
            'database_query': 1000,  # 1 second
            'api_request': 2000,     # 2 seconds
            'image_processing': 5000  # 5 seconds
        }
        
        if self.enabled and XRAY_AVAILABLE:
            self._configure_xray()
    
    def _should_enable_xray(self) -> bool:
        """Determine if X-Ray should be enabled"""
        # Enable X-Ray in production or when explicitly requested
        return (
            os.getenv('ENVIRONMENT') == 'production' or
            os.getenv('ENABLE_XRAY', '').lower() in ['true', '1', 'yes'] or
            os.getenv('AWS_XRAY_TRACING_NAME') is not None
        )
    
    def _configure_xray(self):
        """Configure X-Ray recorder with detailed settings"""
        try:
            # Configure X-Ray recorder with custom sampling rules
            sampling_rules = {
                "version": 2,
                "default": {
                    "fixed_target": 1,
                    "rate": self.trace_sampling_rate
                },
                "rules": [
                    {
                        "description": "High priority API endpoints",
                        "service_name": self.service_name,
                        "http_method": "*",
                        "url_path": "/api/auth/*",
                        "fixed_target": 2,
                        "rate": 0.5
                    },
                    {
                        "description": "Database operations",
                        "service_name": self.service_name,
                        "http_method": "*",
                        "url_path": "/api/posts/*",
                        "fixed_target": 1,
                        "rate": 0.3
                    },
                    {
                        "description": "Image upload operations",
                        "service_name": self.service_name,
                        "http_method": "POST",
                        "url_path": "/api/upload/*",
                        "fixed_target": 2,
                        "rate": 1.0
                    }
                ]
            }
            
            xray_recorder.configure(
                service=self.service_name,
                context_missing='LOG_ERROR',
                plugins=('EC2Plugin', 'ECSPlugin', 'ElasticBeanstalkPlugin'),
                daemon_address=os.getenv('AWS_XRAY_DAEMON_ADDRESS', '127.0.0.1:2000'),
                sampling_rules=sampling_rules,
                use_ssl=os.getenv('XRAY_USE_SSL', 'false').lower() == 'true'
            )
            
            # Patch AWS SDK calls with specific services
            services_to_patch = ['boto3', 'botocore', 'requests', 'sqlite3']
            for service in services_to_patch:
                try:
                    patch_all()
                    logger.debug(f"Patched {service} for X-Ray tracing")
                except Exception as e:
                    logger.warning(f"Failed to patch {service}: {e}")
            
            logger.info(f"X-Ray configured for service: {self.service_name} with sampling rate: {self.trace_sampling_rate}")
            
        except Exception as e:
            logger.error(f"Failed to configure X-Ray: {e}")
            self.enabled = False
    
    def setup_flask_middleware(self, app):
        """Setup X-Ray middleware for Flask app"""
        if not self.enabled or not XRAY_AVAILABLE:
            logger.info("X-Ray middleware not enabled")
            return
        
        try:
            # Add X-Ray middleware
            XRayMiddleware(app, xray_recorder)
            logger.info("X-Ray Flask middleware configured")
            
        except Exception as e:
            logger.error(f"Failed to setup X-Ray Flask middleware: {e}")
    
    def create_subsegment(self, name: str, namespace: str = 'local'):
        """Create X-Ray subsegment context manager"""
        if not self.enabled or not XRAY_AVAILABLE:
            return DummySubsegment()
        
        return xray_recorder.in_subsegment(name, namespace=namespace)
    
    def add_metadata(self, key: str, value: Any, namespace: str = 'default'):
        """Add metadata to current segment"""
        if not self.enabled or not XRAY_AVAILABLE:
            return
        
        try:
            xray_recorder.put_metadata(key, value, namespace)
        except Exception as e:
            logger.debug(f"Failed to add X-Ray metadata: {e}")
    
    def add_annotation(self, key: str, value: str):
        """Add annotation to current segment"""
        if not self.enabled or not XRAY_AVAILABLE:
            return
        
        try:
            xray_recorder.put_annotation(key, value)
        except Exception as e:
            logger.debug(f"Failed to add X-Ray annotation: {e}")
    
    def capture_exception(self, exception: Exception, additional_info: Dict[str, Any] = None):
        """Capture exception in X-Ray with additional context"""
        if not self.enabled or not XRAY_AVAILABLE:
            return
        
        try:
            segment = xray_recorder.current_segment()
            if segment:
                segment.add_exception(exception, stack=True)
                
                # Add additional exception context
                if additional_info:
                    self.add_metadata('exception_context', additional_info, 'error')
                
                # Add error classification
                error_type = type(exception).__name__
                self.add_annotation('error_class', self._classify_error(error_type))
                self.add_annotation('error_severity', self._get_error_severity(exception))
                
        except Exception as e:
            logger.debug(f"Failed to capture exception in X-Ray: {e}")
    
    def _classify_error(self, error_type: str) -> str:
        """Classify error types for better monitoring"""
        client_errors = ['ValidationError', 'AuthenticationError', 'NotFoundError', 'DuplicateError']
        server_errors = ['DatabaseError', 'ServiceError', 'ConfigurationError']
        external_errors = ['NetworkError', 'TimeoutError', 'ExternalServiceError']
        
        if error_type in client_errors:
            return 'client_error'
        elif error_type in server_errors:
            return 'server_error'
        elif error_type in external_errors:
            return 'external_error'
        else:
            return 'unknown_error'
    
    def _get_error_severity(self, exception: Exception) -> str:
        """Determine error severity level"""
        error_type = type(exception).__name__
        
        critical_errors = ['DatabaseError', 'ConfigurationError', 'SecurityError']
        high_errors = ['ServiceError', 'ExternalServiceError']
        medium_errors = ['ValidationError', 'NotFoundError']
        low_errors = ['DuplicateError', 'AuthenticationError']
        
        if error_type in critical_errors:
            return 'critical'
        elif error_type in high_errors:
            return 'high'
        elif error_type in medium_errors:
            return 'medium'
        elif error_type in low_errors:
            return 'low'
        else:
            return 'unknown'
    
    def create_custom_segment(self, name: str, operation_type: str, metadata: Dict[str, Any] = None):
        """Create a custom segment with detailed tracking"""
        if not self.enabled or not XRAY_AVAILABLE:
            return DummyCustomSegment()
        
        return CustomSegment(name, operation_type, metadata, self)
    
    def record_performance_metric(self, operation_type: str, duration_ms: float, 
                                success: bool = True, additional_data: Dict[str, Any] = None):
        """Record performance metrics with threshold checking"""
        try:
            # Check if operation exceeded threshold
            threshold = self.performance_thresholds.get(operation_type, 1000)
            is_slow = duration_ms > threshold
            
            # Add performance annotations
            self.add_annotation('operation_type', operation_type)
            self.add_annotation('duration_ms', str(int(duration_ms)))
            self.add_annotation('is_slow', str(is_slow).lower())
            self.add_annotation('success', str(success).lower())
            
            # Add detailed performance metadata
            performance_data = {
                'operation_type': operation_type,
                'duration_ms': duration_ms,
                'threshold_ms': threshold,
                'is_slow': is_slow,
                'success': success,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if additional_data:
                performance_data.update(additional_data)
            
            self.add_metadata('performance', performance_data, 'performance')
            
            # Log slow operations
            if is_slow:
                logger.warning(f"Slow operation detected: {operation_type} took {duration_ms}ms (threshold: {threshold}ms)")
            
        except Exception as e:
            logger.debug(f"Failed to record performance metric: {e}")
    
    def add_user_context(self, user_id: str, username: str = None, additional_info: Dict[str, Any] = None):
        """Add user context to current trace"""
        try:
            user_data = {
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if username:
                user_data['username'] = username
            
            if additional_info:
                user_data.update(additional_info)
            
            self.add_metadata('user_context', user_data, 'user')
            self.add_annotation('user_id', user_id)
            
        except Exception as e:
            logger.debug(f"Failed to add user context: {e}")
    
    def add_request_context(self, method: str, path: str, user_agent: str = None, 
                          ip_address: str = None, additional_info: Dict[str, Any] = None):
        """Add HTTP request context to current trace"""
        try:
            request_data = {
                'method': method,
                'path': path,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if user_agent:
                request_data['user_agent'] = user_agent
            
            if ip_address:
                request_data['ip_address'] = ip_address
            
            if additional_info:
                request_data.update(additional_info)
            
            self.add_metadata('request_context', request_data, 'http')
            self.add_annotation('http_method', method)
            self.add_annotation('http_path', path)
            
        except Exception as e:
            logger.debug(f"Failed to add request context: {e}")
    
    def get_trace_summary(self) -> Dict[str, Any]:
        """Get summary of current trace"""
        try:
            if not self.enabled or not XRAY_AVAILABLE:
                return {}
            
            segment = xray_recorder.current_segment()
            if not segment:
                return {}
            
            return {
                'trace_id': segment.trace_id,
                'segment_id': segment.id,
                'service_name': self.service_name,
                'start_time': segment.start_time,
                'annotations': getattr(segment, 'annotations', {}),
                'metadata_keys': list(getattr(segment, 'metadata', {}).keys())
            }
            
        except Exception as e:
            logger.debug(f"Failed to get trace summary: {e}")
            return {}

class DummySubsegment:
    """Dummy subsegment for when X-Ray is not available"""
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

class DummyCustomSegment:
    """Dummy custom segment for when X-Ray is not available"""
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
    
    def add_metadata(self, key: str, value: Any):
        pass
    
    def add_annotation(self, key: str, value: str):
        pass

class CustomSegment:
    """Custom segment with enhanced tracking capabilities"""
    
    def __init__(self, name: str, operation_type: str, metadata: Dict[str, Any], xray_config: XRayConfig):
        self.name = name
        self.operation_type = operation_type
        self.metadata = metadata or {}
        self.xray_config = xray_config
        self.start_time = None
        self.subsegment = None
    
    def __enter__(self):
        self.start_time = time.time()
        
        if self.xray_config.enabled and XRAY_AVAILABLE:
            self.subsegment = xray_recorder.in_subsegment(self.name, 'local')
            self.subsegment.__enter__()
            
            # Add initial metadata and annotations
            self.xray_config.add_annotation('operation_type', self.operation_type)
            self.xray_config.add_metadata('operation_metadata', self.metadata, 'operation')
            self.xray_config.add_metadata('start_time', datetime.utcnow().isoformat(), 'timing')
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration_ms = (time.time() - self.start_time) * 1000
            
            # Record performance metrics
            success = exc_type is None
            self.xray_config.record_performance_metric(
                self.operation_type, 
                duration_ms, 
                success, 
                self.metadata
            )
            
            if self.subsegment:
                # Add final timing metadata
                self.xray_config.add_metadata('end_time', datetime.utcnow().isoformat(), 'timing')
                self.xray_config.add_metadata('duration_ms', duration_ms, 'timing')
                
                # Handle exceptions
                if exc_type:
                    self.xray_config.capture_exception(exc_val, self.metadata)
                
                self.subsegment.__exit__(exc_type, exc_val, exc_tb)
    
    def add_metadata(self, key: str, value: Any):
        """Add metadata to the custom segment"""
        self.metadata[key] = value
        if self.xray_config.enabled:
            self.xray_config.add_metadata(key, value, 'custom')
    
    def add_annotation(self, key: str, value: str):
        """Add annotation to the custom segment"""
        if self.xray_config.enabled:
            self.xray_config.add_annotation(key, value)

# Global X-Ray configuration instance
xray_config = XRayConfig()

def trace_function(name: str = None, namespace: str = 'local'):
    """Decorator to trace function calls with X-Ray"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            subsegment_name = name or f"{func.__module__}.{func.__name__}"
            
            with xray_config.create_subsegment(subsegment_name, namespace):
                # Add function metadata
                xray_config.add_metadata('function_info', {
                    'name': func.__name__,
                    'module': func.__module__,
                    'args_count': len(args),
                    'kwargs_keys': list(kwargs.keys())
                })
                
                try:
                    result = func(*args, **kwargs)
                    xray_config.add_annotation('success', 'true')
                    return result
                    
                except Exception as e:
                    xray_config.add_annotation('success', 'false')
                    xray_config.add_annotation('error_type', type(e).__name__)
                    xray_config.capture_exception(e)
                    raise
        
        return wrapper
    return decorator

def trace_database_operation(operation: str, table_name: str = None):
    """Decorator to trace database operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            subsegment_name = f"DynamoDB.{operation}"
            
            with xray_config.create_subsegment(subsegment_name, 'aws'):
                # Add database operation metadata
                metadata = {
                    'operation': operation,
                    'function': func.__name__
                }
                
                if table_name:
                    metadata['table_name'] = table_name
                    xray_config.add_annotation('table_name', table_name)
                
                xray_config.add_metadata('database_operation', metadata)
                xray_config.add_annotation('operation', operation)
                
                try:
                    result = func(*args, **kwargs)
                    xray_config.add_annotation('success', 'true')
                    return result
                    
                except Exception as e:
                    xray_config.add_annotation('success', 'false')
                    xray_config.add_annotation('error_type', type(e).__name__)
                    xray_config.capture_exception(e)
                    raise
        
        return wrapper
    return decorator

class MonitoringMetrics:
    """Application monitoring metrics"""
    
    def __init__(self):
        self.metrics = {}
        self.environment = os.getenv('ENVIRONMENT', 'development')
    
    def increment_counter(self, metric_name: str, value: int = 1, tags: Dict[str, str] = None):
        """Increment a counter metric"""
        try:
            # In development, just log the metric
            if self.environment == 'development':
                logger.info(f"Metric: {metric_name} += {value}", extra={
                    'metric_name': metric_name,
                    'metric_value': value,
                    'metric_tags': tags or {}
                })
            
            # Add to X-Ray metadata
            xray_config.add_metadata('metrics', {
                'name': metric_name,
                'value': value,
                'type': 'counter',
                'tags': tags or {}
            })
            
        except Exception as e:
            logger.debug(f"Failed to record metric {metric_name}: {e}")
    
    def record_timing(self, metric_name: str, duration_ms: float, tags: Dict[str, str] = None):
        """Record a timing metric"""
        try:
            # In development, just log the metric
            if self.environment == 'development':
                logger.info(f"Timing: {metric_name} = {duration_ms}ms", extra={
                    'metric_name': metric_name,
                    'metric_value': duration_ms,
                    'metric_tags': tags or {}
                })
            
            # Add to X-Ray metadata
            xray_config.add_metadata('metrics', {
                'name': metric_name,
                'value': duration_ms,
                'type': 'timing',
                'tags': tags or {}
            })
            
        except Exception as e:
            logger.debug(f"Failed to record timing {metric_name}: {e}")
    
    def record_gauge(self, metric_name: str, value: float, tags: Dict[str, str] = None):
        """Record a gauge metric"""
        try:
            # In development, just log the metric
            if self.environment == 'development':
                logger.info(f"Gauge: {metric_name} = {value}", extra={
                    'metric_name': metric_name,
                    'metric_value': value,
                    'metric_tags': tags or {}
                })
            
            # Add to X-Ray metadata
            xray_config.add_metadata('metrics', {
                'name': metric_name,
                'value': value,
                'type': 'gauge',
                'tags': tags or {}
            })
            
        except Exception as e:
            logger.debug(f"Failed to record gauge {metric_name}: {e}")

# Global monitoring instance
monitoring = MonitoringMetrics()

def time_function(metric_name: str = None, tags: Dict[str, str] = None):
    """Decorator to time function execution"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            import time
            
            start_time = time.time()
            function_metric_name = metric_name or f"{func.__module__}.{func.__name__}.duration"
            
            try:
                result = func(*args, **kwargs)
                success_tags = (tags or {}).copy()
                success_tags['success'] = 'true'
                
                duration_ms = (time.time() - start_time) * 1000
                monitoring.record_timing(function_metric_name, duration_ms, success_tags)
                
                return result
                
            except Exception as e:
                error_tags = (tags or {}).copy()
                error_tags['success'] = 'false'
                error_tags['error_type'] = type(e).__name__
                
                duration_ms = (time.time() - start_time) * 1000
                monitoring.record_timing(function_metric_name, duration_ms, error_tags)
                
                raise
        
        return wrapper
    return decorator