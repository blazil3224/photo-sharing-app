"""
Authentication utilities for photo sharing app
"""
import jwt
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from typing import Optional, Dict, Any
from .models import User
from .logging_config import get_logger
from .error_handler import AuthenticationError, ValidationError

logger = get_logger(__name__)

class AuthService:
    """Authentication service for user management"""
    
    def __init__(self, secret_key: str = None, token_expiry_hours: int = 24):
        self.secret_key = secret_key or 'your-secret-key-change-in-production'
        self.token_expiry_hours = token_expiry_hours
        self.algorithm = 'HS256'
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        try:
            # Generate salt and hash password
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
            return hashed.decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to hash password: {e}")
            raise
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception as e:
            logger.error(f"Failed to verify password: {e}")
            return False
    
    def generate_token(self, user_id: str, username: str) -> str:
        """Generate JWT token for user"""
        try:
            payload = {
                'user_id': user_id,
                'username': username,
                'exp': datetime.utcnow() + timedelta(hours=self.token_expiry_hours),
                'iat': datetime.utcnow()
            }
            
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            logger.info(f"Token generated for user {user_id}")
            return token
        except Exception as e:
            logger.error(f"Failed to generate token for user {user_id}: {e}")
            raise
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to verify token: {e}")
            return None
    
    def register_user(self, username: str, email: str, password: str) -> Dict[str, Any]:
        """Register new user"""
        try:
            # Validate input
            if not username or len(username.strip()) < 3:
                raise ValidationError("ユーザー名は3文字以上である必要があります", "username")
            
            if not email or '@' not in email:
                raise ValidationError("有効なメールアドレスを入力してください", "email")
            
            if not password or len(password) < 6:
                raise ValidationError("パスワードは6文字以上である必要があります", "password")
            
            # Check if user already exists
            existing_user = User.get_by_username(username.strip())
            if existing_user:
                raise ValidationError("ユーザー名は既に使用されています", "username")
            
            existing_email = User.get_by_email(email.strip().lower())
            if existing_email:
                raise ValidationError("メールアドレスは既に使用されています", "email")
            
            # Hash password and create user
            hashed_password = self.hash_password(password)
            user = User(
                username=username.strip(),
                email=email.strip().lower(),
                password_hash=hashed_password
            )
            
            # Save user to database
            user.save()
            
            # Generate token
            token = self.generate_token(user.user_id, user.username)
            
            logger.info(f"User registered successfully: {user.username}")
            
            return {
                'success': True,
                'message': 'ユーザー登録が完了しました',
                'user': user.to_dict(),
                'token': token
            }
            
        except (ValidationError, Exception) as e:
            logger.error(f"Failed to register user {username}: {e}")
            raise
    
    def authenticate_user(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user with username/password"""
        try:
            # Validate input
            if not username or not password:
                raise AuthenticationError("ユーザー名とパスワードを入力してください")
            
            # Find user by username or email
            user = User.get_by_username(username.strip())
            if not user:
                # Try to find by email
                user = User.get_by_email(username.strip().lower())
            
            if not user:
                raise AuthenticationError("ユーザー名またはパスワードが正しくありません")
            
            # Verify password
            if not self.verify_password(password, user.password_hash):
                raise AuthenticationError("ユーザー名またはパスワードが正しくありません")
            
            # Generate token
            token = self.generate_token(user.user_id, user.username)
            
            logger.info(f"User authenticated successfully: {user.username}")
            
            return {
                'success': True,
                'message': 'ログインしました',
                'user': user.to_dict(),
                'token': token
            }
            
        except (AuthenticationError, Exception) as e:
            logger.error(f"Failed to authenticate user {username}: {e}")
            raise
    
    def get_current_user(self, token: str) -> Optional[User]:
        """Get current user from token"""
        try:
            payload = self.verify_token(token)
            if not payload:
                return None
            
            user = User.get_by_id(payload['user_id'])
            return user
            
        except Exception as e:
            logger.error(f"Failed to get current user: {e}")
            return None


# Global auth service instance
auth_service = AuthService()


def token_required(f):
    """Decorator to require authentication token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header:
            try:
                # Expected format: "Bearer <token>"
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'INVALID_TOKEN_FORMAT',
                        'message': 'トークンの形式が正しくありません'
                    }
                }), 401
        
        if not token:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'TOKEN_MISSING',
                    'message': '認証トークンが必要です'
                }
            }), 401
        
        try:
            # Verify token and get user
            current_user = auth_service.get_current_user(token)
            if not current_user:
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'INVALID_TOKEN',
                        'message': '無効なトークンです'
                    }
                }), 401
            
            # Add current user to request context
            request.current_user = current_user
            
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return jsonify({
                'success': False,
                'error': {
                    'code': 'TOKEN_VERIFICATION_FAILED',
                    'message': 'トークンの検証に失敗しました'
                }
            }), 401
        
        return f(*args, **kwargs)
    
    return decorated


def optional_auth(f):
    """Decorator for optional authentication (user can be None)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        current_user = None
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
                current_user = auth_service.get_current_user(token)
            except (IndexError, Exception) as e:
                logger.warning(f"Optional auth failed: {e}")
        
        # Add current user to request context (can be None)
        request.current_user = current_user
        
        return f(*args, **kwargs)
    
    return decorated