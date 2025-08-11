import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { initSecurity, checkSecurityHeaders } from './utils/security';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Header from './components/Common/Header';
import Footer from './components/Common/Footer';
import { PageLoading } from './components/Common/Loading';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { ToastContainer } from './components/Common/Toast';

// Lazy Components - コード分割による最適化
import { 
  LazyHome,
  LazyLogin, 
  LazyRegister,
  LazyProfile,
  LazyUpload,
  LazyPostDetail,
  preloadManager
} from './utils/lazyComponents';

// Performance monitoring
import { usePerformanceMonitor } from './hooks/usePerformance';

// Bundle optimization
import { developmentTools, preloadStrategy } from './utils/bundleOptimization';

import './App.css';

// ルート変更時の予測プリロード
function RoutePreloader() {
  const location = useLocation();

  useEffect(() => {
    // 現在のルートに基づいて次に必要になりそうなコンポーネントをプリロード
    preloadManager.predictivePreload(location.pathname);
  }, [location.pathname]);

  return null;
}

// メインアプリケーションコンポーネント（認証状態を使用）
function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  
  // パフォーマンス監視
  usePerformanceMonitor('AppContent');

  useEffect(() => {
    // アプリケーション起動時に重要なコンポーネントをプリロード
    preloadManager.preloadOnIdle();
  }, []);

  if (loading) {
    return <PageLoading message="アプリケーションを読み込み中..." />;
  }

  return (
    <Router>
      <div className="App d-flex flex-column min-vh-100">
        <RoutePreloader />
        <Header user={user} />
        
        <main className="flex-grow-1">
          <ErrorBoundary>
            <Suspense fallback={<PageLoading message="ページを読み込み中..." />}>
              <Routes>
                {/* Public Routes */}
                <Route 
                  path="/login" 
                  element={
                    isAuthenticated ? <Navigate to="/" replace /> : <LazyLogin />
                  } 
                />
                <Route 
                  path="/register" 
                  element={
                    isAuthenticated ? <Navigate to="/" replace /> : <LazyRegister />
                  } 
                />
                
                {/* Protected Routes */}
                <Route 
                  path="/" 
                  element={
                    isAuthenticated ? <LazyHome /> : <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/profile/:userId" 
                  element={
                    isAuthenticated ? <LazyProfile /> : <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/posts/:postId" 
                  element={
                    isAuthenticated ? <LazyPostDetail /> : <Navigate to="/login" replace />
                  } 
                />
                <Route 
                  path="/upload" 
                  element={
                    isAuthenticated ? <LazyUpload /> : <Navigate to="/login" replace />
                  } 
                />
                
                {/* Catch all route */}
                <Route 
                  path="*" 
                  element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} 
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        
        <Footer />
      </div>
    </Router>
  );
}

// メインAppコンポーネント（プロバイダーでラップ）
function App() {
  // パフォーマンス監視
  usePerformanceMonitor('App');

  useEffect(() => {
    // セキュリティ機能の初期化
    initSecurity();
    
    // セキュリティヘッダーのチェック（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      checkSecurityHeaders().then(headers => {
        console.log('Security headers:', headers);
      });
    }

    // パフォーマンス最適化のための初期設定
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // アイドル時間にバックグラウンドタスクを実行
        preloadManager.preloadCritical();
        
        // 開発環境でのバンドル分析
        if (process.env.NODE_ENV === 'development') {
          developmentTools.analyzeBundleInDev();
          developmentTools.startPerformanceMonitoring();
        }
      });
    }

    // リソースヒントの追加
    const addResourceHints = () => {
      // DNS prefetch for external resources
      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = '//fonts.googleapis.com';
      document.head.appendChild(dnsPrefetch);

      // Preconnect for critical resources
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      document.head.appendChild(preconnect);

      // 予測プリロードの実行
      const currentPath = window.location.pathname;
      const predictiveResources = preloadStrategy.predictive[currentPath];
      if (predictiveResources) {
        preloadStrategy.executePreload(predictiveResources);
      }
    };

    addResourceHints();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <ToastContainer />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;