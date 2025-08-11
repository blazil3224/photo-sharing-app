"""
Unit tests for authentication functionality
Comprehensive test suite covering all authentication scenarios including:
- AuthService class methods
- API endpoints (register, login, logout, me, refresh)
- Authentication decorators
- DynamoDB operations with mocks
- Error handling and edge cases
"""
import unittest
from unittest.mock import patch, MagicMock, Mock
import json
import jwt
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError

# Import the app and auth service
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from shared.auth import AuthService, auth_service
from shared.models import User
from shared.error_handler import ValidationError, AuthenticationError, DuplicateError


class TestAuthService(unittest.TestCase):
    """Test cases for AuthService class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.auth_service = AuthService(secret_key='test-secret-key')
        self.test_user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpassword123'
        }
        self.mock_user_id = 'test-user-id-12345'
    
    def test_hash_password(self):
        """Test password hashing"""
        password = 'testpassword123'
        hashed = self.auth_service.hash_password(password)
        
        # Check that hash is different from original password
        self.assertNotEqual(password, hashed)
        self.assertTrue(isinstance(hashed, str))
        self.assertTrue(len(hashed) > 0)
    
    def test_verify_password(self):
        """Test password verification"""
        password = 'testpassword123'
        hashed = self.auth_service.hash_password(password)
        
        # Correct password should verify
        self.assertTrue(self.auth_service.verify_password(password, hashed))
        
        # Wrong password should not verify
        self.assertFalse(self.auth_service.verify_password('wrongpassword', hashed))
    
    def test_generate_token(self):
        """Test JWT token generation"""
        user_id = 'test-user-id'
        username = 'testuser'
        
        token = self.auth_service.generate_token(user_id, username)
        
        # Verify token structure
        self.assertTrue(isinstance(token, str))
        self.assertTrue(len(token) > 0)
        
        # Decode and verify payload
        payload = jwt.decode(token, 'test-secret-key', algorithms=['HS256'])
        self.assertEqual(payload['user_id'], user_id)
        self.assertEqual(payload['username'], username)
        self.assertIn('exp', payload)
        self.assertIn('iat', payload)
    
    def test_verify_token(self):
        """Test JWT token verification"""
        user_id = 'test-user-id'
        username = 'testuser'
        
        # Generate valid token
        token = self.auth_service.generate_token(user_id, username)
        
        # Verify valid token
        payload = self.auth_service.verify_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload['user_id'], user_id)
        self.assertEqual(payload['username'], username)
        
        # Verify invalid token
        invalid_payload = self.auth_service.verify_token('invalid-token')
        self.assertIsNone(invalid_payload)
    
    def test_verify_expired_token(self):
        """Test expired token verification"""
        # Create expired token
        payload = {
            'user_id': 'test-user-id',
            'username': 'testuser',
            'exp': datetime.utcnow() - timedelta(hours=1),  # Expired 1 hour ago
            'iat': datetime.utcnow() - timedelta(hours=2)
        }
        
        expired_token = jwt.encode(payload, 'test-secret-key', algorithm='HS256')
        
        # Verify expired token returns None
        result = self.auth_service.verify_token(expired_token)
        self.assertIsNone(result)
    
    @patch('shared.models.User.get_by_username')
    @patch('shared.models.User.get_by_email')
    @patch('shared.models.User.save')
    def test_register_user_success(self, mock_save, mock_get_by_email, mock_get_by_username):
        """Test successful user registration"""
        # Mock that user doesn't exist
        mock_get_by_username.return_value = None
        mock_get_by_email.return_value = None
        mock_save.return_value = True
        
        result = self.auth_service.register_user(
            self.test_user_data['username'],
            self.test_user_data['email'],
            self.test_user_data['password']
        )
        
        # Verify result
        self.assertTrue(result['success'])
        self.assertIn('user', result)
        self.assertIn('token', result)
        self.assertEqual(result['user']['username'], self.test_user_data['username'])
        self.assertEqual(result['user']['email'], self.test_user_data['email'])
        
        # Verify methods were called
        mock_get_by_username.assert_called_once_with(self.test_user_data['username'])
        mock_get_by_email.assert_called_once_with(self.test_user_data['email'])
        mock_save.assert_called_once()
    
    @patch('shared.models.User.get_by_username')
    def test_register_user_duplicate_username(self, mock_get_by_username):
        """Test registration with duplicate username"""
        # Mock existing user
        existing_user = MagicMock()
        mock_get_by_username.return_value = existing_user
        
        with self.assertRaises(ValidationError) as context:
            self.auth_service.register_user(
                self.test_user_data['username'],
                self.test_user_data['email'],
                self.test_user_data['password']
            )
        
        self.assertIn('ユーザー名は既に使用されています', str(context.exception))
    
    def test_register_user_invalid_input(self):
        """Test registration with invalid input"""
        # Test short username
        with self.assertRaises(ValidationError):
            self.auth_service.register_user('ab', 'test@example.com', 'password123')
        
        # Test invalid email
        with self.assertRaises(ValidationError):
            self.auth_service.register_user('testuser', 'invalid-email', 'password123')
        
        # Test short password
        with self.assertRaises(ValidationError):
            self.auth_service.register_user('testuser', 'test@example.com', '123')
    
    @patch('shared.models.User.get_by_username')
    def test_authenticate_user_success(self, mock_get_by_username):
        """Test successful user authentication"""
        # Create mock user with hashed password
        mock_user = MagicMock()
        mock_user.user_id = 'test-user-id'
        mock_user.username = self.test_user_data['username']
        mock_user.password_hash = self.auth_service.hash_password(self.test_user_data['password'])
        mock_user.to_dict.return_value = {'user_id': 'test-user-id', 'username': 'testuser'}
        
        mock_get_by_username.return_value = mock_user
        
        result = self.auth_service.authenticate_user(
            self.test_user_data['username'],
            self.test_user_data['password']
        )
        
        # Verify result
        self.assertTrue(result['success'])
        self.assertIn('user', result)
        self.assertIn('token', result)
        self.assertEqual(result['message'], 'ログインしました')
    
    @patch('shared.models.User.get_by_username')
    def test_authenticate_user_not_found(self, mock_get_by_username):
        """Test authentication with non-existent user"""
        mock_get_by_username.return_value = None
        
        with self.assertRaises(AuthenticationError) as context:
            self.auth_service.authenticate_user('nonexistent', 'password')
        
        self.assertIn('ユーザー名またはパスワードが正しくありません', str(context.exception))
    
    @patch('shared.models.User.get_by_username')
    def test_authenticate_user_wrong_password(self, mock_get_by_username):
        """Test authentication with wrong password"""
        # Create mock user
        mock_user = MagicMock()
        mock_user.password_hash = self.auth_service.hash_password('correctpassword')
        mock_get_by_username.return_value = mock_user
        
        with self.assertRaises(AuthenticationError) as context:
            self.auth_service.authenticate_user('testuser', 'wrongpassword')
        
        self.assertIn('ユーザー名またはパスワードが正しくありません', str(context.exception))
    
    @patch('shared.models.User.get_by_email')
    def test_register_user_duplicate_email(self, mock_get_by_email):
        """Test registration with duplicate email"""
        # Mock existing user with same email
        existing_user = MagicMock()
        mock_get_by_email.return_value = existing_user
        
        with self.assertRaises(ValidationError) as context:
            self.auth_service.register_user(
                'newuser',
                self.test_user_data['email'],
                self.test_user_data['password']
            )
        
        self.assertIn('メールアドレスは既に使用されています', str(context.exception))
    
    def test_register_user_empty_fields(self):
        """Test registration with empty fields"""
        # Test empty username
        with self.assertRaises(ValidationError) as context:
            self.auth_service.register_user('', 'test@example.com', 'password123')
        self.assertIn('ユーザー名は3文字以上である必要があります', str(context.exception))
        
        # Test empty email
        with self.assertRaises(ValidationError) as context:
            self.auth_service.register_user('testuser', '', 'password123')
        self.assertIn('有効なメールアドレスを入力してください', str(context.exception))
        
        # Test empty password
        with self.assertRaises(ValidationError) as context:
            self.auth_service.register_user('testuser', 'test@example.com', '')
        self.assertIn('パスワードは6文字以上である必要があります', str(context.exception))
    
    def test_register_user_whitespace_handling(self):
        """Test registration with whitespace in fields"""
        with patch('shared.models.User.get_by_username') as mock_get_by_username, \
             patch('shared.models.User.get_by_email') as mock_get_by_email, \
             patch('shared.models.User.save') as mock_save:
            
            mock_get_by_username.return_value = None
            mock_get_by_email.return_value = None
            mock_save.return_value = True
            
            # Test with whitespace
            result = self.auth_service.register_user(
                '  testuser  ',
                '  TEST@EXAMPLE.COM  ',
                'password123'
            )
            
            # Verify username is trimmed and email is lowercased
            mock_get_by_username.assert_called_with('testuser')
            mock_get_by_email.assert_called_with('test@example.com')
    
    def test_authenticate_user_by_email(self):
        """Test authentication using email instead of username"""
        with patch('shared.models.User.get_by_username') as mock_get_by_username, \
             patch('shared.models.User.get_by_email') as mock_get_by_email:
            
            # Mock that username lookup fails but email lookup succeeds
            mock_get_by_username.return_value = None
            
            mock_user = MagicMock()
            mock_user.user_id = self.mock_user_id
            mock_user.username = self.test_user_data['username']
            mock_user.password_hash = self.auth_service.hash_password(self.test_user_data['password'])
            mock_user.to_dict.return_value = {'user_id': self.mock_user_id, 'username': 'testuser'}
            
            mock_get_by_email.return_value = mock_user
            
            result = self.auth_service.authenticate_user(
                self.test_user_data['email'],
                self.test_user_data['password']
            )
            
            # Verify result
            self.assertTrue(result['success'])
            self.assertIn('user', result)
            self.assertIn('token', result)
            mock_get_by_email.assert_called_with(self.test_user_data['email'])
    
    def test_authenticate_user_empty_credentials(self):
        """Test authentication with empty credentials"""
        # Test empty username
        with self.assertRaises(AuthenticationError) as context:
            self.auth_service.authenticate_user('', 'password')
        self.assertIn('ユーザー名とパスワードを入力してください', str(context.exception))
        
        # Test empty password
        with self.assertRaises(AuthenticationError) as context:
            self.auth_service.authenticate_user('username', '')
        self.assertIn('ユーザー名とパスワードを入力してください', str(context.exception))
    
    @patch('shared.models.User.get_by_id')
    def test_get_current_user_success(self, mock_get_by_id):
        """Test successful current user retrieval"""
        # Create mock user
        mock_user = MagicMock()
        mock_user.user_id = self.mock_user_id
        mock_user.username = 'testuser'
        mock_get_by_id.return_value = mock_user
        
        # Generate valid token
        token = self.auth_service.generate_token(self.mock_user_id, 'testuser')
        
        # Get current user
        result = self.auth_service.get_current_user(token)
        
        self.assertIsNotNone(result)
        self.assertEqual(result.user_id, self.mock_user_id)
        mock_get_by_id.assert_called_once_with(self.mock_user_id)
    
    @patch('shared.models.User.get_by_id')
    def test_get_current_user_invalid_token(self, mock_get_by_id):
        """Test current user retrieval with invalid token"""
        result = self.auth_service.get_current_user('invalid-token')
        self.assertIsNone(result)
        mock_get_by_id.assert_not_called()
    
    @patch('shared.models.User.get_by_id')
    def test_get_current_user_user_not_found(self, mock_get_by_id):
        """Test current user retrieval when user doesn't exist in database"""
        mock_get_by_id.return_value = None
        
        # Generate valid token
        token = self.auth_service.generate_token(self.mock_user_id, 'testuser')
        
        # Get current user
        result = self.auth_service.get_current_user(token)
        
        self.assertIsNone(result)
        mock_get_by_id.assert_called_once_with(self.mock_user_id)
    
    def test_token_expiry_configuration(self):
        """Test token expiry configuration"""
        # Test custom expiry
        custom_auth_service = AuthService(secret_key='test-key', token_expiry_hours=1)
        token = custom_auth_service.generate_token('user-id', 'username')
        
        payload = jwt.decode(token, 'test-key', algorithms=['HS256'])
        exp_time = datetime.utcfromtimestamp(payload['exp'])
        iat_time = datetime.utcfromtimestamp(payload['iat'])
        
        # Should be approximately 1 hour difference
        time_diff = exp_time - iat_time
        self.assertAlmostEqual(time_diff.total_seconds(), 3600, delta=60)  # Allow 1 minute tolerance


