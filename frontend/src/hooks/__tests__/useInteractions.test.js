import { renderHook, act } from '@testing-library/react';
import { useInteractions } from '../useInteractions';
import { api } from '../../services/api';

// APIのモック
jest.mock('../../services/api', () => ({
  api: {
    interactions: {
      toggleLike: jest.fn(),
      addComment: jest.fn()
    },
    posts: {
      deletePost: jest.fn()
    }
  }
}));

// テスト用の投稿データ
const mockPosts = [
  {
    post_id: 'post-1',
    user_id: 'user-1',
    likes_count: 5,
    comments_count: 3,
    user_liked: false,
    caption: 'テスト投稿1'
  },
  {
    post_id: 'post-2',
    user_id: 'user-2',
    likes_count: 10,
    comments_count: 7,
    user_liked: true,
    caption: 'テスト投稿2'
  }
];

describe('useInteractions フック', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのAPI応答を設定
    api.interactions.toggleLike.mockResolvedValue({
      data: { liked: true, likes_count: 6 }
    });
    
    api.interactions.addComment.mockResolvedValue({
      data: {
        interaction_id: 'new-comment',
        user_id: 'current-user',
        content: '新しいコメント',
        created_at: new Date().toISOString()
      }
    });
    
    api.posts.deletePost.mockResolvedValue({});
  });

  describe('基本機能', () => {
    test('初期状態が正しく設定される', () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      expect(result.current.posts).toEqual(mockPosts);
      expect(result.current.isLoading('post-1')).toBe(false);
      expect(result.current.getError('post-1')).toBe(null);
    });

    test('投稿一覧を更新できる', () => {
      const { result } = renderHook(() => useInteractions([]));
      
      act(() => {
        result.current.updatePosts(mockPosts);
      });
      
      expect(result.current.posts).toEqual(mockPosts);
    });

    test('新しい投稿を追加できる', () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      const newPost = {
        post_id: 'post-3',
        user_id: 'user-3',
        likes_count: 0,
        comments_count: 0,
        user_liked: false,
        caption: '新しい投稿'
      };
      
      act(() => {
        result.current.addPost(newPost);
      });
      
      expect(result.current.posts).toHaveLength(3);
      expect(result.current.posts[0]).toEqual(newPost);
    });

    test('特定の投稿を更新できる', () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      act(() => {
        result.current.updatePost('post-1', { likes_count: 100 });
      });
      
      const updatedPost = result.current.posts.find(p => p.post_id === 'post-1');
      expect(updatedPost.likes_count).toBe(100);
    });
  });

  describe('いいね機能', () => {
    test('いいね切り替えが正しく動作する', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      await act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      // API呼び出しの確認
      expect(api.interactions.toggleLike).toHaveBeenCalledWith('post-1');
      
      // 投稿の状態更新確認
      const updatedPost = result.current.posts.find(p => p.post_id === 'post-1');
      expect(updatedPost.user_liked).toBe(true);
      expect(updatedPost.likes_count).toBe(6);
    });

    test('いいね取り消しが正しく動作する', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      api.interactions.toggleLike.mockResolvedValue({
        data: { liked: false, likes_count: 9 }
      });
      
      await act(async () => {
        await result.current.toggleLike('post-2');
      });
      
      const updatedPost = result.current.posts.find(p => p.post_id === 'post-2');
      expect(updatedPost.user_liked).toBe(false);
      expect(updatedPost.likes_count).toBe(9);
    });

    test('いいねエラー時にロールバックされる', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      api.interactions.toggleLike.mockRejectedValue(new Error('ネットワークエラー'));
      
      const originalPost = result.current.posts.find(p => p.post_id === 'post-1');
      const originalLiked = originalPost.user_liked;
      const originalCount = originalPost.likes_count;
      
      await act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      // エラー後に元の状態に戻ることを確認
      const postAfterError = result.current.posts.find(p => p.post_id === 'post-1');
      expect(postAfterError.user_liked).toBe(originalLiked);
      expect(postAfterError.likes_count).toBe(originalCount);
      
      // エラーが設定されることを確認
      expect(result.current.getError('post-1')).toBe('ネットワークエラー');
    });

    test('連続いいね処理が防止される', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      // 最初の処理を開始
      const promise1 = act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      // 2番目の処理を即座に開始
      const promise2 = act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      await Promise.all([promise1, promise2]);
      
      // API呼び出しは1回のみ
      expect(api.interactions.toggleLike).toHaveBeenCalledTimes(1);
    });
  });

  describe('コメント機能', () => {
    test('コメント追加が正しく動作する', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      const commentData = await act(async () => {
        return await result.current.addComment('post-1', 'テストコメント');
      });
      
      // API呼び出しの確認
      expect(api.interactions.addComment).toHaveBeenCalledWith('post-1', {
        content: 'テストコメント'
      });
      
      // コメント数の更新確認
      const updatedPost = result.current.posts.find(p => p.post_id === 'post-1');
      expect(updatedPost.comments_count).toBe(4);
      
      // 返り値の確認
      expect(commentData).toEqual({
        interaction_id: 'new-comment',
        user_id: 'current-user',
        content: '新しいコメント',
        created_at: expect.any(String)
      });
    });

    test('コメント追加エラー時の処理', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      api.interactions.addComment.mockRejectedValue(new Error('コメント投稿エラー'));
      
      const originalPost = result.current.posts.find(p => p.post_id === 'post-1');
      const originalCommentsCount = originalPost.comments_count;
      
      await expect(act(async () => {
        await result.current.addComment('post-1', 'エラーテスト');
      })).rejects.toThrow('コメント投稿エラー');
      
      // コメント数が変更されていないことを確認
      const postAfterError = result.current.posts.find(p => p.post_id === 'post-1');
      expect(postAfterError.comments_count).toBe(originalCommentsCount);
      
      // エラーが設定されることを確認
      expect(result.current.getError('post-1')).toBe('コメント投稿エラー');
    });

    test('連続コメント投稿が防止される', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      // 最初の処理を開始
      const promise1 = act(async () => {
        await result.current.addComment('post-1', 'コメント1');
      });
      
      // 2番目の処理を即座に開始
      const promise2 = act(async () => {
        await result.current.addComment('post-1', 'コメント2');
      });
      
      await Promise.all([promise1, promise2]);
      
      // API呼び出しは1回のみ
      expect(api.interactions.addComment).toHaveBeenCalledTimes(1);
    });
  });

  describe('投稿削除機能', () => {
    test('投稿削除が正しく動作する', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      await act(async () => {
        await result.current.deletePost('post-1');
      });
      
      // API呼び出しの確認
      expect(api.posts.deletePost).toHaveBeenCalledWith('post-1');
      
      // 投稿が一覧から削除されることを確認
      expect(result.current.posts).toHaveLength(1);
      expect(result.current.posts.find(p => p.post_id === 'post-1')).toBeUndefined();
    });

    test('投稿削除エラー時の処理', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      api.posts.deletePost.mockRejectedValue(new Error('削除エラー'));
      
      await expect(act(async () => {
        await result.current.deletePost('post-1');
      })).rejects.toThrow('削除エラー');
      
      // 投稿が削除されていないことを確認
      expect(result.current.posts).toHaveLength(2);
      expect(result.current.posts.find(p => p.post_id === 'post-1')).toBeDefined();
      
      // エラーが設定されることを確認
      expect(result.current.getError('post-1')).toBe('削除エラー');
    });
  });

  describe('ローディング状態管理', () => {
    test('いいね処理中のローディング状態', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      // 遅延を模擬
      api.interactions.toggleLike.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { liked: true, likes_count: 6 } }), 100)
        )
      );
      
      // 処理開始
      const promise = act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      // ローディング状態の確認
      expect(result.current.isLoading('post-1')).toBe(true);
      
      // 処理完了待ち
      await promise;
      
      // ローディング状態の解除確認
      expect(result.current.isLoading('post-1')).toBe(false);
    });

    test('コメント投稿中のローディング状態', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      // 遅延を模擬
      api.interactions.addComment.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: {} }), 100)
        )
      );
      
      // 処理開始
      const promise = act(async () => {
        await result.current.addComment('post-1', 'テスト');
      });
      
      // ローディング状態の確認
      expect(result.current.isLoading('post-1', 'comment')).toBe(true);
      
      // 処理完了待ち
      await promise;
      
      // ローディング状態の解除確認
      expect(result.current.isLoading('post-1', 'comment')).toBe(false);
    });
  });

  describe('エラー管理', () => {
    test('エラーの自動クリア機能', async () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      api.interactions.toggleLike.mockRejectedValue(new Error('テストエラー'));
      
      await act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      // エラーが設定されることを確認
      expect(result.current.getError('post-1')).toBe('テストエラー');
      
      // 3秒経過
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      
      // エラーが自動クリアされることを確認
      expect(result.current.getError('post-1')).toBe(null);
      
      jest.useRealTimers();
    });

    test('手動エラークリア機能', () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      // エラーを手動設定（テスト用）
      act(() => {
        result.current.clearError('post-1');
      });
      
      expect(result.current.getError('post-1')).toBe(null);
    });

    test('複数投稿の独立したエラー管理', async () => {
      const { result } = renderHook(() => useInteractions(mockPosts));
      
      // post-1でエラー発生
      api.interactions.toggleLike.mockRejectedValueOnce(new Error('エラー1'));
      
      await act(async () => {
        await result.current.toggleLike('post-1');
      });
      
      // post-1のみエラーが設定されることを確認
      expect(result.current.getError('post-1')).toBe('エラー1');
      expect(result.current.getError('post-2')).toBe(null);
      
      // post-2で正常処理
      api.interactions.toggleLike.mockResolvedValueOnce({
        data: { liked: false, likes_count: 9 }
      });
      
      await act(async () => {
        await result.current.toggleLike('post-2');
      });
      
      // post-1のエラーは残り、post-2はエラーなし
      expect(result.current.getError('post-1')).toBe('エラー1');
      expect(result.current.getError('post-2')).toBe(null);
    });
  });
});