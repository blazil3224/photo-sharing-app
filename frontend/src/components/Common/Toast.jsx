/**
 * トースト通知コンポーネント
 * エラーメッセージや成功メッセージの表示
 */
import React, { useState, useEffect, useCallback } from 'react';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        if (onClose) onClose();
      }, 300); // フェードアウトアニメーション時間
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  const getToastClass = () => {
    const baseClass = 'toast align-items-center border-0';
    switch (type) {
      case 'success':
        return `${baseClass} text-bg-success`;
      case 'error':
        return `${baseClass} text-bg-danger`;
      case 'warning':
        return `${baseClass} text-bg-warning`;
      case 'info':
      default:
        return `${baseClass} text-bg-info`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'bi-check-circle';
      case 'error':
        return 'bi-exclamation-circle';
      case 'warning':
        return 'bi-exclamation-triangle';
      case 'info':
      default:
        return 'bi-info-circle';
    }
  };

  return (
    <div 
      className={`${getToastClass()} ${visible ? 'show' : 'hide'}`} 
      role="alert" 
      aria-live="assertive" 
      aria-atomic="true"
      style={{
        transition: 'opacity 0.3s ease-in-out',
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="d-flex">
        <div className="toast-body d-flex align-items-center">
          <i className={`bi ${getIcon()} me-2`}></i>
          {message}
        </div>
        <button 
          type="button" 
          className="btn-close btn-close-white me-2 m-auto" 
          aria-label="Close"
          onClick={handleClose}
        ></button>
      </div>
    </div>
  );
};

// トースト管理コンポーネント
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prevToasts => [...prevToasts, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // グローバル関数として登録
  useEffect(() => {
    window.showToast = addToast;
    window.showSuccessToast = (message, duration) => addToast(message, 'success', duration);
    window.showErrorToast = (message, duration) => addToast(message, 'error', duration);
    window.showWarningToast = (message, duration) => addToast(message, 'warning', duration);
    window.showInfoToast = (message, duration) => addToast(message, 'info', duration);

    return () => {
      delete window.showToast;
      delete window.showSuccessToast;
      delete window.showErrorToast;
      delete window.showWarningToast;
      delete window.showInfoToast;
    };
  }, [addToast]);

  return (
    <div 
      className="toast-container position-fixed top-0 end-0 p-3" 
      style={{ zIndex: 1055 }}
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default Toast;