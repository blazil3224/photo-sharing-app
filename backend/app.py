from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from shared.auth import auth_service, token_required, optional_auth
from shared.error_handler import ValidationError, AuthenticationError, NotFoundError, handle_app_error, handle_generic_error
from shared.logging_config import get_logger
from shared.image_service import image_service
from shared.models import User
from shared.security import security_manager, rate_limit, validate_json_input, security_check
from shared.monitoring import setup_monitoring_for_flask_app, monitor_api_endpoint
from shared.dynamodb_optimizer import dynamodb_optimizer
from shared.cloudwatch_config import cloudwatch_config

app = Flask(__name__)
CORS(app)

# Configure app
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['ENV'] = os.getenv('FLASK_ENV', 'development')
app.config['ALLOWED_ORIGINS'] = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

# Initialize security manager
app.security_manager = security_manager
security_manager.init_app(app)

# Initialize comprehensive monitoring
setup_monitoring_for_flask_app(app)

logger = get_logger(__name__)

# Error handlers
@app.errorhandler(ValidationError)
def handle_validation_error(error):
    return handle_app_error(error)

@app.errorhandler(AuthenticationError)
def handle_auth_error(error):
    return handle_app_error(error)

@app.errorhandler(NotFoundError)
def handle_not_found_error(error):
    return handle_app_error(error)

@app.errorhandler(Exception)
def handle_generic_error_handler(error):
    return handle_generic_error(error)

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'service': 'photo-sharing-backend'})

@app.route('/api/test')
@monitor_api_endpoint('test')
def test_endpoint():
    return jsonify({'message': 'バックエンドが正常に動作しています！'})

@app.route('/api/csrf-token', methods=['GET'])
@monitor_api_endpoint('csrf_token')
def get_csrf_token():
    """Get CSRF token for form submissions"""
    try:
        csrf_token = security_manager.csrf_protection.generate_csrf_token()
        return jsonify({
            'success': True,
            'csrf_token': csrf_token
        }), 200
    except Exception as e:
        logger.error(f"Failed to generate CSRF token: {e}")
        return jsonify({
            'success': False,
            'message': 'CSRFトークンの生成に失敗しました'
        }), 500

@app.route('/api/security-log', methods=['POST'])
@rate_limit('api')
def log_security_event():
    """Log security events from frontend"""
    try:
        data = request.get_json()
        if data:
            logger.warning(f"Frontend security event: {data}")
        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"Failed to log security event: {e}")
        return jsonify({'success': False}), 500

# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
@rate_limit('auth')
@security_check()
@validate_json_input(required_fields=['username', 'email', 'password'])
@monitor_api_endpoint('auth_register')
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError("リクエストデータが必要です")
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Record user activity
        cloudwatch_config.record_user_activity('user_registration')
        
        result = auth_service.register_user(username, email, password)
        
        return jsonify(result), 201
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise Exception("ユーザー登録に失敗しました")