class TestDynamoDBMockOperations(unittest.TestCase):
    """Test cases for DynamoDB operations with comprehensive mocking"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.auth_service = AuthService(secret_key='test-secret-key')
        self.test_user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpassword123'
        }
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_save_dynamodb_success(self, mock_get_table):
        """Test successful user save to DynamoDB"""
        # Mock DynamoDB table
        mock_table = MagicMock()
        mock_get_table.return_value = mock_table
        
        # Create user and save
        user = User(
            username=self.test_user_data['username'],
            email=self.test_user_data['email'],
            password_hash='hashed_password'
        )
        
        with patch.object(User, 'get_by_username', return_value=None), \
             patch.object(User, 'get_by_email', return_value=None):
            
            result = user.save()
            
            # Verify DynamoDB put_item was called
            self.assertTrue(result)
            mock_table.put_item.assert_called_once()
            
            # Verify the item structure
            call_args = mock_table.put_item.call_args
            item = call_args[1]['Item']
            self.assertEqual(item['username'], self.test_user_data['username'])
            self.assertEqual(item['email'], self.test_user_data['email'])
            self.assertIn('user_id', item)
            self.assertIn('created_at', item)
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_save_dynamodb_error(self, mock_get_table):
        """Test user save with DynamoDB error"""
        # Mock DynamoDB table to raise exception
        mock_table = MagicMock()
        mock_table.put_item.side_effect = ClientError(
            {'Error': {'Code': 'ValidationException', 'Message': 'Test error'}},
            'PutItem'
        )
        mock_get_table.return_value = mock_table
        
        user = User(
            username=self.test_user_data['username'],
            email=self.test_user_data['email'],
            password_hash='hashed_password'
        )
        
        with patch.object(User, 'get_by_username', return_value=None), \
             patch.object(User, 'get_by_email', return_value=None):
            
            with self.assertRaises(ClientError):
                user.save()
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_get_by_username_success(self, mock_get_table):
        """Test successful user retrieval by username"""
        # Mock DynamoDB table response
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [{
                'user_id': 'test-user-id',
                'username': 'testuser',
                'email': 'test@example.com',
                'password_hash': 'hashed_password',
                'created_at': '2023-01-01T00:00:00'
            }]
        }
        mock_get_table.return_value = mock_table
        
        user = User.get_by_username('testuser')
        
        # Verify query was called correctly
        mock_table.query.assert_called_once()
        call_args = mock_table.query.call_args
        self.assertEqual(call_args[1]['IndexName'], 'username-index')
        self.assertEqual(call_args[1]['KeyConditionExpression'], 'username = :username')
        
        # Verify user object
        self.assertIsNotNone(user)
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_get_by_username_not_found(self, mock_get_table):
        """Test user retrieval when username doesn't exist"""
        # Mock empty DynamoDB response
        mock_table = MagicMock()
        mock_table.query.return_value = {'Items': []}
        mock_get_table.return_value = mock_table
        
        user = User.get_by_username('nonexistent')
        
        self.assertIsNone(user)
        mock_table.query.assert_called_once()
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_get_by_email_success(self, mock_get_table):
        """Test successful user retrieval by email"""
        # Mock DynamoDB table response
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [{
                'user_id': 'test-user-id',
                'username': 'testuser',
                'email': 'test@example.com',
                'password_hash': 'hashed_password',
                'created_at': '2023-01-01T00:00:00'
            }]
        }
        mock_get_table.return_value = mock_table
        
        user = User.get_by_email('test@example.com')
        
        # Verify query was called correctly
        mock_table.query.assert_called_once()
        call_args = mock_table.query.call_args
        self.assertEqual(call_args[1]['IndexName'], 'email-index')
        
        # Verify user object
        self.assertIsNotNone(user)
        self.assertEqual(user.email, 'test@example.com')
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_get_by_id_success(self, mock_get_table):
        """Test successful user retrieval by ID"""
        # Mock DynamoDB table response
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'user_id': 'test-user-id',
                'username': 'testuser',
                'email': 'test@example.com',
                'password_hash': 'hashed_password',
                'created_at': '2023-01-01T00:00:00'
            }
        }
        mock_get_table.return_value = mock_table
        
        user = User.get_by_id('test-user-id')
        
        # Verify get_item was called correctly
        mock_table.get_item.assert_called_once_with(Key={'user_id': 'test-user-id'})
        
        # Verify user object
        self.assertIsNotNone(user)
        self.assertEqual(user.user_id, 'test-user-id')
        self.assertEqual(user.username, 'testuser')
    
    @patch('shared.dynamodb.db_connection.get_table')
    def test_user_get_by_id_not_found(self, mock_get_table):
        """Test user retrieval when ID doesn't exist"""
        # Mock empty DynamoDB response
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_get_table.return_value = mock_table
        
        user = User.get_by_id('nonexistent-id')
        
        self.assertIsNone(user)
        mock_table.get_item.assert_called_once()


