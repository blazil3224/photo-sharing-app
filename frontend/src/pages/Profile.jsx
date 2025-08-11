import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { ProfileHeader, EditProfile, ProfilePosts } from '../components/Profile';
import Loading from '../components/Common/Loading';

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [postsCount, setPostsCount] = useState(0);

  // プロフィール読み込み
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.users.getProfile(userId);
      setProfile(response.data);
    } catch (error) {
      console.error('プロフィール読み込みエラー:', error);
      if (error.status === 404) {
        setError('ユーザーが見つかりません');
      } else {
        setError(error.message || 'プロフィールの読み込みに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 初期読み込み
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (userId) {
      loadProfile();
    }
  }, [userId, isAuthenticated, navigate, loadProfile]);

  // プロフィール画像アップロード処理
  const handleImageUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('profile_image', file);
      
      const response = await api.users.updateProfileImage(currentUser.user_id, formData);
      
      if (response.success) {
        // プロフィール情報を更新
        setProfile(prev => ({
          ...prev,
          profile_image: response.data.profile_image
        }));
      }
    } catch (error) {
      console.error('プロフィール画像アップロードエラー:', error);
      throw error;
    }
  };

  // プロフィール編集開始
  const handleEditStart = () => {
    setIsEditing(true);
  };

  // プロフィール編集保存
  const handleEditSave = (updatedProfile) => {
    setProfile(updatedProfile);
    setIsEditing(false);
  };

  // プロフィール編集キャンセル
  const handleEditCancel = () => {
    setIsEditing(false);
  };

  // 投稿数変更処理
  const handlePostsCountChange = (count) => {
    setPostsCount(count);
  };

  if (!isAuthenticated) {
    return null; // リダイレクト中
  }

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="d-flex justify-content-center py-5">
              <Loading />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="row">
          <div className="col-lg-8 mx-auto">
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
                  onClick={loadProfile}
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
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          {/* プロフィールヘッダー */}
          {isEditing ? (
            <EditProfile
              profile={profile}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          ) : (
            <ProfileHeader
              profile={profile}
              postsCount={postsCount}
              onEditClick={handleEditStart}
              onImageUpload={handleImageUpload}
            />
          )}
          
          {/* 投稿タブとグリッド */}
          {!isEditing && (
            <div className="mt-4">
              <div className="border-bottom mb-4">
                <nav className="nav nav-tabs">
                  <span className="nav-link active">
                    <i className="bi bi-grid-3x3 me-1"></i>
                    投稿
                  </span>
                </nav>
              </div>
              
              {/* ユーザーの投稿グリッド */}
              <ProfilePosts 
                userId={userId} 
                onPostsCountChange={handlePostsCountChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;