/**
 * 強化されたフロントエンドエラーハンドリング
 * 要件6.2, 6.4: ユーザーフレンドリーなエラーメッセージ表示
 */

import { securityLogger } from './security';

// エラータイプの定義
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// エラーメッセージのマッピング
const ERROR_MESSAGES = {
  [ErrorTypes.NETWORK_ERROR]: {
    title: 'ネットワークエラー',
    message: 'インターネット接続を確認してください',
    action: '再試行'
  },
  [ErrorTypes.VALIDATION_ERROR]: {
    title: '入力エラー',
    message: '入力内容を確認してください',
    action: '修正'
  },
  [ErrorTypes.AUTHENTICATION_ERROR]: {
    title: '認証エラー',
    message: 'ログインが必要です',
    action: 'ログイン'
  },
  [ErrorTypes.AUTHORIZATION_ERROR]: {
    title: '権限エラー',
    message: 'この操作を実行する権限がありません',
    action: '戻る'
  },
  [ErrorTypes.NOT_FOUND_ERROR]: {
    title: '見つかりません',
    message: 'お探しのページまたはリソースが見つかりません',
    action: 'ホームに戻る'
  },
  [ErrorTypes.RATE_LIMIT_ERROR]: {
    title: 'リクエスト制限',
    message: 'しばらく時間をおいてから再試行してください',
    action: '待機'
  },
  [ErrorTypes.SERVER_ERROR]: {
    title: 'サーバーエラー',
    message: 'サーバーで問題が発生しました',
    action: '再試行'
  },
  [ErrorTypes.CLIENT_ERROR]: {
    title: 'クライアントエラー',
    message: 'リクエストに問題があります',
    action: '確認'
  },
  [ErrorTypes.UNKNOWN_ERROR]: {
    title: '不明なエラー',
    message: '予期しないエラーが発生しました',
    action: '再試行'
  }
};

// エラー分類関数
export const classifyError = (error) => {
  if (!error) {
    return ErrorTypes.UNKNOWN_ERROR;
  }

  // ネットワークエラー
  if (!error.response && error.request) {
    return ErrorTypes.NETWORK_ERROR;
  }

  // HTTPステータスコードによる分類
  if (error.response) {
    const status = error.response.status;
    
    if (status === 400) {
      return ErrorTypes.VALIDATION_ERROR;
    } else if (status === 401) {
      return ErrorTypes.AUTHENTICATION_ERROR;
    } else if (status === 403) {
      return ErrorTypes.AUTHORIZATION_ERROR;
    } else if (status === 404) {
      return ErrorTypes.NOT_FOUND_ERROR;
    } else if (status === 429) {
      return ErrorTypes.RATE_LIMIT_ERROR;
    } else if (status >= 500) {
      return ErrorTypes.SERVER_ERROR;
    } else if (status >= 400) {
      return ErrorTypes.CLIENT_ERROR;
    }
  }

  // エラーコードによる分類
  if (error.code) {
    const code = error.code.toUpperCase();
    if (Object.values(ErrorTypes).includes(code)) {
      return code;
    }
  }

  return ErrorTypes.UNKNOWN_ERROR;
};

// エラー情報の標準化
export const normalizeError = (error) => {
  const errorType = classifyError(error);
  const defaultInfo = ERROR_MESSAGES[errorType];
  
  const normalizedError = {
    type: errorType,
    title: defaultInfo.title,
    message: defaultInfo.message,
    action: defaultInfo.action,
    timestamp: new Date().toISOString(),
    errorId: null,
    details: null,
    retryAfter: null
  };

  // サーバーからのエラー情報を使用
  if (error.response?.data?.error) {
    const serverError = error.response.data.error;
    normalizedError.message = serverError.message || normalizedError.message;
    normalizedError.errorId = serverError.error_id || serverError.errorId;
    normalizedError.details = serverError.details;
    
    // レート制限の場合はRetry-After情報を取得
    if (errorType === ErrorTypes.RATE_LIMIT_ERROR) {
      normalizedError.retryAfter = error.response.headers['retry-after'];
    }
  }

  // クライアントサイドエラーの場合
  if (error.message && !error.response) {
    normalizedError.message = error.message;
  }

  return normalizedError;
};

// エラーログ記録
export const logError = (error, context = {}) => {
  const normalizedError = normalizeError(error);
  
  // セキュリティログに記録
  securityLogger.log('ERROR_OCCURRED', {
    errorType: normalizedError.type,
    errorId: normalizedError.errorId,
    message: normalizedError.message,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: normalizedError.timestamp
  });

  // 開発環境ではコンソールにも出力
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', {
      normalizedError,
      originalError: error,
      context
    });
  }

  return normalizedError;
};

