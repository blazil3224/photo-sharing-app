"""
Post service for handling post-related business logic
"""
from typing import List, Dict, Any, Optional
from .models import Post, User, Interaction
from .image_service import image_service
from .logging_config import get_logger
from .error_handler import ValidationError, AuthenticationError

logger = get_logger(__name__)

class PostService:
    """Service class for post operations"""
    
    def create_post(self, user_id: str, image_key: str, caption: str = '') -> Dict[str, Any]:
        """Create a new post with image and metadata"""
        try:
            # Validate inputs
            if not user_id:
                raise ValidationError("ユーザーIDが必要です")
            
            if not image_key:
                raise ValidationError("画像キーが必要です")
            
            # Validate user exists
            user = User.get_by_id(user_id)
            if not user:
                raise ValidationError("ユーザーが見つかりません")
            
            # Create post
            post = Post(
                user_id=user_id,
                image_key=image_key,
                caption=caption
            )
            
            # Save to database
            post.save()
            
            # Get image URL
            image_url = image_service.get_image_url(image_key)
            
            # Prepare response data
            post_data = post.to_dict()
            post_data['image_url'] = image_url
            post_data['user'] = {
                'user_id': user.user_id,
                'username': user.username,
                'profile_image': user.profile_image
            }
            
            logger.info(f"Post {post.post_id} created successfully")
            return post_data
            
        except Exception as e:
            logger.error(f"Failed to create post: {e}")
            raise
    
    def get_post_by_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific post by ID with enriched data"""
        try:
            if not post_id:
                raise ValidationError("投稿IDが必要です")
            
            # Get post
            post = Post.get_by_id(post_id)
            if not post:
                return None
            
            # Get user data
            user = User.get_by_id(post.user_id)
            if not user:
                logger.warning(f"User {post.user_id} not found for post {post_id}")
                return None
            
            # Get image URL
            image_url = image_service.get_image_url(post.image_key)
            
            # Prepare enriched post data
            post_data = post.to_dict()
            post_data['image_url'] = image_url
            post_data['user'] = {
                'user_id': user.user_id,
                'username': user.username,
                'profile_image': user.profile_image
            }
            
            return post_data
            
        except Exception as e:
            logger.error(f"Failed to get post {post_id}: {e}")
            raise
    
    def get_timeline_posts(self, limit: int = 20, last_key: str = None) -> Dict[str, Any]:
        """Get timeline posts with pagination and enriched data"""
        try:
            # Validate and normalize limit
            if limit > 50:
                limit = 50
            elif limit < 1:
                limit = 20
            
            # Parse last_key if it's a JSON string
            parsed_last_key = None
            if last_key:
                try:
                    import json
                    parsed_last_key = json.loads(last_key)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(f"Invalid last_key format: {last_key}")
                    parsed_last_key = None
            
            # Get posts with proper pagination
            result = Post.get_timeline_posts(limit=limit, last_key=parsed_last_key)
            posts = result['posts']
            
            # Enrich posts with user data and image URLs
            enriched_posts = []
            for post in posts:
                enriched_post = self._enrich_post_data(post)
                if enriched_post:  # Only include posts with valid user data
                    enriched_posts.append(enriched_post)
            
            # Prepare next_key for client
            next_key = None
            if result['last_evaluated_key']:
                import json
                next_key = json.dumps(result['last_evaluated_key'])
            
            return {
                'posts': enriched_posts,
                'pagination': {
                    'limit': limit,
                    'next_key': next_key,
                    'has_more': result['has_more']
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get timeline posts: {e}")
            raise
    
    def get_user_posts(self, user_id: str, limit: int = 20, last_key: str = None) -> Dict[str, Any]:
        """Get posts by a specific user with pagination"""
        try:
            if not user_id:
                raise ValidationError("ユーザーIDが必要です")
            
            # Validate and normalize limit
            if limit > 50:
                limit = 50
            elif limit < 1:
                limit = 20
            
            # Check if user exists
            user = User.get_by_id(user_id)
            if not user:
                raise ValidationError("ユーザーが見つかりません")
            
            # Parse last_key if it's a JSON string
            parsed_last_key = None
            if last_key:
                try:
                    import json
                    parsed_last_key = json.loads(last_key)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(f"Invalid last_key format: {last_key}")
                    parsed_last_key = None
            
            # Get user's posts with proper pagination
            result = Post.get_user_posts(user_id=user_id, limit=limit, last_key=parsed_last_key)
            posts = result['posts']
            
            # Enrich posts with image URLs
            enriched_posts = []
            for post in posts:
                # Get image URL
                image_url = image_service.get_image_url(post.image_key)
                
                # Prepare post data
                post_data = post.to_dict()
                post_data['image_url'] = image_url
                post_data['user'] = {
                    'user_id': user.user_id,
                    'username': user.username,
                    'profile_image': user.profile_image
                }
                
                enriched_posts.append(post_data)
            
            # Prepare next_key for client
            next_key = None
            if result['last_evaluated_key']:
                import json
                next_key = json.dumps(result['last_evaluated_key'])
            
            return {
                'posts': enriched_posts,
                'user': {
                    'user_id': user.user_id,
                    'username': user.username,
                    'profile_image': user.profile_image,
                    'bio': user.bio
                },
                'pagination': {
                    'limit': limit,
                    'next_key': next_key,
                    'has_more': result['has_more']
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get posts for user {user_id}: {e}")
            raise
    
    def delete_post(self, post_id: str, user_id: str) -> bool:
        """Delete a post and its associated data"""
        try:
            if not post_id:
                raise ValidationError("投稿IDが必要です")
            
            if not user_id:
                raise ValidationError("ユーザーIDが必要です")
            
            # Get post
            post = Post.get_by_id(post_id)
            if not post:
                raise ValidationError("投稿が見つかりません")
            
            # Check ownership
            if post.user_id != user_id:
                raise AuthenticationError("この投稿を削除する権限がありません")
            
            # Delete associated interactions first
            interactions = Interaction.get_post_interactions(post_id)
            for interaction in interactions:
                interaction.delete()
            
            # Delete the post
            post.delete()
            
            # Note: In production, we would also delete the image from S3
            # For now, we'll leave the image as it might be referenced elsewhere
            
            logger.info(f"Post {post_id} deleted successfully by user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete post {post_id}: {e}")
            raise
    
    def _enrich_post_data(self, post: Post) -> Optional[Dict[str, Any]]:
        """Enrich post data with user information and image URL"""
        try:
            # Get user data
            user = User.get_by_id(post.user_id)
            if not user:
                logger.warning(f"User {post.user_id} not found for post {post.post_id}")
                return None
            
            # Get image URL
            image_url = image_service.get_image_url(post.image_key)
            
            # Prepare enriched post data
            post_data = post.to_dict()
            post_data['image_url'] = image_url
            post_data['user'] = {
                'user_id': user.user_id,
                'username': user.username,
                'profile_image': user.profile_image
            }
            
            return post_data
            
        except Exception as e:
            logger.error(f"Failed to enrich post data for {post.post_id}: {e}")
            return None
    
    def validate_post_ownership(self, post_id: str, user_id: str) -> bool:
        """Validate that a user owns a specific post"""
        try:
            post = Post.get_by_id(post_id)
            if not post:
                return False
            
            return post.user_id == user_id
            
        except Exception as e:
            logger.error(f"Failed to validate post ownership: {e}")
            return False
    
    def get_post_stats(self, post_id: str) -> Dict[str, int]:
        """Get statistics for a post (likes, comments)"""
        try:
            post = Post.get_by_id(post_id)
            if not post:
                raise ValidationError("投稿が見つかりません")
            
            return {
                'likes_count': post.likes_count,
                'comments_count': post.comments_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get post stats for {post_id}: {e}")
            raise

# Global service instance
post_service = PostService()