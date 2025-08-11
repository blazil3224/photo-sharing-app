"""
DynamoDB connection and configuration utilities
"""
import boto3
import os
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)

class DynamoDBConnection:
    """DynamoDB connection manager"""
    
    def __init__(self):
        self.dynamodb = None
        self.table_names = {
            'users': os.getenv('USERS_TABLE', 'Users'),
            'posts': os.getenv('POSTS_TABLE', 'Posts'),
            'interactions': os.getenv('INTERACTIONS_TABLE', 'Interactions')
        }
        self._initialize_connection()
    
    def _initialize_connection(self):
        """Initialize DynamoDB connection based on environment"""
        try:
            # Check if running in local development environment
            if os.getenv('ENVIRONMENT') == 'local':
                # Connect to DynamoDB Local
                self.dynamodb = boto3.resource(
                    'dynamodb',
                    endpoint_url='http://localhost:8000',
                    region_name='us-east-1',
                    aws_access_key_id='dummy',
                    aws_secret_access_key='dummy'
                )
                logger.info("Connected to DynamoDB Local")
            else:
                # Connect to AWS DynamoDB
                self.dynamodb = boto3.resource('dynamodb')
                logger.info("Connected to AWS DynamoDB")
        except Exception as e:
            logger.error(f"Failed to initialize DynamoDB connection: {e}")
            raise
    
    def get_table(self, table_type):
        """Get DynamoDB table by type"""
        if table_type not in self.table_names:
            raise ValueError(f"Unknown table type: {table_type}")
        
        table_name = self.table_names[table_type]
        try:
            table = self.dynamodb.Table(table_name)
            # Test table accessibility
            table.load()
            return table
        except ClientError as e:
            logger.error(f"Failed to access table {table_name}: {e}")
            raise
    
    def create_tables(self):
        """Create all required tables if they don't exist"""
        tables_created = []
        
        try:
            # Create Users table
            if not self._table_exists(self.table_names['users']):
                self._create_users_table()
                tables_created.append('Users')
            
            # Create Posts table
            if not self._table_exists(self.table_names['posts']):
                self._create_posts_table()
                tables_created.append('Posts')
            
            # Create Interactions table
            if not self._table_exists(self.table_names['interactions']):
                self._create_interactions_table()
                tables_created.append('Interactions')
            
            if tables_created:
                logger.info(f"Created tables: {', '.join(tables_created)}")
            else:
                logger.info("All tables already exist")
                
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise
    
    def _table_exists(self, table_name):
        """Check if table exists"""
        try:
            table = self.dynamodb.Table(table_name)
            table.load()
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                return False
            raise
    
    def _create_users_table(self):
        """Create Users table"""
        table = self.dynamodb.create_table(
            TableName=self.table_names['users'],
            KeySchema=[
                {
                    'AttributeName': 'user_id',
                    'KeyType': 'HASH'
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'user_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'username',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'email',
                    'AttributeType': 'S'
                }
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'username-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'username',
                            'KeyType': 'HASH'
                        }
                    ],
                    'Projection': {
                        'ProjectionType': 'ALL'
                    },
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                },
                {
                    'IndexName': 'email-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'email',
                            'KeyType': 'HASH'
                        }
                    ],
                    'Projection': {
                        'ProjectionType': 'ALL'
                    },
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        
        # Wait for table to be created
        table.wait_until_exists()
        logger.info("Users table created successfully")
    
    def _create_posts_table(self):
        """Create Posts table"""
        table = self.dynamodb.create_table(
            TableName=self.table_names['posts'],
            KeySchema=[
                {
                    'AttributeName': 'post_id',
                    'KeyType': 'HASH'
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'post_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'user_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'created_at',
                    'AttributeType': 'S'
                }
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'user-posts-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'user_id',
                            'KeyType': 'HASH'
                        },
                        {
                            'AttributeName': 'created_at',
                            'KeyType': 'RANGE'
                        }
                    ],
                    'Projection': {
                        'ProjectionType': 'ALL'
                    },
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                },
                {
                    'IndexName': 'timeline-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'created_at',
                            'KeyType': 'HASH'
                        }
                    ],
                    'Projection': {
                        'ProjectionType': 'ALL'
                    },
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        
        # Wait for table to be created
        table.wait_until_exists()
        logger.info("Posts table created successfully")
    
    def _create_interactions_table(self):
        """Create Interactions table"""
        table = self.dynamodb.create_table(
            TableName=self.table_names['interactions'],
            KeySchema=[
                {
                    'AttributeName': 'post_id',
                    'KeyType': 'HASH'
                },
                {
                    'AttributeName': 'interaction_id',
                    'KeyType': 'RANGE'
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'post_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'interaction_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'user_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'interaction_type',
                    'AttributeType': 'S'
                }
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'user-interactions-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'user_id',
                            'KeyType': 'HASH'
                        },
                        {
                            'AttributeName': 'interaction_type',
                            'KeyType': 'RANGE'
                        }
                    ],
                    'Projection': {
                        'ProjectionType': 'ALL'
                    },
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        
        # Wait for table to be created
        table.wait_until_exists()
        logger.info("Interactions table created successfully")


# Global connection instance
db_connection = DynamoDBConnection()