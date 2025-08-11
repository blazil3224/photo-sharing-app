/**
 * 投稿一覧コンポーネント（タイムライン）
 * 無限スクロールによるページネーション実装
 * 要件6.4: コンポーネントのメモ化とパフォーマンス最適化
 */
import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { api } from '../../services/api';
import PostCard from './PostCard';
import Loading from '../Common/Loading';
import { VirtualizedList } from '../Common/OptimizedComponents';
import { useVirtualScroll, usePerformanceMonitor, useDebounce } from '../../hooks/usePerformance';

const PostList = memo(({ userId = null, refreshTrigger = 0, enableVirtualization = false }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [lastKey, setLastKey] = useState(null);
  
  // パフォーマンス監視
  usePerformanceMonitor(`PostList-${userId || 'timeline'}`);
  
  // デバウンスされたリフレッシュトリガー
  const debouncedRefreshTrigger = useDebounce(refreshTrigger, 300);
  
  const observerRef = useRef();
  const containerRef = useRef();
  
  // 仮想スクロール設定（大量の投稿がある場合）
  const virtualScrollConfig = useMemo(() => ({
    items: posts,
    itemHeight: 600, // 投稿カードの平均高さ
    containerHeight: 800,
    overscan: 3
  }), [posts]);
  
  const {
    scrollElementRef,
    visibleItems,
    totalHeight,
    startIndex,
    endIndex
  } = useVirtualScroll(virtualScrollConfig);

  // Intersection Observer のメモ化
  const lastPostElementRef = useCallback(node => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMorePosts();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );
    
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore]);

  // 初期投稿読み込み
  const loadPosts = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setLastKey(null);
        setHasMore(true);
        setError(null);
      }

      const params = {
        limit: 10,
        ...(lastKey && !reset ? { last_key: lastKey } : {})
      };

      let response;
      if (userId) {
        // 特定ユーザーの投稿を取得
        response = await api.posts.getUserPosts(userId, params);
      } else {
        // タイムライン投稿を取得
        response = await api.posts.getTimeline(params);
      }

      const { posts: newPosts, last_key: newLastKey } = response.data;

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }

      setLastKey(newLastKey);
      setHasMore(!!newLastKey && newPosts.length > 0);

    } catch (error) {
      console.error('投稿読み込みエラー:', error);
      setError(error.message || '投稿の読み込みに失敗しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, lastKey]);

  // 追加投稿読み込み（無限スクロール）
  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    await loadPosts(false);
  }, [loadPosts, loadingMore, hasMore]);

  // 初期読み込み（デバウンスされたトリガーを使用）
  useEffect(() => {
    loadPosts(true);
  }, [userId, debouncedRefreshTrigger]);

  // いいね切り替え処理
  const handleLikeToggle = useCallback((postId) => {
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.post_id === postId) {
          const wasLiked = post.user_liked;
          return {
            ...post,
            user_liked: !wasLiked,
            likes_count: wasLiked ? post.likes_count - 1 : post.likes_count + 1
          };
        }
        return post;
      })
    );
  }, []);

  // 投稿削除処理
  const handlePostDelete = useCallback((postId) => {
    setPosts(prevPosts => prevPosts.filter(post => post.post_id !== postId));
  }, []);

  // 手動リフレッシュ（メモ化）
  const handleRefresh = useCallback(() => {
    loadPosts(true);
  }, [loadPosts]);

  // 投稿レンダリング関数（仮想化用）
  const renderPost = useCallback((post, index) => (
    <PostCard
      key={post.post_id}
      post={post}
      onLikeToggle={handleLikeToggle}
      onDelete={handlePostDelete}
    />
  ), [handleLikeToggle, handlePostDelete]);

  // 投稿一覧のメモ化
  const postElements = useMemo(() => {
    if (enableVirtualization && posts.length > 20) {
      // 仮想化を使用（大量の投稿がある場合）
      return (
        <VirtualizedList
          items={posts}
          renderItem={renderPost}
          itemHeight={600}
          containerHeight={800}
          overscan={3}
          className="posts-container"
        />
      );
    }

    // 通常のレンダリング
    return posts.map((post, index) => {
      const isLast = posts.length === index + 1;
      
      return (
        <div 
          key={post.post_id} 
          ref={isLast ? lastPostElementRef : null}
        >
          <PostCard
            post={post}
            onLikeToggle={handleLikeToggle}
            onDelete={handlePostDelete}
          />
        </div>
      );
    });
  }, [posts, enableVirtualization, renderPost, lastPostElementRef, handleLikeToggle, handlePostDelete]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <div className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>
            <strong>エラーが発生しました</strong>
            <div>{error}</div>
          </div>
        </div>
        <button 
          className="btn btn-outline-danger btn-sm mt-2"
          onClick={handleRefresh}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          再試行
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="mb-4">
          <i className="bi bi-camera text-muted" style={{ fontSize: '4rem' }}></i>
        </div>
        <h5 className="text-muted">
          {userId ? '投稿がありません' : 'まだ投稿がありません'}
        </h5>
        <p className="text-muted">
          {userId ? 'このユーザーはまだ投稿していません。' : '最初の投稿をしてみましょう！'}
        </p>
        {!userId && (
          <button 
            className="btn btn-primary"
            onClick={() => window.location.href = '/upload'}
          >
            <i className="bi bi-plus-circle me-2"></i>
            投稿する
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="post-list">
      {/* リフレッシュボタン */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          {userId ? 'ユーザーの投稿' : 'タイムライン'}
        </h5>
        <button 
          className="btn btn-outline-primary btn-sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          更新
        </button>
      </div>

      {/* 投稿一覧 */}
      <div 
        ref={containerRef}
        className="posts-container"
        style={{ 
          minHeight: enableVirtualization && posts.length > 20 ? '800px' : 'auto'
        }}
      >
        {postElements}
      </div>

      {/* 追加読み込み中インジケーター */}
      {loadingMore && (
        <div className="d-flex justify-content-center py-4">
          <div className="d-flex align-items-center text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">読み込み中...</span>
            </div>
            <span>投稿を読み込み中...</span>
          </div>
        </div>
      )}

      {/* 読み込み完了メッセージ */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-4">
          <div className="text-muted">
            <i className="bi bi-check-circle me-2"></i>
            すべての投稿を表示しました
          </div>
        </div>
      )}
    </div>
  );
};

PostList.displayName = 'PostList';

export default PostList;