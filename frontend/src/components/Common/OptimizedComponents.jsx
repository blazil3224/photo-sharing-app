/**
 * パフォーマンス最適化されたコンポーネント群
 * 要件6.4: コンポーネントのメモ化とパフォーマンス最適化
 */

import React, { memo, useMemo, useCallback, forwardRef, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';

// メモ化されたボタンコンポーネント
export const OptimizedButton = memo(forwardRef(({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  // クラス名の計算をメモ化
  const buttonClasses = useMemo(() => {
    const baseClasses = ['btn'];
    
    if (variant) baseClasses.push(`btn-${variant}`);
    if (size !== 'md') baseClasses.push(`btn-${size}`);
    if (loading) baseClasses.push('btn-loading');
    if (className) baseClasses.push(className);
    
    return baseClasses.join(' ');
  }, [variant, size, loading, className]);

  // クリックハンドラーをメモ化
  const handleClick = useCallback((event) => {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }, [onClick, disabled, loading]);

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span 
          className="spinner-border spinner-border-sm me-2" 
          role="status"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}));

OptimizedButton.displayName = 'OptimizedButton';

OptimizedButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark', 'outline-primary', 'outline-secondary']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  loading: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

// メモ化されたカードコンポーネント
export const OptimizedCard = memo(({
  children,
  title,
  subtitle,
  image,
  imageAlt,
  className = '',
  headerActions,
  footer,
  onClick,
  ...props
}) => {
  // カードクラスの計算をメモ化
  const cardClasses = useMemo(() => {
    const baseClasses = ['card'];
    if (onClick) baseClasses.push('card-clickable');
    if (className) baseClasses.push(className);
    return baseClasses.join(' ');
  }, [className, onClick]);

  // クリックハンドラーをメモ化
  const handleClick = useCallback((event) => {
    onClick?.(event);
  }, [onClick]);

  return (
    <div 
      className={cardClasses}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {image && (
        <div className="card-img-top-container">
          <img 
            src={image} 
            alt={imageAlt || ''} 
            className="card-img-top"
            loading="lazy"
          />
        </div>
      )}
      
      {(title || subtitle || headerActions) && (
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            {title && <h5 className="card-title mb-0">{title}</h5>}
            {subtitle && <h6 className="card-subtitle text-muted">{subtitle}</h6>}
          </div>
          {headerActions && <div className="card-actions">{headerActions}</div>}
        </div>
      )}
      
      <div className="card-body">
        {children}
      </div>
      
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
});

OptimizedCard.displayName = 'OptimizedCard';

OptimizedCard.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  image: PropTypes.string,
  imageAlt: PropTypes.string,
  className: PropTypes.string,
  headerActions: PropTypes.node,
  footer: PropTypes.node,
  onClick: PropTypes.func
};

// メモ化されたリストアイテムコンポーネント
export const OptimizedListItem = memo(({
  children,
  avatar,
  avatarAlt,
  title,
  subtitle,
  actions,
  onClick,
  className = '',
  ...props
}) => {
  // リストアイテムクラスの計算をメモ化
  const itemClasses = useMemo(() => {
    const baseClasses = ['list-group-item', 'd-flex', 'align-items-center'];
    if (onClick) baseClasses.push('list-group-item-action');
    if (className) baseClasses.push(className);
    return baseClasses.join(' ');
  }, [className, onClick]);

  // クリックハンドラーをメモ化
  const handleClick = useCallback((event) => {
    onClick?.(event);
  }, [onClick]);

  return (
    <div 
      className={itemClasses}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {avatar && (
        <img 
          src={avatar} 
          alt={avatarAlt || ''} 
          className="rounded-circle me-3"
          width="40"
          height="40"
          loading="lazy"
        />
      )}
      
      <div className="flex-grow-1">
        {title && <div className="fw-bold">{title}</div>}
        {subtitle && <div className="text-muted small">{subtitle}</div>}
        {children}
      </div>
      
      {actions && (
        <div className="ms-auto">
          {actions}
        </div>
      )}
    </div>
  );
});

OptimizedListItem.displayName = 'OptimizedListItem';

OptimizedListItem.propTypes = {
  children: PropTypes.node,
  avatar: PropTypes.string,
  avatarAlt: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
  onClick: PropTypes.func,
  className: PropTypes.string
};

// 仮想化されたリストコンポーネント（大量データ用）
export const VirtualizedList = memo(({
  items,
  renderItem,
  itemHeight = 60,
  containerHeight = 400,
  overscan = 5,
  className = '',
  ...props
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  // 表示範囲の計算をメモ化
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // 表示するアイテムをメモ化
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      ...item,
      index: startIndex + index
    }));
  }, [items, visibleRange]);

  // スクロールハンドラーをメモ化
  const handleScroll = useCallback((event) => {
    setScrollTop(event.target.scrollTop);
  }, []);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  return (
    <div 
      className={`virtualized-list ${className}`}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
      {...props}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div 
              key={item.id || item.index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, item.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

VirtualizedList.propTypes = {
  items: PropTypes.array.isRequired,
  renderItem: PropTypes.func.isRequired,
  itemHeight: PropTypes.number,
  containerHeight: PropTypes.number,
  overscan: PropTypes.number,
  className: PropTypes.string
};

// メモ化されたフォームフィールドコンポーネント
export const OptimizedFormField = memo(({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  id,
  ...props
}) => {
  // フィールドIDの生成をメモ化
  const fieldId = useMemo(() => {
    return id || `field-${Math.random().toString(36).substr(2, 9)}`;
  }, [id]);

  // 入力クラスの計算をメモ化
  const inputClasses = useMemo(() => {
    const baseClasses = ['form-control'];
    if (error) baseClasses.push('is-invalid');
    if (className) baseClasses.push(className);
    return baseClasses.join(' ');
  }, [error, className]);

  // 変更ハンドラーをメモ化
  const handleChange = useCallback((event) => {
    onChange?.(event.target.value, event);
  }, [onChange]);

  // ブラーハンドラーをメモ化
  const handleBlur = useCallback((event) => {
    onBlur?.(event.target.value, event);
  }, [onBlur]);

  return (
    <div className="mb-3">
      {label && (
        <label htmlFor={fieldId} className="form-label">
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}
      
      <input
        id={fieldId}
        type={type}
        className={inputClasses}
        value={value || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      
      {error && (
        <div id={`${fieldId}-error`} className="invalid-feedback">
          {error}
        </div>
      )}
    </div>
  );
});

OptimizedFormField.displayName = 'OptimizedFormField';

OptimizedFormField.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  error: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string
};

// 遅延読み込み用のSuspenseラッパー
export const LazyComponentWrapper = ({ 
  children, 
  fallback = <div className="d-flex justify-content-center p-4"><div className="spinner-border" role="status"><span className="visually-hidden">読み込み中...</span></div></div> 
}) => (
  <Suspense fallback={fallback}>
    {children}
  </Suspense>
);

LazyComponentWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node
};

// パフォーマンス監視用のコンポーネント
export const PerformanceMonitor = memo(({ children, name }) => {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const startTime = performance.now();
      
      return () => {
        const endTime = performance.now();
        console.log(`[Performance] ${name}: ${endTime - startTime}ms`);
      };
    }
  }, [name]);

  return children;
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

PerformanceMonitor.propTypes = {
  children: PropTypes.node.isRequired,
  name: PropTypes.string.isRequired
};