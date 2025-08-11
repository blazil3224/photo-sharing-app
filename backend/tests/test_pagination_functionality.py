"""
Unit tests for pagination functionality in post display
Tests for requirement 3.4 - pagination behavior verification
"""
import pytest
import json
import sys
import os
from unittest.mock import Mock, patch

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.post_service import post_service
from shared.models import Post
from shared.error_handler import ValidationError

class TestPaginationFunctionality:
    """Test cases for pagination functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        # Create mock posts for pagination testing
        self.mock_posts = []
        for i in range(5):
            mock_post = Mock()
            mock_post.post_id = f'post-{i}'
            mock_post.user_id = f'user-{i}'
            mock_post.image_key = f'images/test-{i}.jpg'
            mock_post.caption = f'Test caption {i}'
            mock_post.likes_count = i
            mock_post.comments_count = i
            mock_post.created_at = f'2024-01-0{i+1}T00:00:00'
            mock_post.to_dict.return_value = {
                'post_id': mock_post.post_id,
                'user_id': mock_post.user_id,
                'image_key': mock_post.image_key,
                'caption': mock_post.caption,
                'likes_count': mock_post.likes_count,
                'comments_count': mock_post.comments_count,
                'created_at': mock_post.created_at
            }
            self.mock_posts.append(mock_post)

    @patch('shared.post_service.Post')
    def test_timeline_pagination_first_page(self, mock_post_class):
        """Test first page of timeline pagination"""
        # Setup mock to return first page with has_more=True
        mock_result = {
            'posts': self.mock_posts[:3],
            'last_evaluated_key': {'post_id': 'post-2', 'created_at': '2024-01-03T00:00:00'},
            'has_more': True
        }
        mock_post_class.get_timeline_posts.return_value = mock_result
        
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            # Setup enrich mock to return enriched data
            mock_enrich.side_effect = lambda post: {
                'post_id': post.post_id,
                'user': {'username': f'user-{post.post_id.split("-")[1]}'},
                'image_url': f'https://example.com/{post.image_key}'
            }
            
            # Test first page request
            result = post_service.get_timeline_posts(limit=3)
            
            # Verify pagination structure
            assert 'posts' in result
            assert 'pagination' in result
            assert len(result['posts']) == 3
            assert result['pagination']['limit'] == 3
            assert result['pagination']['has_more'] is True
            assert result['pagination']['next_key'] is not None
            
            # Verify next_key is properly formatted JSON
            next_key = result['pagination']['next_key']
            parsed_key = json.loads(next_key)
            assert 'post_id' in parsed_key
            assert 'created_at' in parsed_key
            
            # Verify service call
            mock_post_class.get_timeline_posts.assert_called_once_with(limit=3, last_key=None)

    @patch('shared.post_service.Post')
    def test_timeline_pagination_subsequent_page(self, mock_post_class):
        """Test subsequent page of timeline pagination"""
        # Setup mock to return subsequent page
        mock_result = {
            'posts': self.mock_posts[3:5],
            'last_evaluated_key': None,  # No more pages
            'has_more': False
        }
        mock_post_class.get_timeline_posts.return_value = mock_result
        
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            mock_enrich.side_effect = lambda post: {
                'post_id': post.post_id,
                'user': {'username': f'user-{post.post_id.split("-")[1]}'},
                'image_url': f'https://example.com/{post.image_key}'
            }
            
            # Test subsequent page request with last_key
            last_key = json.dumps({'post_id': 'post-2', 'created_at': '2024-01-03T00:00:00'})
            result = post_service.get_timeline_posts(limit=3, last_key=last_key)
            
            # Verify pagination structure
            assert len(result['posts']) == 2
            assert result['pagination']['has_more'] is False
            assert result['pagination']['next_key'] is None
            
            # Verify service call with parsed last_key
            mock_post_class.get_timeline_posts.assert_called_once_with(
                limit=3, 
                last_key={'post_id': 'post-2', 'created_at': '2024-01-03T00:00:00'}
            )

    @patch('shared.post_service.Post')
    def test_timeline_pagination_invalid_last_key(self, mock_post_class):
        """Test timeline pagination with invalid last_key format"""
        # Setup mock to return posts
        mock_result = {
            'posts': self.mock_posts[:3],
            'last_evaluated_key': None,
            'has_more': False
        }
        mock_post_class.get_timeline_posts.return_value = mock_result
        
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            mock_enrich.side_effect = lambda post: {
                'post_id': post.post_id,
                'user': {'username': f'user-{post.post_id.split("-")[1]}'},
                'image_url': f'https://example.com/{post.image_key}'
            }
            
            # Test with invalid JSON last_key
            result = post_service.get_timeline_posts(limit=3, last_key='invalid-json')
            
            # Should handle gracefully and treat as first page
            assert len(result['posts']) == 3
            
            # Verify service was called with None (invalid key ignored)
            mock_post_class.get_timeline_posts.assert_called_once_with(limit=3, last_key=None)

    @patch('shared.post_service.User')
    @patch('shared.post_service.Post')
    def test_user_posts_pagination_first_page(self, mock_post_class, mock_user_class):
        """Test first page of user posts pagination"""
        # Setup user mock
        mock_user = Mock()
        mock_user.user_id = 'test-user-123'
        mock_user.username = 'testuser'
        mock_user.profile_image = 'profile.jpg'
        mock_user.bio = 'Test bio'
        mock_user_class.get_by_id.return_value = mock_user
        
        # Setup posts mock
        mock_result = {
            'posts': self.mock_posts[:2],
            'last_evaluated_key': {'user_id': 'test-user-123', 'created_at': '2024-01-02T00:00:00'},
            'has_more': True
        }
        mock_post_class.get_user_posts.return_value = mock_result
        
        with patch('shared.post_service.image_service') as mock_image_service:
            mock_image_service.get_image_url.return_value = 'https://example.com/image.jpg'
            
            # Test first page request
            result = post_service.get_user_posts(user_id='test-user-123', limit=2)
            
            # Verify pagination structure
            assert 'posts' in result
            assert 'user' in result
            assert 'pagination' in result
            assert len(result['posts']) == 2
            assert result['pagination']['limit'] == 2
            assert result['pagination']['has_more'] is True
            assert result['pagination']['next_key'] is not None
            
            # Verify user data is included
            assert result['user']['username'] == 'testuser'
            assert result['user']['bio'] == 'Test bio'
            
            # Verify service call
            mock_post_class.get_user_posts.assert_called_once_with(
                user_id='test-user-123', limit=2, last_key=None
            )

    @patch('shared.post_service.User')
    @patch('shared.post_service.Post')
    def test_user_posts_pagination_last_page(self, mock_post_class, mock_user_class):
        """Test last page of user posts pagination"""
        # Setup user mock
        mock_user = Mock()
        mock_user.user_id = 'test-user-123'
        mock_user.username = 'testuser'
        mock_user.profile_image = 'profile.jpg'
        mock_user.bio = 'Test bio'
        mock_user_class.get_by_id.return_value = mock_user
        
        # Setup posts mock for last page
        mock_result = {
            'posts': [self.mock_posts[4]],  # Only one post left
            'last_evaluated_key': None,
            'has_more': False
        }
        mock_post_class.get_user_posts.return_value = mock_result
        
        with patch('shared.post_service.image_service') as mock_image_service:
            mock_image_service.get_image_url.return_value = 'https://example.com/image.jpg'
            
            # Test last page request
            last_key = json.dumps({'user_id': 'test-user-123', 'created_at': '2024-01-04T00:00:00'})
            result = post_service.get_user_posts(user_id='test-user-123', limit=2, last_key=last_key)
            
            # Verify pagination structure
            assert len(result['posts']) == 1
            assert result['pagination']['has_more'] is False
            assert result['pagination']['next_key'] is None
            
            # Verify service call with parsed last_key
            mock_post_class.get_user_posts.assert_called_once_with(
                user_id='test-user-123',
                limit=2,
                last_key={'user_id': 'test-user-123', 'created_at': '2024-01-04T00:00:00'}
            )

    def test_pagination_limit_validation(self):
        """Test pagination limit validation and normalization"""
        # Test with various limit values
        test_cases = [
            (0, 20),    # Below minimum should normalize to default
            (1, 1),     # Valid minimum
            (25, 25),   # Valid middle value
            (50, 50),   # Valid maximum
            (100, 50),  # Above maximum should normalize to max
            (-5, 20),   # Negative should normalize to default
        ]
        
        for input_limit, expected_limit in test_cases:
            with patch('shared.post_service.Post') as mock_post_class:
                mock_result = {
                    'posts': [],
                    'last_evaluated_key': None,
                    'has_more': False
                }
                mock_post_class.get_timeline_posts.return_value = mock_result
                
                result = post_service.get_timeline_posts(limit=input_limit)
                
                # Verify the limit was normalized correctly
                assert result['pagination']['limit'] == expected_limit

    @patch('shared.post_service.Post')
    def test_pagination_empty_result_set(self, mock_post_class):
        """Test pagination behavior with empty result set"""
        # Setup mock to return empty result
        mock_result = {
            'posts': [],
            'last_evaluated_key': None,
            'has_more': False
        }
        mock_post_class.get_timeline_posts.return_value = mock_result
        
        # Test pagination with empty results
        result = post_service.get_timeline_posts(limit=20)
        
        # Verify pagination structure is still correct
        assert 'posts' in result
        assert 'pagination' in result
        assert result['posts'] == []
        assert result['pagination']['has_more'] is False
        assert result['pagination']['next_key'] is None
        assert result['pagination']['limit'] == 20

    @patch('shared.post_service.Post')
    def test_pagination_json_serialization(self, mock_post_class):
        """Test that pagination keys are properly JSON serialized"""
        # Setup mock with complex last_evaluated_key
        complex_key = {
            'post_id': 'post-123',
            'created_at': '2024-01-01T12:30:45.123Z',
            'user_id': 'user-456'
        }
        mock_result = {
            'posts': self.mock_posts[:1],
            'last_evaluated_key': complex_key,
            'has_more': True
        }
        mock_post_class.get_timeline_posts.return_value = mock_result
        
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            mock_enrich.return_value = {
                'post_id': 'post-0',
                'user': {'username': 'user-0'},
                'image_url': 'https://example.com/image.jpg'
            }
            
            result = post_service.get_timeline_posts(limit=1)
            
            # Verify next_key is valid JSON
            next_key = result['pagination']['next_key']
            assert next_key is not None
            
            # Verify it can be parsed back to original structure
            parsed_key = json.loads(next_key)
            assert parsed_key == complex_key

    @patch('shared.post_service.Post')
    def test_pagination_key_round_trip(self, mock_post_class):
        """Test that pagination keys work correctly in round-trip scenarios"""
        # First request - get initial page
        first_key = {'post_id': 'post-1', 'created_at': '2024-01-01T00:00:00'}
        mock_result_1 = {
            'posts': self.mock_posts[:2],
            'last_evaluated_key': first_key,
            'has_more': True
        }
        mock_post_class.get_timeline_posts.return_value = mock_result_1
        
        with patch.object(post_service, '_enrich_post_data') as mock_enrich:
            mock_enrich.side_effect = lambda post: {
                'post_id': post.post_id,
                'user': {'username': f'user-{post.post_id.split("-")[1]}'},
                'image_url': f'https://example.com/{post.image_key}'
            }
            
            # First request
            result_1 = post_service.get_timeline_posts(limit=2)
            next_key = result_1['pagination']['next_key']
            
            # Reset mock for second request
            mock_post_class.reset_mock()
            mock_result_2 = {
                'posts': self.mock_posts[2:4],
                'last_evaluated_key': None,
                'has_more': False
            }
            mock_post_class.get_timeline_posts.return_value = mock_result_2
            
            # Second request using next_key from first request
            result_2 = post_service.get_timeline_posts(limit=2, last_key=next_key)
            
            # Verify second request used the correct parsed key
            mock_post_class.get_timeline_posts.assert_called_once_with(
                limit=2, last_key=first_key
            )
            
            # Verify second result structure
            assert len(result_2['posts']) == 2
            assert result_2['pagination']['has_more'] is False
            assert result_2['pagination']['next_key'] is None

if __name__ == '__main__':
    pytest.main([__file__])