import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * プロフィールヘッダーコンポーネント
 * 要件5.1, 5.4: プロフィール情報表示と権限制御
 */
const ProfileHeader = ({ 
  profile, 
  postsCount = 0, 
  onEditClick, 
  onImageUpload,
  loading = false 
}) => {
  const { user: currentUser } = useAuth();
  const [imageLoading, setImageLoading] = useState(false);
  
  // 自分のプロフィールかどうかを判定
  const isOwnProfile = currentUser?.user_id === profile?.user_id;
  
  // プロフィール画像変更処理
  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // ファイル検証
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('JPEG、PNG形式の画像ファイルのみアップロード可能です');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB制限
      alert('ファイルサイズは5MB以下にしてください');
      return;
    }
    
    setImageLoading(true);
    try {
      if (onImageUpload) {
        await onImageUpload(file);
      }
    } catch (error) {
      console.error('プロフィール画像アップロードエラー:', error);
      alert('画像のアップロードに失敗しました');
    } finally {
      setImageLoading(false);
    }
  };
  
  // 日付フォーマット
  const formatJoinDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long'
    });
  };
  
  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="row">
            <div className="col-md-4 text-center">
              <div className="placeholder-glow">
                <div 
                  className="placeholder rounded-circle mx-auto"
                  style={{ width: '150px', height: '150px' }}
                ></div>
              </div>
            </div>
            <div className="col-md-8">
              <div className="placeholder-glow">
                <h2 className="placeholder col-6"></h2>
                <p className="placeholder col-8"></p>
                <div className="row">
                  <div className="col-4">
                    <div className="placeholder col-12"></div>
                  </div>
                  <div className="col-4">
                    <div className="placeholder col-12"></div>
                  </div>
                  <div className="col-4">
                    <div className="placeholder col-12"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <i className="bi bi-person-x text-muted mb-3" style={{ fontSize: '4rem' }}></i>
          <h4 className="text-muted">ユーザーが見つかりません</h4>
          <p className="text-muted">
            このユーザーは存在しないか、削除された可能性があります。
          </p>
          <Link to="/" className="btn btn-primary">
            <i className="bi bi-house me-2"></i>
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="row">
          {/* プロフィール画像 */}
          <div className="col-md-4 text-center">
            <div className="profile-image-container mb-3 position-relative">
              <img
                src={profile.profile_image || '/default-avatar.png'}
                alt={`${profile.username}のプロフィール画像`}
                className="rounded-circle img-fluid border"
                style={{ 
                  width: '150px', 
                  height: '150px', 
                  objectFit: 'cover',
                  opacity: imageLoading ? 0.5 : 1
                }}
              />
              
              {/* 画像アップロード中のローディング */}
              {imageLoading && (
                <div 
                  className="position-absolute top-50 start-50 translate-middle"
                  style={{ zIndex: 1 }}
                >
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">アップロード中...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* 画像変更ボタン（自分のプロフィールのみ） */}
            {isOwnProfile && (
              <div>
                <input
                  type="file"
                  id="profile-image-input"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                  disabled={imageLoading}
                />
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => document.getElementById('profile-image-input').click()}
                  disabled={imageLoading}
                >
                  <i className="bi bi-camera me-1"></i>
                  {imageLoading ? 'アップロード中...' : '画像を変更'}
                </button>
              </div>
            )}
          </div>
          
          {/* プロフィール情報 */}
          <div className="col-md-8">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="mb-0">{profile.username}</h2>
              
              {/* 編集ボタン（自分のプロフィールのみ） */}
              {isOwnProfile && (
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={onEditClick}
                >
                  <i className="bi bi-pencil me-1"></i>
                  プロフィールを編集
                </button>
              )}
            </div>
            
            {/* 統計情報 */}
            <div className="row mb-4">
              <div className="col-4 text-center">
                <div className="d-flex flex-column">
                  <strong className="fs-5">{postsCount.toLocaleString()}</strong>
                  <span className="text-muted small">投稿</span>
                </div>
              </div>
              <div className="col-4 text-center">
                <div className="d-flex flex-column">
                  <strong className="fs-5">0</strong>
                  <span className="text-muted small">フォロワー</span>
                </div>
              </div>
              <div className="col-4 text-center">
                <div className="d-flex flex-column">
                  <strong className="fs-5">0</strong>
                  <span className="text-muted small">フォロー中</span>
                </div>
              </div>
            </div>
            
            {/* 自己紹介 */}
            {profile.bio && (
              <div className="mb-3">
                <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {profile.bio}
                </p>
              </div>
            )}
            
            {/* 参加日 */}
            {profile.created_at && (
              <div className="text-muted small">
                <i className="bi bi-calendar3 me-1"></i>
                {formatJoinDate(profile.created_at)}に参加
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;