/**
 * コード分割とレイジーローディング用ユーティリティ
 * 要件6.4: バンドルサイズ最適化とコード分割実装
 */

import React, { lazy, Suspense, memo } from 'react';
import Loading from '../components/Common/Loading';

// 遅延読み込み用のラッパーコンポーネント
const LazyWrapper = memo(({ 
  children, 
  fallback = <Loading />, 
  errorBoundary = true,
  retryCount = 3 
}) => {
  const [error, setError] = React.useState(null);
  const [retries, setRetries] = React.useState(0);

  const handleRetry = () => {
    if (retries < retryCount) {
      setError(null);
      setRetries(prev => prev + 1);
      // 強制的にコンポーネントを再読み込み
      window.location.reload();
    }
  };

  if (error && errorBoundary) {
    return (
      <div className="alert alert-danger text-center" role="alert">
        <h5 className="alert-heading">
          <i className="bi bi-exclamation-triangle me-2"></i>
          コンポーネントの読み込みに失敗しました
        </h5>
        <p className="mb-3">
          ネットワーク接続を確認して、再試行してください。
        </p>
        <div className="d-flex justify-content-center gap-2">
          <button 
            className="btn btn-outline-danger btn-sm"
            onClick={handleRetry}
            disabled={retries >= retryCount}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            再試行 ({retries}/{retryCount})
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => window.location.href = '/'}
          >
            <i className="bi bi-house me-1"></i>
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
});

LazyWrapper.displayName = 'LazyWrapper';

// 遅延読み込みコンポーネント作成ヘルパー
export const createLazyComponent = (importFunc, options = {}) => {
  const {
    fallback = <Loading />,
    errorBoundary = true,
    retryCount = 3,
    preload = false
  } = options;

  const LazyComponent = lazy(() => 
    importFunc().catch(error => {
      console.error('Lazy component loading failed:', error);
      throw error;
    })
  );

  const WrappedComponent = memo((props) => (
    <LazyWrapper 
      fallback={fallback}
      errorBoundary={errorBoundary}
      retryCount={retryCount}
    >
      <LazyComponent {...props} />
    </LazyWrapper>
  ));

  WrappedComponent.displayName = `Lazy(${LazyComponent.displayName || 'Component'})`;

  // プリロード機能
  if (preload) {
    WrappedComponent.preload = importFunc;
  }

  return WrappedComponent;
};

// 主要ページコンポーネントの遅延読み込み
export const LazyHome = createLazyComponent(
  () => import('../pages/Home'),
  { 
    fallback: <Loading message="ホームページを読み込み中..." />,
    preload: true 
  }
);

export const LazyProfile = createLazyComponent(
  () => import('../pages/Profile'),
  { 
    fallback: <Loading message="プロフィールページを読み込み中..." />,
    preload: true 
  }
);

export const LazyUpload = createLazyComponent(
  () => import('../pages/Upload'),
  { 
    fallback: <Loading message="アップロードページを読み込み中..." /> 
  }
);

export const LazyLogin = createLazyComponent(
  () => import('../pages/Login'),
  { 
    fallback: <Loading message="ログインページを読み込み中..." />,
    preload: true 
  }
);

export const LazyRegister = createLazyComponent(
  () => import('../pages/Register'),
  { 
    fallback: <Loading message="登録ページを読み込み中..." /> 
  }
);

// 投稿関連コンポーネントの遅延読み込み
export const LazyPostDetail = createLazyComponent(
  () => import('../components/Posts/PostDetail'),
  { 
    fallback: <Loading message="投稿詳細を読み込み中..." /> 
  }
);

export const LazyPostList = createLazyComponent(
  () => import('../components/Posts/PostList'),
  { 
    fallback: <Loading message="投稿一覧を読み込み中..." />,
    preload: true 
  }
);

export const LazyUploadForm = createLazyComponent(
  () => import('../components/Posts/UploadForm'),
  { 
    fallback: <Loading message="アップロードフォームを読み込み中..." /> 
  }
);

// インタラクション関連コンポーネントの遅延読み込み
export const LazyCommentSection = createLazyComponent(
  () => import('../components/Interactions/CommentSection'),
  { 
    fallback: <div className="placeholder-glow"><div className="placeholder col-12" style={{height: '100px'}}></div></div> 
  }
);

export const LazyLikeButton = createLazyComponent(
  () => import('../components/Interactions/LikeButton'),
  { 
    fallback: <div className="placeholder-glow"><div className="placeholder col-3" style={{height: '40px'}}></div></div> 
  }
);

// プロフィール関連コンポーネントの遅延読み込み
export const LazyEditProfile = createLazyComponent(
  () => import('../components/Profile/EditProfile'),
  { 
    fallback: <Loading message="プロフィール編集フォームを読み込み中..." /> 
  }
);

export const LazyProfilePosts = createLazyComponent(
  () => import('../components/Profile/ProfilePosts'),
  { 
    fallback: <Loading message="投稿一覧を読み込み中..." /> 
  }
);

// ルートベースのコード分割
export const routeComponents = {
  Home: LazyHome,
  Profile: LazyProfile,
  Upload: LazyUpload,
  Login: LazyLogin,
  Register: LazyRegister,
  PostDetail: LazyPostDetail
};

// プリロード管理
class PreloadManager {
  constructor() {
    this.preloadedComponents = new Set();
    this.preloadPromises = new Map();
  }

  // コンポーネントのプリロード
  preload(componentName, importFunc) {
    if (this.preloadedComponents.has(componentName)) {
      return this.preloadPromises.get(componentName);
    }

    const promise = importFunc().then(module => {
      this.preloadedComponents.add(componentName);
      return module;
    }).catch(error => {
      console.error(`Failed to preload ${componentName}:`, error);
      throw error;
    });

    this.preloadPromises.set(componentName, promise);
    return promise;
  }

  // 重要なコンポーネントの一括プリロード
  preloadCritical() {
    const criticalComponents = [
      { name: 'Home', func: () => import('../pages/Home') },
      { name: 'Login', func: () => import('../pages/Login') },
      { name: 'Profile', func: () => import('../pages/Profile') },
      { name: 'PostList', func: () => import('../components/Posts/PostList') }
    ];

    return Promise.allSettled(
      criticalComponents.map(({ name, func }) => this.preload(name, func))
    );
  }

  // ユーザーの行動に基づく予測プリロード
  predictivePreload(currentRoute) {
    const preloadMap = {
      '/': ['Profile', 'Upload'], // ホームからプロフィールやアップロードに移動する可能性
      '/login': ['Home'], // ログイン後はホームに移動
      '/profile': ['EditProfile', 'Upload'], // プロフィールから編集やアップロードに移動
      '/upload': ['Home'] // アップロード後はホームに移動
    };

    const componentsToPreload = preloadMap[currentRoute] || [];
    
    componentsToPreload.forEach(componentName => {
      const component = routeComponents[componentName];
      if (component && component.preload) {
        this.preload(componentName, component.preload);
      }
    });
  }

  // アイドル時間を利用したプリロード
  preloadOnIdle() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.preloadCritical();
      });
    } else {
      // フォールバック: 少し遅延してプリロード
      setTimeout(() => {
        this.preloadCritical();
      }, 2000);
    }
  }
}

