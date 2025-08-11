import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../Common/Loading';

/**
 * プロフィール投稿グリッドコンポーネント
 * 要件5.1, 5.3: ユーザー投稿一覧表示と削除機能
 */
const ProfilePosts = ({ userId, onPostsCountChange }) => {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [lastKey, setLastKey] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, post: null });

  // 自分のプロフィールかどうかを判定
  const isOwnProfile = currentUser?.user_id === userId;

  // 投稿一覧読み込み
  const loadPosts = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setLastKey(null);
        setHasMore(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = {
        limit: 12,
        ...(lastKey && !reset ? { last_key: lastKey } : {})
      };

      const response = await api.posts.getUserPosts(userId, params);
      const { posts: newPosts, last_key: newLastKey } = response.data;

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }

      setLastKey(newLastKey);
      setHasMore(!!newLastKey && newPosts.length > 0);

      // 投稿数を親コンポーネントに通知
      if (onPostsCountChange && reset) {
        onPostsCountChange(newPosts.length + (newLastKey ? 1 : 0)); // 概算
      }

    } catch (error) {
      console.error('投稿読み込みエラー:', error);
      setError(error.message || '投稿の読み込みに失敗しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, lastKey, onPostsCountChange]);

  // 初期読み込み
  useEffect(() => {
    if (userId) {
      loadPosts(true);
    }
  }, [userId, loadPosts]);

  // 投稿削除処理
  const handleDeletePost = async (postId) => {
    try {
      await api.posts.deletePost(postId);
      
      // 投稿を一覧から削除
      setPosts(prev => prev.filter(post => post.post_id !== postId));
      
      // 投稿数を更新
      if (onPostsCountChange) {
        onPostsCountChange(posts.length - 1);
      }
      
      setDeleteModal({ show: false, post: null });
    } catch (error) {
      console.error('投稿削除エラー:', error);
      alert('投稿の削除に失敗しました');
    }
  };

  // 削除確認モーダルを開く
  const openDeleteModal = (post) => {
    setDeleteModal({ show: true, post });
  };

  // 削除確認モーダルを閉じる
  const closeDeleteModal = () => {
    setDeleteModal({ show: false, post: null });
  };

  // 無限スクロール処理
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop
      >= document.documentElement.offsetHeight - 1000
      && hasMore && !loadingMore
    ) {
      loadPosts(false);
    }
  }, [hasMore, loadingMore, loadPosts]);

  // スクロールイベントリスナー
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <div className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>
            <strong>エラーが発生しました</strong>
            <div>{error}</div>
          </div>
        </div>
        <button 
          className="btn btn-outline-danger btn-sm mt-2"
          onClick={() => loadPosts(true)}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          再試行
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="mb-4">
          <i className="bi bi-camera text-muted" style={{ fontSize: '4rem' }}></i>
        </div>
        <h5 className="text-muted mb-3">
          {isOwnProfile ? 'まだ投稿がありません' : '投稿がありません'}
        </h5>
        <p className="text-muted mb-4">
          {isOwnProfile 
            ? '最初の投稿をして、あなたの写真を共有しましょう！' 
            : 'このユーザーはまだ投稿していません。'
          }
        </p>
        {isOwnProfile && (
          <Link to="/upload" className="btn btn-primary">
            <i className="bi bi-plus-circle me-2"></i>
            投稿する
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="profile-posts">
      {/* 投稿グリッド */}
      <div className="row g-1">
        {posts.map((post) => (
          <div key={post.post_id} className="col-4">
            <div className="position-relative post-grid-item">
              <Link to={`/posts/${post.post_id}`} className="d-block">
                <div 
                  className="ratio ratio-1x1 bg-light rounded overflow-hidden"
                  style={{ cursor: 'pointer' }}
                >
                  <img
                    src={post.image_url}
                    alt={post.caption || '投稿画像'}
                    className="img-fluid w-100 h-100"
                    style={{ objectFit: 'cover' }}
                    loading="lazy"
                  />
                  
                  {/* ホバー時のオーバーレイ */}
                  <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-50 opacity-0 hover-overlay">
                    <div className="text-white text-center">
                      <div className="d-flex align-items-center justify-content-center gap-3">
                        <div className="d-flex align-items-center">
                          <i className="bi bi-heart-fill me-1"></i>
                          <span>{post.likes_count}</span>
                        </div>
                        <div className="d-flex align-items-center">
                          <i className="bi bi-chat-fill me-1"></i>
                          <span>{post.comments_count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              
              {/* 削除ボタン（自分の投稿のみ） */}
              {isOwnProfile && (
                <div className="position-absolute top-0 end-0 p-2">
                  <button
                    className="btn btn-sm btn-danger opacity-75"
                    onClick={(e) => {
                      e.preventDefault();
                      openDeleteModal(post);
                    }}
                    title="投稿を削除"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 追加読み込み中インジケーター */}
      {loadingMore && (
        <div className="d-flex justify-content-center py-4">
          <div className="d-flex align-items-center text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">読み込み中...</span>
            </div>
            <span>投稿を読み込み中...</span>
          </div>
        </div>
      )}

      {/* 読み込み完了メッセージ */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-4">
          <div className="text-muted">
            <i className="bi bi-check-circle me-2"></i>
            すべての投稿を表示しました
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteModal.show && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">投稿を削除</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeDeleteModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-3">
                  <img
                    src={deleteModal.post?.image_url}
                    alt="削除対象の投稿"
                    className="img-fluid rounded"
                    style={{ maxHeight: '200px', objectFit: 'cover' }}
                  />
                </div>
                <p>この投稿を削除してもよろしいですか？</p>
                <p className="text-muted small">
                  この操作は取り消すことができません。投稿に関連するいいねやコメントもすべて削除されます。
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeDeleteModal}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDeletePost(deleteModal.post.post_id)}
                >
                  <i className="bi bi-trash me-2"></i>
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS スタイル */}
      <style jsx>{`
        .post-grid-item:hover .hover-overlay {
          opacity: 1 !important;
          transition: opacity 0.2s ease;
        }
        
        .post-grid-item .hover-overlay {
          transition: opacity 0.2s ease;
        }
      `}</style>
    </div>
  );
};

export default ProfilePosts;