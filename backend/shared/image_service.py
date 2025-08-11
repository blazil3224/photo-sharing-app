"""
Image processing and S3 upload service for photo sharing app
"""
import os
import boto3
import uuid
from PIL import Image, ImageOps
from io import BytesIO
import mimetypes
from typing import Dict, Tuple, Optional
from .logging_config import get_logger
from .error_handler import ValidationError

logger = get_logger(__name__)

class ImageService:
    """Service for handling image uploads, processing, and S3 operations"""
    
    # Supported image formats
    SUPPORTED_FORMATS = {'JPEG', 'PNG', 'JPG'}
    SUPPORTED_MIME_TYPES = {'image/jpeg', 'image/png'}
    
    # Size limits
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    THUMBNAIL_SIZE = (300, 300)
    MEDIUM_SIZE = (800, 800)
    
    def __init__(self):
        """Initialize ImageService with S3 client"""
        self.s3_client = boto3.client(
            's3',
            endpoint_url=os.getenv('S3_ENDPOINT_URL', 'http://localstack:4566'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID', 'test'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY', 'test'),
            region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
        )
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'photo-sharing-images')
        
        # Ensure bucket exists
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Create S3 bucket if it doesn't exist"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
                logger.info(f"Created S3 bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to create S3 bucket: {e}")
    
    def validate_image_file(self, file_data: bytes, filename: str, content_type: str) -> Dict[str, any]:
        """
        Validate image file format, size, and content
        
        Args:
            file_data: Raw file bytes
            filename: Original filename
            content_type: MIME type
            
        Returns:
            Dict with validation results
            
        Raises:
            ValidationError: If validation fails
        """
        # Check file size
        if len(file_data) > self.MAX_FILE_SIZE:
            raise ValidationError(f"ファイルサイズが制限を超えています。最大{self.MAX_FILE_SIZE // (1024*1024)}MBまでです。")
        
        # Check MIME type
        if content_type not in self.SUPPORTED_MIME_TYPES:
            raise ValidationError(f"サポートされていないファイル形式です。JPEG、PNGのみ対応しています。")
        
        # Validate file extension
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        if file_ext not in ['jpg', 'jpeg', 'png']:
            raise ValidationError("ファイル拡張子が無効です。.jpg、.jpeg、.pngのみ対応しています。")
        
        try:
            # Validate image content using Pillow
            with Image.open(BytesIO(file_data)) as img:
                # Check if it's a valid image
                img.verify()
                
                # Re-open for getting info (verify() closes the image)
                img = Image.open(BytesIO(file_data))
                
                # Check format
                if img.format not in self.SUPPORTED_FORMATS:
                    raise ValidationError(f"サポートされていない画像形式です: {img.format}")
                
                # Get image dimensions
                width, height = img.size
                
                return {
                    'valid': True,
                    'format': img.format,
                    'size': len(file_data),
                    'dimensions': {'width': width, 'height': height},
                    'content_type': content_type
                }
                
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            logger.error(f"Image validation failed: {e}")
            raise ValidationError("無効な画像ファイルです。")
    
    def process_image(self, file_data: bytes, filename: str) -> Dict[str, bytes]:
        """
        Process image to create different sizes (original, medium, thumbnail)
        
        Args:
            file_data: Raw image bytes
            filename: Original filename
            
        Returns:
            Dict with processed image data for different sizes
        """
        processed_images = {}
        
        try:
            with Image.open(BytesIO(file_data)) as img:
                # Convert to RGB if necessary (for PNG with transparency)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Apply EXIF orientation
                img = ImageOps.exif_transpose(img)
                
                # Original (potentially compressed)
                original_buffer = BytesIO()
                img.save(original_buffer, format='JPEG', quality=90, optimize=True)
                processed_images['original'] = original_buffer.getvalue()
                
                # Medium size
                medium_img = img.copy()
                medium_img.thumbnail(self.MEDIUM_SIZE, Image.Resampling.LANCZOS)
                medium_buffer = BytesIO()
                medium_img.save(medium_buffer, format='JPEG', quality=85, optimize=True)
                processed_images['medium'] = medium_buffer.getvalue()
                
                # Thumbnail
                thumb_img = img.copy()
                thumb_img.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
                thumb_buffer = BytesIO()
                thumb_img.save(thumb_buffer, format='JPEG', quality=80, optimize=True)
                processed_images['thumbnail'] = thumb_buffer.getvalue()
                
                logger.info(f"Processed image {filename} into {len(processed_images)} sizes")
                return processed_images
                
        except Exception as e:
            logger.error(f"Image processing failed for {filename}: {e}")
            raise ValidationError("画像の処理に失敗しました。")
    
    def generate_upload_url(self, filename: str, content_type: str, user_id: str) -> Dict[str, str]:
        """
        Generate presigned URL for direct S3 upload
        
        Args:
            filename: Original filename
            content_type: MIME type
            user_id: User ID for organizing uploads
            
        Returns:
            Dict with upload URL and key information
        """
        try:
            # Generate unique key
            file_ext = filename.lower().split('.')[-1] if '.' in filename else 'jpg'
            unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
            s3_key = f"uploads/{user_id}/{unique_filename}"
            
            # Generate presigned URL for PUT operation
            presigned_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ContentType': content_type,
                    'ContentLength': self.MAX_FILE_SIZE  # Set max size limit
                },
                ExpiresIn=3600  # 1 hour
            )
            
            return {
                'upload_url': presigned_url,
                's3_key': s3_key,
                'bucket': self.bucket_name,
                'expires_in': 3600
            }
            
        except Exception as e:
            logger.error(f"Failed to generate upload URL: {e}")
            raise ValidationError("アップロードURLの生成に失敗しました。")
    
    def upload_processed_images(self, processed_images: Dict[str, bytes], base_key: str) -> Dict[str, str]:
        """
        Upload processed images to S3
        
        Args:
            processed_images: Dict of processed image data
            base_key: Base S3 key (without size suffix)
            
        Returns:
            Dict with S3 keys for each image size
        """
        uploaded_keys = {}
        
        try:
            for size, image_data in processed_images.items():
                # Create key for this size
                key_parts = base_key.rsplit('.', 1)
                if len(key_parts) == 2:
                    s3_key = f"{key_parts[0]}_{size}.{key_parts[1]}"
                else:
                    s3_key = f"{base_key}_{size}"
                
                # Upload to S3
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=image_data,
                    ContentType='image/jpeg',
                    CacheControl='max-age=31536000'  # 1 year cache
                )
                
                uploaded_keys[size] = s3_key
                logger.info(f"Uploaded {size} image to {s3_key}")
            
            return uploaded_keys
            
        except Exception as e:
            logger.error(f"Failed to upload processed images: {e}")
            raise ValidationError("画像のアップロードに失敗しました。")
    
    def get_image_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """
        Generate presigned URL for image access
        
        Args:
            s3_key: S3 object key
            expires_in: URL expiration time in seconds
            
        Returns:
            Presigned URL for image access
        """
        try:
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expires_in
            )
        except Exception as e:
            logger.error(f"Failed to generate image URL for {s3_key}: {e}")
            return ""
    
    def delete_image(self, s3_key: str) -> bool:
        """
        Delete image from S3
        
        Args:
            s3_key: S3 object key
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            logger.info(f"Deleted image: {s3_key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete image {s3_key}: {e}")
            return False

# Global instance
image_service = ImageService()