class TestAuthEndpoints(unittest.TestCase):
    """Test cases for authentication API endpoints"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.app = app.test_client()
        self.app.testing = True
        
        self.test_user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpassword123'
        }
    
    @patch('shared.auth.auth_service.register_user')
    def test_register_endpoint_success(self, mock_register):
        """Test successful registration endpoint"""
        mock_register.return_value = {
            'success': True,
            'message': 'ユーザー登録が完了しました',
            'user': {'user_id': 'test-id', 'username': 'testuser'},
            'token': 'test-token'
        }
        
        response = self.app.post('/api/auth/register',
                               data=json.dumps(self.test_user_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('token', data)
    
    def test_register_endpoint_no_data(self):
        """Test registration endpoint with no data"""
        response = self.app.post('/api/auth/register',
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    @patch('shared.auth.auth_service.register_user')
    def test_register_endpoint_validation_error(self, mock_register):
        """Test registration endpoint with validation error"""
        mock_register.side_effect = ValidationError("ユーザー名は既に使用されています", "username")
        
        response = self.app.post('/api/auth/register',
                               data=json.dumps(self.test_user_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)
        self.assertEqual(data['error']['code'], 'VALIDATION_ERROR')
    
    def test_register_endpoint_missing_fields(self):
        """Test registration endpoint with missing fields"""
        incomplete_data = {'username': 'testuser'}
        
        response = self.app.post('/api/auth/register',
                               data=json.dumps(incomplete_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    def test_register_endpoint_invalid_json(self):
        """Test registration endpoint with invalid JSON"""
        response = self.app.post('/api/auth/register',
                               data='invalid json',
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    @patch('shared.auth.auth_service.authenticate_user')
    def test_login_endpoint_success(self, mock_authenticate):
        """Test successful login endpoint"""
        mock_authenticate.return_value = {
            'success': True,
            'message': 'ログインしました',
            'user': {'user_id': 'test-id', 'username': 'testuser'},
            'token': 'test-token'
        }
        
        login_data = {
            'username': self.test_user_data['username'],
            'password': self.test_user_data['password']
        }
        
        response = self.app.post('/api/auth/login',
                               data=json.dumps(login_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('token', data)
    
    def test_login_endpoint_no_data(self):
        """Test login endpoint with no data"""
        response = self.app.post('/api/auth/login',
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    @patch('shared.auth.auth_service.authenticate_user')
    def test_login_endpoint_authentication_error(self, mock_authenticate):
        """Test login endpoint with authentication error"""
        mock_authenticate.side_effect = AuthenticationError("ユーザー名またはパスワードが正しくありません")
        
        login_data = {
            'username': 'wronguser',
            'password': 'wrongpassword'
        }
        
        response = self.app.post('/api/auth/login',
                               data=json.dumps(login_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)
        self.assertEqual(data['error']['code'], 'AUTHENTICATION_ERROR')
    
    def test_login_endpoint_missing_fields(self):
        """Test login endpoint with missing fields"""
        incomplete_data = {'username': 'testuser'}
        
        response = self.app.post('/api/auth/login',
                               data=json.dumps(incomplete_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    def test_login_endpoint_empty_credentials(self):
        """Test login endpoint with empty credentials"""
        empty_data = {'username': '', 'password': ''}
        
        response = self.app.post('/api/auth/login',
                               data=json.dumps(empty_data),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    @patch('shared.auth.auth_service.get_current_user')
    def test_logout_endpoint_success(self, mock_get_current_user):
        """Test successful logout endpoint"""
        mock_user = MagicMock()
        mock_user.username = 'testuser'
        mock_get_current_user.return_value = mock_user
        
        headers = {'Authorization': 'Bearer test-token'}
        response = self.app.post('/api/auth/logout', headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'ログアウトしました')
    
    def test_logout_endpoint_no_token(self):
        """Test logout endpoint without token"""
        response = self.app.post('/api/auth/logout')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
    
    @patch('shared.auth.auth_service.get_current_user')
    def test_me_endpoint_success(self, mock_get_current_user):
        """Test successful current user endpoint"""
        mock_user = MagicMock()
        mock_user.to_dict.return_value = {'user_id': 'test-id', 'username': 'testuser'}
        mock_get_current_user.return_value = mock_user
        
        headers = {'Authorization': 'Bearer test-token'}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('user', data)
    
    @patch('shared.auth.auth_service.get_current_user')
    @patch('shared.auth.auth_service.generate_token')
    def test_refresh_token_endpoint_success(self, mock_generate_token, mock_get_current_user):
        """Test successful token refresh endpoint"""
        mock_user = MagicMock()
        mock_user.user_id = 'test-id'
        mock_user.username = 'testuser'
        mock_get_current_user.return_value = mock_user
        mock_generate_token.return_value = 'new-test-token'
        
        headers = {'Authorization': 'Bearer test-token'}
        response = self.app.post('/api/auth/refresh', headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('token', data)
        self.assertEqual(data['token'], 'new-test-token')
    
    def test_refresh_token_endpoint_no_token(self):
        """Test token refresh endpoint without token"""
        response = self.app.post('/api/auth/refresh')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'TOKEN_MISSING')
    
    @patch('shared.auth.auth_service.get_current_user')
    def test_me_endpoint_invalid_token(self, mock_get_current_user):
        """Test current user endpoint with invalid token"""
        mock_get_current_user.return_value = None
        
        headers = {'Authorization': 'Bearer invalid-token'}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_TOKEN')
    
    def test_me_endpoint_no_token(self):
        """Test current user endpoint without token"""
        response = self.app.get('/api/auth/me')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'TOKEN_MISSING')
    
    @patch('shared.auth.auth_service.get_current_user')
    def test_logout_endpoint_invalid_token(self, mock_get_current_user):
        """Test logout endpoint with invalid token"""
        mock_get_current_user.return_value = None
        
        headers = {'Authorization': 'Bearer invalid-token'}
        response = self.app.post('/api/auth/logout', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_TOKEN')


class TestAuthDecorators(unittest.TestCase):
    """Test cases for authentication decorators"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.app = app.test_client()
        self.app.testing = True
    
    def test_token_required_no_token(self):
        """Test token_required decorator without token"""
        response = self.app.get('/api/auth/me')
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'TOKEN_MISSING')
    
    def test_token_required_invalid_format(self):
        """Test token_required decorator with invalid token format"""
        headers = {'Authorization': 'InvalidFormat'}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_TOKEN_FORMAT')
    
    def test_token_required_bearer_only(self):
        """Test token_required decorator with Bearer but no token"""
        headers = {'Authorization': 'Bearer'}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_TOKEN_FORMAT')
    
    def test_token_required_empty_bearer(self):
        """Test token_required decorator with empty Bearer token"""
        headers = {'Authorization': 'Bearer '}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_TOKEN')
    
    @patch('shared.auth.auth_service.get_current_user')
    def test_token_required_invalid_token(self, mock_get_current_user):
        """Test token_required decorator with invalid token"""
        mock_get_current_user.return_value = None
        
        headers = {'Authorization': 'Bearer invalid-token'}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'INVALID_TOKEN')
    
    @patch('shared.auth.auth_service.get_current_user')
    def test_token_required_exception_handling(self, mock_get_current_user):
        """Test token_required decorator with exception during verification"""
        mock_get_current_user.side_effect = Exception("Database connection error")
        
        headers = {'Authorization': 'Bearer test-token'}
        response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertEqual(data['error']['code'], 'TOKEN_VERIFICATION_FAILED')


