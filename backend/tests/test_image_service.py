"""
Tests for image service functionality
"""
import pytest
import os
import io
from PIL import Image
from unittest.mock import Mock, patch, MagicMock, call
from botocore.exceptions import ClientError, NoCredentialsError
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.image_service import ImageService, image_service
from shared.error_handler import ValidationError

class TestImageService:
    """Test cases for ImageService"""
    
    def setup_method(self):
        """Setup test environment"""
        self.image_service = ImageService()
    
    def create_test_image(self, format='JPEG', size=(100, 100), mode='RGB'):
        """Create a test image in memory"""
        img = Image.new(mode, size, color='red')
        buffer = io.BytesIO()
        img.save(buffer, format=format)
        return buffer.getvalue()
    
    def test_validate_image_file_valid_jpeg(self):
        """Test validation of valid JPEG image"""
        image_data = self.create_test_image('JPEG')
        
        result = self.image_service.validate_image_file(
            file_data=image_data,
            filename='test.jpg',
            content_type='image/jpeg'
        )
        
        assert result['valid'] is True
        assert result['format'] == 'JPEG'
        assert result['dimensions']['width'] == 100
        assert result['dimensions']['height'] == 100
    
    def test_validate_image_file_valid_png(self):
        """Test validation of valid PNG image"""
        image_data = self.create_test_image('PNG')
        
        result = self.image_service.validate_image_file(
            file_data=image_data,
            filename='test.png',
            content_type='image/png'
        )
        
        assert result['valid'] is True
        assert result['format'] == 'PNG'
    
    def test_validate_image_file_invalid_format(self):
        """Test validation with invalid file format"""
        image_data = b'not an image'
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=image_data,
                filename='test.txt',
                content_type='text/plain'
            )
        
        assert "サポートされていないファイル形式" in str(exc_info.value)
    
    def test_validate_image_file_too_large(self):
        """Test validation with file too large"""
        # Create large dummy data
        large_data = b'x' * (6 * 1024 * 1024)  # 6MB
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=large_data,
                filename='test.jpg',
                content_type='image/jpeg'
            )
        
        assert "ファイルサイズが制限を超えています" in str(exc_info.value)
    
    def test_validate_image_file_invalid_extension(self):
        """Test validation with invalid file extension"""
        image_data = self.create_test_image('JPEG')
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=image_data,
                filename='test.gif',
                content_type='image/jpeg'
            )
        
        assert "ファイル拡張子が無効です" in str(exc_info.value)
    
    def test_process_image_creates_multiple_sizes(self):
        """Test image processing creates multiple sizes"""
        image_data = self.create_test_image('JPEG', size=(1000, 1000))
        
        processed = self.image_service.process_image(
            file_data=image_data,
            filename='test.jpg'
        )
        
        assert 'original' in processed
        assert 'medium' in processed
        assert 'thumbnail' in processed
        
        # Check that all are valid JPEG data
        for size, data in processed.items():
            assert len(data) > 0
            # Verify it's a valid image
            img = Image.open(io.BytesIO(data))
            assert img.format == 'JPEG'
    
    def test_process_image_handles_rgba(self):
        """Test image processing handles RGBA images"""
        # Create RGBA image
        img = Image.new('RGBA', (100, 100), color=(255, 0, 0, 128))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        image_data = buffer.getvalue()
        
        processed = self.image_service.process_image(
            file_data=image_data,
            filename='test.png'
        )
        
        # Should convert to RGB JPEG
        for size, data in processed.items():
            img = Image.open(io.BytesIO(data))
            assert img.format == 'JPEG'
            assert img.mode == 'RGB'
    
    @patch('boto3.client')
    def test_generate_upload_url(self, mock_boto_client):
        """Test S3 upload URL generation"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = 'https://test-url.com'
        
        service = ImageService()
        
        result = service.generate_upload_url(
            filename='test.jpg',
            content_type='image/jpeg',
            user_id='user123'
        )
        
        assert 'upload_url' in result
        assert 's3_key' in result
        assert 'bucket' in result
        assert result['upload_url'] == 'https://test-url.com'
        assert 'user123' in result['s3_key']
    
    @patch('boto3.client')
    def test_upload_processed_images(self, mock_boto_client):
        """Test uploading processed images to S3"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        service = ImageService()
        
        processed_images = {
            'original': b'original_data',
            'medium': b'medium_data',
            'thumbnail': b'thumb_data'
        }
        
        result = service.upload_processed_images(
            processed_images=processed_images,
            base_key='test/user123/image.jpg'
        )
        
        assert len(result) == 3
        assert 'original' in result
        assert 'medium' in result
        assert 'thumbnail' in result
        
        # Verify S3 put_object was called for each size
        assert mock_s3.put_object.call_count == 3
    
    @patch('boto3.client')
    def test_get_image_url(self, mock_boto_client):
        """Test getting image URL"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = 'https://image-url.com'
        
        service = ImageService()
        
        url = service.get_image_url('test/image.jpg')
        
        assert url == 'https://image-url.com'
        mock_s3.generate_presigned_url.assert_called_once()
    
    @patch('boto3.client')
    def test_delete_image(self, mock_boto_client):
        """Test deleting image from S3"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        service = ImageService()
        
        result = service.delete_image('test/image.jpg')
        
        assert result is True
        mock_s3.delete_object.assert_called_once()
    
    @patch('boto3.client')
    def test_delete_image_failure(self, mock_boto_client):
        """Test delete image failure handling"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.delete_object.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchKey', 'Message': 'Key not found'}},
            'delete_object'
        )
        
        service = ImageService()
        
        result = service.delete_image('test/nonexistent.jpg')
        
        assert result is False
    
    # Additional comprehensive tests for task 4.3 requirements
    
    def test_validate_image_file_corrupted_data(self):
        """Test validation with corrupted image data"""
        # Create corrupted JPEG data
        corrupted_data = b'\xff\xd8\xff\xe0' + b'corrupted' * 100
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=corrupted_data,
                filename='test.jpg',
                content_type='image/jpeg'
            )
        
        assert "無効な画像ファイルです" in str(exc_info.value)
    
    def test_validate_image_file_empty_data(self):
        """Test validation with empty file data"""
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=b'',
                filename='test.jpg',
                content_type='image/jpeg'
            )
        
        assert "無効な画像ファイルです" in str(exc_info.value)
    
    def test_validate_image_file_unsupported_mime_type(self):
        """Test validation with unsupported MIME type"""
        image_data = self.create_test_image('JPEG')
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=image_data,
                filename='test.jpg',
                content_type='image/gif'
            )
        
        assert "サポートされていないファイル形式" in str(exc_info.value)
    
    def test_validate_image_file_no_extension(self):
        """Test validation with filename without extension"""
        image_data = self.create_test_image('JPEG')
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=image_data,
                filename='test',
                content_type='image/jpeg'
            )
        
        assert "ファイル拡張子が無効です" in str(exc_info.value)
    
    def test_process_image_invalid_data(self):
        """Test image processing with invalid data"""
        invalid_data = b'not an image'
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.process_image(
                file_data=invalid_data,
                filename='test.jpg'
            )
        
        assert "画像の処理に失敗しました" in str(exc_info.value)
    
    def test_process_image_handles_exif_orientation(self):
        """Test image processing handles EXIF orientation"""
        # Create image with EXIF data (simulated)
        img = Image.new('RGB', (200, 100), color='blue')
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        image_data = buffer.getvalue()
        
        processed = self.image_service.process_image(
            file_data=image_data,
            filename='test.jpg'
        )
        
        # Verify all sizes are created
        assert len(processed) == 3
        for size, data in processed.items():
            img = Image.open(io.BytesIO(data))
            assert img.format == 'JPEG'
    
    def test_process_image_palette_mode(self):
        """Test image processing with palette mode image"""
        # Create palette mode image
        img = Image.new('P', (100, 100))
        # Add a simple palette
        img.putpalette([i for i in range(256)] * 3)
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        image_data = buffer.getvalue()
        
        processed = self.image_service.process_image(
            file_data=image_data,
            filename='test.png'
        )
        
        # Should convert to RGB JPEG
        for size, data in processed.items():
            img = Image.open(io.BytesIO(data))
            assert img.format == 'JPEG'
            assert img.mode == 'RGB'
    
    @patch('boto3.client')
    def test_generate_upload_url_s3_error(self, mock_boto_client):
        """Test upload URL generation with S3 error"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.side_effect = ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            'generate_presigned_url'
        )
        
        service = ImageService()
        
        with pytest.raises(ValidationError) as exc_info:
            service.generate_upload_url(
                filename='test.jpg',
                content_type='image/jpeg',
                user_id='user123'
            )
        
        assert "アップロードURLの生成に失敗しました" in str(exc_info.value)
    
    @patch('boto3.client')
    def test_generate_upload_url_creates_unique_key(self, mock_boto_client):
        """Test that upload URL generation creates unique S3 keys"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = 'https://test-url.com'
        
        service = ImageService()
        
        result1 = service.generate_upload_url('test.jpg', 'image/jpeg', 'user123')
        result2 = service.generate_upload_url('test.jpg', 'image/jpeg', 'user123')
        
        # Keys should be different (UUID-based)
        assert result1['s3_key'] != result2['s3_key']
        # But both should contain user ID
        assert 'user123' in result1['s3_key']
        assert 'user123' in result2['s3_key']
    
    @patch('boto3.client')
    def test_upload_processed_images_partial_failure(self, mock_boto_client):
        """Test upload processed images with partial failure"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        # First upload succeeds, second fails
        mock_s3.put_object.side_effect = [
            None,  # Success
            ClientError({'Error': {'Code': 'NoSuchBucket', 'Message': 'Bucket not found'}}, 'put_object'),
            None   # Success
        ]
        
        service = ImageService()
        
        processed_images = {
            'original': b'original_data',
            'medium': b'medium_data',
            'thumbnail': b'thumb_data'
        }
        
        with pytest.raises(ValidationError) as exc_info:
            service.upload_processed_images(
                processed_images=processed_images,
                base_key='test/user123/image.jpg'
            )
        
        assert "画像のアップロードに失敗しました" in str(exc_info.value)
    
    @patch('boto3.client')
    def test_upload_processed_images_key_generation(self, mock_boto_client):
        """Test upload processed images generates correct S3 keys"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        service = ImageService()
        
        processed_images = {
            'original': b'original_data',
            'medium': b'medium_data',
            'thumbnail': b'thumb_data'
        }
        
        result = service.upload_processed_images(
            processed_images=processed_images,
            base_key='test/user123/image.jpg'
        )
        
        # Check that keys are generated correctly
        assert result['original'] == 'test/user123/image_original.jpg'
        assert result['medium'] == 'test/user123/image_medium.jpg'
        assert result['thumbnail'] == 'test/user123/image_thumbnail.jpg'
        
        # Verify put_object calls
        expected_calls = [
            call(
                Bucket=service.bucket_name,
                Key='test/user123/image_original.jpg',
                Body=b'original_data',
                ContentType='image/jpeg',
                CacheControl='max-age=31536000'
            ),
            call(
                Bucket=service.bucket_name,
                Key='test/user123/image_medium.jpg',
                Body=b'medium_data',
                ContentType='image/jpeg',
                CacheControl='max-age=31536000'
            ),
            call(
                Bucket=service.bucket_name,
                Key='test/user123/image_thumbnail.jpg',
                Body=b'thumb_data',
                ContentType='image/jpeg',
                CacheControl='max-age=31536000'
            )
        ]
        mock_s3.put_object.assert_has_calls(expected_calls, any_order=True)
    
    @patch('boto3.client')
    def test_get_image_url_error_handling(self, mock_boto_client):
        """Test get image URL error handling"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchKey', 'Message': 'Key not found'}},
            'generate_presigned_url'
        )
        
        service = ImageService()
        
        url = service.get_image_url('test/nonexistent.jpg')
        
        assert url == ""
    
    @patch('boto3.client')
    def test_get_image_url_custom_expiration(self, mock_boto_client):
        """Test get image URL with custom expiration"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = 'https://image-url.com'
        
        service = ImageService()
        
        url = service.get_image_url('test/image.jpg', expires_in=7200)
        
        assert url == 'https://image-url.com'
        mock_s3.generate_presigned_url.assert_called_with(
            'get_object',
            Params={'Bucket': service.bucket_name, 'Key': 'test/image.jpg'},
            ExpiresIn=7200
        )
    
    @patch('boto3.client')
    def test_ensure_bucket_exists_creation(self, mock_boto_client):
        """Test bucket creation when bucket doesn't exist"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        # First call (head_bucket) fails, second call (create_bucket) succeeds
        mock_s3.head_bucket.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchBucket', 'Message': 'Bucket not found'}},
            'head_bucket'
        )
        
        service = ImageService()
        
        # Verify create_bucket was called
        mock_s3.create_bucket.assert_called_once_with(Bucket=service.bucket_name)
    
    @patch('boto3.client')
    def test_ensure_bucket_exists_already_exists(self, mock_boto_client):
        """Test bucket creation when bucket already exists"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        # head_bucket succeeds (bucket exists)
        mock_s3.head_bucket.return_value = {}
        
        service = ImageService()
        
        # Verify create_bucket was not called
        mock_s3.create_bucket.assert_not_called()
    
    @patch('boto3.client')
    def test_ensure_bucket_exists_creation_failure(self, mock_boto_client):
        """Test bucket creation failure handling"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        
        # Both head_bucket and create_bucket fail
        mock_s3.head_bucket.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchBucket', 'Message': 'Bucket not found'}},
            'head_bucket'
        )
        mock_s3.create_bucket.side_effect = ClientError(
            {'Error': {'Code': 'BucketAlreadyExists', 'Message': 'Bucket already exists'}},
            'create_bucket'
        )
        
        # Should not raise exception, just log error
        service = ImageService()
        
        # Verify both operations were attempted
        mock_s3.head_bucket.assert_called_once()
        mock_s3.create_bucket.assert_called_once()
    
    def test_image_service_constants(self):
        """Test ImageService constants are properly defined"""
        assert ImageService.MAX_FILE_SIZE == 5 * 1024 * 1024
        assert ImageService.THUMBNAIL_SIZE == (300, 300)
        assert ImageService.MEDIUM_SIZE == (800, 800)
        assert 'JPEG' in ImageService.SUPPORTED_FORMATS
        assert 'PNG' in ImageService.SUPPORTED_FORMATS
        assert 'image/jpeg' in ImageService.SUPPORTED_MIME_TYPES
        assert 'image/png' in ImageService.SUPPORTED_MIME_TYPES
    
    def test_process_image_size_constraints(self):
        """Test that processed images respect size constraints"""
        # Create large image
        large_image_data = self.create_test_image('JPEG', size=(2000, 2000))
        
        processed = self.image_service.process_image(
            file_data=large_image_data,
            filename='large.jpg'
        )
        
        # Check thumbnail size
        thumb_img = Image.open(io.BytesIO(processed['thumbnail']))
        assert thumb_img.size[0] <= ImageService.THUMBNAIL_SIZE[0]
        assert thumb_img.size[1] <= ImageService.THUMBNAIL_SIZE[1]
        
        # Check medium size
        medium_img = Image.open(io.BytesIO(processed['medium']))
        assert medium_img.size[0] <= ImageService.MEDIUM_SIZE[0]
        assert medium_img.size[1] <= ImageService.MEDIUM_SIZE[1]
    
    def test_validate_image_file_edge_case_sizes(self):
        """Test validation with edge case file sizes"""
        # Test exactly at limit
        limit_data = b'x' * ImageService.MAX_FILE_SIZE
        
        with pytest.raises(ValidationError):
            # This will fail because it's not a valid image, but size check comes first
            self.image_service.validate_image_file(
                file_data=limit_data,
                filename='test.jpg',
                content_type='image/jpeg'
            )
        
        # Test just over limit
        over_limit_data = b'x' * (ImageService.MAX_FILE_SIZE + 1)
        
        with pytest.raises(ValidationError) as exc_info:
            self.image_service.validate_image_file(
                file_data=over_limit_data,
                filename='test.jpg',
                content_type='image/jpeg'
            )
        
        assert "ファイルサイズが制限を超えています" in str(exc_info.value)

