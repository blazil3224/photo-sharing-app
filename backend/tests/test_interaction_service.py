"""
Tests for interaction service functionality
"""
import pytest
import sys
import os
from decimal import Decimal

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.interaction_service import interaction_service
from shared.models import User, Post, Interaction
from shared.error_handler import ValidationError, NotFoundError
from shared.dynamodb import db_connection

class TestInteractionService:
    """Test cases for interaction service"""
    
    @classmethod
    def setup_class(cls):
        """Set up test environment"""
        # Set environment to local for testing
        os.environ['ENVIRONMENT'] = 'local'
        
        # Create tables if they don't exist
        try:
            db_connection.create_tables()
        except Exception as e:
            print(f"Warning: Could not create tables: {e}")
    
    def setup_method(self):
        """Set up test data before each test"""
        # Create test users
        self.user1 = User(
            username="testuser1",
            email="test1@example.com",
            password_hash="hashed_password_1"
        )
        self.user1.save()
        
        self.user2 = User(
            username="testuser2", 
            email="test2@example.com",
            password_hash="hashed_password_2"
        )
        self.user2.save()
        
        # Create test post
        self.post = Post(
            user_id=self.user1.user_id,
            image_key="test/image.jpg",
            caption="Test post for interactions"
        )
        self.post.save()
    
    def teardown_method(self):
        """Clean up test data after each test"""
        try:
            # Clean up interactions
            interactions = Interaction.get_post_interactions(self.post.post_id)
            for interaction in interactions:
                interaction.delete()
            
            # Clean up post
            self.post.delete()
            
            # Clean up users
            self.user1.delete()
            self.user2.delete()
        except Exception as e:
            print(f"Warning: Could not clean up test data: {e}")
    
    def test_toggle_like_add(self):
        """Test adding a like to a post"""
        result = interaction_service.toggle_like(
            user_id=self.user1.user_id,
            post_id=self.post.post_id
        )
        
        assert result['liked'] is True
        assert int(result['likes_count']) == 1
        assert 'いいねしました' in result['message']
        
        # Verify like exists in database
        like = Interaction.get_user_like(self.post.post_id, self.user1.user_id)
        assert like is not None
        assert like.interaction_type == 'like'
    
    def test_toggle_like_remove(self):
        """Test removing a like from a post"""
        # First add a like
        interaction_service.toggle_like(
            user_id=self.user1.user_id,
            post_id=self.post.post_id
        )
        
        # Then remove it
        result = interaction_service.toggle_like(
            user_id=self.user1.user_id,
            post_id=self.post.post_id
        )
        
        assert result['liked'] is False
        assert int(result['likes_count']) == 0
        assert 'いいねを取り消しました' in result['message']
        
        # Verify like no longer exists in database
        like = Interaction.get_user_like(self.post.post_id, self.user1.user_id)
        assert like is None
    
    def test_toggle_like_nonexistent_post(self):
        """Test toggling like on non-existent post"""
        with pytest.raises(NotFoundError) as exc_info:
            interaction_service.toggle_like(
                user_id=self.user1.user_id,
                post_id="nonexistent_post_id"
            )
        
        assert "投稿が見つかりません" in str(exc_info.value)
    
    def test_add_comment_success(self):
        """Test adding a comment to a post"""
        comment_content = "This is a test comment"
        
        result = interaction_service.add_comment(
            user_id=self.user1.user_id,
            post_id=self.post.post_id,
            content=comment_content
        )
        
        assert result['comment']['content'] == comment_content
        assert result['comment']['username'] == self.user1.username
        assert int(result['comments_count']) == 1
        assert 'コメントを投稿しました' in result['message']
        
        # Verify comment exists in database
        comments = Interaction.get_post_interactions(
            self.post.post_id, 
            interaction_type='comment'
        )
        assert len(comments) == 1
        assert comments[0].content == comment_content
    
    def test_add_comment_empty_content(self):
        """Test adding empty comment"""
        with pytest.raises(ValidationError) as exc_info:
            interaction_service.add_comment(
                user_id=self.user1.user_id,
                post_id=self.post.post_id,
                content=""
            )
        
        assert "コメント内容が必要です" in str(exc_info.value)
    
    def test_add_comment_whitespace_only(self):
        """Test adding comment with only whitespace"""
        with pytest.raises(ValidationError) as exc_info:
            interaction_service.add_comment(
                user_id=self.user1.user_id,
                post_id=self.post.post_id,
                content="   \n\t   "
            )
        
        assert "コメント内容が必要です" in str(exc_info.value)
    
    def test_add_comment_too_long(self):
        """Test adding comment that exceeds length limit"""
        long_content = "a" * 501  # Exceeds 500 character limit
        
        with pytest.raises(ValidationError) as exc_info:
            interaction_service.add_comment(
                user_id=self.user1.user_id,
                post_id=self.post.post_id,
                content=long_content
            )
        
        assert "500文字以内" in str(exc_info.value)
    
    def test_add_comment_nonexistent_post(self):
        """Test adding comment to non-existent post"""
        with pytest.raises(NotFoundError) as exc_info:
            interaction_service.add_comment(
                user_id=self.user1.user_id,
                post_id="nonexistent_post_id",
                content="Test comment"
            )
        
        assert "投稿が見つかりません" in str(exc_info.value)
    
    def test_get_post_likes(self):
        """Test getting likes for a post"""
        # Add likes from both users
        interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        interaction_service.toggle_like(self.user2.user_id, self.post.post_id)
        
        result = interaction_service.get_post_likes(self.post.post_id)
        
        assert int(result['likes_count']) == 2
        assert int(result['total_likes']) == 2
        assert len(result['likes']) == 2
        
        # Check that user info is included
        usernames = [like['username'] for like in result['likes']]
        assert self.user1.username in usernames
        assert self.user2.username in usernames
    
    def test_get_post_comments(self):
        """Test getting comments for a post"""
        # Add comments from both users
        interaction_service.add_comment(
            self.user1.user_id, 
            self.post.post_id, 
            "First comment"
        )
        interaction_service.add_comment(
            self.user2.user_id, 
            self.post.post_id, 
            "Second comment"
        )
        
        result = interaction_service.get_post_comments(self.post.post_id)
        
        assert int(result['comments_count']) == 2
        assert int(result['total_comments']) == 2
        assert len(result['comments']) == 2
        
        # Check that comments are sorted by creation time (oldest first)
        assert result['comments'][0]['content'] == "First comment"
        assert result['comments'][1]['content'] == "Second comment"
        
        # Check that user info is included
        assert result['comments'][0]['username'] == self.user1.username
        assert result['comments'][1]['username'] == self.user2.username
    
    def test_get_user_like_status(self):
        """Test checking user's like status for a post"""
        # Initially no like
        liked = interaction_service.get_user_like_status(
            self.user1.user_id, 
            self.post.post_id
        )
        assert liked is False
        
        # Add like
        interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        
        # Now should be liked
        liked = interaction_service.get_user_like_status(
            self.user1.user_id, 
            self.post.post_id
        )
        assert liked is True
    
    def test_delete_comment_success(self):
        """Test deleting a comment by its author"""
        # Add comment
        result = interaction_service.add_comment(
            self.user1.user_id,
            self.post.post_id,
            "Comment to be deleted"
        )
        
        interaction_id = result['comment']['interaction_id']
        
        # Delete comment
        delete_result = interaction_service.delete_comment(
            self.user1.user_id,
            self.post.post_id,
            interaction_id
        )
        
        assert 'コメントを削除しました' in delete_result['message']
        assert int(delete_result['comments_count']) == 0
        
        # Verify comment no longer exists
        comments = interaction_service.get_post_comments(self.post.post_id)
        assert int(comments['comments_count']) == 0
    
    def test_delete_comment_unauthorized(self):
        """Test deleting comment by different user"""
        # Add comment by user1
        result = interaction_service.add_comment(
            self.user1.user_id,
            self.post.post_id,
            "Comment by user1"
        )
        
        interaction_id = result['comment']['interaction_id']
        
        # Try to delete by user2
        with pytest.raises(ValidationError) as exc_info:
            interaction_service.delete_comment(
                self.user2.user_id,
                self.post.post_id,
                interaction_id
            )
        
        assert "自分のコメントのみ削除できます" in str(exc_info.value)
    
    def test_delete_nonexistent_comment(self):
        """Test deleting non-existent comment"""
        with pytest.raises(NotFoundError) as exc_info:
            interaction_service.delete_comment(
                self.user1.user_id,
                self.post.post_id,
                "nonexistent_interaction_id"
            )
        
        assert "コメントが見つかりません" in str(exc_info.value)
    
    def test_duplicate_like_prevention(self):
        """Test that duplicate likes are properly handled (重複いいね検証テスト)"""
        # Add initial like
        result1 = interaction_service.toggle_like(
            user_id=self.user1.user_id,
            post_id=self.post.post_id
        )
        assert result1['liked'] is True
        assert int(result1['likes_count']) == 1
        
        # Verify like exists
        like_status = interaction_service.get_user_like_status(
            self.user1.user_id, 
            self.post.post_id
        )
        assert like_status is True
        
        # Try to like again (should toggle off)
        result2 = interaction_service.toggle_like(
            user_id=self.user1.user_id,
            post_id=self.post.post_id
        )
        assert result2['liked'] is False
        assert int(result2['likes_count']) == 0
        
        # Verify like no longer exists
        like_status = interaction_service.get_user_like_status(
            self.user1.user_id, 
            self.post.post_id
        )
        assert like_status is False
        
        # Verify only one interaction record was created and deleted
        interactions = Interaction.get_post_interactions(
            self.post.post_id, 
            interaction_type='like'
        )
        assert len(interactions) == 0
    
    def test_empty_comment_validation(self):
        """Test validation of empty comments (空コメント検証テスト)"""
        # Test completely empty string
        with pytest.raises(ValidationError) as exc_info:
            interaction_service.add_comment(
                user_id=self.user1.user_id,
                post_id=self.post.post_id,
                content=""
            )
        assert "コメント内容が必要です" in str(exc_info.value)
        
        # Test None value
        with pytest.raises(ValidationError) as exc_info:
            interaction_service.add_comment(
                user_id=self.user1.user_id,
                post_id=self.post.post_id,
                content=None
            )
        assert "コメント内容が必要です" in str(exc_info.value)
        
        # Test whitespace only variations
        whitespace_variations = [
            "   ",      # spaces only
            "\t\t",     # tabs only
            "\n\n",     # newlines only
            " \t\n ",   # mixed whitespace
            "\r\n\t ",  # carriage return + mixed
        ]
        
        for whitespace in whitespace_variations:
            with pytest.raises(ValidationError) as exc_info:
                interaction_service.add_comment(
                    user_id=self.user1.user_id,
                    post_id=self.post.post_id,
                    content=whitespace
                )
            assert "コメント内容が必要です" in str(exc_info.value)
        
        # Verify no comments were actually created
        comments = interaction_service.get_post_comments(self.post.post_id)
        assert int(comments['comments_count']) == 0
    
    def test_interaction_count_accuracy(self):
        """Test accuracy of interaction count aggregation (インタラクション数集計の正確性テスト)"""
        # Initial state - no interactions
        post_likes = interaction_service.get_post_likes(self.post.post_id)
        post_comments = interaction_service.get_post_comments(self.post.post_id)
        assert int(post_likes['likes_count']) == 0
        assert int(post_comments['comments_count']) == 0
        
        # Add likes from multiple users
        interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        interaction_service.toggle_like(self.user2.user_id, self.post.post_id)
        
        # Verify like count accuracy
        post_likes = interaction_service.get_post_likes(self.post.post_id)
        assert int(post_likes['likes_count']) == 2
        assert int(post_likes['total_likes']) == 2
        assert len(post_likes['likes']) == 2
        
        # Add comments from multiple users
        interaction_service.add_comment(
            self.user1.user_id, 
            self.post.post_id, 
            "First comment"
        )
        interaction_service.add_comment(
            self.user2.user_id, 
            self.post.post_id, 
            "Second comment"
        )
        interaction_service.add_comment(
            self.user1.user_id, 
            self.post.post_id, 
            "Third comment"
        )
        
        # Verify comment count accuracy
        post_comments = interaction_service.get_post_comments(self.post.post_id)
        assert int(post_comments['comments_count']) == 3
        assert int(post_comments['total_comments']) == 3
        assert len(post_comments['comments']) == 3
        
        # Remove one like and verify count updates
        interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        post_likes = interaction_service.get_post_likes(self.post.post_id)
        assert int(post_likes['likes_count']) == 1
        assert int(post_likes['total_likes']) == 1
        
        # Delete one comment and verify count updates
        comments = interaction_service.get_post_comments(self.post.post_id)
        first_comment_id = comments['comments'][0]['interaction_id']
        first_comment_user = comments['comments'][0]['user_id']
        
        interaction_service.delete_comment(
            first_comment_user,
            self.post.post_id,
            first_comment_id
        )
        
        post_comments = interaction_service.get_post_comments(self.post.post_id)
        assert int(post_comments['comments_count']) == 2
        assert int(post_comments['total_comments']) == 2
        
        # Verify final state consistency
        # Should have 1 like and 2 comments
        final_likes = interaction_service.get_post_likes(self.post.post_id)
        final_comments = interaction_service.get_post_comments(self.post.post_id)
        
        assert int(final_likes['likes_count']) == 1
        assert int(final_comments['comments_count']) == 2
        
        # Verify database consistency by counting actual records
        all_interactions = Interaction.get_post_interactions(self.post.post_id)
        like_interactions = [i for i in all_interactions if i.interaction_type == 'like']
        comment_interactions = [i for i in all_interactions if i.interaction_type == 'comment']
        
        assert len(like_interactions) == 1
        assert len(comment_interactions) == 2
    
    def test_concurrent_like_operations(self):
        """Test handling of concurrent like operations to prevent race conditions"""
        # This test simulates potential race conditions in like toggling
        # Multiple rapid like operations should be handled correctly
        
        # Rapid toggle operations
        results = []
        for i in range(5):
            result = interaction_service.toggle_like(
                user_id=self.user1.user_id,
                post_id=self.post.post_id
            )
            results.append(result)
        
        # Final state should be liked (odd number of toggles)
        assert results[-1]['liked'] is True
        assert int(results[-1]['likes_count']) == 1
        
        # Verify database state matches
        like_status = interaction_service.get_user_like_status(
            self.user1.user_id, 
            self.post.post_id
        )
        assert like_status is True
        
        # Verify only one like record exists
        likes = Interaction.get_post_interactions(
            self.post.post_id, 
            interaction_type='like'
        )
        assert len(likes) == 1
    
    def test_comment_content_trimming(self):
        """Test that comment content is properly trimmed of whitespace"""
        # Test comment with leading/trailing whitespace
        content_with_whitespace = "  \t\n  This is a comment with whitespace  \t\n  "
        expected_content = "This is a comment with whitespace"
        
        result = interaction_service.add_comment(
            user_id=self.user1.user_id,
            post_id=self.post.post_id,
            content=content_with_whitespace
        )
        
        assert result['comment']['content'] == expected_content
        
        # Verify in database
        comments = interaction_service.get_post_comments(self.post.post_id)
        assert comments['comments'][0]['content'] == expected_content
    
    def test_interaction_count_consistency_after_errors(self):
        """Test that interaction counts remain consistent even after errors occur"""
        # Add some initial interactions
        interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        interaction_service.add_comment(
            self.user1.user_id, 
            self.post.post_id, 
            "Valid comment"
        )
        
        # Try to add invalid comments (should fail but not affect counts)
        try:
            interaction_service.add_comment(
                self.user1.user_id, 
                self.post.post_id, 
                ""  # Empty comment
            )
        except ValidationError:
            pass
        
        try:
            interaction_service.add_comment(
                self.user1.user_id, 
                "nonexistent_post", 
                "Comment on nonexistent post"
            )
        except NotFoundError:
            pass
        
        # Verify counts are still accurate
        likes = interaction_service.get_post_likes(self.post.post_id)
        comments = interaction_service.get_post_comments(self.post.post_id)
        
        assert int(likes['likes_count']) == 1
        assert int(comments['comments_count']) == 1
        
        # Verify database consistency
        all_interactions = Interaction.get_post_interactions(self.post.post_id)
        assert len(all_interactions) == 2  # 1 like + 1 comment
    
    def test_multiple_users_interaction_isolation(self):
        """Test that interactions from different users are properly isolated"""
        # User1 likes the post
        result1 = interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        assert result1['liked'] is True
        
        # User2 also likes the post
        result2 = interaction_service.toggle_like(self.user2.user_id, self.post.post_id)
        assert result2['liked'] is True
        
        # Both users should have liked status
        user1_liked = interaction_service.get_user_like_status(
            self.user1.user_id, self.post.post_id
        )
        user2_liked = interaction_service.get_user_like_status(
            self.user2.user_id, self.post.post_id
        )
        assert user1_liked is True
        assert user2_liked is True
        
        # Total likes should be 2
        likes = interaction_service.get_post_likes(self.post.post_id)
        assert int(likes['likes_count']) == 2
        
        # User1 unlikes the post
        result3 = interaction_service.toggle_like(self.user1.user_id, self.post.post_id)
        assert result3['liked'] is False
        
        # User1 should not be liked, User2 should still be liked
        user1_liked = interaction_service.get_user_like_status(
            self.user1.user_id, self.post.post_id
        )
        user2_liked = interaction_service.get_user_like_status(
            self.user2.user_id, self.post.post_id
        )
        assert user1_liked is False
        assert user2_liked is True
        
        # Total likes should be 1
        likes = interaction_service.get_post_likes(self.post.post_id)
        assert int(likes['likes_count']) == 1

if __name__ == '__main__':
    pytest.main([__file__, '-v'])