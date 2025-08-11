import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

/**
 * インタラクション管理用カスタムフック
 * リアルタイム更新とオプティミスティックUIを提供
 */
export const useInteractions = (initialPosts = []) => {
  const [posts, setPosts] = useState(initialPosts);
  const [errors, setErrors] = useState({});
  const loadingRef = useRef(new Set());

  // エラー管理
  const setError = useCallback((postId, error) => {
    setErrors(prev => ({ ...prev, [postId]: error }));
    // エラーを3秒後に自動クリア
    setTimeout(() => {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[postId];
        return newErrors;
      });
    }, 3000);
  }, []);

  // いいね切り替え処理
  const toggleLike = useCallback(async (postId) => {
    if (loadingRef.current.has(postId)) return;
    
    loadingRef.current.add(postId);
    
    try {
      // オプティミスティック更新
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

      // API呼び出し
      const response = await api.interactions.toggleLike(postId);
      
      // サーバーからの実際の値で更新
      if (response.data) {
        setPosts(prevPosts => 
          prevPosts.map(post => {
            if (post.post_id === postId) {
              return {
                ...post,
                user_liked: response.data.liked,
                likes_count: response.data.likes_count
              };
            }
            return post;
          })
        );
      }

    } catch (error) {
      console.error('いいね処理でエラーが発生しました:', error);
      
      // エラー時は元の状態に戻す
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.post_id === postId) {
            const currentLiked = post.user_liked;
            return {
              ...post,
              user_liked: !currentLiked,
              likes_count: currentLiked ? post.likes_count - 1 : post.likes_count + 1
            };
          }
          return post;
        })
      );
      
      setError(postId, error.message || 'いいね処理に失敗しました');
    } finally {
      loadingRef.current.delete(postId);
    }
  }, [setError]);

  // コメント追加処理
  const addComment = useCallback(async (postId, content) => {
    if (loadingRef.current.has(`comment-${postId}`)) return;
    
    loadingRef.current.add(`comment-${postId}`);
    
    try {
      const response = await api.interactions.addComment(postId, { content });
      
      // コメント数を更新
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.post_id === postId) {
            return {
              ...post,
              comments_count: post.comments_count + 1
            };
          }
          return post;
        })
      );

      return response.data;

    } catch (error) {
      console.error('コメント投稿でエラーが発生しました:', error);
      setError(postId, error.message || 'コメント投稿に失敗しました');
      throw error;
    } finally {
      loadingRef.current.delete(`comment-${postId}`);
    }
  }, [setError]);

  // 投稿削除処理
  const deletePost = useCallback(async (postId) => {
    if (loadingRef.current.has(`delete-${postId}`)) return;
    
    loadingRef.current.add(`delete-${postId}`);
    
    try {
      await api.posts.deletePost(postId);
      
      // 投稿を一覧から削除
      setPosts(prevPosts => prevPosts.filter(post => post.post_id !== postId));

    } catch (error) {
      console.error('投稿削除でエラーが発生しました:', error);
      setError(postId, error.message || '投稿削除に失敗しました');
      throw error;
    } finally {
      loadingRef.current.delete(`delete-${postId}`);
    }
  }, [setError]);

  // 投稿一覧の更新
  const updatePosts = useCallback((newPosts) => {
    setPosts(newPosts);
  }, []);

  // 特定の投稿を更新
  const updatePost = useCallback((postId, updates) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.post_id === postId ? { ...post, ...updates } : post
      )
    );
  }, []);

  // 新しい投稿を先頭に追加
  const addPost = useCallback((newPost) => {
    setPosts(prevPosts => [newPost, ...prevPosts]);
  }, []);

  // ローディング状態の確認
  const isLoading = useCallback((postId, action = '') => {
    const key = action ? `${action}-${postId}` : postId;
    return loadingRef.current.has(key);
  }, []);

  // エラー取得
  const getError = useCallback((postId) => {
    return errors[postId] || null;
  }, [errors]);

  // エラークリア
  const clearError = useCallback((postId) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[postId];
      return newErrors;
    });
  }, []);

  return {
    posts,
    toggleLike,
    addComment,
    deletePost,
    updatePosts,
    updatePost,
    addPost,
    isLoading,
    getError,
    clearError
  };
};