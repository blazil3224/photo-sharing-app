/**
 * ローディングコンポーネント
 * 各種ローディング状態の表示
 */
import React from 'react';

// 基本的なローディングスピナー
export const LoadingSpinner = ({ size = 'md', color = 'primary', className = '' }) => {
  const sizeClass = {
    sm: 'spinner-border-sm',
    md: '',
    lg: 'spinner-border-lg'
  }[size];

  return (
    <div className={`spinner-border text-${color} ${sizeClass} ${className}`} role="status">
      <span className="visually-hidden">読み込み中...</span>
    </div>
  );
};

// ページ全体のローディング
export const PageLoading = ({ message = '読み込み中...' }) => {
  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <div className="mt-3">
          <p className="text-muted">{message}</p>
        </div>
      </div>
    </div>
  );
};

// コンテンツエリアのローディング
export const ContentLoading = ({ message = '読み込み中...', height = '200px' }) => {
  return (
    <div 
      className="d-flex justify-content-center align-items-center"
      style={{ height }}
    >
      <div className="text-center">
        <LoadingSpinner />
        <div className="mt-2">
          <small className="text-muted">{message}</small>
        </div>
      </div>
    </div>
  );
};

// ボタン内のローディング
export const ButtonLoading = ({ loading, children, ...props }) => {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading && (
        <LoadingSpinner size="sm" className="me-2" />
      )}
      {children}
    </button>
  );
};

// カード形式のローディング
export const CardLoading = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card mb-3">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div 
                className="bg-light rounded-circle me-3"
                style={{ width: '40px', height: '40px' }}
              ></div>
              <div className="flex-grow-1">
                <div 
                  className="bg-light rounded mb-2"
                  style={{ height: '20px', width: '60%' }}
                ></div>
                <div 
                  className="bg-light rounded"
                  style={{ height: '16px', width: '40%' }}
                ></div>
              </div>
            </div>
            <div 
              className="bg-light rounded mt-3"
              style={{ height: '200px' }}
            ></div>
            <div className="mt-3">
              <div 
                className="bg-light rounded mb-2"
                style={{ height: '16px', width: '80%' }}
              ></div>
              <div 
                className="bg-light rounded"
                style={{ height: '16px', width: '60%' }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

// リスト形式のローディング
export const ListLoading = ({ count = 5 }) => {
  return (
    <div className="list-group">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="list-group-item">
          <div className="d-flex align-items-center">
            <div 
              className="bg-light rounded-circle me-3"
              style={{ width: '32px', height: '32px' }}
            ></div>
            <div className="flex-grow-1">
              <div 
                className="bg-light rounded mb-1"
                style={{ height: '16px', width: '70%' }}
              ></div>
              <div 
                className="bg-light rounded"
                style={{ height: '14px', width: '50%' }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// インラインローディング（テキスト内）
export const InlineLoading = ({ text = '処理中' }) => {
  return (
    <span className="d-inline-flex align-items-center">
      <LoadingSpinner size="sm" className="me-2" />
      {text}
    </span>
  );
};

// オーバーレイローディング
export const OverlayLoading = ({ show, message = '処理中...' }) => {
  if (!show) return null;

  return (
    <div 
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
        zIndex: 1050 
      }}
    >
      <div className="bg-white rounded p-4 text-center">
        <LoadingSpinner size="lg" />
        <div className="mt-3">
          <p className="mb-0">{message}</p>
        </div>
      </div>
    </div>
  );
};

// デフォルトエクスポート（後方互換性のため）
const Loading = ({ message = '読み込み中...' }) => {
  return <PageLoading message={message} />;
};

export default Loading;