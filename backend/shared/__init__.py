"""
Shared utilities and libraries for photo sharing app
"""

# Import logging configuration first to ensure proper setup
from .logging_config import setup_logging, get_logger

# Import error handling
from .error_handler import (
    AppError, ValidationError, AuthenticationError, AuthorizationError,
    NotFoundError, DuplicateError, FileError, DatabaseError, ExternalServiceError,
    register_error_handlers
)

# Import database connection and models
from .dynamodb import db_connection
from .models import User, Post, Interaction

# Import monitoring and X-Ray
from .xray_config import xray_config, monitoring, trace_function, time_function
from .monitoring import (
    setup_monitoring_for_flask_app, performance_monitor,
    monitor_api_endpoint, monitor_database_operation
)

# Initialize logging
logger = get_logger(__name__)
logger.info("Shared libraries initialized")

__all__ = [
    # Logging
    'setup_logging',
    'get_logger',
    
    # Error handling
    'AppError',
    'ValidationError', 
    'AuthenticationError',
    'AuthorizationError',
    'NotFoundError',
    'DuplicateError',
    'FileError',
    'DatabaseError',
    'ExternalServiceError',
    'register_error_handlers',
    
    # Database
    'db_connection',
    'User',
    'Post', 
    'Interaction',
    
    # Monitoring
    'xray_config',
    'monitoring',
    'trace_function',
    'time_function',
    'setup_monitoring_for_flask_app',
    'performance_monitor',
    'monitor_api_endpoint',
    'monitor_database_operation'
]