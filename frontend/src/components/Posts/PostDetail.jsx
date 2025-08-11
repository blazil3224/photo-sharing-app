/**
 * 投稿詳細ページコンポーネント
 * 投稿の詳細情報とコメント一覧を表示
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../Common/Loading';
import { LikeButton, CommentSection, InteractionStats } from '../Interactions';

const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 投稿詳細読み込み
  const loadPost = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.posts.getPost(postId);
      setPost(response.data);
    } catch (error) {
      console.error('投稿読み込みエラー:', error);
      if (error.status === 404) {
        setError('投稿が見つかりません');
      } else {
        setError(error.message || '投稿の読み込みに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // コメント一覧読み込み
  const loadComments = useCallback(async () => {
    try {
      setCommentsLoading(true);
      const response = await api.interactions.getPostComments(postId, { limit: 50 });
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('コメント読み込みエラー:', error);
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  // 初期データ読み込み
  useEffect(() => {
    loadPost();
    loadComments();
  }, [loadPost, loadComments]);



  // 投稿削除処理
  const handleDelete = async () => {
    try {
      await api.posts.deletePost(postId);
      navigate('/');
    } catch (error) {
      console.error('投稿削除でエラーが発生しました:', error);
    }
  };

  // 投稿日時のフォーマット
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="d-flex justify-content-center">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger" role="alert">
          <div className="d-flex align-items-center">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <div>
              <strong>エラーが発生しました</strong>
              <div>{error}</div>
            </div>
          </div>
          <div className="mt-3">
            <button 
              className="btn btn-outline-danger btn-sm me-2"
              onClick={loadPost}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              再試行
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/')}
            >
              <i className="bi bi-house me-1"></i>
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          {/* 戻るボタン */}
          <div className="mb-3">
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={() => navigate(-1)}
            >
              <i className="bi bi-arrow-left me-2"></i>
              戻る
            </button>
          </div>

          {/* 投稿詳細カード */}
          <div className="card shadow-sm">
            {/* 投稿ヘッダー */}
            <div className="card-header bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <img
                    src={post.user?.profile_image || '/default-avatar.png'}
                    alt={post.user?.username}
                    className="rounded-circle me-3"
                    style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                  />
                  <div>
                    <Link 
                      to={`/profile/${post.user_id}`}
                      className="text-decoration-none fw-bold text-dark h6 mb-0"
                    >
                      {post.user?.username || 'Unknown User'}
                    </Link>
                    <div className="text-muted small">
                      {formatDate(post.created_at)}
                    </div>
                  </div>
                </div>
                
                {/* 投稿オプション（自分の投稿の場合のみ表示） */}
                {user?.user_id === post.user_id && (
                  <div className="dropdown">
                    <button
                      className="btn btn-link text-muted p-0"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <i className="bi bi-three-dots"></i>
                    </button>
                    <ul className="dropdown-menu">
                      <li>
                        <button
                          className="dropdown-item text-danger"
                          onClick={() => setShowDeleteModal(true)}
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
              <img
                src={post.image_url}
                alt="投稿画像"
                className="card-img-top"
                style={{ maxHeight: '70vh', objectFit: 'contain', backgroundColor: '#f8f9fa' }}
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
                    size="large"
                    showCount={false}
                  />
                  <button className="btn btn-link p-0 text-decoration-none text-dark">
                    <i className="bi bi-chat fs-4"></i>
                  </button>
                </div>
              </div>

              {/* インタラクション統計 */}
              <InteractionStats
                postId={post.post_id}
                likesCount={post.likes_count}
                commentsCount={post.comments_count}
                showCommentsDetail={false}
                size="large"
              />

              {/* キャプション */}
              {post.caption && (
                <div className="mb-4">
                  <span className="fw-bold me-2">{post.user?.username}</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{post.caption}</span>
                </div>
              )}

              {/* コメントセクション */}
              <CommentSection
                postId={post.post_id}
                initialComments={comments}
                initialCount={post.comments_count}
                onCommentChange={(postId, newCount) => {
                  setPost(prevPost => ({
                    ...prevPost,
                    comments_count: newCount
                  }));
                }}
                maxHeight="500px"
                showAddComment={true}
              />
            </div>
          </div>
        </div>
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
                  onClick={() => setShowDeleteModal(false)}
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
                  onClick={() => setShowDeleteModal(false)}
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

export default PostDetail;