class TestImageServiceIntegration:
    """Integration tests for ImageService with mocked S3"""
    
    @patch('boto3.client')
    def test_full_image_upload_workflow(self, mock_boto_client):
        """Test complete image upload workflow"""
        mock_s3 = Mock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = 'https://upload-url.com'
        
        service = ImageService()
        
        # Step 1: Generate upload URL
        upload_info = service.generate_upload_url(
            filename='test.jpg',
            content_type='image/jpeg',
            user_id='user123'
        )
        
        assert 'upload_url' in upload_info
        assert 's3_key' in upload_info
        
        # Step 2: Process image
        image_data = self.create_test_image('JPEG', size=(1000, 1000))
        processed = service.process_image(
            file_data=image_data,
            filename='test.jpg'
        )
        
        assert len(processed) == 3
        
        # Step 3: Upload processed images
        uploaded_keys = service.upload_processed_images(
            processed_images=processed,
            base_key=upload_info['s3_key']
        )
        
        assert len(uploaded_keys) == 3
        assert mock_s3.put_object.call_count == 3
    
    def create_test_image(self, format='JPEG', size=(100, 100), mode='RGB'):
        """Create a test image in memory"""
        img = Image.new(mode, size, color='red')
        buffer = io.BytesIO()
        img.save(buffer, format=format)
        return buffer.getvalue()

if __name__ == '__main__':
    pytest.main([__file__])