@app.route('/api/auth/login', methods=['POST'])
@rate_limit('auth')
@security_check()
@validate_json_input(required_fields=['username', 'password'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError("リクエストデータが必要です")
        
        username = data.get('username')
        password = data.get('password')
        
        result = auth_service.authenticate_user(username, password)
        
        return jsonify(result), 200
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise Exception("ログインに失敗しました")

@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout():
    """User logout endpoint"""
    try:
        # In a stateless JWT system, logout is handled client-side
        # by removing the token. We just return success.
        logger.info(f"User {request.current_user.username} logged out")
        
        return jsonify({
            'success': True,
            'message': 'ログアウトしました'
        }), 200
        
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise Exception("ログアウトに失敗しました")

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user():
    """Get current user information"""
    try:
        user = request.current_user
        
        return jsonify({
            'success': True,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get current user: {e}")
        raise Exception("ユーザー情報の取得に失敗しました")

@app.route('/api/auth/refresh', methods=['POST'])
@token_required
def refresh_token():
    """Refresh JWT token"""
    try:
        user = request.current_user
        
        # Generate new token
        new_token = auth_service.generate_token(user.user_id, user.username)
        
        return jsonify({
            'success': True,
            'message': 'トークンを更新しました',
            'token': new_token
        }), 200
        
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise Exception("トークンの更新に失敗しました")

# Image upload endpoints
@app.route('/api/images/upload-url', methods=['POST'])
@token_required
def generate_upload_url():
    """Generate presigned URL for image upload"""
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError("リクエストデータが必要です")
        
        filename = data.get('filename')
        content_type = data.get('content_type')
        
        if not filename:
            raise ValidationError("ファイル名が必要です")
        
        if not content_type:
            raise ValidationError("コンテンツタイプが必要です")
        
        # Validate content type
        if content_type not in image_service.SUPPORTED_MIME_TYPES:
            raise ValidationError("サポートされていないファイル形式です。JPEG、PNGのみ対応しています。")
        
        user = request.current_user
        
        # Generate upload URL
        upload_info = image_service.generate_upload_url(
            filename=filename,
            content_type=content_type,
            user_id=user.user_id
        )
        
        return jsonify({
            'success': True,
            'message': 'アップロードURLを生成しました',
            'upload_info': upload_info
        }), 200
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Upload URL generation failed: {e}")
        raise Exception("アップロードURLの生成に失敗しました")

@app.route('/api/images/validate', methods=['POST'])
@token_required
def validate_image():
    """Validate uploaded image file"""
    try:
        # Check if file is present
        if 'file' not in request.files:
            raise ValidationError("画像ファイルが必要です")
        
        file = request.files['file']
        
        if file.filename == '':
            raise ValidationError("ファイルが選択されていません")
        
        # Read file data
        file_data = file.read()
        
        if not file_data:
            raise ValidationError("空のファイルです")
        
        # Validate image
        validation_result = image_service.validate_image_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type
        )
        
        return jsonify({
            'success': True,
            'message': '画像ファイルは有効です',
            'validation': validation_result
        }), 200
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Image validation failed: {e}")
        raise Exception("画像の検証に失敗しました")

@app.route('/api/images/process', methods=['POST'])
@token_required
def process_image():
    """Process uploaded image and create different sizes"""
    try:
        # Check if file is present
        if 'file' not in request.files:
            raise ValidationError("画像ファイルが必要です")
        
        file = request.files['file']
        
        if file.filename == '':
            raise ValidationError("ファイルが選択されていません")
        
        # Read file data
        file_data = file.read()
        
        if not file_data:
            raise ValidationError("空のファイルです")
        
        user = request.current_user
        
        # Validate image first
        validation_result = image_service.validate_image_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type
        )
        
        # Process image into different sizes
        processed_images = image_service.process_image(
            file_data=file_data,
            filename=file.filename
        )
        
        # Generate base S3 key
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else 'jpg'
        import uuid
        unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
        base_key = f"processed/{user.user_id}/{unique_filename}"
        
        # Upload processed images to S3
        uploaded_keys = image_service.upload_processed_images(
            processed_images=processed_images,
            base_key=base_key
        )
        
        # Generate access URLs
        image_urls = {}
        for size, s3_key in uploaded_keys.items():
            image_urls[size] = image_service.get_image_url(s3_key)
        
        return jsonify({
            'success': True,
            'message': '画像を処理しました',
            'validation': validation_result,
            'processed_images': {
                'keys': uploaded_keys,
                'urls': image_urls
            }
        }), 200
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        raise Exception("画像の処理に失敗しました")

@app.route('/api/images/<path:s3_key>', methods=['GET'])
@optional_auth
def get_image_url(s3_key):
    """Get presigned URL for image access"""
    try:
        # Generate presigned URL
        image_url = image_service.get_image_url(s3_key)
        
        if not image_url:
            raise ValidationError("画像が見つかりません")
        
        return jsonify({
            'success': True,
            'image_url': image_url
        }), 200
        
    except ValidationError as e:
        raise
    except Exception as e:
        logger.error(f"Failed to get image URL for {s3_key}: {e}")
        raise Exception("画像URLの取得に失敗しました")

# Post management endpoints
@app.route('/api/posts', methods=['POST'])
@token_required
@rate_limit('upload')
@security_check()
@validate_json_input(required_fields=['image_key'], optional_fields=['caption'])
def create_post():
    """Create new post"""
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError("リクエストデータが必要です")
        
        image_key = data.get('image_key')
        caption = data.get('caption', '')
        
        user = request.current_user
        
        # Import post service
        from shared.post_service import post_service
        
        # Create post using service
        post_data = post_service.create_post(
            user_id=user.user_id,
            image_key=image_key,
            caption=caption
        )
        
        return jsonify({
            'success': True,
            'message': '投稿を作成しました',
            'post': post_data
        }), 201
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Post creation failed: {e}")
        raise Exception("投稿の作成に失敗しました")

@app.route('/api/posts', methods=['GET'])
@optional_auth
@rate_limit('api')
@security_check()
def get_timeline_posts():
    """Get timeline posts with pagination"""
    try:
        # Get pagination parameters
        limit = int(request.args.get('limit', 20))
        last_key = request.args.get('last_key')
        
        # Import post service
        from shared.post_service import post_service
        
        # Get timeline posts using service
        result = post_service.get_timeline_posts(limit=limit, last_key=last_key)
        
        return jsonify({
            'success': True,
            'posts': result['posts'],
            'pagination': result['pagination']
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get timeline posts: {e}")
        raise Exception("タイムラインの取得に失敗しました")

@app.route('/api/posts/<post_id>', methods=['GET'])
@optional_auth
def get_post(post_id):
    """Get specific post by ID"""
    try:
        # Import post service
        from shared.post_service import post_service
        
        # Get post using service
        post_data = post_service.get_post_by_id(post_id)
        
        if not post_data:
            raise ValidationError("投稿が見つかりません")
        
        return jsonify({
            'success': True,
            'post': post_data
        }), 200
        
    except ValidationError as e:
        raise
    except Exception as e:
        logger.error(f"Failed to get post {post_id}: {e}")
        raise Exception("投稿の取得に失敗しました")

@app.route('/api/posts/<post_id>', methods=['DELETE'])
@token_required
def delete_post(post_id):
    """Delete post"""
    try:
        user = request.current_user
        
        # Import post service
        from shared.post_service import post_service
        
        # Delete post using service
        post_service.delete_post(post_id=post_id, user_id=user.user_id)
        
        return jsonify({
            'success': True,
            'message': '投稿を削除しました'
        }), 200
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to delete post {post_id}: {e}")
        raise Exception("投稿の削除に失敗しました")

@app.route('/api/users/<user_id>/posts', methods=['GET'])
@optional_auth
def get_user_posts(user_id):
    """Get posts by specific user"""
    try:
        # Get pagination parameters
        limit = int(request.args.get('limit', 20))
        last_key = request.args.get('last_key')
        
        # Import post service
        from shared.post_service import post_service
        
        # Get user posts using service
        result = post_service.get_user_posts(
            user_id=user_id,
            limit=limit,
            last_key=last_key
        )
        
        return jsonify({
            'success': True,
            'posts': result['posts'],
            'user': result['user'],
            'pagination': result['pagination']
        }), 200
        
    except ValidationError as e:
        raise
    except Exception as e:
        logger.error(f"Failed to get posts for user {user_id}: {e}")
        raise Exception("ユーザー投稿の取得に失敗しました")

# Interaction endpoints
@app.route('/api/posts/<post_id>/like', methods=['POST'])
@token_required
def toggle_like(post_id):
    """Toggle like for a post"""
    try:
        user = request.current_user
        
        # Import interaction service
        from shared.interaction_service import interaction_service
        
        # Toggle like using service
        result = interaction_service.toggle_like(
            user_id=user.user_id,
            post_id=post_id
        )
        
        return jsonify({
            'success': True,
            'liked': result['liked'],
            'likes_count': result['likes_count'],
            'message': result['message']
        }), 200
        
    except (ValidationError, NotFoundError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle like for post {post_id}: {e}")
        raise Exception("いいねの処理に失敗しました")

@app.route('/api/posts/<post_id>/likes', methods=['GET'])
@optional_auth
def get_post_likes(post_id):
    """Get likes for a post"""
    try:
        limit = int(request.args.get('limit', 50))
        
        # Import interaction service
        from shared.interaction_service import interaction_service
        
        # Get likes using service
        result = interaction_service.get_post_likes(
            post_id=post_id,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'likes': result['likes'],
            'likes_count': result['likes_count'],
            'total_likes': result['total_likes']
        }), 200
        
    except (ValidationError, NotFoundError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to get likes for post {post_id}: {e}")
        raise Exception("いいね一覧の取得に失敗しました")

@app.route('/api/posts/<post_id>/comments', methods=['POST'])
@token_required
def add_comment(post_id):
    """Add comment to a post"""
    try:
        data = request.get_json()
        
        if not data:
            raise ValidationError("リクエストデータが必要です")
        
        content = data.get('content')
        user = request.current_user
        
        # Import interaction service
        from shared.interaction_service import interaction_service
        
        # Add comment using service
        result = interaction_service.add_comment(
            user_id=user.user_id,
            post_id=post_id,
            content=content
        )
        
        return jsonify({
            'success': True,
            'comment': result['comment'],
            'comments_count': result['comments_count'],
            'message': result['message']
        }), 201
        
    except (ValidationError, NotFoundError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to add comment to post {post_id}: {e}")
        raise Exception("コメントの投稿に失敗しました")

@app.route('/api/posts/<post_id>/comments', methods=['GET'])
@optional_auth
def get_post_comments(post_id):
    """Get comments for a post"""
    try:
        limit = int(request.args.get('limit', 50))
        
        # Import interaction service
        from shared.interaction_service import interaction_service
        
        # Get comments using service
        result = interaction_service.get_post_comments(
            post_id=post_id,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'comments': result['comments'],
            'comments_count': result['comments_count'],
            'total_comments': result['total_comments']
        }), 200
        
    except (ValidationError, NotFoundError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to get comments for post {post_id}: {e}")
        raise Exception("コメント一覧の取得に失敗しました")

@app.route('/api/posts/<post_id>/comments/<interaction_id>', methods=['DELETE'])
@token_required
def delete_comment(post_id, interaction_id):
    """Delete a comment"""
    try:
        user = request.current_user
        
        # Import interaction service
        from shared.interaction_service import interaction_service
        
        # Delete comment using service
        result = interaction_service.delete_comment(
            user_id=user.user_id,
            post_id=post_id,
            interaction_id=interaction_id
        )
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'comments_count': result['comments_count']
        }), 200
        
    except (ValidationError, NotFoundError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to delete comment {interaction_id}: {e}")
        raise Exception("コメントの削除に失敗しました")

@app.route('/api/posts/<post_id>/like-status', methods=['GET'])
@token_required
def get_like_status(post_id):
    """Get current user's like status for a post"""
    try:
        user = request.current_user
        
        # Import interaction service
        from shared.interaction_service import interaction_service
        
        # Get like status using service
        liked = interaction_service.get_user_like_status(
            user_id=user.user_id,
            post_id=post_id
        )
        
        return jsonify({
            'success': True,
            'liked': liked
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get like status for post {post_id}: {e}")
        raise Exception("いいね状態の取得に失敗しました")

# Profile management endpoints
@app.route('/api/users/<user_id>', methods=['GET'])
@optional_auth
def get_user_profile(user_id):
    """Get user profile information"""
    try:
        # Get user by ID
        user = User.get_by_id(user_id)
        
        if not user:
            raise NotFoundError("ユーザーが見つかりません")
        
        # Get user's post count
        from shared.post_service import post_service
        user_posts_result = post_service.get_user_posts(user_id=user_id, limit=1)
        
        # Build profile response
        profile_data = {
            'user_id': user.user_id,
            'username': user.username,
            'profile_image': user.profile_image,
            'bio': user.bio,
            'created_at': user.created_at,
            'posts_count': len(user_posts_result.get('posts', []))
        }
        
        # Don't include email for other users
        current_user = getattr(request, 'current_user', None)
        if current_user and current_user.user_id == user_id:
            profile_data['email'] = user.email
        
        return jsonify({
            'success': True,
            'profile': profile_data
        }), 200
        
    except (NotFoundError, ValidationError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to get user profile {user_id}: {e}")
        raise Exception("プロフィールの取得に失敗しました")

@app.route('/api/users/<user_id>', methods=['PUT'])
@token_required
def update_user_profile(user_id):
    """Update user profile information"""
    try:
        current_user = request.current_user
        
        # Check if user is updating their own profile
        if current_user.user_id != user_id:
            raise AuthenticationError("自分のプロフィールのみ編集できます")
        
        data = request.get_json()
        
        if data is None:
            raise ValidationError("更新データが必要です")
        
        # Validate and prepare update data
        update_data = {}
        
        # Update username if provided
        if 'username' in data:
            username = data['username'].strip() if data['username'] else None
            if username:
                if len(username) < 3:
                    raise ValidationError("ユーザー名は3文字以上である必要があります", "username")
                
                # Check if username is already taken by another user
                existing_user = User.get_by_username(username)
                if existing_user and existing_user.user_id != user_id:
                    raise ValidationError("ユーザー名は既に使用されています", "username")
                
                update_data['username'] = username
        
        # Update email if provided
        if 'email' in data:
            email = data['email'].strip().lower() if data['email'] else None
            if email:
                if '@' not in email:
                    raise ValidationError("有効なメールアドレスを入力してください", "email")
                
                # Check if email is already taken by another user
                existing_user = User.get_by_email(email)
                if existing_user and existing_user.user_id != user_id:
                    raise ValidationError("メールアドレスは既に使用されています", "email")
                
                update_data['email'] = email
        
        # Update bio if provided
        if 'bio' in data:
            bio = data['bio'].strip() if data['bio'] else None
            if bio and len(bio) > 500:
                raise ValidationError("自己紹介は500文字以内で入力してください", "bio")
            update_data['bio'] = bio
        
        # Update profile image if provided
        if 'profile_image' in data:
            profile_image = data['profile_image'].strip() if data['profile_image'] else None
            update_data['profile_image'] = profile_image
        
        if not update_data:
            raise ValidationError("更新する項目がありません")
        
        # Update user profile
        current_user.update(**update_data)
        
        # Return updated profile
        updated_profile = {
            'user_id': current_user.user_id,
            'username': current_user.username,
            'email': current_user.email,
            'profile_image': current_user.profile_image,
            'bio': current_user.bio,
            'created_at': current_user.created_at
        }
        
        return jsonify({
            'success': True,
            'message': 'プロフィールを更新しました',
            'profile': updated_profile
        }), 200
        
    except (ValidationError, AuthenticationError, NotFoundError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to update user profile {user_id}: {e}")
        raise Exception("プロフィールの更新に失敗しました")

@app.route('/api/users/<user_id>/profile-image', methods=['POST'])
@token_required
def upload_profile_image(user_id):
    """Upload profile image"""
    try:
        current_user = request.current_user
        
        # Check if user is updating their own profile
        if current_user.user_id != user_id:
            raise AuthenticationError("自分のプロフィール画像のみ更新できます")
        
        # Check if file is present
        if 'file' not in request.files:
            raise ValidationError("画像ファイルが必要です")
        
        file = request.files['file']
        
        if file.filename == '':
            raise ValidationError("ファイルが選択されていません")
        
        # Read file data
        file_data = file.read()
        
        if not file_data:
            raise ValidationError("空のファイルです")
        
        # Validate image first
        validation_result = image_service.validate_image_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type
        )
        
        # Process image into different sizes
        processed_images = image_service.process_image(
            file_data=file_data,
            filename=file.filename
        )
        
        # Generate base S3 key for profile image
        file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else 'jpg'
        import uuid
        unique_filename = f"profile_{uuid.uuid4().hex}.{file_ext}"
        base_key = f"profiles/{current_user.user_id}/{unique_filename}"
        
        # Upload processed images to S3
        uploaded_keys = image_service.upload_processed_images(
            processed_images=processed_images,
            base_key=base_key
        )
        
        # Use medium size for profile image, fallback to original
        profile_image_key = uploaded_keys.get('medium', uploaded_keys.get('original'))
        
        # Update user's profile image
        current_user.update(profile_image=profile_image_key)
        
        # Generate access URL
        profile_image_url = image_service.get_image_url(profile_image_key)
        
        return jsonify({
            'success': True,
            'message': 'プロフィール画像を更新しました',
            'profile_image': {
                'key': profile_image_key,
                'url': profile_image_url
            },
            'validation': validation_result
        }), 200
        
    except (ValidationError, AuthenticationError) as e:
        raise
    except Exception as e:
        logger.error(f"Failed to upload profile image for user {user_id}: {e}")
        raise Exception("プロフィール画像のアップロードに失敗しました")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)