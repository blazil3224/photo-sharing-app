/**
 * 認証フローの統合テスト
 * ログイン・登録フローのE2Eテスト実装
 * 認証状態による画面遷移テスト
 * エラーケースの表示確認テスト
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// テスト対象コンポーネント
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import App from '../../App';
import Login from '../../pages/Login';
import Register from '../../pages/Register';
import Home from '../../pages/Home';
import Header from '../../components/Common/Header';

// APIモック
import { api } from '../../services/api';

// APIをモック化
jest.mock('../../services/api', () => ({
  api: {
    auth: {
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
    },
  },
}));

// ローカルストレージのモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// React Router のナビゲーションをモック
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Bootstrap のモーダル機能をモック
global.bootstrap = {
  Modal: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
  })),
};

// テストヘルパー関数
const renderWithRouter = (component) => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('認証フローの統合テスト', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    // モックをリセット
    jest.clearAllMocks();
    mockNavigate.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    localStorageMock.clear.mockImplementation(() => {});
    
    // getCurrentUserのデフォルトモック
    api.auth.getCurrentUser.mockResolvedValue({
      data: { success: false }
    });
  });

  describe('ログインフローのE2Eテスト', () => {
    test('正常なログインフローが完了する', async () => {
      // APIレスポンスをモック
      const mockUser = {
        user_id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
      };
      const mockToken = 'mock-jwt-token';

      api.auth.login.mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
          token: mockToken,
        },
      });

      renderWithRouter(<Login />);

      // ログインフォームの要素を確認
      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /ユーザー名/ })).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'testuser');
      await user.type(document.getElementById('password'), 'password123');

      // ログインボタンをクリック
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // APIが正しいパラメータで呼ばれることを確認
      await waitFor(() => {
        expect(api.auth.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
        });
      });

      // 成功時の処理を確認（ローカルストレージの保存は AuthContext 内で行われる）
      // テストでは API 呼び出しが正しく行われることを確認
      expect(api.auth.login).toHaveBeenCalledTimes(1);
    });

    test('ログイン時のバリデーションエラーが表示される', async () => {
      renderWithRouter(<Login />);

      // 空のフォームで送信
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // バリデーションエラーメッセージを確認
      await waitFor(() => {
        expect(screen.getByText('ユーザー名は必須です')).toBeInTheDocument();
        expect(screen.getByText('パスワードは必須です')).toBeInTheDocument();
      });

      // APIが呼ばれないことを確認
      expect(api.auth.login).not.toHaveBeenCalled();
    });

    test('ログイン時のAPIエラーが表示される', async () => {
      // APIエラーをモック
      api.auth.login.mockRejectedValue({
        message: 'ユーザー名またはパスワードが間違っています',
      });

      renderWithRouter(<Login />);

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'wronguser');
      await user.type(document.getElementById('password'), 'wrongpassword');

      // ログインボタンをクリック
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('ユーザー名またはパスワードが間違っています')).toBeInTheDocument();
      });
    });
  });

  describe('新規登録フローのE2Eテスト', () => {
    test('正常な新規登録フローが完了する', async () => {
      // APIレスポンスをモック
      const mockUser = {
        user_id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
      };
      const mockToken = 'new-jwt-token';

      api.auth.register.mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
          token: mockToken,
        },
      });

      renderWithRouter(<Register />);

      // 新規登録フォームの要素を確認
      expect(screen.getByRole('heading', { name: '新規登録' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /ユーザー名/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /メールアドレス/ })).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(document.getElementById('confirmPassword')).toBeInTheDocument();

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'newuser');
      await user.type(screen.getByRole('textbox', { name: /メールアドレス/ }), 'new@example.com');
      await user.type(document.getElementById('password'), 'password123');
      await user.type(document.getElementById('confirmPassword'), 'password123');

      // 登録ボタンをクリック
      await user.click(screen.getByRole('button', { name: 'アカウント作成' }));

      // APIが正しいパラメータで呼ばれることを確認
      await waitFor(() => {
        expect(api.auth.register).toHaveBeenCalledWith({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
        });
      });

      // 成功時の処理を確認（ローカルストレージの保存は AuthContext 内で行われる）
      expect(api.auth.register).toHaveBeenCalledTimes(1);
    });

    test('新規登録時のバリデーションエラーが表示される', async () => {
      renderWithRouter(<Register />);

      // 無効なデータでフォームを送信
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'ab'); // 3文字未満
      await user.type(screen.getByRole('textbox', { name: /メールアドレス/ }), 'invalid-email'); // 無効なメール
      await user.type(document.getElementById('password'), '123'); // 6文字未満
      await user.type(document.getElementById('confirmPassword'), '456'); // パスワード不一致

      await user.click(screen.getByRole('button', { name: 'アカウント作成' }));

      // バリデーションエラーメッセージを確認
      await waitFor(() => {
        expect(screen.getByText('ユーザー名は3文字以上で入力してください')).toBeInTheDocument();
        expect(screen.getByText('有効なメールアドレスを入力してください')).toBeInTheDocument();
        expect(screen.getByText('パスワードは6文字以上で入力してください')).toBeInTheDocument();
        expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument();
      });

      // APIが呼ばれないことを確認
      expect(api.auth.register).not.toHaveBeenCalled();
    });

    test('新規登録時のAPIエラーが表示される', async () => {
      // APIエラーをモック
      api.auth.register.mockRejectedValue({
        message: 'このユーザー名は既に使用されています',
      });

      renderWithRouter(<Register />);

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'existinguser');
      await user.type(screen.getByRole('textbox', { name: /メールアドレス/ }), 'existing@example.com');
      await user.type(document.getElementById('password'), 'password123');
      await user.type(document.getElementById('confirmPassword'), 'password123');

      // 登録ボタンをクリック
      await user.click(screen.getByRole('button', { name: 'アカウント作成' }));

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('このユーザー名は既に使用されています')).toBeInTheDocument();
      });
    });
  });

  // AuthContextの状態をテストするためのテストコンポーネント
  const TestAuthComponent = () => {
    const { user, isAuthenticated, loading, login, logout } = useAuth();
    
    if (loading) return <div>Loading...</div>;
    
    return (
      <div>
        <div data-testid="auth-status">
          {isAuthenticated ? 'authenticated' : 'unauthenticated'}
        </div>
        {user && <div data-testid="username">{user.username}</div>}
        <button onClick={() => login({ username: 'test', password: 'test' })}>
          Login
        </button>
        <button onClick={logout}>Logout</button>
      </div>
    );
  };

  describe('認証状態による画面遷移テスト', () => {

    test('未認証状態の初期化が正しく動作する', async () => {
      // ローカルストレージをクリア
      localStorageMock.getItem.mockReturnValue(null);
      
      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // 未認証状態が表示されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });
    });

    test('認証済み状態の復元が正しく動作する', async () => {
      // 認証済み状態をモック
      const mockUser = {
        user_id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
      };
      const mockToken = 'mock-jwt-token';

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      api.auth.getCurrentUser.mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
        },
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // 認証状態が復元されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });
    });

    test('ログイン処理が正しく動作する', async () => {
      // ローカルストレージをクリア
      localStorageMock.getItem.mockReturnValue(null);
      
      const mockUser = {
        user_id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
      };
      const mockToken = 'mock-jwt-token';

      api.auth.login.mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
          token: mockToken,
        },
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // 初期状態は未認証
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });

      // ログインボタンをクリック
      await user.click(screen.getByText('Login'));

      // 認証状態に変更されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });
    });

    test('ログアウト機能が正常に動作する', async () => {
      // 認証済み状態をモック
      const mockUser = {
        user_id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
      };
      const mockToken = 'mock-jwt-token';

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      api.auth.getCurrentUser.mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
        },
      });

      api.auth.logout.mockResolvedValue({
        data: { success: true }
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // 認証状態が復元されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      // ログアウトボタンをクリック
      await user.click(screen.getByText('Logout'));

      // 未認証状態に変更されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });
    });
  });

  describe('エラーケースの表示確認テスト', () => {
    test('ネットワークエラー時の適切なエラーメッセージ表示', async () => {
      // ネットワークエラーをモック
      api.auth.login.mockRejectedValue(new Error('Network Error'));

      renderWithRouter(<Login />);

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'testuser');
      await user.type(document.getElementById('password'), 'password123');

      // ログインボタンをクリック
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // ネットワークエラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
      });
    });

    test('サーバーエラー時の適切なエラーメッセージ表示', async () => {
      // サーバーエラーをモック
      api.auth.login.mockRejectedValue({
        message: 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。',
        status: 500
      });

      renderWithRouter(<Login />);

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'testuser');
      await user.type(document.getElementById('password'), 'password123');

      // ログインボタンをクリック
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // サーバーエラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。')).toBeInTheDocument();
      });
    });

    test('認証トークンの有効期限切れ時の処理', async () => {
      // 期限切れトークンをモック
      const mockUser = {
        user_id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
      };
      const expiredToken = 'expired-jwt-token';

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return expiredToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      // getCurrentUserで401エラーを返す
      api.auth.getCurrentUser.mockRejectedValue({
        status: 401,
        message: 'Token expired'
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // トークンが無効な場合、未認証状態になることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });
    });

    test('フォームバリデーションエラーの複数表示', async () => {
      renderWithRouter(<Register />);

      // 全て空のフォームで送信
      await user.click(screen.getByRole('button', { name: 'アカウント作成' }));

      // 複数のバリデーションエラーが同時に表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('ユーザー名は必須です')).toBeInTheDocument();
        expect(screen.getByText('メールアドレスは必須です')).toBeInTheDocument();
        expect(screen.getByText('パスワードは必須です')).toBeInTheDocument();
        expect(screen.getByText('パスワード確認は必須です')).toBeInTheDocument();
      });

      // APIが呼ばれないことを確認
      expect(api.auth.register).not.toHaveBeenCalled();
    });

    test('ローディング状態の表示と非表示', async () => {
      // 遅延レスポンスをモック
      let resolveLogin;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      api.auth.login.mockReturnValue(loginPromise);

      renderWithRouter(<Login />);

      // フォームに入力
      await user.type(screen.getByRole('textbox', { name: /ユーザー名/ }), 'testuser');
      await user.type(document.getElementById('password'), 'password123');

      // ログインボタンをクリック
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // ローディング状態が表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('処理中...')).toBeInTheDocument();
      });

      // レスポンスを解決
      resolveLogin({
        data: {
          success: true,
          user: { user_id: 'test-id', username: 'testuser', email: 'test@example.com' },
          token: 'test-token'
        }
      });

      // ローディング状態が非表示になることを確認
      await waitFor(() => {
        expect(screen.queryByText('処理中...')).not.toBeInTheDocument();
      });
    });
  });

  describe('認証状態の永続化テスト', () => {
    test('ページリロード後も認証状態が維持される', async () => {
      // 認証済み状態をローカルストレージに保存
      const mockUser = {
        user_id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
      };
      const mockToken = 'mock-jwt-token';

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return mockToken;
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });

      api.auth.getCurrentUser.mockResolvedValue({
        data: {
          success: true,
          user: mockUser,
        },
      });

      // アプリを再起動（ページリロードをシミュレート）
      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // 認証状態が復元されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      // getCurrentUserが呼ばれることを確認
      expect(api.auth.getCurrentUser).toHaveBeenCalled();
    });

    test('無効なローカルストレージデータの処理', async () => {
      // 無効なJSONデータをモック
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'invalid-token';
        if (key === 'user') return 'invalid-json-data';
        return null;
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        </MemoryRouter>
      );

      // エラーが発生しても未認証状態になることを確認
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      });
    });
  });
});