import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import PostList from '../../components/Posts/PostList';
import { LikeButton } from '../../components/Interactions';
import { api } from '../../services/api';

// APIのモック
jest.mock('../../services/api', () => ({
  api: {
    interactions: {
      toggleLike: jest.fn(),
      addComment: jest.fn(),
      getPostComments: jest.fn()
    },
    posts: {
      getTimeline: jest.fn(),
      getUserPosts: jest.fn()
    }
  }
}));

// パフォーマンス測定用のヘルパー
const measurePerformance = async (operation) => {
  const start = performance.now();
  await operation();
  const end = performance.now();
  return end - start;
};

// 大量のテストデータ生成
const generateMockPosts = (count) => {
  return Array.from({ length: count }, (_, index) => ({
    post_id: `post-${index}`,
    user_id: `user-${index % 10}`,
    image_url: `https://example.com/image-${index}.jpg`,
    caption: `テスト投稿 ${index}`,
    created_at: new Date(Date.now() - index * 60000).toISOString(),
    likes_count: Math.floor(Math.random() * 100),
    comments_count: Math.floor(Math.random() * 20),
    user_liked: Math.random() > 0.5,
    user: {
      user_id: `user-${index % 10}`,
      username: `user${index % 10}`,
      profile_image: `/avatar-${index % 10}.png`
    }
  }));
};

