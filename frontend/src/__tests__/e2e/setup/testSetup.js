/**
 * E2Eテストセットアップとユーティリティ
 * 要件: 全要件の統合検証
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import { api } from '../../../services/api';

// テスト用のモックデータ
export const mockTestData = {
  users: {
    testUser1: {
      user_id: 'test-user-1',
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'TestPassword123!',
      profile_image: '/test-avatar-1.jpg',
      bio: 'テストユーザー1です'
    },
    testUser2: {
      user_id: 'test-user-2',
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'TestPassword456!',
      profile_image: '/test-avatar-2.jpg',
      bio: 'テストユーザー2です'
    }
  },
  posts: {
    testPost1: {
      post_id: 'test-post-1',
      user_id: 'test-user-1',
      image_url: '/test-image-1.jpg',
      caption: 'テスト投稿1です',
      likes_count: 5,
      comments_count: 2,
      created_at: '2024-01-01T10:00:00Z'
    },
    testPost2: {
      post_id: 'test-post-2',
      user_id: 'test-user-2',
      image_url: '/test-image-2.jpg',
      caption: 'テスト投稿2です',
      likes_count: 3,
      comments_count: 1,
      created_at: '2024-01-01T11:00:00Z'
    }
  },
  interactions: {
    like1: {
      post_id: 'test-post-1',
      user_id: 'test-user-2',
      interaction_type: 'like',
      created_at: '2024-01-01T10:30:00Z'
    },
    comment1: {
      post_id: 'test-post-1',
      user_id: 'test-user-2',
      interaction_type: 'comment',
      content: 'いいね！',
      created_at: '2024-01-01T10:45:00Z'
    }
  }
};

// テスト用のAPIモック設定
export const setupApiMocks = () => {
  // 認証API
  jest.spyOn(api.auth, 'login').mockImplementation(async (email, password) => {
    const user = Object.values(mockTestData.users).find(u => u.email === email);
    if (user && password === user.password) {
      return {
        success: true,
        data: {
          user: { ...user, password: undefined },
          token: 'mock-jwt-token'
        }
      };
    }
    throw new Error('認証に失敗しました');
  });

  jest.spyOn(api.auth, 'register').mockImplementation(async (username, email, password) => {
    const newUser = {
      user_id: `test-user-${Date.now()}`,
      username,
      email,
      created_at: new Date().toISOString()
    };
    return {
      success: true,
      data: { user: newUser, token: 'mock-jwt-token' }
    };
  });

  jest.spyOn(api.auth, 'logout').mockResolvedValue({
    success: true,
    message: 'ログアウトしました'
  });

  // 投稿API
  jest.spyOn(api.posts, 'getTimeline').mockImplementation(async (params = {}) => {
    const posts = Object.values(mockTestData.posts).map(post => ({
      ...post,
      user: mockTestData.users.testUser1
    }));
    
    return {
      success: true,
      data: {
        posts: posts.slice(0, params.limit || 10),
        last_key: null,
        has_more: false
      }
    };
  });

  jest.spyOn(api.posts, 'getPostById').mockImplementation(async (postId) => {
    const post = mockTestData.posts[Object.keys(mockTestData.posts).find(key => 
      mockTestData.posts[key].post_id === postId
    )];
    
    if (!post) {
      throw new Error('投稿が見つかりません');
    }

    return {
      success: true,
      data: {
        ...post,
        user: mockTestData.users.testUser1
      }
    };
  });

  jest.spyOn(api.posts, 'createPost').mockImplementation(async (postData) => {
    const newPost = {
      post_id: `test-post-${Date.now()}`,
      user_id: 'test-user-1',
      ...postData,
      likes_count: 0,
      comments_count: 0,
      created_at: new Date().toISOString()
    };
    
    return {
      success: true,
      data: newPost
    };
  });

  // インタラクションAPI
  jest.spyOn(api.interactions, 'toggleLike').mockImplementation(async (postId) => {
    return {
      success: true,
      data: {
        liked: true,
        likes_count: 6
      }
    };
  });

  jest.spyOn(api.interactions, 'addComment').mockImplementation(async (postId, content) => {
    const newComment = {
      interaction_id: `comment-${Date.now()}`,
      post_id: postId,
      user_id: 'test-user-1',
      content,
      created_at: new Date().toISOString()
    };
    
    return {
      success: true,
      data: newComment
    };
  });

  jest.spyOn(api.interactions, 'getComments').mockImplementation(async (postId) => {
    return {
      success: true,
      data: [
        {
          ...mockTestData.interactions.comment1,
          user: mockTestData.users.testUser2
        }
      ]
    };
  });

  // プロフィールAPI
  jest.spyOn(api.profile, 'getProfile').mockImplementation(async (userId) => {
    const user = Object.values(mockTestData.users).find(u => u.user_id === userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    return {
      success: true,
      data: { ...user, password: undefined }
    };
  });

  jest.spyOn(api.profile, 'updateProfile').mockImplementation(async (profileData) => {
    return {
      success: true,
      data: {
        ...mockTestData.users.testUser1,
        ...profileData,
        password: undefined
      }
    };
  });
};

// テスト用のコンポーネントラッパー
export const TestWrapper = ({ children, initialUser = null }) => {
  return (
    <BrowserRouter>
      <AuthProvider initialUser={initialUser}>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};

// カスタムレンダー関数
export const renderWithProviders = (ui, options = {}) => {
  const { initialUser, ...renderOptions } = options;
  
  const Wrapper = ({ children }) => (
    <TestWrapper initialUser={initialUser}>
      {children}
    </TestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// テストユーティリティ関数
export const testUtils = {
  // ユーザーログイン
  async loginUser(email = mockTestData.users.testUser1.email, password = mockTestData.users.testUser1.password) {
    const emailInput = screen.getByLabelText(/メールアドレス/i);
    const passwordInput = screen.getByLabelText(/パスワード/i);
    const loginButton = screen.getByRole('button', { name: /ログイン/i });

    await userEvent.type(emailInput, email);
    await userEvent.type(passwordInput, password);
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.queryByText(/ログイン中/i)).not.toBeInTheDocument();
    });
  },

  // ユーザー登録
  async registerUser(username = 'newuser', email = 'new@example.com', password = 'NewPassword123!') {
    const usernameInput = screen.getByLabelText(/ユーザー名/i);
    const emailInput = screen.getByLabelText(/メールアドレス/i);
    const passwordInput = screen.getByLabelText(/パスワード/i);
    const registerButton = screen.getByRole('button', { name: /登録/i });

    await userEvent.type(usernameInput, username);
    await userEvent.type(emailInput, email);
    await userEvent.type(passwordInput, password);
    await userEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.queryByText(/登録中/i)).not.toBeInTheDocument();
    });
  },

  // 投稿作成
  async createPost(caption = 'テスト投稿', imageFile = null) {
    const captionInput = screen.getByLabelText(/キャプション/i);
    const submitButton = screen.getByRole('button', { name: /投稿/i });

    await userEvent.type(captionInput, caption);

    if (imageFile) {
      const fileInput = screen.getByLabelText(/画像を選択/i);
      await userEvent.upload(fileInput, imageFile);
    }

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(/投稿中/i)).not.toBeInTheDocument();
    });
  },

  // いいねボタンクリック
  async toggleLike(postId = 'test-post-1') {
    const likeButton = screen.getByTestId(`like-button-${postId}`);
    await userEvent.click(likeButton);

    await waitFor(() => {
      expect(likeButton).not.toBeDisabled();
    });
  },

  // コメント追加
  async addComment(content = 'テストコメント', postId = 'test-post-1') {
    const commentInput = screen.getByPlaceholderText(/コメントを入力/i);
    const submitButton = screen.getByRole('button', { name: /コメント投稿/i });

    await userEvent.type(commentInput, content);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(commentInput).toHaveValue('');
    });
  },

  // プロフィール更新
  async updateProfile(bio = '更新されたプロフィール') {
    const bioInput = screen.getByLabelText(/自己紹介/i);
    const saveButton = screen.getByRole('button', { name: /保存/i });

    await userEvent.clear(bioInput);
    await userEvent.type(bioInput, bio);
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText(/保存中/i)).not.toBeInTheDocument();
    });
  },

  // 要素が表示されるまで待機
  async waitForElement(selector, timeout = 5000) {
    return await waitFor(() => {
      const element = screen.getByTestId(selector);
      expect(element).toBeInTheDocument();
      return element;
    }, { timeout });
  },

  // ページナビゲーション
  async navigateToPage(pageName) {
    const navigationMap = {
      'ホーム': /ホーム/i,
      'プロフィール': /プロフィール/i,
      'アップロード': /アップロード/i,
      'ログイン': /ログイン/i,
      '登録': /登録/i
    };

    const linkPattern = navigationMap[pageName];
    if (!linkPattern) {
      throw new Error(`Unknown page: ${pageName}`);
    }

    const link = screen.getByRole('link', { name: linkPattern });
    await userEvent.click(link);

    await waitFor(() => {
      expect(window.location.pathname).toMatch(new RegExp(pageName.toLowerCase()));
    });
  },

  // エラーメッセージの確認
  expectErrorMessage(message) {
    expect(screen.getByText(message)).toBeInTheDocument();
  },

  // 成功メッセージの確認
  expectSuccessMessage(message) {
    expect(screen.getByText(message)).toBeInTheDocument();
  },

  // ローディング状態の確認
  expectLoadingState() {
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  },

  // ローディング完了の確認
  async waitForLoadingComplete() {
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  }
};

// テストデータクリーンアップ
export const cleanupTestData = () => {
  // LocalStorageクリア
  localStorage.clear();
  sessionStorage.clear();
  
  // APIモッククリア
  jest.clearAllMocks();
};

// テスト環境セットアップ
export const setupTestEnvironment = () => {
  // コンソールエラーを抑制（テスト中の不要なログを減らす）
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Warning: ReactDOM.render is no longer supported')
      ) {
        return;
      }
      originalError.call(console, ...args);
    };
  });

  afterAll(() => {
    console.error = originalError;
  });

  // 各テスト前のセットアップ
  beforeEach(() => {
    setupApiMocks();
    
    // IntersectionObserver のモック
    global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // ResizeObserver のモック
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // matchMedia のモック
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  // 各テスト後のクリーンアップ
  afterEach(() => {
    cleanupTestData();
  });
};

// パフォーマンステストユーティリティ
export const performanceUtils = {
  // レンダリング時間測定
  measureRenderTime: async (renderFunction) => {
    const startTime = performance.now();
    await renderFunction();
    const endTime = performance.now();
    return endTime - startTime;
  },

  // メモリ使用量測定
  measureMemoryUsage: () => {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  },

  // ネットワーク遅延シミュレーション
  simulateNetworkDelay: (delay = 1000) => {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
};

export default {
  mockTestData,
  setupApiMocks,
  TestWrapper,
  renderWithProviders,
  testUtils,
  cleanupTestData,
  setupTestEnvironment,
  performanceUtils
};