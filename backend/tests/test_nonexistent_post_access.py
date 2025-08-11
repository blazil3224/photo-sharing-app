"""
Unit tests for non-existent post access scenarios
Tests for requirement 3.3 - proper error handling when posts don't exist
"""
import pytest
import json
import sys
import os
from unittest.mock import Mock, patch

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import app
from shared.post_service import post_service
from shared.error_handler import ValidationError

class TestNonexistentPostAccess:
    """Test cases for non-existent post access scenarios"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.app = app.test_client()
        self.app.testing = True

    @patch('shared.post_service.post_service')
    def test_get_nonexistent_post_by_id_api(self, mock_post_service):
        """Test API endpoint behavior when accessing non-existent post - Requirement 3.3"""
        # Setup mock to return None (post not found)
        mock_post_service.get_post_by_id.return_value = None
        
        # Make request for non-existent post
        response = self.app.get('/api/posts/nonexistent-post-123')
        
        # Verify error response
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert '投稿が見つかりません' in data['error']['message']
        assert data['error']['code'] == 'VALIDATION_ERROR'
        
        # Verify service was called with correct post ID
        mock_post_service.get_post_by_id.assert_called_once_with('nonexistent-post-123')

    @patch('shared.post_service.Post')
    def test_get_nonexistent_post_service_layer(self, mock_post_class):
        """Test service layer behavior when post doesn't exist"""
        # Setup mock to return None
        mock_post_class.get_by_id.return_value = None
        
        # Test service method
        result = post_service.get_post_by_id('nonexistent-post-456')
        
        # Verify service returns None for non-existent post
        assert result is None
        
        # Verify database was queried
        mock_post_class.get_by_id.assert_called_once_with('nonexistent-post-456')

    def test_get_post_with_empty_id(self):
        """Test post retrieval with empty post ID"""
        # Test with empty string
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_by_id('')
        
        assert '投稿IDが必要です' in str(exc_info.value)
        
        # Test with None
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_by_id(None)
        
        assert '投稿IDが必要です' in str(exc_info.value)

    @patch('shared.post_service.post_service')
    def test_get_post_empty_id_api(self, mock_post_service):
        """Test API endpoint with empty post ID"""
        # Setup mock to raise ValidationError
        mock_post_service.get_post_by_id.side_effect = ValidationError("投稿IDが必要です")
        
        # Make request with empty post ID (this would be handled by Flask routing)
        # Instead, test with a post ID that triggers validation error
        response = self.app.get('/api/posts/ ')  # Space character as ID
        
        # Verify error response
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data

    @patch('shared.post_service.Post')
    @patch('shared.post_service.User')
    def test_get_post_with_missing_user(self, mock_user_class, mock_post_class):
        """Test post retrieval when associated user doesn't exist"""
        # Setup post mock
        mock_post = Mock()
        mock_post.post_id = 'test-post-123'
        mock_post.user_id = 'nonexistent-user-456'
        mock_post.image_key = 'images/test.jpg'
        mock_post.caption = 'Test caption'
        mock_post.to_dict.return_value = {
            'post_id': 'test-post-123',
            'user_id': 'nonexistent-user-456',
            'image_key': 'images/test.jpg',
            'caption': 'Test caption'
        }
        
        # Setup mocks - post exists but user doesn't
        mock_post_class.get_by_id.return_value = mock_post
        mock_user_class.get_by_id.return_value = None  # User not found
        
        # Test service method
        result = post_service.get_post_by_id('test-post-123')
        
        # Should return None when user is missing (orphaned post)
        assert result is None
        
        # Verify both post and user were queried
        mock_post_class.get_by_id.assert_called_once_with('test-post-123')
        mock_user_class.get_by_id.assert_called_once_with('nonexistent-user-456')

    @patch('shared.post_service.post_service')
    def test_get_user_posts_nonexistent_user_api(self, mock_post_service):
        """Test API endpoint for posts of non-existent user"""
        # Setup mock to raise ValidationError
        mock_post_service.get_user_posts.side_effect = ValidationError("ユーザーが見つかりません")
        
        # Make request for non-existent user's posts
        response = self.app.get('/api/users/nonexistent-user-789/posts')
        
        # Verify error response
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert 'ユーザーが見つかりません' in data['error']['message']
        
        # Verify service was called
        mock_post_service.get_user_posts.assert_called_once_with(
            user_id='nonexistent-user-789',
            limit=20,
            last_key=None
        )

    @patch('shared.post_service.User')
    def test_get_user_posts_nonexistent_user_service(self, mock_user_class):
        """Test service layer behavior when user doesn't exist"""
        # Setup mock to return None (user not found)
        mock_user_class.get_by_id.return_value = None
        
        # Test service method
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_user_posts('nonexistent-user-999')
        
        assert 'ユーザーが見つかりません' in str(exc_info.value)
        
        # Verify user lookup was attempted
        mock_user_class.get_by_id.assert_called_once_with('nonexistent-user-999')

    @patch('shared.post_service.Post')
    def test_delete_nonexistent_post(self, mock_post_class):
        """Test deletion of non-existent post"""
        # Setup mock to return None (post not found)
        mock_post_class.get_by_id.return_value = None
        
        # Test service method
        with pytest.raises(ValidationError) as exc_info:
            post_service.delete_post('nonexistent-post-111', 'test-user-123')
        
        assert '投稿が見つかりません' in str(exc_info.value)
        
        # Verify post lookup was attempted
        mock_post_class.get_by_id.assert_called_once_with('nonexistent-post-111')

    @patch('shared.post_service.Post')
    def test_get_post_stats_nonexistent_post(self, mock_post_class):
        """Test getting statistics for non-existent post"""
        # Setup mock to return None (post not found)
        mock_post_class.get_by_id.return_value = None
        
        # Test service method
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_stats('nonexistent-post-222')
        
        assert '投稿が見つかりません' in str(exc_info.value)
        
        # Verify post lookup was attempted
        mock_post_class.get_by_id.assert_called_once_with('nonexistent-post-222')

    @patch('shared.post_service.Post')
    def test_validate_ownership_nonexistent_post(self, mock_post_class):
        """Test ownership validation for non-existent post"""
        # Setup mock to return None (post not found)
        mock_post_class.get_by_id.return_value = None
        
        # Test service method
        result = post_service.validate_post_ownership('nonexistent-post-333', 'test-user-123')
        
        # Should return False for non-existent post
        assert result is False
        
        # Verify post lookup was attempted
        mock_post_class.get_by_id.assert_called_once_with('nonexistent-post-333')

    @patch('shared.post_service.Post')
    def test_timeline_posts_with_orphaned_posts(self, mock_post_class):
        """Test timeline retrieval when some posts have missing users"""
        # Create mock posts, some with valid users, some orphaned
        mock_posts = []
        for i in range(3):
            mock_post = Mock()
            mock_post.post_id = f'post-{i}'
            mock_post.user_id = f'user-{i}'
            mock_post.image_key = f'images/test-{i}.jpg'
            mock_post.to_dict.return_value = {
                'post_id': f'post-{i}',
                'user_id': f'user-{i}',
                'image_key': f'images/test-{i}.jpg'
            }
            mock_posts.append(mock_post)
        
        # Setup mock to return posts
        mock_result = {
            'posts': mock_posts,
            'last_evaluated_key': None,
            'has_more': False
        }
        mock_post_class.get_timeline_posts.return_value = mock_result
        
        # Mock _enrich_post_data to simulate some posts having missing users
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            # First post has valid user, second is orphaned, third has valid user
            mock_enrich.side_effect = [
                {'post_id': 'post-0', 'user': {'username': 'user-0'}},  # Valid
                None,  # Orphaned post (user not found)
                {'post_id': 'post-2', 'user': {'username': 'user-2'}}   # Valid
            ]
            
            # Test timeline retrieval
            result = post_service.get_timeline_posts(limit=10)
            
            # Should only include posts with valid users (orphaned posts filtered out)
            assert len(result['posts']) == 2
            assert result['posts'][0]['post_id'] == 'post-0'
            assert result['posts'][1]['post_id'] == 'post-2'
            
            # Verify all posts were processed
            assert mock_enrich.call_count == 3

    @patch('shared.post_service.post_service')
    def test_api_error_response_format(self, mock_post_service):
        """Test that API returns properly formatted error responses"""
        # Setup mock to raise ValidationError
        mock_post_service.get_post_by_id.side_effect = ValidationError("投稿が見つかりません")
        
        # Make request
        response = self.app.get('/api/posts/test-post-123')
        
        # Verify error response format
        assert response.status_code == 400
        data = json.loads(response.data)
        
        # Check required error response fields
        assert 'success' in data
        assert data['success'] is False
        assert 'error' in data
        assert 'code' in data['error']
        assert 'message' in data['error']
        assert data['error']['code'] == 'VALIDATION_ERROR'
        assert data['error']['message'] == '投稿が見つかりません'

    @patch('shared.post_service.post_service')
    def test_api_generic_error_handling(self, mock_post_service):
        """Test API handling of generic exceptions"""
        # Setup mock to raise generic exception
        mock_post_service.get_post_by_id.side_effect = Exception("Database connection failed")
        
        # Make request
        response = self.app.get('/api/posts/test-post-123')
        
        # Verify error response
        assert response.status_code == 500
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert '投稿の取得に失敗しました' in data['error']['message']

    def test_malformed_post_id_patterns(self):
        """Test various malformed post ID patterns"""
        # Test empty string validation
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_by_id('')
        assert '投稿IDが必要です' in str(exc_info.value)
        
        # Test None validation
        with pytest.raises(ValidationError) as exc_info:
            post_service.get_post_by_id(None)
        assert '投稿IDが必要です' in str(exc_info.value)

if __name__ == '__main__':
    pytest.main([__file__])