// エラー表示用のReactコンポーネント
export const ErrorDisplay = ({ error, onRetry, onDismiss, className = '' }) => {
  if (!error) return null;

  const normalizedError = typeof error === 'object' && error.type 
    ? error 
    : normalizeError(error);

  const getIconClass = (errorType) => {
    switch (errorType) {
      case ErrorTypes.NETWORK_ERROR:
        return 'bi-wifi-off';
      case ErrorTypes.VALIDATION_ERROR:
        return 'bi-exclamation-triangle';
      case ErrorTypes.AUTHENTICATION_ERROR:
        return 'bi-person-x';
      case ErrorTypes.AUTHORIZATION_ERROR:
        return 'bi-shield-x';
      case ErrorTypes.NOT_FOUND_ERROR:
        return 'bi-search';
      case ErrorTypes.RATE_LIMIT_ERROR:
        return 'bi-clock';
      case ErrorTypes.SERVER_ERROR:
        return 'bi-server';
      default:
        return 'bi-exclamation-circle';
    }
  };

  const getAlertClass = (errorType) => {
    switch (errorType) {
      case ErrorTypes.VALIDATION_ERROR:
        return 'alert-warning';
      case ErrorTypes.AUTHENTICATION_ERROR:
      case ErrorTypes.AUTHORIZATION_ERROR:
        return 'alert-danger';
      case ErrorTypes.NOT_FOUND_ERROR:
        return 'alert-info';
      case ErrorTypes.RATE_LIMIT_ERROR:
        return 'alert-warning';
      default:
        return 'alert-danger';
    }
  };

  return (
    <div className={`alert ${getAlertClass(normalizedError.type)} ${className}`} role="alert">
      <div className="d-flex align-items-start">
        <i className={`bi ${getIconClass(normalizedError.type)} me-3 mt-1`} style={{ fontSize: '1.2rem' }}></i>
        <div className="flex-grow-1">
          <h6 className="alert-heading mb-2">{normalizedError.title}</h6>
          <p className="mb-2">{normalizedError.message}</p>
          
          {normalizedError.errorId && (
            <small className="text-muted d-block mb-2">
              エラーID: {normalizedError.errorId}
            </small>
          )}
          
          {normalizedError.retryAfter && (
            <small className="text-muted d-block mb-2">
              {normalizedError.retryAfter}秒後に再試行してください
            </small>
          )}
          
          <div className="d-flex gap-2 mt-3">
            {onRetry && (
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={onRetry}
                disabled={normalizedError.retryAfter > 0}
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                {normalizedError.action}
              </button>
            )}
            
            {onDismiss && (
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={onDismiss}
              >
                <i className="bi bi-x me-1"></i>
                閉じる
              </button>
            )}
          </div>
        </div>
        
        {onDismiss && (
          <button 
            type="button" 
            className="btn-close" 
            onClick={onDismiss}
            aria-label="Close"
          ></button>
        )}
      </div>
    </div>
  );
};

// エラーバウンダリ用のエラーハンドラー
export const handleComponentError = (error, errorInfo) => {
  const context = {
    componentStack: errorInfo.componentStack,
    errorBoundary: true
  };
  
  logError(error, context);
  
  return normalizeError(error);
};

// 非同期操作のエラーハンドリング
export const handleAsyncError = async (asyncOperation, context = {}) => {
  try {
    return await asyncOperation();
  } catch (error) {
    const normalizedError = logError(error, context);
    throw normalizedError;
  }
};

// グローバルエラーハンドラーの設定
export const setupGlobalErrorHandlers = () => {
  // 未処理のPromise拒否
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    logError(error, { type: 'unhandled_promise_rejection' });
    
    // 開発環境以外では詳細なエラーを隠す
    if (process.env.NODE_ENV !== 'development') {
      event.preventDefault();
    }
  });

  // 未処理のJavaScriptエラー
  window.addEventListener('error', (event) => {
    const error = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    };
    
    logError(error, { type: 'unhandled_javascript_error' });
  });

  // リソース読み込みエラー
  window.addEventListener('error', (event) => {
    if (event.target !== window) {
      const error = {
        message: `Failed to load resource: ${event.target.src || event.target.href}`,
        type: 'resource_load_error',
        element: event.target.tagName
      };
      
      logError(error, { type: 'resource_load_error' });
    }
  }, true);
};

// エラー回復機能
export const createErrorRecovery = (maxRetries = 3, baseDelay = 1000) => {
  return async (operation, context = {}) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const normalizedError = normalizeError(error);
        
        // 回復不可能なエラーの場合は即座に失敗
        if ([
          ErrorTypes.AUTHENTICATION_ERROR,
          ErrorTypes.AUTHORIZATION_ERROR,
          ErrorTypes.VALIDATION_ERROR
        ].includes(normalizedError.type)) {
          throw normalizedError;
        }
        
        // 最後の試行の場合は失敗
        if (attempt === maxRetries) {
          logError(error, { ...context, finalAttempt: true, totalAttempts: attempt });
          throw normalizedError;
        }
        
        // 指数バックオフで待機
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        logError(error, { ...context, attempt, nextRetryIn: delay * 2 });
      }
    }
  };
};

export default {
  ErrorTypes,
  classifyError,
  normalizeError,
  logError,
  ErrorDisplay,
  handleComponentError,
  handleAsyncError,
  setupGlobalErrorHandlers,
  createErrorRecovery
};