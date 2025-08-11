#!/usr/bin/env python3
"""
Validation script for DynamoDB models structure
"""
import os
import sys
import logging

# Add the parent directory to the path so we can import shared modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.models import User, Post, Interaction
from shared.dynamodb import DynamoDBConnection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def validate_user_model():
    """Validate User model structure"""
    logger.info("Validating User model...")
    
    # Check if User class has required attributes
    user = User()
    required_attrs = ['user_id', 'username', 'email', 'password_hash', 'created_at']
    
    for attr in required_attrs:
        if not hasattr(user, attr):
            raise AttributeError(f"User model missing required attribute: {attr}")
    
    # Check if User has required methods
    required_methods = ['save', 'get_by_id', 'get_by_username', 'get_by_email', 'update', 'delete', 'to_dict']
    
    for method in required_methods:
        if not hasattr(User, method):
            raise AttributeError(f"User model missing required method: {method}")
    
    logger.info("User model validation passed")

def validate_post_model():
    """Validate Post model structure"""
    logger.info("Validating Post model...")
    
    # Check if Post class has required attributes
    post = Post()
    required_attrs = ['post_id', 'user_id', 'image_key', 'likes_count', 'comments_count', 'created_at']
    
    for attr in required_attrs:
        if not hasattr(post, attr):
            raise AttributeError(f"Post model missing required attribute: {attr}")
    
    # Check if Post has required methods
    required_methods = ['save', 'get_by_id', 'get_user_posts', 'get_timeline_posts', 'update_counts', 'delete', 'to_dict']
    
    for method in required_methods:
        if not hasattr(Post, method):
            raise AttributeError(f"Post model missing required method: {method}")
    
    logger.info("Post model validation passed")

def validate_interaction_model():
    """Validate Interaction model structure"""
    logger.info("Validating Interaction model...")
    
    # Check if Interaction class has required attributes
    interaction = Interaction()
    required_attrs = ['post_id', 'user_id', 'interaction_type', 'interaction_id', 'created_at']
    
    for attr in required_attrs:
        if not hasattr(interaction, attr):
            raise AttributeError(f"Interaction model missing required attribute: {attr}")
    
    # Check if Interaction has required methods
    required_methods = ['save', 'get_post_interactions', 'get_user_like', 'delete_like', 'delete', 'to_dict']
    
    for method in required_methods:
        if not hasattr(Interaction, method):
            raise AttributeError(f"Interaction model missing required method: {method}")
    
    logger.info("Interaction model validation passed")

def validate_dynamodb_connection():
    """Validate DynamoDB connection structure"""
    logger.info("Validating DynamoDB connection...")
    
    # Check if DynamoDBConnection has required methods
    connection = DynamoDBConnection()
    required_methods = ['get_table', 'create_tables']
    
    for method in required_methods:
        if not hasattr(connection, method):
            raise AttributeError(f"DynamoDBConnection missing required method: {method}")
    
    # Check if table names are configured
    expected_tables = ['users', 'posts', 'interactions']
    for table in expected_tables:
        if table not in connection.table_names:
            raise ValueError(f"Missing table configuration: {table}")
    
    logger.info("DynamoDB connection validation passed")

def main():
    """Run model validation"""
    try:
        logger.info("Starting DynamoDB model validation...")
        
        # Validate all models
        validate_user_model()
        validate_post_model()
        validate_interaction_model()
        validate_dynamodb_connection()
        
        logger.info("All model validations passed successfully!")
        
    except Exception as e:
        logger.error(f"Model validation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()