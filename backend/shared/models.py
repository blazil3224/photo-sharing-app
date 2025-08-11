"""
DynamoDB model classes for photo sharing app
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from botocore.exceptions import ClientError
from .logging_config import get_logger
from .dynamodb import db_connection

logger = get_logger(__name__)

class BaseModel:
    """Base model class with common DynamoDB operations"""
    
    def __init__(self):
        self.db = db_connection
    
    def _generate_id(self) -> str:
        """Generate unique ID"""
        return str(uuid.uuid4())
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        return datetime.utcnow().isoformat()


class User(BaseModel):
    """User model for DynamoDB Users table"""
    
    def __init__(self, user_id: str = None, username: str = None, email: str = None, 
                 password_hash: str = None, profile_image: str = None, bio: str = None):
        super().__init__()
        self.user_id = user_id or self._generate_id()
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.profile_image = profile_image
        self.bio = bio
        self.created_at = self._get_timestamp()
    
    def save(self) -> bool:
        """Save user to DynamoDB"""
        from .monitoring import monitor_database_operation
        
        @monitor_database_operation('user_save', 'users')
        def _save_user():
            table = self.db.get_table('users')
            
            # Check if username already exists
            if self.username and self.get_by_username(self.username):
                from .error_handler import DuplicateError
                raise DuplicateError("ユーザー名は既に使用されています", "username")
            
            # Check if email already exists
            if self.email and self.get_by_email(self.email):
                from .error_handler import DuplicateError
                raise DuplicateError("メールアドレスは既に使用されています", "email")
            
            item = {
                'user_id': self.user_id,
                'username': self.username,
                'email': self.email,
                'password_hash': self.password_hash,
                'created_at': self.created_at
            }
            
            # Add optional fields if they exist
            if self.profile_image:
                item['profile_image'] = self.profile_image
            if self.bio:
                item['bio'] = self.bio
            
            table.put_item(Item=item)
            logger.info(f"User {self.user_id} saved successfully")
            return True
        
        return _save_user()
    
    @classmethod
    def get_by_id(cls, user_id: str) -> Optional['User']:
        """Get user by ID"""
        from .monitoring import monitor_database_operation
        
        @monitor_database_operation('user_get_by_id', 'users')
        def _get_user():
            table = db_connection.get_table('users')
            response = table.get_item(Key={'user_id': user_id})
            
            if 'Item' in response:
                item = response['Item']
                user = cls(
                    user_id=item['user_id'],
                    username=item['username'],
                    email=item['email'],
                    password_hash=item['password_hash'],
                    profile_image=item.get('profile_image'),
                    bio=item.get('bio')
                )
                user.created_at = item['created_at']
                return user
            return None
        
        return _get_user()
    
    @classmethod
    def get_by_username(cls, username: str) -> Optional['User']:
        """Get user by username"""
        try:
            table = db_connection.get_table('users')
            response = table.query(
                IndexName='username-index',
                KeyConditionExpression='username = :username',
                ExpressionAttributeValues={':username': username}
            )
            
            if response['Items']:
                item = response['Items'][0]
                user = cls(
                    user_id=item['user_id'],
                    username=item['username'],
                    email=item['email'],
                    password_hash=item['password_hash'],
                    profile_image=item.get('profile_image'),
                    bio=item.get('bio')
                )
                user.created_at = item['created_at']
                return user
            return None
            
        except Exception as e:
            logger.error(f"Failed to get user by username {username}: {e}")
            raise
    
    @classmethod
    def get_by_email(cls, email: str) -> Optional['User']:
        """Get user by email"""
        try:
            table = db_connection.get_table('users')
            response = table.query(
                IndexName='email-index',
                KeyConditionExpression='email = :email',
                ExpressionAttributeValues={':email': email}
            )
            
            if response['Items']:
                item = response['Items'][0]
                user = cls(
                    user_id=item['user_id'],
                    username=item['username'],
                    email=item['email'],
                    password_hash=item['password_hash'],
                    profile_image=item.get('profile_image'),
                    bio=item.get('bio')
                )
                user.created_at = item['created_at']
                return user
            return None
            
        except Exception as e:
            logger.error(f"Failed to get user by email {email}: {e}")
            raise
    
    def update(self, **kwargs) -> bool:
        """Update user attributes"""
        try:
            table = self.db.get_table('users')
            
            # Build update expression
            update_expression = "SET "
            expression_attribute_values = {}
            expression_attribute_names = {}
            
            for key, value in kwargs.items():
                if hasattr(self, key) and value is not None:
                    # Handle reserved keywords
                    attr_name = f"#{key}"
                    attr_value = f":{key}"
                    
                    update_expression += f"{attr_name} = {attr_value}, "
                    expression_attribute_names[attr_name] = key
                    expression_attribute_values[attr_value] = value
                    
                    # Update instance attribute
                    setattr(self, key, value)
            
            # Remove trailing comma and space
            update_expression = update_expression.rstrip(', ')
            
            if not expression_attribute_values:
                return True  # Nothing to update
            
            table.update_item(
                Key={'user_id': self.user_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
            
            logger.info(f"User {self.user_id} updated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update user {self.user_id}: {e}")
            raise
    
    def delete(self) -> bool:
        """Delete user"""
        try:
            table = self.db.get_table('users')
            table.delete_item(Key={'user_id': self.user_id})
            logger.info(f"User {self.user_id} deleted successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete user {self.user_id}: {e}")
            raise
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert user to dictionary"""
        return {
            'user_id': self.user_id,
            'username': self.username,
            'email': self.email,
            'profile_image': self.profile_image,
            'bio': self.bio,
            'created_at': self.created_at
        }


