#!/usr/bin/env python3
"""
DynamoDB table initialization script for photo sharing app
"""
import os
import sys
import logging

# Add the parent directory to the path so we can import shared modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.dynamodb import db_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def main():
    """Initialize DynamoDB tables"""
    try:
        logger.info("Starting DynamoDB table initialization...")
        
        # Set environment to local for development
        os.environ['ENVIRONMENT'] = 'local'
        
        # Create all tables
        db_connection.create_tables()
        
        logger.info("DynamoDB table initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"Failed to initialize tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()