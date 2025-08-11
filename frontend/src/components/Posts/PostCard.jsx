/**
 * 投稿カードコンポーネント
 * タイムラインで表示される個別の投稿カード
 * 要件6.4: 画像遅延読み込み（Lazy Loading）実装
 */
import React, { useState, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { LikeButton, InteractionStats } from '../Interactions';
import LazyImage from '../Common/LazyImage';
import { usePerformanceMonitor } from '../../hooks/usePerformance';

const PostCard = memo(({ post, onLikeToggle, onDelete }) => {
  const { user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // パフォーマンス監視
  usePerformanceMonitor(`PostCard-${post.post_id}`);

  // いいね変更ハンドラー（メモ化）
  const handleLikeChange = useCallback((postId, liked, newCount) => {
    if (onLikeToggle) {
      onLikeToggle(postId);
    }
  }, [onLikeToggle]);

  // 投稿削除処理（メモ化）
  const handleDelete = useCallback(async () => {
    try {
      await api.posts.deletePost(post.post_id);
      if (onDelete) {
        onDelete(post.post_id);
      }
      setShowDeleteModal(false);
    } catch (error) {
      console.error('投稿削除でエラーが発生しました:', error);
    }
  }, [post.post_id, onDelete]);

  // モーダル表示制御（メモ化）
  const handleShowDeleteModal = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleHideDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  // 投稿日時のフォーマット（メモ化）
  const formattedDate = React.useMemo(() => {
    const date = new Date(post.created_at);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '1日前';
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  }, [post.created_at]);

  // ユーザーが投稿の所有者かどうかをメモ化
  const isOwner = React.useMemo(() => {
    return user?.user_id === post.user_id;
  }, [user?.user_id, post.user_id]);

  return (
    <div className="card mb-4 shadow-sm">
      {/* 投稿ヘッダー */}
      <div className="card-header bg-white border-0 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <LazyImage
              src={post.user?.profile_image || '/default-avatar.png'}
              alt={post.user?.username || 'ユーザーアバター'}
              className="rounded-circle me-3"
              style={{ width: '40px', height: '40px', objectFit: 'cover' }}
              placeholder="/default-avatar.png"
              errorImage="/default-avatar.png"
              loading="eager"
            />
            <div>
              <Link 
                to={`/profile/${post.user_id}`}
                className="text-decoration-none fw-bold text-dark"
              >
                {post.user?.username || 'Unknown User'}
              </Link>
              <div className="text-muted small">
                {formattedDate}
              </div>
            </div>
          </div>
          
          {/* 投稿オプション（自分の投稿の場合のみ表示） */}
          {isOwner && (
            <div className="dropdown">
              <button
                className="btn btn-link text-muted p-0"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label="投稿オプション"
              >
                <i className="bi bi-three-dots"></i>
              </button>
              <ul className="dropdown-menu">
                <li>
                  <button
                    className="dropdown-item text-danger"
                    onClick={handleShowDeleteModal}
                  >
                    <i className="bi bi-trash me-2"></i>
                    削除
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 投稿画像 */}
      <div className="position-relative">
        <LazyImage
          src={post.image_url}
          alt={post.caption || '投稿画像'}
          className="card-img-top"
          style={{ maxHeight: '600px', objectFit: 'cover', width: '100%' }}
          placeholder="/image-placeholder.svg"
          errorImage="/image-error.svg"
          threshold={0.1}
          rootMargin="100px"
          onLoad={() => {
            // 画像読み込み完了時の処理（必要に応じて）
            if (process.env.NODE_ENV === 'development') {
              console.log(`Image loaded for post ${post.post_id}`);
            }
          }}
        />
      </div>

      {/* 投稿アクション */}
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-3 align-items-center">
            <LikeButton
              postId={post.post_id}
              initialLiked={post.user_liked}
              initialCount={post.likes_count}
              onLikeChange={handleLikeChange}
              showCount={false}
            />
            <Link
              to={`/posts/${post.post_id}`}
              className="btn btn-link p-0 text-decoration-none text-dark"
              title="コメントを見る"
            >
              <i className="bi bi-chat fs-5"></i>
            </Link>
          </div>
        </div>

        {/* インタラクション統計 */}
        <InteractionStats
          postId={post.post_id}
          likesCount={post.likes_count}
          commentsCount={post.comments_count}
          showCommentsDetail={true}
        />

        {/* キャプション */}
        {post.caption && (
          <div className="mb-2">
            <span className="fw-bold me-2">{post.user?.username}</span>
            <span>{post.caption}</span>
          </div>
        )}

        {/* コメント数 */}
        {post.comments_count > 0 && (
          <Link
            to={`/posts/${post.post_id}`}
            className="text-muted text-decoration-none small"
          >
            {post.comments_count}件のコメントをすべて表示
          </Link>
        )}
      </div>

      {/* 削除確認モーダル */}
      {showDeleteModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">投稿を削除</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleHideDeleteModal}
                  aria-label="閉じる"
                ></button>
              </div>
              <div className="modal-body">
                <p>この投稿を削除してもよろしいですか？</p>
                <p className="text-muted small">この操作は取り消すことができません。</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleHideDeleteModal}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

PostCard.displayName = 'PostCard';

export default PostCard;