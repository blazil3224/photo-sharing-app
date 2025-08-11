import React, { useState, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * いいねボタンコンポーネント
 * 要件4.1, 4.2: いいね切り替えとオプティミスティックUI実装
 */
const LikeButton = ({ 
  postId, 
  initialLiked = false, 
  initialCount = 0, 
  onLikeChange,
  size = 'normal',
  showCount = true 
}) => {
  const { user, isAuthenticated } = useAuth();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // いいね切り替え処理（オプティミスティックUI）
  const handleLikeToggle = useCallback(async () => {
    if (!isAuthenticated) {
      setError('ログインが必要です');
      return;
    }

    if (isLoading) return;

    // オプティミスティック更新（即座にUIを更新）
    const previousLiked = isLiked;
    const previousCount = likesCount;
    
    setIsLiked(!previousLiked);
    setLikesCount(previousCount + (previousLiked ? -1 : 1));
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.interactions.toggleLike(postId);
      
      // サーバーからの実際の値で更新
      if (response.data) {
        setIsLiked(response.data.liked);
        setLikesCount(response.data.likes_count);
      }

      // 親コンポーネントに変更を通知
      if (onLikeChange) {
        onLikeChange(postId, !previousLiked, response.data?.likes_count || likesCount);
      }

    } catch (error) {
      console.error('いいね処理でエラーが発生しました:', error);
      
      // エラー時は元の状態に戻す（ロールバック）
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      setError(error.message || 'いいね処理に失敗しました');
      
      // エラーを一定時間後にクリア
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [postId, isLiked, likesCount, isAuthenticated, isLoading, onLikeChange]);

  // サイズに応じたクラス設定
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'fs-6';
      case 'large':
        return 'fs-3';
      default:
        return 'fs-5';
    }
  };

  return (
    <div className="like-button-container">
      <div className="d-flex align-items-center">
        <button
          className={`btn btn-link p-0 text-decoration-none position-relative ${
            isLiked ? 'text-danger' : 'text-dark'
          }`}
          onClick={handleLikeToggle}
          disabled={isLoading || !isAuthenticated}
          title={isAuthenticated ? (isLiked ? 'いいねを取り消す' : 'いいね') : 'ログインが必要です'}
          aria-label={`${isLiked ? 'いいねを取り消す' : 'いいね'} (${likesCount}件)`}
        >
          {/* ローディング中のスピナー */}
          {isLoading && (
            <div 
              className="position-absolute top-50 start-50 translate-middle"
              style={{ zIndex: 1 }}
            >
              <div 
                className="spinner-border text-primary" 
                style={{ width: '1rem', height: '1rem' }}
                role="status"
              >
                <span className="visually-hidden">処理中...</span>
              </div>
            </div>
          )}
          
          {/* ハートアイコン */}
          <i 
            className={`bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'} ${getSizeClasses()} ${
              isLoading ? 'opacity-25' : ''
            }`}
            style={{
              transition: 'all 0.2s ease',
              transform: isLiked ? 'scale(1.1)' : 'scale(1)'
            }}
          ></i>
        </button>

        {/* いいね数表示 */}
        {showCount && (
          <span 
            className={`ms-2 ${size === 'small' ? 'small' : ''} ${
              isLoading ? 'opacity-50' : ''
            }`}
            style={{ transition: 'opacity 0.2s ease' }}
          >
            {likesCount > 0 ? (
              <span className="fw-bold">
                {likesCount.toLocaleString()}
              </span>
            ) : (
              <span className="text-muted">0</span>
            )}
          </span>
        )}
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="mt-1">
          <small className="text-danger">
            <i className="bi bi-exclamation-triangle me-1"></i>
            {error}
          </small>
        </div>
      )}

      {/* 未認証ユーザー向けメッセージ */}
      {!isAuthenticated && (
        <div className="mt-1">
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            いいねするにはログインしてください
          </small>
        </div>
      )}
    </div>
  );
};

export default LikeButton;