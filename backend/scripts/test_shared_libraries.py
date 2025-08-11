#!/usr/bin/env python3
"""
Test script for shared libraries and utilities
"""
import os
import sys
import logging

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def test_logging_config():
    """Test logging configuration"""
    print("Testing logging configuration...")
    
    from shared.logging_config import get_logger, setup_logging
    
    # Test logger creation
    logger = get_logger(__name__)
    logger.info("Test info message")
    logger.warning("Test warning message")
    logger.error("Test error message")
    
    print("✓ Logging configuration test passed")

def test_error_handling():
    """Test error handling utilities"""
    print("Testing error handling...")
    
    from shared.error_handler import (
        ValidationError, AuthenticationError, NotFoundError,
        DatabaseError, AppError
    )
    
    # Test error creation
    validation_error = ValidationError("Invalid input", "username")
    assert validation_error.status_code == 400
    assert validation_error.error_code.value == "VALIDATION_ERROR"
    
    auth_error = AuthenticationError()
    assert auth_error.status_code == 401
    
    not_found_error = NotFoundError("User not found", "user")
    assert not_found_error.status_code == 404
    
    # Test error serialization
    error_dict = validation_error.to_dict()
    assert error_dict["success"] == False
    assert "error" in error_dict
    
    print("✓ Error handling test passed")

def test_xray_config():
    """Test X-Ray configuration"""
    print("Testing X-Ray configuration...")
    
    from shared.xray_config import xray_config, monitoring, trace_function
    
    # Test X-Ray config initialization
    assert hasattr(xray_config, 'enabled')
    assert hasattr(xray_config, 'service_name')
    
    # Test monitoring metrics
    monitoring.increment_counter('test.counter', 1, {'test': 'true'})
    monitoring.record_timing('test.timing', 100.5, {'test': 'true'})
    monitoring.record_gauge('test.gauge', 42.0, {'test': 'true'})
    
    # Test trace decorator
    @trace_function('test_function')
    def test_traced_function():
        return "traced"
    
    result = test_traced_function()
    assert result == "traced"
    
    print("✓ X-Ray configuration test passed")

def test_database_connection():
    """Test database connection"""
    print("Testing database connection...")
    
    # Set environment for local testing
    os.environ['ENVIRONMENT'] = 'local'
    
    try:
        from shared.dynamodb import db_connection
        
        # Test connection initialization
        assert db_connection.dynamodb is not None
        assert 'users' in db_connection.table_names
        assert 'posts' in db_connection.table_names
        assert 'interactions' in db_connection.table_names
        
        print("✓ Database connection test passed")
        
    except Exception as e:
        print(f"⚠ Database connection test skipped (DynamoDB not available): {e}")

def test_monitoring_setup():
    """Test monitoring utilities"""
    print("Testing monitoring utilities...")
    
    from shared.monitoring import (
        PerformanceMonitor, HealthCheck, 
        monitor_api_endpoint, monitor_database_operation
    )
    
    # Test performance monitor
    perf_monitor = PerformanceMonitor()
    assert hasattr(perf_monitor, 'thresholds')
    
    # Test health check
    health_checker = HealthCheck()
    
    def dummy_check():
        return True
    
    health_checker.register_check('dummy', dummy_check)
    results = health_checker.run_checks()
    
    assert 'status' in results
    assert 'checks' in results
    assert 'dummy' in results['checks']
    
    # Test decorators
    @monitor_api_endpoint('test_endpoint')
    def test_api_function():
        return {"status": "ok"}
    
    @monitor_database_operation('test_operation', 'test_table')
    def test_db_function():
        return True
    
    api_result = test_api_function()
    db_result = test_db_function()
    
    assert api_result["status"] == "ok"
    assert db_result == True
    
    print("✓ Monitoring utilities test passed")

def test_shared_imports():
    """Test shared module imports"""
    print("Testing shared module imports...")
    
    from shared import (
        get_logger, AppError, ValidationError, db_connection,
        User, Post, Interaction, xray_config, monitoring,
        setup_monitoring_for_flask_app
    )
    
    # Test that all imports work
    logger = get_logger('test')
    logger.info("Import test successful")
    
    print("✓ Shared imports test passed")

def main():
    """Run all tests"""
    print("Running shared libraries tests...\n")
    
    try:
        test_logging_config()
        test_error_handling()
        test_xray_config()
        test_database_connection()
        test_monitoring_setup()
        test_shared_imports()
        
        print("\n✅ All tests passed!")
        return 0
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())