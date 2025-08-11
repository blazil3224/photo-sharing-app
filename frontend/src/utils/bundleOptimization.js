/**
 * バンドル最適化ユーティリティ
 * 要件6.4: バンドルサイズ最適化とコード分割実装
 */

// Tree shaking の最適化
export const optimizeImports = {
  // Bootstrap の必要な部分のみインポート
  bootstrap: {
    // CSS は必要な部分のみ
    css: [
      'bootstrap/dist/css/bootstrap.min.css'
    ],
    // JS は使用する機能のみ
    js: [
      'bootstrap/js/dist/dropdown',
      'bootstrap/js/dist/modal',
      'bootstrap/js/dist/tooltip'
    ]
  },

  // React Router の最適化
  reactRouter: {
    // 必要なコンポーネントのみインポート
    components: [
      'BrowserRouter',
      'Routes',
      'Route',
      'Navigate',
      'Link'
    ]
  },

  // Axios の最適化
  axios: {
    // カスタムビルドを使用
    customBuild: true,
    features: [
      'request',
      'response',
      'interceptors',
      'defaults'
    ]
  }
};

// チャンク分割戦略
export const chunkStrategy = {
  // ベンダーライブラリの分割
  vendor: {
    react: ['react', 'react-dom'],
    router: ['react-router-dom'],
    ui: ['bootstrap'],
    utils: ['axios']
  },

  // ページレベルでの分割
  pages: {
    auth: ['Login', 'Register'],
    main: ['Home', 'Profile'],
    upload: ['Upload'],
    posts: ['PostDetail']
  },

  // 機能レベルでの分割
  features: {
    interactions: ['LikeButton', 'CommentSection'],
    profile: ['EditProfile', 'ProfilePosts'],
    common: ['Header', 'Footer', 'Loading']
  }
};

// バンドル分析レポート
export const bundleAnalyzer = {
  // バンドルサイズの測定
  measureBundleSize: () => {
    if (typeof window !== 'undefined' && window.performance) {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.includes('.js'));
      const cssResources = resources.filter(r => r.name.includes('.css'));

      return {
        totalJS: jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
        totalCSS: cssResources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
        resourceCount: {
          js: jsResources.length,
          css: cssResources.length,
          total: resources.length
        },
        loadTime: {
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          windowLoad: performance.timing.loadEventEnd - performance.timing.navigationStart
        }
      };
    }
    return null;
  },

  // 未使用コードの検出
  detectUnusedCode: () => {
    if (typeof window !== 'undefined' && window.coverage) {
      // Chrome DevTools Coverage API を使用
      return window.coverage.getCoverage();
    }
    return null;
  },

  // パフォーマンス推奨事項
  getRecommendations: (bundleInfo) => {
    const recommendations = [];

    if (bundleInfo.totalJS > 1024 * 1024) { // 1MB以上
      recommendations.push({
        type: 'warning',
        message: 'JavaScriptバンドルサイズが1MBを超えています',
        suggestion: 'コード分割を検討してください'
      });
    }

    if (bundleInfo.resourceCount.js > 10) {
      recommendations.push({
        type: 'info',
        message: 'JavaScriptファイル数が多すぎます',
        suggestion: 'バンドルの統合を検討してください'
      });
    }

    if (bundleInfo.loadTime.domContentLoaded > 3000) {
      recommendations.push({
        type: 'error',
        message: 'DOMContentLoadedが3秒を超えています',
        suggestion: 'クリティカルパスの最適化が必要です'
      });
    }

    return recommendations;
  }
};

// プリロード戦略
export const preloadStrategy = {
  // クリティカルリソースの特定
  critical: [
    '/static/css/main.css',
    '/static/js/main.js'
  ],

  // 予測プリロード
  predictive: {
    '/': ['/static/js/pages/Profile.js'],
    '/login': ['/static/js/pages/Home.js'],
    '/profile': ['/static/js/pages/EditProfile.js']
  },

  // プリロードリンクの生成
  generatePreloadLinks: (resources) => {
    return resources.map(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      
      if (resource.endsWith('.js')) {
        link.as = 'script';
      } else if (resource.endsWith('.css')) {
        link.as = 'style';
      } else if (resource.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
        link.as = 'image';
      }
      
      link.href = resource;
      return link;
    });
  },

  // プリロードの実行
  executePreload: (resources) => {
    const links = preloadStrategy.generatePreloadLinks(resources);
    links.forEach(link => {
      document.head.appendChild(link);
    });
  }
};

