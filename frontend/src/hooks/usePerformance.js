/**
 * パフォーマンス監視用カスタムフック
 * 要件6.4: コンポーネントのメモ化とパフォーマンス最適化
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// パフォーマンス測定フック
export const usePerformanceMonitor = (componentName) => {
  const renderStartTime = useRef(performance.now());
  const renderCount = useRef(0);
  const mountTime = useRef(null);

  useEffect(() => {
    // マウント時間を記録
    if (!mountTime.current) {
      mountTime.current = performance.now();
    }

    // レンダー回数をカウント
    renderCount.current += 1;

    // レンダー時間を測定
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;

    // パフォーマンスログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName}:`, {
        renderDuration: `${renderDuration.toFixed(2)}ms`,
        renderCount: renderCount.current,
        totalMountTime: mountTime.current ? `${(renderEndTime - mountTime.current).toFixed(2)}ms` : 'N/A'
      });
    }

    // 次回のレンダー開始時間を更新
    renderStartTime.current = performance.now();
  });

  return {
    renderCount: renderCount.current,
    getRenderDuration: () => performance.now() - renderStartTime.current
  };
};

// メモリ使用量監視フック
export const useMemoryMonitor = (interval = 5000) => {
  const [memoryInfo, setMemoryInfo] = useState(null);

  useEffect(() => {
    if (!('memory' in performance)) {
      return;
    }

    const updateMemoryInfo = () => {
      const memory = performance.memory;
      setMemoryInfo({
        usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
        timestamp: Date.now()
      });
    };

    updateMemoryInfo();
    const intervalId = setInterval(updateMemoryInfo, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return memoryInfo;
};

// レンダリング最適化フック
export const useRenderOptimization = (dependencies = []) => {
  const previousDeps = useRef(dependencies);
  const renderCount = useRef(0);
  const shouldRender = useRef(true);

  // 依存関係の変更をチェック
  const depsChanged = dependencies.some((dep, index) => 
    dep !== previousDeps.current[index]
  );

  if (depsChanged) {
    shouldRender.current = true;
    previousDeps.current = dependencies;
    renderCount.current += 1;
  } else {
    shouldRender.current = false;
  }

  return {
    shouldRender: shouldRender.current,
    renderCount: renderCount.current,
    skipRender: useCallback(() => {
      shouldRender.current = false;
    }, [])
  };
};

// 仮想スクロール用フック
export const useVirtualScroll = ({
  items = [],
  itemHeight = 100,
  containerHeight = 400,
  overscan = 5
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef(null);

  const visibleItemCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    startIndex + visibleItemCount + overscan * 2
  );

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    ...item,
    index: startIndex + index,
    offsetTop: (startIndex + index) * itemHeight
  }));

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((event) => {
    setScrollTop(event.target.scrollTop);
  }, []);

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    startIndex,
    endIndex
  };
};

// 画像遅延読み込み用フック
export const useLazyLoading = (threshold = 0.1, rootMargin = '50px') => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold, rootMargin }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [threshold, rootMargin]);

  return [targetRef, isIntersecting];
};

// デバウンス処理フック
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// スロットル処理フック
export const useThrottle = (callback, delay) => {
  const lastRun = useRef(Date.now());

  return useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
};

// Web Vitals 測定フック
export const useWebVitals = () => {
  const [vitals, setVitals] = useState({});

  useEffect(() => {
    // Core Web Vitals の測定
    const measureVitals = async () => {
      try {
        const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

        getCLS((metric) => {
          setVitals(prev => ({ ...prev, cls: metric.value }));
        });

        getFID((metric) => {
          setVitals(prev => ({ ...prev, fid: metric.value }));
        });

        getFCP((metric) => {
          setVitals(prev => ({ ...prev, fcp: metric.value }));
        });

        getLCP((metric) => {
          setVitals(prev => ({ ...prev, lcp: metric.value }));
        });

        getTTFB((metric) => {
          setVitals(prev => ({ ...prev, ttfb: metric.value }));
        });
      } catch (error) {
        console.warn('Web Vitals measurement failed:', error);
      }
    };

    measureVitals();
  }, []);

  return vitals;
};

// リソース使用量監視フック
export const useResourceMonitor = () => {
  const [resources, setResources] = useState({
    images: 0,
    scripts: 0,
    stylesheets: 0,
    total: 0
  });

  useEffect(() => {
    const updateResourceCount = () => {
      const images = document.querySelectorAll('img').length;
      const scripts = document.querySelectorAll('script').length;
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;
      
      setResources({
        images,
        scripts,
        stylesheets,
        total: images + scripts + stylesheets
      });
    };

    updateResourceCount();

    // DOM変更を監視
    const observer = new MutationObserver(updateResourceCount);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  return resources;
};

// パフォーマンス警告フック
export const usePerformanceWarnings = (thresholds = {}) => {
  const defaultThresholds = {
    renderTime: 16, // 60fps = 16.67ms per frame
    memoryUsage: 50, // MB
    resourceCount: 100,
    ...thresholds
  };

  const [warnings, setWarnings] = useState([]);
  const memoryInfo = useMemoryMonitor();
  const resources = useResourceMonitor();

  useEffect(() => {
    const newWarnings = [];

    // メモリ使用量チェック
    if (memoryInfo && memoryInfo.usedJSHeapSize > defaultThresholds.memoryUsage) {
      newWarnings.push({
        type: 'memory',
        message: `メモリ使用量が${memoryInfo.usedJSHeapSize}MBに達しています`,
        severity: 'warning'
      });
    }

    // リソース数チェック
    if (resources.total > defaultThresholds.resourceCount) {
      newWarnings.push({
        type: 'resources',
        message: `リソース数が${resources.total}個に達しています`,
        severity: 'info'
      });
    }

    setWarnings(newWarnings);
  }, [memoryInfo, resources, defaultThresholds]);

  return warnings;
};

// パフォーマンス最適化のためのユーティリティ
export const performanceUtils = {
  // 重い処理を次のフレームに延期
  defer: (callback) => {
    return new Promise(resolve => {
      requestIdleCallback(() => {
        const result = callback();
        resolve(result);
      });
    });
  },

  // バッチ処理
  batch: (tasks, batchSize = 10) => {
    return new Promise(resolve => {
      const results = [];
      let index = 0;

      const processBatch = () => {
        const batch = tasks.slice(index, index + batchSize);
        batch.forEach(task => {
          results.push(task());
        });

        index += batchSize;

        if (index < tasks.length) {
          requestAnimationFrame(processBatch);
        } else {
          resolve(results);
        }
      };

      processBatch();
    });
  },

  // メモリクリーンアップ
  cleanup: () => {
    // 不要なイベントリスナーの削除
    // キャッシュのクリア
    // 未使用のオブジェクトの削除
    if (window.gc) {
      window.gc();
    }
  }
};

export default {
  usePerformanceMonitor,
  useMemoryMonitor,
  useRenderOptimization,
  useVirtualScroll,
  useLazyLoading,
  useDebounce,
  useThrottle,
  useWebVitals,
  useResourceMonitor,
  usePerformanceWarnings,
  performanceUtils
};