const TestAuthProvider = ({ children }) => {
  const authValue = {
    user: { user_id: 'current-user', username: 'testuser' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false
  };
  
  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('インタラクション機能のパフォーマンステスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのAPI応答を設定
    api.interactions.toggleLike.mockResolvedValue({
      data: { liked: true, likes_count: 1 }
    });
    
    api.posts.getTimeline.mockResolvedValue({
      data: { posts: [], last_key: null }
    });
  });

  describe('大量データでのレンダリングパフォーマンス', () => {
    test('100個のいいねボタンのレンダリング時間', async () => {
      const posts = generateMockPosts(100);
      
      const renderTime = await measurePerformance(async () => {
        render(
          <TestAuthProvider>
            <div>
              {posts.map(post => (
                <LikeButton
                  key={post.post_id}
                  postId={post.post_id}
                  initialLiked={post.user_liked}
                  initialCount={post.likes_count}
                />
              ))}
            </div>
          </TestAuthProvider>
        );
      });
      
      // 100個のいいねボタンが1秒以内にレンダリングされることを確認
      expect(renderTime).toBeLessThan(1000);
      
      // すべてのボタンが表示されることを確認
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(100);
    });

    test('大量投稿でのPostListレンダリング', async () => {
      const posts = generateMockPosts(50);
      
      api.posts.getTimeline.mockResolvedValue({
        data: { posts, last_key: null }
      });
      
      const renderTime = await measurePerformance(async () => {
        render(
          <TestAuthProvider>
            <PostList />
          </TestAuthProvider>
        );
        
        // データ読み込み完了まで待機
        await waitFor(() => {
          expect(screen.getAllByText(/テスト投稿/)).toHaveLength(50);
        });
      });
      
      // 50個の投稿が2秒以内に表示されることを確認
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('連続操作のパフォーマンス', () => {
    test('連続いいね操作の応答性', async () => {
      const user = userEvent.setup();
      const posts = generateMockPosts(10);
      
      render(
        <TestAuthProvider>
          <div>
            {posts.map(post => (
              <LikeButton
                key={post.post_id}
                postId={post.post_id}
                initialLiked={false}
                initialCount={0}
              />
            ))}
          </div>
        </TestAuthProvider>
      );
      
      const buttons = screen.getAllByRole('button');
      
      // 連続いいね操作の時間測定
      const operationTime = await measurePerformance(async () => {
        for (let i = 0; i < 10; i++) {
          await user.click(buttons[i]);
        }
      });
      
      // 10回の連続操作が500ms以内に完了することを確認
      expect(operationTime).toBeLessThan(500);
      
      // すべてのAPI呼び出しが実行されることを確認
      expect(api.interactions.toggleLike).toHaveBeenCalledTimes(10);
    });

    test('高頻度更新時のUI応答性', async () => {
      const user = userEvent.setup();
      
      // 遅延なしでレスポンスを返すように設定
      api.interactions.toggleLike.mockImplementation((postId) => 
        Promise.resolve({
          data: { liked: true, likes_count: Math.floor(Math.random() * 100) }
        })
      );
      
      render(
        <TestAuthProvider>
          <LikeButton
            postId="performance-test"
            initialLiked={false}
            initialCount={0}
          />
        </TestAuthProvider>
      );
      
      const button = screen.getByRole('button');
      
      // 短時間での連続クリック
      const clickTime = await measurePerformance(async () => {
        for (let i = 0; i < 5; i++) {
          await user.click(button);
          // 少し待機してUI更新を確認
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });
      
      // 5回の連続クリックが200ms以内に完了することを確認
      expect(clickTime).toBeLessThan(200);
    });
  });

  describe('メモリ使用量とリーク検出', () => {
    test('大量コンポーネントのマウント・アンマウント', async () => {
      const posts = generateMockPosts(100);
      
      // 初期メモリ使用量（概算）
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // コンポーネントをマウント
      const { unmount } = render(
        <TestAuthProvider>
          <div>
            {posts.map(post => (
              <LikeButton
                key={post.post_id}
                postId={post.post_id}
                initialLiked={post.user_liked}
                initialCount={post.likes_count}
              />
            ))}
          </div>
        </TestAuthProvider>
      );
      
      // マウント後のメモリ使用量
      const mountedMemory = performance.memory?.usedJSHeapSize || 0;
      
      // コンポーネントをアンマウント
      unmount();
      
      // ガベージコレクションを促進
      if (global.gc) {
        global.gc();
      }
      
      // アンマウント後のメモリ使用量
      const unmountedMemory = performance.memory?.usedJSHeapSize || 0;
      
      // メモリリークがないことを確認（完全ではないが目安として）
      if (performance.memory) {
        const memoryIncrease = unmountedMemory - initialMemory;
        const mountedIncrease = mountedMemory - initialMemory;
        
        // アンマウント後のメモリ増加がマウント時の50%以下であることを確認
        expect(memoryIncrease).toBeLessThan(mountedIncrease * 0.5);
      }
    });
  });

  describe('ネットワーク遅延耐性テスト', () => {
    test('高遅延環境でのユーザビリティ', async () => {
      const user = userEvent.setup();
      
      // 高遅延を模擬（1秒）
      api.interactions.toggleLike.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { liked: true, likes_count: 1 } }), 1000)
        )
      );
      
      render(
        <TestAuthProvider>
          <LikeButton
            postId="latency-test"
            initialLiked={false}
            initialCount={0}
          />
        </TestAuthProvider>
      );
      
      const button = screen.getByRole('button');
      
      // クリック時間を測定
      const clickTime = await measurePerformance(async () => {
        await user.click(button);
      });
      
      // クリック自体は即座に応答することを確認（50ms以内）
      expect(clickTime).toBeLessThan(50);
      
      // オプティミスティック更新が即座に反映されることを確認
      expect(screen.getByText('1')).toBeInTheDocument();
      
      // ローディング状態が表示されることを確認
      expect(screen.getByText('処理中...')).toBeInTheDocument();
      
      // 最終的にAPI呼び出しが完了することを確認
      await waitFor(() => {
        expect(screen.queryByText('処理中...')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('ネットワークエラー時の復旧性能', async () => {
      const user = userEvent.setup();
      
      // 最初はエラー、2回目は成功
      api.interactions.toggleLike
        .mockRejectedValueOnce(new Error('ネットワークエラー'))
        .mockResolvedValueOnce({ data: { liked: true, likes_count: 1 } });
      
      render(
        <TestAuthProvider>
          <LikeButton
            postId="error-recovery-test"
            initialLiked={false}
            initialCount={0}
          />
        </TestAuthProvider>
      );
      
      const button = screen.getByRole('button');
      
      // 最初のクリック（エラー）
      await user.click(button);
      
      // エラー後のロールバック確認
      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText(/ネットワークエラー/)).toBeInTheDocument();
      });
      
      // 再試行の時間測定
      const retryTime = await measurePerformance(async () => {
        await user.click(button);
        
        // 成功確認
        await waitFor(() => {
          expect(screen.getByText('1')).toBeInTheDocument();
        });
      });
      
      // 再試行が500ms以内に完了することを確認
      expect(retryTime).toBeLessThan(500);
    });
  });

  describe('同時実行とレースコンディション', () => {
    test('同一投稿への同時いいね操作', async () => {
      const user = userEvent.setup();
      
      // 遅延を模擬
      api.interactions.toggleLike.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { liked: true, likes_count: 1 } }), 100)
        )
      );
      
      render(
        <TestAuthProvider>
          <LikeButton
            postId="race-condition-test"
            initialLiked={false}
            initialCount={0}
          />
        </TestAuthProvider>
      );
      
      const button = screen.getByRole('button');
      
      // 同時に複数回クリック
      const promises = Array.from({ length: 5 }, () => user.click(button));
      
      await Promise.all(promises);
      
      // API呼び出しは1回のみであることを確認
      expect(api.interactions.toggleLike).toHaveBeenCalledTimes(1);
      
      // 最終状態が正しいことを確認
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    test('複数投稿への同時操作', async () => {
      const user = userEvent.setup();
      const posts = generateMockPosts(5);
      
      render(
        <TestAuthProvider>
          <div>
            {posts.map(post => (
              <LikeButton
                key={post.post_id}
                postId={post.post_id}
                initialLiked={false}
                initialCount={0}
              />
            ))}
          </div>
        </TestAuthProvider>
      );
      
      const buttons = screen.getAllByRole('button');
      
      // 同時に全ボタンをクリック
      const operationTime = await measurePerformance(async () => {
        const promises = buttons.map(button => user.click(button));
        await Promise.all(promises);
      });
      
      // 同時操作が300ms以内に完了することを確認
      expect(operationTime).toBeLessThan(300);
      
      // すべての投稿で独立してAPI呼び出しが実行されることを確認
      expect(api.interactions.toggleLike).toHaveBeenCalledTimes(5);
    });
  });

  describe('アクセシビリティパフォーマンス', () => {
    test('スクリーンリーダー対応の応答性', async () => {
      const posts = generateMockPosts(20);
      
      const renderTime = await measurePerformance(async () => {
        render(
          <TestAuthProvider>
            <div>
              {posts.map(post => (
                <LikeButton
                  key={post.post_id}
                  postId={post.post_id}
                  initialLiked={post.user_liked}
                  initialCount={post.likes_count}
                />
              ))}
            </div>
          </TestAuthProvider>
        );
      });
      
      // ARIAラベル付きコンポーネントが500ms以内にレンダリングされることを確認
      expect(renderTime).toBeLessThan(500);
      
      // すべてのボタンに適切なARIAラベルが設定されることを確認
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveAttribute('title');
      });
    });
  });
});