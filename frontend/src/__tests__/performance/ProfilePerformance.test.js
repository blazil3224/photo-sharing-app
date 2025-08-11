import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Profile from '../../pages/Profile';
import { ProfilePosts } from '../../components/Profile';
import { api } from '../../services/api';

// APIモック
jest.mock('../../services/api');

// React Routerのモック
const mockNavigate = jest.fn();
const mockParams = { userId: 'user123' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

// パフォーマンス測定用のヘルパー
const measurePerformance = async (operation) => {
  const start = performance.now();
  await operation();
  const end = performance.now();
  return end - start;
};

/**
 * プロフィール機能パフォーマンステスト
 * 大量データ処理、メモリ使用量、レンダリング性能の検証
 */
describe('プロフィール機能パフォーマンステスト', () => {
  const mockUser = {
    user_id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    bio: 'テストユーザーです',
    profile_image: '/test-avatar.jpg',
    created_at: '2024-01-01T00:00:00Z'
  };

  // 大量の投稿データを生成
  const generateMockPosts = (count) => {
    return Array.from({ length: count }, (_, i) => ({
      post_id: `post${i}`,
      user_id: 'user123',
      image_url: `/test-image${i}.jpg`,
      caption: `テスト投稿${i} - これは長いキャプションのテストです。パフォーマンステストのために作成された投稿で、実際のユーザー投稿を模擬しています。`,
      likes_count: Math.floor(Math.random() * 1000),
      comments_count: Math.floor(Math.random() * 100),
      created_at: `2024-01-${String((i % 30) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`
    }));
  };

  const renderWithAuth = (user = mockUser, isAuthenticated = true) => {
    const authValue = {
      user,
      isAuthenticated,
      updateUser: jest.fn()
    };

    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <Profile />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  const renderProfilePostsWithAuth = (props = {}, user = mockUser) => {
    const authValue = {
      user,
      isAuthenticated: true,
      updateUser: jest.fn()
    };

    const defaultProps = {
      userId: 'user123',
      onPostsCountChange: jest.fn(),
      ...props
    };

    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <ProfilePosts {...defaultProps} />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのAPIレスポンス設定
    api.users.getProfile.mockResolvedValue({
      success: true,
      data: mockUser
    });
  });

  describe('大量投稿データの処理性能', () => {
    test('100件の投稿を効率的に表示できる', async () => {
      const largePosts = generateMockPosts(100);
      
      // 最初の12件を返す
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: largePosts.slice(0, 12),
          last_key: 'key12'
        }
      });

      const renderTime = await measurePerformance(async () => {
        renderWithAuth();
        
        await waitFor(() => {
          const images = screen.getAllByRole('img');
          const postImages = images.filter(img => 
            img.getAttribute('src')?.includes('test-image')
          );
          expect(postImages.length).toBeGreaterThanOrEqual(12);
        });
      });

      // 初期レンダリングは1秒以内であること
      expect(renderTime).toBeLessThan(1000);
    });

    test('1000件の投稿データでの無限スクロール性能', async () => {
      const massivePosts = generateMockPosts(1000);
      let currentIndex = 0;
      const batchSize = 12;

      // 無限スクロールのモック実装
      api.posts.getUserPosts.mockImplementation(async (userId, params) => {
        const start = currentIndex;
        const end = Math.min(start + batchSize, massivePosts.length);
        const batch = massivePosts.slice(start, end);
        currentIndex = end;

        return {
          success: true,
          data: {
            posts: batch,
            last_key: end < massivePosts.length ? `key${end}` : null
          }
        };
      });

      renderProfilePostsWithAuth();

      // 初期読み込み
      await waitFor(() => {
        expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
      });

      // 複数回のスクロールをシミュレート
      const scrollTimes = [];
      for (let i = 0; i < 5; i++) {
        const scrollTime = await measurePerformance(async () => {
          // スクロールイベントをシミュレート
          Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
          Object.defineProperty(document.documentElement, 'scrollTop', { value: 1000 * (i + 1), writable: true });
          Object.defineProperty(document.documentElement, 'offsetHeight', { value: 1000 * (i + 2), writable: true });

          act(() => {
            window.dispatchEvent(new Event('scroll'));
          });

          await waitFor(() => {
            const images = screen.getAllByRole('img');
            expect(images.length).toBeGreaterThan(12 * (i + 1));
          }, { timeout: 2000 });
        });

        scrollTimes.push(scrollTime);
      }

      // 各スクロール操作は500ms以内であること
      scrollTimes.forEach(time => {
        expect(time).toBeLessThan(500);
      });

      // 平均スクロール時間は300ms以内であること
      const averageScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      expect(averageScrollTime).toBeLessThan(300);
    });

    test('画像の遅延読み込み効果測定', async () => {
      const posts = generateMockPosts(50);
      
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: posts.slice(0, 12),
          last_key: 'key12'
        }
      });

      const renderTime = await measurePerformance(async () => {
        renderProfilePostsWithAuth();
        
        await waitFor(() => {
          const images = screen.getAllByRole('img');
          const postImages = images.filter(img => 
            img.getAttribute('src')?.includes('test-image')
          );
          expect(postImages.length).toBeGreaterThanOrEqual(12);
        });
      });

      // 遅延読み込みにより初期レンダリングが高速であること
      expect(renderTime).toBeLessThan(800);

      // すべての投稿画像にloading="lazy"が設定されていることを確認
      const images = screen.getAllByRole('img');
      const postImages = images.filter(img => 
        img.getAttribute('src')?.includes('test-image')
      );
      
      postImages.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('メモリ使用量最適化', () => {
    test('大量データ表示時のメモリリーク検出', async () => {
      const posts = generateMockPosts(200);
      
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: posts.slice(0, 24),
          last_key: 'key24'
        }
      });

      // 初期メモリ使用量（概算）
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      const { unmount } = renderProfilePostsWithAuth();

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(20);
      });

      // コンポーネントをアンマウント
      unmount();

      // ガベージコレクションを促進
      if (global.gc) {
        global.gc();
      }

      // メモリ使用量の増加が許容範囲内であることを確認
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // メモリ増加が10MB以下であること（概算）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    test('イベントリスナーの適切なクリーンアップ', async () => {
      const originalAddEventListener = window.addEventListener;
      const originalRemoveEventListener = window.removeEventListener;
      
      let addedListeners = 0;
      let removedListeners = 0;

      window.addEventListener = jest.fn((...args) => {
        addedListeners++;
        return originalAddEventListener.apply(window, args);
      });

      window.removeEventListener = jest.fn((...args) => {
        removedListeners++;
        return originalRemoveEventListener.apply(window, args);
      });

      const { unmount } = renderProfilePostsWithAuth();

      await waitFor(() => {
        expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument();
      });

      // コンポーネントをアンマウント
      unmount();

      // イベントリスナーが適切にクリーンアップされていることを確認
      expect(removedListeners).toBeGreaterThanOrEqual(addedListeners);

      // 元の関数を復元
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
    });
  });

  describe('レンダリング最適化', () => {
    test('プロフィール情報変更時の部分更新性能', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      // プロフィール編集モードに切り替え
      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // フォーム入力の性能測定
      const inputTime = await measurePerformance(async () => {
        const usernameInput = screen.getByDisplayValue('testuser');
        
        // 複数回の入力をシミュレート
        for (let i = 0; i < 10; i++) {
          fireEvent.change(usernameInput, { 
            target: { value: `testuser${i}` } 
          });
        }
      });

      // 入力処理が100ms以内であること
      expect(inputTime).toBeLessThan(100);
    });

    test('投稿グリッドの効率的なレンダリング', async () => {
      const posts = generateMockPosts(36); // 3行分の投稿
      
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts,
          last_key: null
        }
      });

      const renderTime = await measurePerformance(async () => {
        renderProfilePostsWithAuth();
        
        await waitFor(() => {
          const images = screen.getAllByRole('img');
          expect(images.length).toBe(36);
        });
      });

      // 36件の投稿表示が1秒以内であること
      expect(renderTime).toBeLessThan(1000);
    });

    test('ホバー効果の性能', async () => {
      const posts = generateMockPosts(12);
      
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts,
          last_key: null
        }
      });

      renderProfilePostsWithAuth();

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBe(12);
      });

      // 複数の投稿にホバーをシミュレート
      const hoverTime = await measurePerformance(async () => {
        const images = screen.getAllByRole('img');
        
        for (let i = 0; i < Math.min(5, images.length); i++) {
          fireEvent.mouseEnter(images[i]);
          fireEvent.mouseLeave(images[i]);
        }
      });

      // ホバー効果が50ms以内であること
      expect(hoverTime).toBeLessThan(50);
    });
  });

  describe('ネットワーク最適化', () => {
    test('API呼び出しの効率性', async () => {
      const posts = generateMockPosts(24);
      
      // APIレスポンス時間をシミュレート
      api.posts.getUserPosts.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms遅延
        return {
          success: true,
          data: {
            posts: posts.slice(0, 12),
            last_key: 'key12'
          }
        };
      });

      const loadTime = await measurePerformance(async () => {
        renderProfilePostsWithAuth();
        
        await waitFor(() => {
          const images = screen.getAllByRole('img');
          expect(images.length).toBeGreaterThan(0);
        });
      });

      // ネットワーク遅延を含めても500ms以内であること
      expect(loadTime).toBeLessThan(500);
    });

    test('同時API呼び出しの制御', async () => {
      let apiCallCount = 0;
      
      api.posts.getUserPosts.mockImplementation(async () => {
        apiCallCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          data: {
            posts: generateMockPosts(12),
            last_key: 'key12'
          }
        };
      });

      renderProfilePostsWithAuth();

      // 複数回のスクロールを短時間で実行
      for (let i = 0; i < 5; i++) {
        act(() => {
          Object.defineProperty(document.documentElement, 'scrollTop', { value: 1000 * (i + 1), writable: true });
          window.dispatchEvent(new Event('scroll'));
        });
      }

      await waitFor(() => {
        expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
      });

      // 不要な重複API呼び出しが発生していないことを確認
      expect(apiCallCount).toBeLessThanOrEqual(2);
    });
  });

  describe('ユーザビリティ性能', () => {
    test('削除モーダルの表示性能', async () => {
      const posts = generateMockPosts(12);
      
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts,
          last_key: null
        }
      });

      renderProfilePostsWithAuth();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('投稿を削除');
        expect(deleteButtons.length).toBeGreaterThan(0);
      });

      const modalTime = await measurePerformance(async () => {
        const deleteButton = screen.getAllByTitle('投稿を削除')[0];
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('投稿を削除')).toBeInTheDocument();
        });
      });

      // モーダル表示が100ms以内であること
      expect(modalTime).toBeLessThan(100);
    });

    test('フォーム入力の応答性', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const inputResponseTime = await measurePerformance(async () => {
        const bioInput = screen.getByDisplayValue('テストユーザーです');
        
        // 長いテキストの入力をシミュレート
        const longText = 'これは非常に長い自己紹介文です。'.repeat(20);
        fireEvent.change(bioInput, { target: { value: longText } });
        
        expect(bioInput.value).toBe(longText);
      });

      // 長いテキスト入力でも50ms以内で応答すること
      expect(inputResponseTime).toBeLessThan(50);
    });
  });

  describe('エラー処理性能', () => {
    test('ネットワークエラー時の回復性能', async () => {
      // 最初はエラー
      api.users.getProfile.mockRejectedValueOnce({
        message: 'ネットワークエラー'
      });

      // 再試行時は成功
      api.users.getProfile.mockResolvedValueOnce({
        success: true,
        data: mockUser
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('ネットワークエラー')).toBeInTheDocument();
      });

      const recoveryTime = await measurePerformance(async () => {
        fireEvent.click(screen.getByText('再試行'));
        
        await waitFor(() => {
          expect(screen.getByText('testuser')).toBeInTheDocument();
        });
      });

      // エラー回復が1秒以内であること
      expect(recoveryTime).toBeLessThan(1000);
    });
  });
});