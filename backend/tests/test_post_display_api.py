"""
Unit tests for post display functionality API endpoints
Tests for requirements 3.1, 3.2, 3.3 - timeline retrieval, post details, and error handling
"""
import pytest
import json
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import app
from shared.error_handler import ValidationError

class TestPostDisplayAPI:
    """Test cases for post display API endpoints"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.app = app.test_client()
        self.app.testing = True
        
        # Mock post data
        self.mock_post_data = {
            'post_id': 'test-post-123',
            'user_id': 'test-user-123',
            'image_key': 'images/test.jpg',
            'image_url': 'https://example.com/test.jpg',
            'caption': 'Test caption',
            'likes_count': 5,
            'comments_count': 2,
            'created_at': '2024-01-01T00:00:00',
            'user': {
                'user_id': 'test-user-123',
                'username': 'testuser',
                'profile_image': 'profile.jpg'
            }
        }
        
        # Mock timeline response
        self.mock_timeline_response = {
            'posts': [self.mock_post_data],
            'pagination': {
                'limit': 20,
                'next_key': None,
                'has_more': False
            }
        }
        
        # Mock user posts response
        self.mock_user_posts_response = {
            'posts': [self.mock_post_data],
            'user': {
                'user_id': 'test-user-123',
                'username': 'testuser',
                'profile_image': 'profile.jpg',
                'bio': 'Test bio'
            },
            'pagination': {
                'limit': 20,
                'next_key': None,
                'has_more': False
            }
        }

    @patch('shared.post_service.post_service')
    def test_get_timeline_posts_success(self, mock_post_service):
        """Test successful timeline posts retrieval - Requirement 3.1"""
        # Setup mock
        mock_post_service.get_timeline_posts.return_value = self.mock_timeline_response
        
        # Make request
        response = self.app.get('/api/posts')
        
        # Verify response
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'posts' in data
        assert 'pagination' in data
        assert len(data['posts']) == 1
        assert data['posts'][0]['post_id'] == 'test-post-123'
        assert data['posts'][0]['user']['username'] == 'testuser'
        assert data['pagination']['limit'] == 20
        assert data['pagination']['has_more'] is False
        
        # Verify service call
        mock_post_service.get_timeline_posts.assert_called_once_with(limit=20, last_key=None)

    @patch('shared.post_service.post_service')
    def test_get_timeline_posts_with_pagination(self, mock_post_service):
        """Test timeline posts retrieval with pagination parameters - Requirement 3.4"""
        # Setup mock with pagination
        paginated_response = {
            'posts': [self.mock_post_data],
            'pagination': {
                'limit': 10,
                'next_key': 'next-key-123',
                'has_more': True
            }
        }
        mock_post_service.get_timeline_posts.return_value = paginated_response
        
        # Make request with pagination parameters
        response = self.app.get('/api/posts?limit=10&last_key=last-key-456')
        
        # Verify response
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['pagination']['limit'] == 10
        assert data['pagination']['next_key'] == 'next-key-123'
        assert data['pagination']['has_more'] is True
        
        # Verify service call with correct parameters
        mock_post_service.get_timeline_posts.assert_called_once_with(limit=10, last_key='last-key-456')

    @patch('shared.post_service.post_service')
    def test_get_timeline_posts_empty_result(self, mock_post_service):
        """Test timeline posts retrieval when no posts exist"""
        # Setup mock with empty result
        empty_response = {
            'posts': [],
            'pagination': {
                'limit': 20,
                'next_key': None,
                'has_more': False
            }
        }
        mock_post_service.get_timeline_posts.return_value = empty_response
        
        # Make request
        response = self.app.get('/api/posts')
        
        # Verify response
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['posts'] == []
        assert data['pagination']['has_more'] is False

    @patch('shared.post_service.post_service')
    def test_get_timeline_posts_service_error(self, mock_post_service):
        """Test timeline posts retrieval when service throws error"""
        # Setup mock to raise exception
        mock_post_service.get_timeline_posts.side_effect = Exception("Database error")
        
        # Make request
        response = self.app.get('/api/posts')
        
        # Verify error response
        assert response.status_code == 500
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert 'タイムラインの取得に失敗しました' in data['error']['message']

    @patch('shared.post_service.post_service')
    def test_get_post_by_id_success(self, mock_post_service):
        """Test successful post retrieval by ID - Requirement 3.2"""
        # Setup mock
        mock_post_service.get_post_by_id.return_value = self.mock_post_data
        
        # Make request
        response = self.app.get('/api/posts/test-post-123')
        
        # Verify response
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'post' in data
        assert data['post']['post_id'] == 'test-post-123'
        assert data['post']['caption'] == 'Test caption'
        assert data['post']['likes_count'] == 5
        assert data['post']['comments_count'] == 2
        assert data['post']['user']['username'] == 'testuser'
        assert data['post']['image_url'] == 'https://example.com/test.jpg'
        
        # Verify service call
        mock_post_service.get_post_by_id.assert_called_once_with('test-post-123')

    @patch('shared.post_service.post_service')
    def test_get_post_by_id_not_found(self, mock_post_service):
        """Test post retrieval when post doesn't exist - Requirement 3.3"""
        # Setup mock to return None
        mock_post_service.get_post_by_id.return_value = None
        
        # Make request
        response = self.app.get('/api/posts/nonexistent-post')
        
        # Verify error response
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert '投稿が見つかりません' in data['error']['message']
        
        # Verify service call
        mock_post_service.get_post_by_id.assert_called_once_with('nonexistent-post')

    @patch('shared.post_service.post_service')
    def test_get_post_by_id_service_error(self, mock_post_service):
        """Test post retrieval when service throws error"""
        # Setup mock to raise exception
        mock_post_service.get_post_by_id.side_effect = Exception("Database error")
        
        # Make request
        response = self.app.get('/api/posts/test-post-123')
        
        # Verify error response
        assert response.status_code == 500
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert '投稿の取得に失敗しました' in data['error']['message']

    @patch('shared.post_service.post_service')
    def test_get_user_posts_success(self, mock_post_service):
        """Test successful user posts retrieval"""
        # Setup mock
        mock_post_service.get_user_posts.return_value = self.mock_user_posts_response
        
        # Make request
        response = self.app.get('/api/users/test-user-123/posts')
        
        # Verify response
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert 'posts' in data
        assert 'user' in data
        assert 'pagination' in data
        assert len(data['posts']) == 1
        assert data['posts'][0]['post_id'] == 'test-post-123'
        assert data['user']['username'] == 'testuser'
        assert data['user']['bio'] == 'Test bio'
        
        # Verify service call
        mock_post_service.get_user_posts.assert_called_once_with(
            user_id='test-user-123',
            limit=20,
            last_key=None
        )

    @patch('shared.post_service.post_service')
    def test_get_user_posts_with_pagination(self, mock_post_service):
        """Test user posts retrieval with pagination"""
        # Setup mock with pagination
        paginated_response = {
            'posts': [self.mock_post_data],
            'user': {
                'user_id': 'test-user-123',
                'username': 'testuser',
                'profile_image': 'profile.jpg',
                'bio': 'Test bio'
            },
            'pagination': {
                'limit': 5,
                'next_key': 'next-key-789',
                'has_more': True
            }
        }
        mock_post_service.get_user_posts.return_value = paginated_response
        
        # Make request with pagination parameters
        response = self.app.get('/api/users/test-user-123/posts?limit=5&last_key=last-key-abc')
        
        # Verify response
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['success'] is True
        assert data['pagination']['limit'] == 5
        assert data['pagination']['next_key'] == 'next-key-789'
        assert data['pagination']['has_more'] is True
        
        # Verify service call with correct parameters
        mock_post_service.get_user_posts.assert_called_once_with(
            user_id='test-user-123',
            limit=5,
            last_key='last-key-abc'
        )

    @patch('shared.post_service.post_service')
    def test_get_user_posts_user_not_found(self, mock_post_service):
        """Test user posts retrieval when user doesn't exist"""
        # Setup mock to raise ValidationError
        mock_post_service.get_user_posts.side_effect = ValidationError("ユーザーが見つかりません")
        
        # Make request
        response = self.app.get('/api/users/nonexistent-user/posts')
        
        # Verify error response
        assert response.status_code == 400
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert 'ユーザーが見つかりません' in data['error']['message']

    @patch('shared.post_service.post_service')
    def test_get_user_posts_service_error(self, mock_post_service):
        """Test user posts retrieval when service throws error"""
        # Setup mock to raise exception
        mock_post_service.get_user_posts.side_effect = Exception("Database error")
        
        # Make request
        response = self.app.get('/api/users/test-user-123/posts')
        
        # Verify error response
        assert response.status_code == 500
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data
        assert 'ユーザー投稿の取得に失敗しました' in data['error']['message']

    def test_get_timeline_posts_invalid_limit_parameter(self):
        """Test timeline posts with invalid limit parameter"""
        # Make request with invalid limit (should be handled gracefully)
        response = self.app.get('/api/posts?limit=invalid')
        
        # Should return 500 error due to int() conversion failure
        assert response.status_code == 500
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data

    def test_get_user_posts_invalid_limit_parameter(self):
        """Test user posts with invalid limit parameter"""
        # Make request with invalid limit (should be handled gracefully)
        response = self.app.get('/api/users/test-user-123/posts?limit=invalid')
        
        # Should return 500 error due to int() conversion failure
        assert response.status_code == 500
        data = json.loads(response.data)
        
        assert data['success'] is False
        assert 'error' in data

    @patch('shared.post_service.post_service')
    def test_pagination_boundary_conditions(self, mock_post_service):
        """Test pagination with boundary conditions"""
        # Test with limit=0 (should be normalized to default)
        mock_post_service.get_timeline_posts.return_value = self.mock_timeline_response
        
        response = self.app.get('/api/posts?limit=0')
        assert response.status_code == 200
        
        # Verify service was called (limit normalization happens in service)
        mock_post_service.get_timeline_posts.assert_called_with(limit=0, last_key=None)

    @patch('shared.post_service.post_service')
    def test_timeline_posts_large_limit(self, mock_post_service):
        """Test timeline posts with very large limit"""
        # Test with limit=1000 (should be normalized to max in service)
        mock_post_service.get_timeline_posts.return_value = self.mock_timeline_response
        
        response = self.app.get('/api/posts?limit=1000')
        assert response.status_code == 200
        
        # Verify service was called (limit normalization happens in service)
        mock_post_service.get_timeline_posts.assert_called_with(limit=1000, last_key=None)

if __name__ == '__main__':
    pytest.main([__file__])