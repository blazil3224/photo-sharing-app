import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../Common/Loading';

/**
 * コメントセクションコンポーネント
 * 要件4.3, 4.4: コメント表示・投稿機能とリアルタイム更新
 */
const CommentSection = ({ 
  postId, 
  initialComments = [], 
  initialCount = 0,
  onCommentChange,
  maxHeight = '400px',
  showAddComment = true 
}) => {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState(initialComments);
  const [commentsCount, setCommentsCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [lastKey, setLastKey] = useState(null);
  
  // 新しいコメント投稿用の状態
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  
  const textareaRef = useRef(null);
  const commentsEndRef = useRef(null);

  // コメント一覧読み込み
  const loadComments = useCallback(async (reset = false) => {
    if (loading || loadingMore) return;

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
        limit: 20,
        ...(lastKey && !reset ? { last_key: lastKey } : {})
      };

      const response = await api.interactions.getPostComments(postId, params);
      const { comments: newComments, last_key: newLastKey } = response.data;

      if (reset) {
        setComments(newComments);
      } else {
        setComments(prev => [...prev, ...newComments]);
      }

      setLastKey(newLastKey);
      setHasMore(!!newLastKey && newComments.length > 0);

    } catch (error) {
      console.error('コメント読み込みエラー:', error);
      setError(error.message || 'コメントの読み込みに失敗しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [postId, loading, loadingMore, lastKey]);

  // 初期読み込み
  useEffect(() => {
    if (initialComments.length === 0) {
      loadComments(true);
    }
  }, [postId, initialComments.length, loadComments]);

  // コメント投稿処理
  const handleCommentSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      setSubmitError('ログインが必要です');
      return;
    }

    const content = newComment.trim();
    if (!content) {
      setSubmitError('コメントを入力してください');
      return;
    }

    if (content.length > 500) {
      setSubmitError('コメントは500文字以内で入力してください');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.interactions.addComment(postId, { content });
      
      // 新しいコメントを一覧の先頭に追加（オプティミスティック更新）
      const newCommentData = {
        ...response.data,
        user: {
          user_id: user.user_id,
          username: user.username,
          profile_image: user.profile_image
        }
      };

      setComments(prev => [newCommentData, ...prev]);
      setCommentsCount(prev => prev + 1);
      setNewComment('');

      // 親コンポーネントに変更を通知
      if (onCommentChange) {
        onCommentChange(postId, commentsCount + 1);
      }

      // 新しいコメントまでスクロール
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      console.error('コメント投稿エラー:', error);
      setSubmitError(error.message || 'コメントの投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [postId, newComment, isAuthenticated, user, commentsCount, onCommentChange]);

  // テキストエリアの自動リサイズ
  const handleTextareaChange = useCallback((e) => {
    setNewComment(e.target.value);
    setSubmitError(null);
    
    // 自動リサイズ
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  // 日時フォーマット
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}分前`;
    } else if (diffHours < 24) {
      return `${diffHours}時間前`;
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-3">
        <Loading size="small" />
      </div>
    );
  }

  return (
    <div className="comment-section">
      {/* コメント数表示 */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">
          コメント ({commentsCount.toLocaleString()})
        </h6>
        {comments.length > 0 && (
          <button 
            className="btn btn-outline-secondary btn-sm"
            onClick={() => loadComments(true)}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            更新
          </button>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setError(null)}
          ></button>
        </div>
      )}

      {/* コメント一覧 */}
      <div 
        className="comments-list mb-3"
        style={{ 
          maxHeight, 
          overflowY: 'auto',
          border: comments.length > 0 ? '1px solid #dee2e6' : 'none',
          borderRadius: '0.375rem',
          padding: comments.length > 0 ? '1rem' : '0'
        }}
      >
        {comments.length > 0 ? (
          <>
            {comments.map((comment, index) => (
              <div 
                key={comment.interaction_id || index} 
                className={`d-flex mb-3 ${index === comments.length - 1 ? 'mb-0' : ''}`}
              >
                <img
                  src={comment.user?.profile_image || '/default-avatar.png'}
                  alt={comment.user?.username}
                  className="rounded-circle me-3 flex-shrink-0"
                  style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                />
                <div className="flex-grow-1">
                  <div className="bg-light rounded p-3">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <Link 
                        to={`/profile/${comment.user_id}`}
                        className="text-decoration-none fw-bold text-dark small"
                      >
                        {comment.user?.username || 'Unknown User'}
                      </Link>
                      <span className="text-muted small">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {comment.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* 追加読み込みボタン */}
            {hasMore && (
              <div className="text-center mt-3">
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => loadComments(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">読み込み中...</span>
                      </div>
                      読み込み中...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-chevron-down me-1"></i>
                      さらに読み込む
                    </>
                  )}
                </button>
              </div>
            )}
            
            <div ref={commentsEndRef} />
          </>
        ) : (
          <div className="text-center py-4 text-muted">
            <i className="bi bi-chat-dots mb-2 d-block" style={{ fontSize: '2rem' }}></i>
            <p className="mb-0">まだコメントがありません</p>
            <small>最初のコメントを投稿してみましょう！</small>
          </div>
        )}
      </div>

      {/* コメント投稿フォーム */}
      {showAddComment && (
        <div className="add-comment-form">
          {isAuthenticated ? (
            <form onSubmit={handleCommentSubmit}>
              <div className="d-flex">
                <img
                  src={user?.profile_image || '/default-avatar.png'}
                  alt={user?.username}
                  className="rounded-circle me-3 flex-shrink-0"
                  style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                />
                <div className="flex-grow-1">
                  <div className="input-group">
                    <textarea
                      ref={textareaRef}
                      className="form-control"
                      placeholder="コメントを追加..."
                      value={newComment}
                      onChange={handleTextareaChange}
                      disabled={isSubmitting}
                      rows="1"
                      style={{ 
                        resize: 'none',
                        minHeight: '38px',
                        maxHeight: '120px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          handleCommentSubmit(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!newComment.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <div className="spinner-border spinner-border-sm" role="status">
                          <span className="visually-hidden">送信中...</span>
                        </div>
                      ) : (
                        <>
                          <i className="bi bi-send me-1"></i>
                          投稿
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* 文字数カウンター */}
                  <div className="d-flex justify-content-between align-items-center mt-1">
                    <small className="text-muted">
                      Ctrl+Enterで投稿
                    </small>
                    <small className={`${newComment.length > 450 ? 'text-warning' : 'text-muted'}`}>
                      {newComment.length}/500
                    </small>
                  </div>
                  
                  {/* 投稿エラー表示 */}
                  {submitError && (
                    <div className="mt-2">
                      <small className="text-danger">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        {submitError}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <div className="text-center py-3 bg-light rounded">
              <p className="mb-2 text-muted">
                <i className="bi bi-chat-dots me-2"></i>
                コメントを投稿するにはログインしてください
              </p>
              <Link to="/login" className="btn btn-primary btn-sm">
                ログイン
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;