export const preloadManager = new PreloadManager();

// バンドル分析用のユーティリティ
export const bundleAnalyzer = {
  // 読み込まれたチャンクの情報を取得
  getLoadedChunks: () => {
    if (window.__webpack_require__ && window.__webpack_require__.cache) {
      return Object.keys(window.__webpack_require__.cache);
    }
    return [];
  },

  // バンドルサイズの推定
  estimateBundleSize: () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    let totalSize = 0;

    scripts.forEach(script => {
      // スクリプトのサイズを推定（実際のサイズは取得できないため概算）
      const src = script.src;
      if (src.includes('chunk') || src.includes('bundle')) {
        totalSize += 100; // KB単位での概算
      }
    });

    return totalSize;
  },

  // パフォーマンス情報の収集
  getPerformanceInfo: () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');

    return {
      loadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : 0,
      resourceCount: resources.length,
      jsResources: resources.filter(r => r.name.includes('.js')).length,
      cssResources: resources.filter(r => r.name.includes('.css')).length
    };
  }
};

// 動的インポート用のヘルパー
export const dynamicImport = async (modulePath, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.warn(`Dynamic import failed (attempt ${i + 1}/${retries}):`, error);
      
      if (i === retries - 1) {
        throw error;
      }
      
      // 指数バックオフで再試行
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};

// Webpackチャンクの事前読み込み
export const preloadChunk = (chunkName) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = `/${chunkName}.js`;
  document.head.appendChild(link);
};

export default {
  createLazyComponent,
  LazyWrapper,
  routeComponents,
  preloadManager,
  bundleAnalyzer,
  dynamicImport,
  preloadChunk
};