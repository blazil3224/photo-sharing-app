"""
Interaction service for handling likes and comments
"""
from typing import Dict, Any, List, Optional
from .models import Interaction, Post, User
from .error_handler import ValidationError, NotFoundError
from .logging_config import get_logger
from .monitoring import monitor_database_operation
from botocore.exceptions import ClientError

logger = get_logger(__name__)

class InteractionService:
    """Service for managing post interactions (likes and comments)"""
    
    def toggle_like(self, user_id: str, post_id: str) -> Dict[str, Any]:
        """
        Toggle like for a post using DynamoDB conditional updates to avoid race conditions
        Returns the new like status and updated count
        """
        @monitor_database_operation('toggle_like', 'interactions')
        def _toggle_like():
            # Validate post exists
            post = Post.get_by_id(post_id)
            if not post:
                raise NotFoundError("投稿が見つかりません")
            
            # Check if user has already liked this post
            existing_like = Interaction.get_user_like(post_id, user_id)
            
            if existing_like:
                # Unlike: Remove the like and decrement count
                Interaction.delete_like(post_id, user_id)
                post.update_counts(likes_delta=-1)
                
                logger.info(f"User {user_id} unliked post {post_id}")
                return {
                    'liked': False,
                    'likes_count': post.likes_count,
                    'message': 'いいねを取り消しました'
                }
            else:
                # Like: Add the like and increment count
                like = Interaction(
                    post_id=post_id,
                    user_id=user_id,
                    interaction_type='like'
                )
                like.save()
                post.update_counts(likes_delta=1)
                
                logger.info(f"User {user_id} liked post {post_id}")
                return {
                    'liked': True,
                    'likes_count': post.likes_count,
                    'message': 'いいねしました'
                }
        
        return _toggle_like()
    
    def add_comment(self, user_id: str, post_id: str, content: str) -> Dict[str, Any]:
        """
        Add a comment to a post
        """
        @monitor_database_operation('add_comment', 'interactions')
        def _add_comment():
            # Validate input
            if not content or not content.strip():
                raise ValidationError("コメント内容が必要です")
            
            trimmed_content = content.strip()
            if len(trimmed_content) > 500:  # Limit comment length
                raise ValidationError("コメントは500文字以内で入力してください")
            
            # Validate post exists
            post = Post.get_by_id(post_id)
            if not post:
                raise NotFoundError("投稿が見つかりません")
            
            # Validate user exists
            user = User.get_by_id(user_id)
            if not user:
                raise NotFoundError("ユーザーが見つかりません")
            
            # Create comment
            comment = Interaction(
                post_id=post_id,
                user_id=user_id,
                interaction_type='comment',
                content=trimmed_content
            )
            comment.save()
            
            # Update post comment count
            post.update_counts(comments_delta=1)
            
            logger.info(f"User {user_id} commented on post {post_id}")
            
            # Return comment data with user info
            return {
                'comment': {
                    'interaction_id': comment.interaction_id,
                    'post_id': comment.post_id,
                    'user_id': comment.user_id,
                    'username': user.username,
                    'content': comment.content,
                    'created_at': comment.created_at
                },
                'comments_count': post.comments_count,
                'message': 'コメントを投稿しました'
            }
        
        return _add_comment()
    
    def get_post_likes(self, post_id: str, limit: int = 50) -> Dict[str, Any]:
        """
        Get likes for a post
        """
        try:
            # Validate post exists
            post = Post.get_by_id(post_id)
            if not post:
                raise NotFoundError("投稿が見つかりません")
            
            # Get likes
            likes = Interaction.get_post_interactions(
                post_id=post_id,
                interaction_type='like',
                limit=limit
            )
            
            # Get user info for each like
            likes_with_users = []
            for like in likes:
                user = User.get_by_id(like.user_id)
                if user:
                    likes_with_users.append({
                        'user_id': user.user_id,
                        'username': user.username,
                        'profile_image': user.profile_image,
                        'created_at': like.created_at
                    })
            
            return {
                'likes': likes_with_users,
                'likes_count': len(likes_with_users),
                'total_likes': post.likes_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get likes for post {post_id}: {e}")
            raise
    
    def get_post_comments(self, post_id: str, limit: int = 50) -> Dict[str, Any]:
        """
        Get comments for a post
        """
        try:
            # Validate post exists
            post = Post.get_by_id(post_id)
            if not post:
                raise NotFoundError("投稿が見つかりません")
            
            # Get comments
            comments = Interaction.get_post_interactions(
                post_id=post_id,
                interaction_type='comment',
                limit=limit
            )
            
            # Get user info for each comment
            comments_with_users = []
            for comment in comments:
                user = User.get_by_id(comment.user_id)
                if user:
                    comments_with_users.append({
                        'interaction_id': comment.interaction_id,
                        'user_id': user.user_id,
                        'username': user.username,
                        'profile_image': user.profile_image,
                        'content': comment.content,
                        'created_at': comment.created_at
                    })
            
            # Sort comments by creation time (oldest first)
            comments_with_users.sort(key=lambda x: x['created_at'])
            
            return {
                'comments': comments_with_users,
                'comments_count': len(comments_with_users),
                'total_comments': post.comments_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get comments for post {post_id}: {e}")
            raise
    
    def get_user_like_status(self, user_id: str, post_id: str) -> bool:
        """
        Check if a user has liked a specific post
        """
        try:
            like = Interaction.get_user_like(post_id, user_id)
            return like is not None
            
        except Exception as e:
            logger.error(f"Failed to get like status for user {user_id}, post {post_id}: {e}")
            return False
    
    def delete_comment(self, user_id: str, post_id: str, interaction_id: str) -> Dict[str, Any]:
        """
        Delete a comment (only by the comment author)
        """
        try:
            # Get the comment
            comments = Interaction.get_post_interactions(post_id, 'comment')
            comment = None
            for c in comments:
                if c.interaction_id == interaction_id:
                    comment = c
                    break
            
            if not comment:
                raise NotFoundError("コメントが見つかりません")
            
            # Check if user is the author
            if comment.user_id != user_id:
                raise ValidationError("自分のコメントのみ削除できます")
            
            # Delete comment
            comment.delete()
            
            # Update post comment count
            post = Post.get_by_id(post_id)
            if post:
                post.update_counts(comments_delta=-1)
            
            logger.info(f"User {user_id} deleted comment {interaction_id}")
            
            return {
                'message': 'コメントを削除しました',
                'comments_count': post.comments_count if post else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to delete comment {interaction_id}: {e}")
            raise


# Global service instance
interaction_service = InteractionService()