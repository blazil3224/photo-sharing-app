/**
 * エラーバウンダリーコンポーネント
 * Reactアプリケーション全体のエラーハンドリング
 */
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // エラーが発生した場合の状態更新
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // エラー情報をログに記録
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // エラー報告サービスに送信（本番環境では実装）
    if (process.env.NODE_ENV === 'production') {
      // TODO: エラー報告サービス（Sentry等）への送信
      console.error('Production error:', error);
    }
  }

  handleReload = () => {
    // ページをリロード
    window.location.reload();
  };

  handleGoHome = () => {
    // ホームページに戻る
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // エラー発生時のフォールバックUI
      return (
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="card border-danger">
                <div className="card-header bg-danger text-white">
                  <h4 className="mb-0">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    エラーが発生しました
                  </h4>
                </div>
                <div className="card-body">
                  <p className="card-text">
                    申し訳ございません。予期しないエラーが発生しました。
                    ページをリロードするか、ホームページに戻ってお試しください。
                  </p>
                  
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <div className="mt-4">
                      <h6>エラー詳細（開発環境のみ表示）:</h6>
                      <div className="bg-light p-3 rounded">
                        <pre className="mb-2 text-danger">
                          {this.state.error.toString()}
                        </pre>
                        {this.state.errorInfo.componentStack && (
                          <details>
                            <summary className="text-muted">コンポーネントスタック</summary>
                            <pre className="mt-2 text-muted small">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <button 
                      className="btn btn-primary me-2" 
                      onClick={this.handleReload}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      ページをリロード
                    </button>
                    <button 
                      className="btn btn-outline-secondary" 
                      onClick={this.handleGoHome}
                    >
                      <i className="bi bi-house me-1"></i>
                      ホームに戻る
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // エラーがない場合は通常の子コンポーネントを表示
    return this.props.children;
  }
}

export default ErrorBoundary;