class TestAuthEdgeCases(unittest.TestCase):
    """Test cases for authentication edge cases and error scenarios"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.auth_service = AuthService(secret_key='test-secret-key')
        self.app = app.test_client()
        self.app.testing = True
    
    def test_password_hashing_consistency(self):
        """Test that password hashing is consistent"""
        password = 'testpassword123'
        hash1 = self.auth_service.hash_password(password)
        hash2 = self.auth_service.hash_password(password)
        
        # Hashes should be different (due to salt) but both should verify
        self.assertNotEqual(hash1, hash2)
        self.assertTrue(self.auth_service.verify_password(password, hash1))
        self.assertTrue(self.auth_service.verify_password(password, hash2))
    
    def test_password_verification_with_invalid_hash(self):
        """Test password verification with invalid hash format"""
        password = 'testpassword123'
        invalid_hash = 'not-a-valid-hash'
        
        result = self.auth_service.verify_password(password, invalid_hash)
        self.assertFalse(result)
    
    def test_token_generation_with_special_characters(self):
        """Test token generation with special characters in user data"""
        user_id = 'user-123-!@#$%'
        username = 'test_user-123'
        
        token = self.auth_service.generate_token(user_id, username)
        payload = self.auth_service.verify_token(token)
        
        self.assertIsNotNone(payload)
        self.assertEqual(payload['user_id'], user_id)
        self.assertEqual(payload['username'], username)
    
    def test_token_verification_with_wrong_secret(self):
        """Test token verification with wrong secret key"""
        # Generate token with one secret
        token = self.auth_service.generate_token('user-id', 'username')
        
        # Try to verify with different secret
        wrong_auth_service = AuthService(secret_key='wrong-secret')
        payload = wrong_auth_service.verify_token(token)
        
        self.assertIsNone(payload)
    
    def test_concurrent_user_registration(self):
        """Test handling of concurrent user registration attempts"""
        with patch('shared.models.User.get_by_username') as mock_get_by_username, \
             patch('shared.models.User.get_by_email') as mock_get_by_email, \
             patch('shared.models.User.save') as mock_save:
            
            # First call returns None (user doesn't exist)
            # Second call during save might find user exists (race condition)
            mock_get_by_username.return_value = None
            mock_get_by_email.return_value = None
            mock_save.side_effect = DuplicateError("ユーザー名は既に使用されています", "username")
            
            with self.assertRaises(DuplicateError):
                self.auth_service.register_user('testuser', 'test@example.com', 'password123')
    
    @patch('shared.auth.auth_service.register_user')
    def test_endpoint_error_response_format(self, mock_register):
        """Test that endpoint error responses follow consistent format"""
        mock_register.side_effect = ValidationError("テストエラー", "test_field")
        
        response = self.app.post('/api/auth/register',
                               data=json.dumps({'username': 'test', 'email': 'test@test.com', 'password': 'test'}),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        
        # Verify error response structure
        self.assertFalse(data['success'])
        self.assertIn('error', data)
        self.assertIn('code', data['error'])
        self.assertIn('message', data['error'])
        self.assertEqual(data['error']['code'], 'VALIDATION_ERROR')
    
    def test_unicode_handling_in_credentials(self):
        """Test handling of unicode characters in credentials"""
        unicode_data = {
            'username': 'テストユーザー',
            'email': 'テスト@example.com',
            'password': 'パスワード123'
        }
        
        # Test that unicode characters don't break validation
        with self.assertRaises(ValidationError):  # Invalid email format
            self.auth_service.register_user(
                unicode_data['username'],
                unicode_data['email'],
                unicode_data['password']
            )
    
    def test_very_long_input_handling(self):
        """Test handling of very long input strings"""
        long_string = 'a' * 1000
        
        with self.assertRaises(ValidationError):
            self.auth_service.register_user(long_string, 'test@example.com', 'password123')


class TestAuthIntegration(unittest.TestCase):
    """Integration tests for complete authentication flows"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.app = app.test_client()
        self.app.testing = True
        self.test_user_data = {
            'username': 'integrationuser',
            'email': 'integration@example.com',
            'password': 'integrationpass123'
        }
    
    @patch('shared.models.User.get_by_username')
    @patch('shared.models.User.get_by_email')
    @patch('shared.models.User.save')
    @patch('shared.models.User.get_by_id')
    def test_complete_auth_flow(self, mock_get_by_id, mock_save, mock_get_by_email, mock_get_by_username):
        """Test complete authentication flow: register -> login -> access protected endpoint"""
        # Setup mocks for registration
        mock_get_by_username.return_value = None
        mock_get_by_email.return_value = None
        mock_save.return_value = True
        
        # Step 1: Register user
        register_response = self.app.post('/api/auth/register',
                                        data=json.dumps(self.test_user_data),
                                        content_type='application/json')
        
        self.assertEqual(register_response.status_code, 201)
        register_data = json.loads(register_response.data)
        self.assertTrue(register_data['success'])
        self.assertIn('token', register_data)
        
        # Step 2: Use token to access protected endpoint
        token = register_data['token']
        
        # Mock user for token verification
        mock_user = MagicMock()
        mock_user.user_id = 'test-user-id'
        mock_user.username = self.test_user_data['username']
        mock_user.to_dict.return_value = {
            'user_id': 'test-user-id',
            'username': self.test_user_data['username'],
            'email': self.test_user_data['email']
        }
        mock_get_by_id.return_value = mock_user
        
        headers = {'Authorization': f'Bearer {token}'}
        me_response = self.app.get('/api/auth/me', headers=headers)
        
        self.assertEqual(me_response.status_code, 200)
        me_data = json.loads(me_response.data)
        self.assertTrue(me_data['success'])
        self.assertIn('user', me_data)
        self.assertEqual(me_data['user']['username'], self.test_user_data['username'])


if __name__ == '__main__':
    unittest.main()