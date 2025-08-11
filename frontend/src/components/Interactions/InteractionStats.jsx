import React from 'react';
import { Link } from 'react-router-dom';

/**
 * インタラクション統計表示コンポーネント
 * いいね数、コメント数などの統計情報を表示
 */
const InteractionStats = ({ 
  postId,
  likesCount = 0,
  commentsCount = 0,
  showLikesDetail = true,
  showCommentsDetail = true,
  size = 'normal'
}) => {
  
  // サイズに応じたクラス設定
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'small';
      case 'large':
        return 'fs-6';
      default:
        return '';
    }
  };

  const textClass = getSizeClasses();

  return (
    <div className="interaction-stats">
      {/* いいね数表示 */}
      {likesCount > 0 && showLikesDetail && (
        <div className={`fw-bold mb-2 ${textClass}`}>
          <i className="bi bi-heart-fill text-danger me-1"></i>
          {likesCount === 1 ? (
            '1件のいいね'
          ) : (
            `${likesCount.toLocaleString()}件のいいね`
          )}
        </div>
      )}

      {/* コメント数表示 */}
      {commentsCount > 0 && showCommentsDetail && (
        <div className={`mb-2 ${textClass}`}>
          {postId ? (
            <Link
              to={`/posts/${postId}`}
              className="text-muted text-decoration-none"
            >
              <i className="bi bi-chat me-1"></i>
              {commentsCount === 1 ? (
                '1件のコメント'
              ) : (
                `${commentsCount.toLocaleString()}件のコメント`
              )}
              をすべて表示
            </Link>
          ) : (
            <span className="text-muted">
              <i className="bi bi-chat me-1"></i>
              {commentsCount === 1 ? (
                '1件のコメント'
              ) : (
                `${commentsCount.toLocaleString()}件のコメント`
              )}
            </span>
          )}
        </div>
      )}

      {/* インタラクションがない場合 */}
      {likesCount === 0 && commentsCount === 0 && (
        <div className={`text-muted ${textClass}`}>
          <small>
            <i className="bi bi-heart me-1"></i>
            まだいいねやコメントがありません
          </small>
        </div>
      )}
    </div>
  );
};

export default InteractionStats;