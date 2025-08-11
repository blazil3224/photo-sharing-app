import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

/**
 * プロフィール編集コンポーネント
 * 要件5.2: プロフィール情報編集機能
 */
const EditProfile = ({ profile, onSave, onCancel, loading = false }) => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    email: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // プロフィールデータでフォームを初期化
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        email: profile.email || ''
      });
    }
  }, [profile]);

  // フォーム入力変更処理
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsDirty(true);
    
    // エラークリア
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // バリデーション
  const validateForm = () => {
    const newErrors = {};

    // ユーザー名検証
    if (!formData.username.trim()) {
      newErrors.username = 'ユーザー名は必須です';
    } else if (formData.username.length < 3) {
      newErrors.username = 'ユーザー名は3文字以上で入力してください';
    } else if (formData.username.length > 30) {
      newErrors.username = 'ユーザー名は30文字以内で入力してください';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'ユーザー名は英数字とアンダースコアのみ使用可能です';
    }

    // メールアドレス検証
    if (!formData.email.trim()) {
      newErrors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    // 自己紹介検証
    if (formData.bio.length > 500) {
      newErrors.bio = '自己紹介は500文字以内で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await api.users.updateProfile(user.user_id, {
        username: formData.username.trim(),
        bio: formData.bio.trim(),
        email: formData.email.trim()
      });

      if (response.success) {
        // 認証コンテキストのユーザー情報を更新
        if (updateUser) {
          updateUser({
            ...user,
            username: formData.username.trim(),
            bio: formData.bio.trim(),
            email: formData.email.trim()
          });
        }

        // 親コンポーネントに通知
        if (onSave) {
          onSave(response.data);
        }
        
        setIsDirty(false);
      } else {
        throw new Error(response.message || 'プロフィールの更新に失敗しました');
      }
    } catch (error) {
      console.error('プロフィール更新エラー:', error);
      
      // サーバーエラーの処理
      if (error.status === 409) {
        setErrors({ username: 'このユーザー名は既に使用されています' });
      } else if (error.status === 400) {
        setErrors({ general: error.message || '入力内容に問題があります' });
      } else {
        setErrors({ general: 'プロフィールの更新に失敗しました。しばらく後でお試しください。' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('変更内容が保存されていません。編集を終了しますか？')) {
        if (onCancel) {
          onCancel();
        }
      }
    } else {
      if (onCancel) {
        onCancel();
      }
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">読み込み中...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="bi bi-pencil me-2"></i>
          プロフィール編集
        </h5>
      </div>
      
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {/* 全般エラー表示 */}
          {errors.general && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {errors.general}
            </div>
          )}

          {/* ユーザー名 */}
          <div className="mb-3">
            <label htmlFor="username" className="form-label">
              ユーザー名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className={`form-control ${errors.username ? 'is-invalid' : ''}`}
              value={formData.username}
              onChange={handleInputChange}
              disabled={isSubmitting}
              placeholder="ユーザー名を入力"
              maxLength={30}
            />
            {errors.username && (
              <div className="invalid-feedback">
                {errors.username}
              </div>
            )}
            <div className="form-text">
              英数字とアンダースコアのみ使用可能（3-30文字）
            </div>
          </div>

          {/* メールアドレス */}
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              メールアドレス <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`form-control ${errors.email ? 'is-invalid' : ''}`}
              value={formData.email}
              onChange={handleInputChange}
              disabled={isSubmitting}
              placeholder="メールアドレスを入力"
            />
            {errors.email && (
              <div className="invalid-feedback">
                {errors.email}
              </div>
            )}
          </div>

          {/* 自己紹介 */}
          <div className="mb-4">
            <label htmlFor="bio" className="form-label">
              自己紹介
            </label>
            <textarea
              id="bio"
              name="bio"
              className={`form-control ${errors.bio ? 'is-invalid' : ''}`}
              rows="4"
              value={formData.bio}
              onChange={handleInputChange}
              disabled={isSubmitting}
              placeholder="自己紹介を入力してください..."
              maxLength={500}
            />
            {errors.bio && (
              <div className="invalid-feedback">
                {errors.bio}
              </div>
            )}
            <div className="form-text d-flex justify-content-between">
              <span>あなたについて教えてください</span>
              <span className={formData.bio.length > 450 ? 'text-warning' : 'text-muted'}>
                {formData.bio.length}/500
              </span>
            </div>
          </div>

          {/* 保存・キャンセルボタン */}
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  保存中...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-2"></i>
                  変更を保存
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;