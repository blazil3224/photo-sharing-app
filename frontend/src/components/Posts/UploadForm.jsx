import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import './UploadForm.css';

/**
 * 写真アップロードフォームコンポーネント
 * 要件2.1-2.4: 画像選択、プレビュー、ドラッグ&ドロップ、進捗表示、エラーハンドリング
 */
const UploadForm = ({ onUploadSuccess, onClose }) => {
  const { user } = useAuth();
  const { request } = useApi();
  
  // 状態管理
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // ファイル入力参照
  const fileInputRef = useRef(null);
  
  // サポートされるファイル形式とサイズ制限
  const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/jpg'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  
  /**
   * ファイル検証
   * 要件2.3, 2.4: ファイル形式とサイズの検証
   */
  const validateFile = (file) => {
    if (!file) {
      return '画像ファイルを選択してください';
    }
    
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return 'JPEG、PNG形式の画像ファイルのみアップロード可能です';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return 'ファイルサイズは5MB以下にしてください';
    }
    
    return null;
  };
  
  /**
   * ファイル選択処理
   * 要件2.1: 画像選択とプレビュー表示
   */
  const handleFileSelect = (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError('');
    setSelectedFile(file);
    
    // プレビュー画像の生成
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };
  
  /**
   * ファイル入力変更ハンドラー
   */
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };
  
  /**
   * ドラッグオーバーハンドラー
   * 要件2.2: ドラッグ&ドロップ機能
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  
  /**
   * ドラッグリーブハンドラー
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  
  /**
   * ドロップハンドラー
   * 要件2.2: ドラッグ&ドロップによるファイルアップロード
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);
  
  /**
   * アップロード処理
   * 要件2.2: 画像とキャプションの保存
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('画像ファイルを選択してください');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setError('');
    
    try {
      // FormDataの作成
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('caption', caption);
      
      // アップロード進捗の模擬（実際のAPIでは進捗イベントを使用）
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      // API呼び出し
      const response = await request('/api/posts', {
        method: 'POST',
        body: formData,
        // Content-Typeヘッダーは自動設定されるため削除
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.success) {
        // 成功時の処理
        setTimeout(() => {
          onUploadSuccess && onUploadSuccess(response.data);
          resetForm();
        }, 500);
      } else {
        throw new Error(response.message || 'アップロードに失敗しました');
      }
      
    } catch (err) {
      setError(err.message || 'アップロードに失敗しました');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };
  
  /**
   * フォームリセット
   */
  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setUploadProgress(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  /**
   * ファイル選択ボタンクリック
   */
  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-form">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">新しい投稿</h5>
          {onClose && (
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={isUploading}
            ></button>
          )}
        </div>
        
        <div className="card-body">
          {/* ドラッグ&ドロップエリア */}
          <div 
            className={`upload-area border-2 border-dashed rounded p-4 text-center mb-3 ${
              isDragOver ? 'border-primary bg-light' : 'border-secondary'
            } ${isUploading ? 'disabled' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ minHeight: '200px', cursor: isUploading ? 'not-allowed' : 'pointer' }}
            onClick={!isUploading ? handleFileSelectClick : undefined}
          >
            {previewUrl ? (
              <div className="preview-container">
                <img 
                  src={previewUrl} 
                  alt="プレビュー" 
                  className="img-fluid rounded"
                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                />
                <div className="mt-2">
                  <small className="text-muted">
                    {selectedFile?.name} ({(selectedFile?.size / 1024 / 1024).toFixed(2)} MB)
                  </small>
                </div>
              </div>
            ) : (
              <div className="upload-placeholder">
                <i className="bi bi-cloud-upload fs-1 text-muted mb-3"></i>
                <p className="mb-2">
                  {isDragOver ? '画像をドロップしてください' : '画像をドラッグ&ドロップまたはクリックして選択'}
                </p>
                <small className="text-muted">
                  JPEG、PNG形式 / 最大5MB
                </small>
              </div>
            )}
          </div>
          
          {/* 隠しファイル入力 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
          
          {/* キャプション入力 */}
          <div className="mb-3">
            <label htmlFor="caption" className="form-label">キャプション</label>
            <textarea
              id="caption"
              className="form-control"
              rows="3"
              placeholder="写真の説明を入力してください..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isUploading}
              maxLength={500}
            />
            <div className="form-text">
              {caption.length}/500文字
            </div>
          </div>
          
          {/* エラー表示 */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </div>
          )}
          
          {/* アップロード進捗 */}
          {isUploading && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted">アップロード中...</span>
                <span className="text-muted">{uploadProgress}%</span>
              </div>
              <div className="progress">
                <div 
                  className="progress-bar progress-bar-striped progress-bar-animated" 
                  role="progressbar" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        
        <div className="card-footer">
          <div className="d-flex justify-content-end gap-2">
            {onClose && (
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isUploading}
              >
                キャンセル
              </button>
            )}
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  アップロード中...
                </>
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  投稿する
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadForm;