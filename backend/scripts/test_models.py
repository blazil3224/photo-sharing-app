#!/usr/bin/env python3
"""
Test script for DynamoDB models
"""
import os
import sys
import logging

# Add the parent directory to the path so we can import shared modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.models import User, Post, Interaction

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def test_user_model():
    """Test User model operations"""
    logger.info("Testing User model...")
    
    # Create a test user
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash="hashed_password_123",
        bio="Test user bio"
    )
    
    # Save user
    user.save()
    logger.info(f"Created user: {user.user_id}")
    
    # Retrieve user by ID
    retrieved_user = User.get_by_id(user.user_id)
    assert retrieved_user is not None
    assert retrieved_user.username == "testuser"
    logger.info("User retrieval by ID successful")
    
    # Retrieve user by username
    user_by_username = User.get_by_username("testuser")
    assert user_by_username is not None
    assert user_by_username.user_id == user.user_id
    logger.info("User retrieval by username successful")
    
    # Update user
    user.update(bio="Updated bio")
    updated_user = User.get_by_id(user.user_id)
    assert updated_user.bio == "Updated bio"
    logger.info("User update successful")
    
    return user

def test_post_model(user):
    """Test Post model operations"""
    logger.info("Testing Post model...")
    
    # Create a test post
    post = Post(
        user_id=user.user_id,
        image_key="test-image-key.jpg",
        caption="Test post caption"
    )
    
    # Save post
    post.save()
    logger.info(f"Created post: {post.post_id}")
    
    # Retrieve post by ID
    retrieved_post = Post.get_by_id(post.post_id)
    assert retrieved_post is not None
    assert retrieved_post.caption == "Test post caption"
    logger.info("Post retrieval by ID successful")
    
    # Get user posts
    user_posts = Post.get_user_posts(user.user_id)
    assert len(user_posts) >= 1
    assert user_posts[0].post_id == post.post_id
    logger.info("User posts retrieval successful")
    
    # Update post counts
    post.update_counts(likes_delta=1, comments_delta=1)
    updated_post = Post.get_by_id(post.post_id)
    assert updated_post.likes_count == 1
    assert updated_post.comments_count == 1
    logger.info("Post counts update successful")
    
    return post

def test_interaction_model(user, post):
    """Test Interaction model operations"""
    logger.info("Testing Interaction model...")
    
    # Create a like interaction
    like = Interaction(
        post_id=post.post_id,
        user_id=user.user_id,
        interaction_type="like"
    )
    
    # Save like
    like.save()
    logger.info(f"Created like: {like.interaction_id}")
    
    # Create a comment interaction
    comment = Interaction(
        post_id=post.post_id,
        user_id=user.user_id,
        interaction_type="comment",
        content="This is a test comment"
    )
    
    # Save comment
    comment.save()
    logger.info(f"Created comment: {comment.interaction_id}")
    
    # Get post interactions
    interactions = Interaction.get_post_interactions(post.post_id)
    assert len(interactions) >= 2
    logger.info("Post interactions retrieval successful")
    
    # Get likes only
    likes = Interaction.get_post_interactions(post.post_id, interaction_type="like")
    assert len(likes) >= 1
    logger.info("Post likes retrieval successful")
    
    # Check user like
    user_like = Interaction.get_user_like(post.post_id, user.user_id)
    assert user_like is not None
    logger.info("User like check successful")
    
    return like, comment

def cleanup_test_data(user, post, like, comment):
    """Clean up test data"""
    logger.info("Cleaning up test data...")
    
    # Delete interactions
    like.delete()
    comment.delete()
    
    # Delete post
    post.delete()
    
    # Delete user
    user.delete()
    
    logger.info("Test data cleanup completed")

def main():
    """Run model tests"""
    try:
        logger.info("Starting DynamoDB model tests...")
        
        # Set environment to local for development
        os.environ['ENVIRONMENT'] = 'local'
        
        # Test models
        user = test_user_model()
        post = test_post_model(user)
        like, comment = test_interaction_model(user, post)
        
        # Clean up
        cleanup_test_data(user, post, like, comment)
        
        logger.info("All model tests passed successfully!")
        
    except Exception as e:
        logger.error(f"Model tests failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()