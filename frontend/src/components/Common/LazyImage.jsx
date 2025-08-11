/**
 * 遅延読み込み対応画像コンポーネント
 * 要件6.4: 画像遅延読み込み（Lazy Loading）実装
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import PropTypes from 'prop-types';

const LazyImage = memo(({
  src,
  alt,
  className = '',
  style = {},
  placeholder = '/placeholder.svg',
  errorImage = '/error-image.svg',
  threshold = 0.1,
  rootMargin = '50px',
  onLoad,
  onError,
  loading = 'lazy',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageStatus, setImageStatus] = useState('loading'); // loading, loaded, error
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Intersection Observer の設定
  useEffect(() => {
    const currentImgRef = imgRef.current;
    
    if (!currentImgRef) return;

    // ブラウザがIntersection Observerをサポートしているかチェック
    if (!('IntersectionObserver' in window)) {
      // サポートしていない場合は即座に画像を読み込む
      setIsInView(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          // 一度表示されたら監視を停止
          observerRef.current?.unobserve(currentImgRef);
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(currentImgRef);

    return () => {
      if (observerRef.current && currentImgRef) {
        observerRef.current.unobserve(currentImgRef);
      }
    };
  }, [threshold, rootMargin]);

  // 画像の読み込み処理
  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setImageStatus('loaded');
      onLoad?.(img);
    };
    
    img.onerror = (error) => {
      setImageSrc(errorImage);
      setImageStatus('error');
      onError?.(error);
    };
    
    img.src = src;
  }, [isInView, src, errorImage, onLoad, onError]);

  // プリロード用の画像形式検出
  const getOptimizedImageSrc = (originalSrc) => {
    if (!originalSrc) return originalSrc;
    
    // WebP対応チェック
    const supportsWebP = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    })();

    // AVIF対応チェック
    const supportsAVIF = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    })();

    // 最適な形式を選択
    if (supportsAVIF && originalSrc.includes('.jpg') || originalSrc.includes('.jpeg')) {
      return originalSrc.replace(/\.(jpg|jpeg)$/i, '.avif');
    } else if (supportsWebP && (originalSrc.includes('.jpg') || originalSrc.includes('.jpeg') || originalSrc.includes('.png'))) {
      return originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }
    
    return originalSrc;
  };

  // レスポンシブ画像のsrcset生成
  const generateSrcSet = (baseSrc) => {
    if (!baseSrc || baseSrc === placeholder || baseSrc === errorImage) {
      return undefined;
    }

    const sizes = [320, 640, 768, 1024, 1280, 1920];
    const extension = baseSrc.split('.').pop();
    const baseName = baseSrc.replace(`.${extension}`, '');

    return sizes
      .map(size => `${baseName}_${size}w.${extension} ${size}w`)
      .join(', ');
  };

  // 画像のスタイル設定
  const imageStyle = {
    transition: 'opacity 0.3s ease-in-out, filter 0.3s ease-in-out',
    opacity: imageStatus === 'loaded' ? 1 : 0.7,
    filter: imageStatus === 'loading' ? 'blur(2px)' : 'none',
    ...style
  };

  // アクセシビリティ属性
  const accessibilityProps = {
    'aria-label': alt,
    'aria-busy': imageStatus === 'loading',
    'data-testid': 'lazy-image'
  };

  return (
    <div 
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <img
        src={getOptimizedImageSrc(imageSrc)}
        srcSet={generateSrcSet(imageSrc)}
        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        alt={alt}
        className={`lazy-image ${imageStatus}`}
        style={imageStyle}
        loading={loading}
        decoding="async"
        {...accessibilityProps}
        {...props}
      />
      
      {/* ローディングインジケーター */}
      {imageStatus === 'loading' && (
        <div 
          className="lazy-image-loading"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}
        >
          <div 
            className="spinner-border spinner-border-sm text-primary"
            role="status"
            aria-label="画像を読み込み中"
          >
            <span className="visually-hidden">読み込み中...</span>
          </div>
        </div>
      )}
      
      {/* エラー表示 */}
      {imageStatus === 'error' && (
        <div 
          className="lazy-image-error"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
            textAlign: 'center',
            color: '#6c757d'
          }}
        >
          <i className="bi bi-image" style={{ fontSize: '2rem' }}></i>
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            画像を読み込めませんでした
          </div>
        </div>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  placeholder: PropTypes.string,
  errorImage: PropTypes.string,
  threshold: PropTypes.number,
  rootMargin: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  loading: PropTypes.oneOf(['lazy', 'eager'])
};

// 画像プリロード用のユーティリティ関数
export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// 複数画像の一括プリロード
export const preloadImages = async (srcArray) => {
  try {
    const promises = srcArray.map(src => preloadImage(src));
    return await Promise.all(promises);
  } catch (error) {
    console.warn('Some images failed to preload:', error);
    return [];
  }
};

// 画像最適化のためのユーティリティ
export const getOptimalImageSize = (containerWidth, devicePixelRatio = window.devicePixelRatio || 1) => {
  const targetWidth = containerWidth * devicePixelRatio;
  const sizes = [320, 640, 768, 1024, 1280, 1920];
  
  // 最適なサイズを選択（目標サイズ以上の最小サイズ）
  return sizes.find(size => size >= targetWidth) || sizes[sizes.length - 1];
};

// 画像フォーマット対応チェック
export const getSupportedImageFormats = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return {
    webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
    avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0,
    jpeg: true, // 常にサポート
    png: true   // 常にサポート
  };
};

export default LazyImage;