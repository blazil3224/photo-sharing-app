"""
Tests for post service functionality
"""
import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.post_service import post_service
from shared.models import Post, User
from shared.error_handler import ValidationError, AuthenticationError

class TestPostService:
    """Test cases for PostService"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_user = Mock()
        self.mock_user.user_id = 'test-user-123'
        self.mock_user.username = 'testuser'
        self.mock_user.profile_image = 'profile.jpg'
        
        self.mock_post = Mock()
        self.mock_post.post_id = 'test-post-123'
        self.mock_post.user_id = 'test-user-123'
        self.mock_post.image_key = 'images/test.jpg'
        self.mock_post.caption = 'Test caption'
        self.mock_post.likes_count = 0
        self.mock_post.comments_count = 0
        self.mock_post.created_at = '2024-01-01T00:00:00'
        
        # Mock the to_dict method
        self.mock_post.to_dict.return_value = {
            'post_id': self.mock_post.post_id,
            'user_id': self.mock_post.user_id,
            'image_key': self.mock_post.image_key,
            'caption': self.mock_post.caption,
            'likes_count': self.mock_post.likes_count,
            'comments_count': self.mock_post.comments_count,
            'created_at': self.mock_post.created_at
        }
    
    @patch('shared.post_service.User')
    @patch('shared.post_service.Post')
    @patch('shared.post_service.image_service')
    def test_create_post_success(self, mock_image_service, mock_post_class, mock_user_class):
        """Test successful post creation"""
        # Setup mocks
        mock_user_class.get_by_id.return_value = self.mock_user
        mock_post_instance = Mock()
        mock_post_instance.post_id = 'new-post-123'
        mock_post_instance.to_dict.return_value = {
            'post_id': 'new-post-123',
            'user_id': 'test-user-123',
            'image_key': 'images/test.jpg',
            'caption': 'Test caption',
            'likes_count': 0,
            'comments_count': 0,
            'created_at': '2024-01-01T00:00:00'
        }
        mock_post_class.return_value = mock_post_instance
        mock_image_service.get_image_url.return_value = 'https://example.com/image.jpg'
        
        # Test post creation
        result = post_service.create_post(
            user_id='test-user-123',
            image_key='images/test.jpg',
            caption='Test caption'
        )
        
        # Verify results
        assert result is not None
        assert result['post_id'] == 'new-post-123'
        assert result['user_id'] == 'test-user-123'
        assert result['image_key'] == 'images/test.jpg'
        assert result['caption'] == 'Test caption'
        assert result['image_url'] == 'https://example.com/image.jpg'
        assert 'user' in result
        assert result['user']['username'] == 'testuser'
        
        # Verify method calls
        mock_user_class.get_by_id.assert_called_once_with('test-user-123')
        mock_post_class.assert_called_once()
        mock_post_instance.save.assert_called_once()
        mock_image_service.get_image_url.assert_called_once_with('images/test.jpg')
    
    def test_create_post_missing_user_id(self):
        """Test post creation with missing user ID"""
        with pytest.raises(ValidationError) as exc_info:
            post_service.create_post(
                user_id='',
                image_key='images/test.jpg',
                caption='Test caption'
            )
        
        assert 'ユーザーIDが必要です' in str(exc_info.value)
    
    def test_create_post_missing_image_key(self):
        """Test post creation with missing image key"""
        with pytest.raises(ValidationError) as exc_info:
            post_service.create_post(
                user_id='test-user-123',
                image_key='',
                caption='Test caption'
            )
        
        assert '画像キーが必要です' in str(exc_info.value)
    
    @patch('shared.post_service.User')
    def test_create_post_user_not_found(self, mock_user_class):
        """Test post creation when user doesn't exist"""
        mock_user_class.get_by_id.return_value = None
        
        with pytest.raises(ValidationError) as exc_info:
            post_service.create_post(
                user_id='nonexistent-user',
                image_key='images/test.jpg',
                caption='Test caption'
            )
        
        assert 'ユーザーが見つかりません' in str(exc_info.value)
    
    @patch('shared.post_service.User')
    @patch('shared.post_service.Post')
    @patch('shared.post_service.image_service')
    def test_get_post_by_id_success(self, mock_image_service, mock_post_class, mock_user_class):
        """Test successful post retrieval by ID"""
        # Setup mocks
        mock_post_class.get_by_id.return_value = self.mock_post
        mock_user_class.get_by_id.return_value = self.mock_user
        mock_image_service.get_image_url.return_value = 'https://example.com/image.jpg'
        
        # Test post retrieval
        result = post_service.get_post_by_id('test-post-123')
        
        # Verify results
        assert result is not None
        assert result['post_id'] == 'test-post-123'
        assert result['image_url'] == 'https://example.com/image.jpg'
        assert 'user' in result
        assert result['user']['username'] == 'testuser'
        
        # Verify method calls
        mock_post_class.get_by_id.assert_called_once_with('test-post-123')
        mock_user_class.get_by_id.assert_called_once_with('test-user-123')
        mock_image_service.get_image_url.assert_called_once_with('images/test.jpg')
    
    @patch('shared.post_service.Post')
    def test_get_post_by_id_not_found(self, mock_post_class):
        """Test post retrieval when post doesn't exist"""
        mock_post_class.get_by_id.return_value = None
        
        result = post_service.get_post_by_id('nonexistent-post')
        
        assert result is None
        mock_post_class.get_by_id.assert_called_once_with('nonexistent-post')
    
    def test_get_post_by_id_missing_id(self):
        """Test post retrieval with missing ID"""
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_by_id('')
        
        assert '投稿IDが必要です' in str(exc_info.value)
    
    @patch('shared.post_service.Post')
    def test_get_timeline_posts_success(self, mock_post_class):
        """Test successful timeline posts retrieval"""
        # Setup mocks
        mock_posts = [self.mock_post]
        mock_post_class.get_timeline_posts.return_value = mock_posts
        
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            mock_enrich.return_value = {
                'post_id': 'test-post-123',
                'image_url': 'https://example.com/image.jpg',
                'user': {'username': 'testuser'}
            }
            
            # Test timeline retrieval
            result = post_service.get_timeline_posts(limit=20)
            
            # Verify results
            assert 'posts' in result
            assert 'pagination' in result
            assert len(result['posts']) == 1
            assert result['pagination']['limit'] == 20
            assert result['pagination']['has_more'] is False
            
            # Verify method calls
            mock_post_class.get_timeline_posts.assert_called_once_with(limit=20, last_key=None)
            mock_enrich.assert_called_once_with(self.mock_post)
    
    @patch('shared.post_service.User')
    @patch('shared.post_service.Post')
    @patch('shared.post_service.image_service')
    def test_get_user_posts_success(self, mock_image_service, mock_post_class, mock_user_class):
        """Test successful user posts retrieval"""
        # Setup mocks
        mock_user_class.get_by_id.return_value = self.mock_user
        mock_posts = [self.mock_post]
        mock_post_class.get_user_posts.return_value = mock_posts
        mock_image_service.get_image_url.return_value = 'https://example.com/image.jpg'
        
        # Test user posts retrieval
        result = post_service.get_user_posts(user_id='test-user-123', limit=20)
        
        # Verify results
        assert 'posts' in result
        assert 'user' in result
        assert 'pagination' in result
        assert len(result['posts']) == 1
        assert result['user']['username'] == 'testuser'
        assert result['pagination']['limit'] == 20
        
        # Verify method calls
        mock_user_class.get_by_id.assert_called_once_with('test-user-123')
        mock_post_class.get_user_posts.assert_called_once_with(
            user_id='test-user-123', limit=20, last_key=None
        )
    
    @patch('shared.post_service.User')
    def test_get_user_posts_user_not_found(self, mock_user_class):
        """Test user posts retrieval when user doesn't exist"""
        mock_user_class.get_by_id.return_value = None
        
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_user_posts(user_id='nonexistent-user')
        
        assert 'ユーザーが見つかりません' in str(exc_info.value)
    
    @patch('shared.post_service.Post')
    @patch('shared.post_service.Interaction')
    def test_delete_post_success(self, mock_interaction_class, mock_post_class):
        """Test successful post deletion"""
        # Setup mocks
        mock_post_class.get_by_id.return_value = self.mock_post
        mock_interactions = [Mock(), Mock()]
        mock_interaction_class.get_post_interactions.return_value = mock_interactions
        
        # Test post deletion
        result = post_service.delete_post(post_id='test-post-123', user_id='test-user-123')
        
        # Verify results
        assert result is True
        
        # Verify method calls
        mock_post_class.get_by_id.assert_called_once_with('test-post-123')
        mock_interaction_class.get_post_interactions.assert_called_once_with('test-post-123')
        for interaction in mock_interactions:
            interaction.delete.assert_called_once()
        self.mock_post.delete.assert_called_once()
    
    @patch('shared.post_service.Post')
    def test_delete_post_not_found(self, mock_post_class):
        """Test post deletion when post doesn't exist"""
        mock_post_class.get_by_id.return_value = None
        
        with pytest.raises(ValidationError) as exc_info:
            post_service.delete_post(post_id='nonexistent-post', user_id='test-user-123')
        
        assert '投稿が見つかりません' in str(exc_info.value)
    
    @patch('shared.post_service.Post')
    def test_delete_post_unauthorized(self, mock_post_class):
        """Test post deletion by unauthorized user"""
        # Setup mock with different user ID
        mock_post = Mock()
        mock_post.user_id = 'different-user-123'
        mock_post_class.get_by_id.return_value = mock_post
        
        with pytest.raises(AuthenticationError) as exc_info:
            post_service.delete_post(post_id='test-post-123', user_id='test-user-123')
        
        assert 'この投稿を削除する権限がありません' in str(exc_info.value)
    
    @patch('shared.post_service.Post')
    def test_validate_post_ownership_success(self, mock_post_class):
        """Test successful post ownership validation"""
        mock_post_class.get_by_id.return_value = self.mock_post
        
        result = post_service.validate_post_ownership(
            post_id='test-post-123',
            user_id='test-user-123'
        )
        
        assert result is True
        mock_post_class.get_by_id.assert_called_once_with('test-post-123')
    
    @patch('shared.post_service.Post')
    def test_validate_post_ownership_failure(self, mock_post_class):
        """Test post ownership validation failure"""
        mock_post = Mock()
        mock_post.user_id = 'different-user-123'
        mock_post_class.get_by_id.return_value = mock_post
        
        result = post_service.validate_post_ownership(
            post_id='test-post-123',
            user_id='test-user-123'
        )
        
        assert result is False
    
    @patch('shared.post_service.Post')
    def test_get_post_stats_success(self, mock_post_class):
        """Test successful post statistics retrieval"""
        mock_post_class.get_by_id.return_value = self.mock_post
        
        result = post_service.get_post_stats('test-post-123')
        
        assert result == {
            'likes_count': 0,
            'comments_count': 0
        }
        mock_post_class.get_by_id.assert_called_once_with('test-post-123')
    
    @patch('shared.post_service.Post')
    def test_get_post_stats_not_found(self, mock_post_class):
        """Test post statistics retrieval when post doesn't exist"""
        mock_post_class.get_by_id.return_value = None
        
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_stats('nonexistent-post')
        
        assert '投稿が見つかりません' in str(exc_info.value)

if __name__ == '__main__':
    pytest.main([__file__])