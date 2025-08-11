import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadForm } from '../components/Posts';
import { useAuth } from '../contexts/AuthContext';

/**
 * 写真アップロードページ
 * 要件2.1-2.4: 写真アップロード機能の統合ページ
 */
const Upload = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  // 未認証ユーザーのリダイレクト
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  /**
   * アップロード成功時の処理
   */
  const handleUploadSuccess = (postData) => {
    // 投稿詳細ページまたはホームページにリダイレクト
    navigate('/', { 
      state: { 
        message: '投稿が正常にアップロードされました！',
        newPost: postData 
      }
    });
  };
  
  /**
   * キャンセル時の処理
   */
  const handleClose = () => {
    navigate(-1); // 前のページに戻る
  };
  
  if (!isAuthenticated) {
    return null; // リダイレクト中は何も表示しない
  }
  
  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <UploadForm 
            onUploadSuccess={handleUploadSuccess}
            onClose={handleClose}
          />
        </div>
      </div>
    </div>
  );
};

export default Upload;