class Post(BaseModel):
    """Post model for DynamoDB Posts table"""
    
    def __init__(self, post_id: str = None, user_id: str = None, image_key: str = None,
                 caption: str = None, likes_count: int = 0, comments_count: int = 0):
        super().__init__()
        self.post_id = post_id or self._generate_id()
        self.user_id = user_id
        self.image_key = image_key
        self.caption = caption
        self.likes_count = likes_count
        self.comments_count = comments_count
        self.created_at = self._get_timestamp()
    
    def save(self) -> bool:
        """Save post to DynamoDB"""
        try:
            table = self.db.get_table('posts')
            
            item = {
                'post_id': self.post_id,
                'user_id': self.user_id,
                'image_key': self.image_key,
                'likes_count': self.likes_count,
                'comments_count': self.comments_count,
                'created_at': self.created_at
            }
            
            # Add optional caption
            if self.caption:
                item['caption'] = self.caption
            
            table.put_item(Item=item)
            logger.info(f"Post {self.post_id} saved successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save post {self.post_id}: {e}")
            raise
    
    @classmethod
    def get_by_id(cls, post_id: str) -> Optional['Post']:
        """Get post by ID"""
        try:
            table = db_connection.get_table('posts')
            response = table.get_item(Key={'post_id': post_id})
            
            if 'Item' in response:
                item = response['Item']
                post = cls(
                    post_id=item['post_id'],
                    user_id=item['user_id'],
                    image_key=item['image_key'],
                    caption=item.get('caption'),
                    likes_count=item.get('likes_count', 0),
                    comments_count=item.get('comments_count', 0)
                )
                post.created_at = item['created_at']
                return post
            return None
            
        except Exception as e:
            logger.error(f"Failed to get post by ID {post_id}: {e}")
            raise
    
    @classmethod
    def get_user_posts(cls, user_id: str, limit: int = 20, last_key: Dict[str, str] = None) -> Dict[str, Any]:
        """Get posts by user with proper DynamoDB pagination"""
        try:
            table = db_connection.get_table('posts')
            
            query_params = {
                'IndexName': 'user-posts-index',
                'KeyConditionExpression': 'user_id = :user_id',
                'ExpressionAttributeValues': {':user_id': user_id},
                'ScanIndexForward': False,  # Sort by created_at descending
                'Limit': limit
            }
            
            # Handle pagination with proper DynamoDB LastEvaluatedKey
            if last_key:
                query_params['ExclusiveStartKey'] = last_key
            
            response = table.query(**query_params)
            
            posts = []
            for item in response['Items']:
                post = cls(
                    post_id=item['post_id'],
                    user_id=item['user_id'],
                    image_key=item['image_key'],
                    caption=item.get('caption'),
                    likes_count=item.get('likes_count', 0),
                    comments_count=item.get('comments_count', 0)
                )
                post.created_at = item['created_at']
                posts.append(post)
            
            # Return posts with pagination info
            return {
                'posts': posts,
                'last_evaluated_key': response.get('LastEvaluatedKey'),
                'has_more': 'LastEvaluatedKey' in response
            }
            
        except Exception as e:
            logger.error(f"Failed to get user posts for {user_id}: {e}")
            raise
    
    @classmethod
    def get_timeline_posts(cls, limit: int = 20, last_key: Dict[str, str] = None) -> Dict[str, Any]:
        """Get timeline posts with proper DynamoDB pagination"""
        try:
            table = db_connection.get_table('posts')
            
            # Use scan with proper pagination for timeline
            # In production, this could be optimized with a GSI using a fixed partition key
            scan_params = {
                'Limit': limit,
                'Select': 'ALL_ATTRIBUTES'
            }
            
            # Handle pagination with proper DynamoDB LastEvaluatedKey
            if last_key:
                scan_params['ExclusiveStartKey'] = last_key
            
            response = table.scan(**scan_params)
            
            posts = []
            for item in response['Items']:
                post = cls(
                    post_id=item['post_id'],
                    user_id=item['user_id'],
                    image_key=item['image_key'],
                    caption=item.get('caption'),
                    likes_count=item.get('likes_count', 0),
                    comments_count=item.get('comments_count', 0)
                )
                post.created_at = item['created_at']
                posts.append(post)
            
            # Sort by created_at descending (most recent first)
            posts.sort(key=lambda x: x.created_at, reverse=True)
            
            # Return posts with pagination info
            return {
                'posts': posts,
                'last_evaluated_key': response.get('LastEvaluatedKey'),
                'has_more': 'LastEvaluatedKey' in response
            }
            
        except Exception as e:
            logger.error(f"Failed to get timeline posts: {e}")
            raise
    
    def update_counts(self, likes_delta: int = 0, comments_delta: int = 0) -> bool:
        """Update like and comment counts"""
        try:
            table = self.db.get_table('posts')
            
            update_expression = "ADD likes_count :likes_delta, comments_count :comments_delta"
            expression_attribute_values = {
                ':likes_delta': likes_delta,
                ':comments_delta': comments_delta
            }
            
            table.update_item(
                Key={'post_id': self.post_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_attribute_values
            )
            
            # Update instance attributes
            self.likes_count += likes_delta
            self.comments_count += comments_delta
            
            logger.info(f"Post {self.post_id} counts updated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update post counts {self.post_id}: {e}")
            raise
    
    def delete(self) -> bool:
        """Delete post"""
        try:
            table = self.db.get_table('posts')
            table.delete_item(Key={'post_id': self.post_id})
            logger.info(f"Post {self.post_id} deleted successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete post {self.post_id}: {e}")
            raise
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert post to dictionary"""
        return {
            'post_id': self.post_id,
            'user_id': self.user_id,
            'image_key': self.image_key,
            'caption': self.caption,
            'likes_count': self.likes_count,
            'comments_count': self.comments_count,
            'created_at': self.created_at
        }


class Interaction(BaseModel):
    """Interaction model for DynamoDB Interactions table (likes and comments)"""
    
    def __init__(self, post_id: str = None, user_id: str = None, 
                 interaction_type: str = None, content: str = None):
        super().__init__()
        self.post_id = post_id
        self.user_id = user_id
        self.interaction_type = interaction_type  # 'like' or 'comment'
        self.content = content  # Only for comments
        self.created_at = self._get_timestamp()
        # Generate composite interaction_id: {type}#{user_id}#{timestamp}
        self.interaction_id = f"{interaction_type}#{user_id}#{self.created_at}"
    
    def save(self) -> bool:
        """Save interaction to DynamoDB"""
        try:
            table = self.db.get_table('interactions')
            
            item = {
                'post_id': self.post_id,
                'interaction_id': self.interaction_id,
                'user_id': self.user_id,
                'interaction_type': self.interaction_type,
                'created_at': self.created_at
            }
            
            # Add content for comments
            if self.content:
                item['content'] = self.content
            
            table.put_item(Item=item)
            logger.info(f"Interaction {self.interaction_id} saved successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save interaction {self.interaction_id}: {e}")
            raise
    
    @classmethod
    def get_post_interactions(cls, post_id: str, interaction_type: str = None, 
                            limit: int = 50) -> List['Interaction']:
        """Get interactions for a post"""
        try:
            table = db_connection.get_table('interactions')
            
            query_params = {
                'KeyConditionExpression': 'post_id = :post_id',
                'ExpressionAttributeValues': {':post_id': post_id},
                'Limit': limit
            }
            
            # Filter by interaction type if specified
            if interaction_type:
                query_params['FilterExpression'] = 'interaction_type = :type'
                query_params['ExpressionAttributeValues'][':type'] = interaction_type
            
            response = table.query(**query_params)
            
            interactions = []
            for item in response['Items']:
                interaction = cls(
                    post_id=item['post_id'],
                    user_id=item['user_id'],
                    interaction_type=item['interaction_type'],
                    content=item.get('content')
                )
                interaction.interaction_id = item['interaction_id']
                interaction.created_at = item['created_at']
                interactions.append(interaction)
            
            return interactions
            
        except Exception as e:
            logger.error(f"Failed to get interactions for post {post_id}: {e}")
            raise
    
    @classmethod
    def get_user_like(cls, post_id: str, user_id: str) -> Optional['Interaction']:
        """Check if user has liked a post"""
        try:
            table = db_connection.get_table('interactions')
            
            # Query for like interaction with specific pattern
            response = table.query(
                KeyConditionExpression='post_id = :post_id AND begins_with(interaction_id, :like_prefix)',
                ExpressionAttributeValues={
                    ':post_id': post_id,
                    ':like_prefix': f'like#{user_id}#'
                },
                Limit=1
            )
            
            if response['Items']:
                item = response['Items'][0]
                interaction = cls(
                    post_id=item['post_id'],
                    user_id=item['user_id'],
                    interaction_type=item['interaction_type']
                )
                interaction.interaction_id = item['interaction_id']
                interaction.created_at = item['created_at']
                return interaction
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get user like for post {post_id}, user {user_id}: {e}")
            raise
    
    @classmethod
    def delete_like(cls, post_id: str, user_id: str) -> bool:
        """Delete a like interaction"""
        try:
            # First find the like
            like = cls.get_user_like(post_id, user_id)
            if not like:
                return False
            
            table = db_connection.get_table('interactions')
            table.delete_item(
                Key={
                    'post_id': post_id,
                    'interaction_id': like.interaction_id
                }
            )
            
            logger.info(f"Like deleted for post {post_id}, user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete like for post {post_id}, user {user_id}: {e}")
            raise
    
    def delete(self) -> bool:
        """Delete interaction"""
        try:
            table = self.db.get_table('interactions')
            table.delete_item(
                Key={
                    'post_id': self.post_id,
                    'interaction_id': self.interaction_id
                }
            )
            logger.info(f"Interaction {self.interaction_id} deleted successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete interaction {self.interaction_id}: {e}")
            raise
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert interaction to dictionary"""
        result = {
            'post_id': self.post_id,
            'interaction_id': self.interaction_id,
            'user_id': self.user_id,
            'interaction_type': self.interaction_type,
            'created_at': self.created_at
        }
        
        if self.content:
            result['content'] = self.content
            
        return result