// Service Worker キャッシュ戦略
export const cacheStrategy = {
  // キャッシュ設定
  config: {
    // 静的リソース（長期キャッシュ）
    static: {
      pattern: /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/,
      strategy: 'CacheFirst',
      maxAge: 365 * 24 * 60 * 60 // 1年
    },

    // API レスポンス（短期キャッシュ）
    api: {
      pattern: /^https?:\/\/.*\/api\/.*/,
      strategy: 'NetworkFirst',
      maxAge: 5 * 60 // 5分
    },

    // HTML ページ（ネットワーク優先）
    pages: {
      pattern: /.*\.html$/,
      strategy: 'NetworkFirst',
      maxAge: 24 * 60 * 60 // 1日
    }
  },

  // キャッシュサイズの監視
  monitorCacheSize: () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate().then(estimate => ({
        quota: estimate.quota,
        usage: estimate.usage,
        usagePercentage: (estimate.usage / estimate.quota) * 100
      }));
    }
    return Promise.resolve(null);
  }
};

// 画像最適化
export const imageOptimization = {
  // 画像フォーマットの選択
  selectOptimalFormat: (originalUrl) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const formats = {
      avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0,
      webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
    };

    if (formats.avif) return originalUrl.replace(/\.(jpg|jpeg|png)$/, '.avif');
    if (formats.webp) return originalUrl.replace(/\.(jpg|jpeg|png)$/, '.webp');
    return originalUrl;
  },

  // レスポンシブ画像のsrcset生成
  generateSrcSet: (baseUrl, sizes = [320, 640, 768, 1024, 1280, 1920]) => {
    const extension = baseUrl.split('.').pop();
    const baseName = baseUrl.replace(`.${extension}`, '');

    return sizes
      .map(size => `${baseName}_${size}w.${extension} ${size}w`)
      .join(', ');
  },

  // 画像の遅延読み込み設定
  lazyLoadConfig: {
    threshold: 0.1,
    rootMargin: '50px',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg=='
  }
};

// パフォーマンス監視
export const performanceMonitoring = {
  // Core Web Vitals の測定
  measureWebVitals: async () => {
    try {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');
      
      const vitals = {};
      
      getCLS((metric) => { vitals.cls = metric.value; });
      getFID((metric) => { vitals.fid = metric.value; });
      getFCP((metric) => { vitals.fcp = metric.value; });
      getLCP((metric) => { vitals.lcp = metric.value; });
      getTTFB((metric) => { vitals.ttfb = metric.value; });
      
      return vitals;
    } catch (error) {
      console.warn('Web Vitals measurement failed:', error);
      return {};
    }
  },

  // バンドル読み込み時間の測定
  measureBundleLoadTime: () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    
    const jsResources = resources.filter(r => r.name.includes('.js'));
    const cssResources = resources.filter(r => r.name.includes('.css'));
    
    return {
      navigation: {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        loadComplete: navigation.loadEventEnd - navigation.fetchStart
      },
      resources: {
        js: jsResources.map(r => ({
          name: r.name,
          duration: r.duration,
          size: r.transferSize
        })),
        css: cssResources.map(r => ({
          name: r.name,
          duration: r.duration,
          size: r.transferSize
        }))
      }
    };
  },

  // パフォーマンス警告の生成
  generateWarnings: (metrics) => {
    const warnings = [];
    
    if (metrics.lcp > 2500) {
      warnings.push({
        type: 'LCP',
        message: 'Largest Contentful Paint が遅すぎます',
        value: metrics.lcp,
        threshold: 2500
      });
    }
    
    if (metrics.fid > 100) {
      warnings.push({
        type: 'FID',
        message: 'First Input Delay が長すぎます',
        value: metrics.fid,
        threshold: 100
      });
    }
    
    if (metrics.cls > 0.1) {
      warnings.push({
        type: 'CLS',
        message: 'Cumulative Layout Shift が大きすぎます',
        value: metrics.cls,
        threshold: 0.1
      });
    }
    
    return warnings;
  }
};

// 開発環境での最適化ツール
export const developmentTools = {
  // バンドル分析の実行
  analyzeBundleInDev: () => {
    if (process.env.NODE_ENV === 'development') {
      const bundleInfo = bundleAnalyzer.measureBundleSize();
      const recommendations = bundleAnalyzer.getRecommendations(bundleInfo);
      
      console.group('📦 Bundle Analysis');
      console.log('Bundle Info:', bundleInfo);
      console.log('Recommendations:', recommendations);
      console.groupEnd();
      
      return { bundleInfo, recommendations };
    }
  },

  // パフォーマンス監視の開始
  startPerformanceMonitoring: () => {
    if (process.env.NODE_ENV === 'development') {
      performanceMonitoring.measureWebVitals().then(vitals => {
        const warnings = performanceMonitoring.generateWarnings(vitals);
        
        console.group('⚡ Performance Monitoring');
        console.log('Web Vitals:', vitals);
        if (warnings.length > 0) {
          console.warn('Performance Warnings:', warnings);
        }
        console.groupEnd();
      });
    }
  }
};

export default {
  optimizeImports,
  chunkStrategy,
  bundleAnalyzer,
  preloadStrategy,
  cacheStrategy,
  imageOptimization,
  performanceMonitoring,
  developmentTools
};