/**
 * API呼び出し用カスタムフック
 * ローディング状態とエラーハンドリングを統合
 */
import { useState, useCallback } from 'react';

/**
 * API呼び出し用フック
 * @param {Function} apiFunction - 呼び出すAPI関数
 * @param {Object} options - オプション設定
 * @returns {Object} { data, loading, error, execute, reset }
 */
export const useApi = (apiFunction, options = {}) => {
  const {
    initialData = null,
    onSuccess = null,
    onError = null,
    showErrorToast = true,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFunction(...args);
      const responseData = response.data;

      setData(responseData);

      // 成功時のコールバック実行
      if (onSuccess) {
        onSuccess(responseData);
      }

      return { success: true, data: responseData };
    } catch (err) {
      const errorMessage = err.message || 'エラーが発生しました';
      setError(errorMessage);

      // エラー時のコールバック実行
      if (onError) {
        onError(err);
      }

      // エラートースト表示（オプション）
      if (showErrorToast && window.showErrorToast) {
        window.showErrorToast(errorMessage);
      }

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError, showErrorToast]);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
  }, [initialData]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
};

/**
 * 複数のAPI呼び出しを並列実行するフック
 * @param {Array} apiCalls - API呼び出し配列 [{ key, apiFunction, args }]
 * @returns {Object} { data, loading, errors, execute, reset }
 */
export const useMultipleApi = (apiCalls = []) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setErrors({});

      const promises = apiCalls.map(async ({ key, apiFunction, args = [] }) => {
        try {
          const response = await apiFunction(...args);
          return { key, success: true, data: response.data };
        } catch (error) {
          return { key, success: false, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      
      const newData = {};
      const newErrors = {};

      results.forEach(({ key, success, data: resultData, error }) => {
        if (success) {
          newData[key] = resultData;
        } else {
          newErrors[key] = error;
        }
      });

      setData(newData);
      setErrors(newErrors);

      return { success: Object.keys(newErrors).length === 0, data: newData, errors: newErrors };
    } catch (error) {
      const errorMessage = error.message || '複数のAPI呼び出しでエラーが発生しました';
      setErrors({ general: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [apiCalls]);

  const reset = useCallback(() => {
    setData({});
    setErrors({});
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    errors,
    execute,
    reset,
  };
};

/**
 * ページネーション対応API呼び出しフック
 * @param {Function} apiFunction - ページネーション対応API関数
 * @param {Object} options - オプション設定
 * @returns {Object} ページネーション関連の状態と関数
 */
export const usePaginatedApi = (apiFunction, options = {}) => {
  const {
    initialLimit = 20,
    onSuccess = null,
    onError = null,
  } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastKey, setLastKey] = useState(null);

  // 初回読み込み
  const loadInitial = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFunction({
        limit: initialLimit,
        ...params,
      });

      const responseData = response.data;
      
      if (responseData.success) {
        setItems(responseData.posts || responseData.items || []);
        setHasMore(responseData.pagination?.has_more || false);
        setLastKey(responseData.pagination?.last_key || null);

        if (onSuccess) {
          onSuccess(responseData);
        }
      }

      return { success: true, data: responseData };
    } catch (err) {
      const errorMessage = err.message || 'データの読み込みに失敗しました';
      setError(errorMessage);

      if (onError) {
        onError(err);
      }

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [apiFunction, initialLimit, onSuccess, onError]);

  // 追加読み込み
  const loadMore = useCallback(async (params = {}) => {
    if (!hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const response = await apiFunction({
        limit: initialLimit,
        last_key: lastKey,
        ...params,
      });

      const responseData = response.data;
      
      if (responseData.success) {
        const newItems = responseData.posts || responseData.items || [];
        setItems(prevItems => [...prevItems, ...newItems]);
        setHasMore(responseData.pagination?.has_more || false);
        setLastKey(responseData.pagination?.last_key || null);

        if (onSuccess) {
          onSuccess(responseData);
        }
      }

      return { success: true, data: responseData };
    } catch (err) {
      const errorMessage = err.message || '追加データの読み込みに失敗しました';
      setError(errorMessage);

      if (onError) {
        onError(err);
      }

      return { success: false, error: errorMessage };
    } finally {
      setLoadingMore(false);
    }
  }, [apiFunction, initialLimit, hasMore, loadingMore, lastKey, onSuccess, onError]);

  // リセット
  const reset = useCallback(() => {
    setItems([]);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    setHasMore(true);
    setLastKey(null);
  }, []);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    loadInitial,
    loadMore,
    reset,
  };
};

export default useApi;