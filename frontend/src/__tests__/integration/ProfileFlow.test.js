import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Profile from '../../pages/Profile';
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

/**
 * プロフィール機能統合テスト
 * 要件5.1, 5.2, 5.3, 5.4, 6.3の検証
 */
describe('プロフィール機能統合テスト', () => {
  const mockUser = {
    user_id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    bio: 'テストユーザーです',
    profile_image: '/test-avatar.jpg',
    created_at: '2024-01-01T00:00:00Z'
  };

  const mockOtherUser = {
    user_id: 'other456',
    username: 'otheruser',
    email: 'other@example.com',
    bio: 'その他のユーザーです',
    profile_image: '/other-avatar.jpg',
    created_at: '2024-01-02T00:00:00Z'
  };

  const mockPosts = [
    {
      post_id: 'post1',
      user_id: 'user123',
      image_url: '/test-image1.jpg',
      caption: 'テスト投稿1',
      likes_count: 5,
      comments_count: 2,
      created_at: '2024-01-03T00:00:00Z'
    },
    {
      post_id: 'post2',
      user_id: 'user123',
      image_url: '/test-image2.jpg',
      caption: 'テスト投稿2',
      likes_count: 3,
      comments_count: 1,
      created_at: '2024-01-04T00:00:00Z'
    }
  ];

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    
    // デフォルトのAPIレスポンス設定
    api.users.getProfile.mockResolvedValue({
      success: true,
      data: mockUser
    });
    
    api.posts.getUserPosts.mockResolvedValue({
      success: true,
      data: {
        posts: mockPosts,
        last_key: null
      }
    });
  });

  describe('要件5.1: プロフィール表示機能', () => {
    test('自分のプロフィールページが正しく表示される', async () => {
      renderWithAuth();

      // プロフィール情報の表示確認
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText('テストユーザーです')).toBeInTheDocument();
        expect(screen.getByText('2024年1月に参加')).toBeInTheDocument();
      });

      // 投稿数の表示確認
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('投稿')).toBeInTheDocument();

      // 編集ボタンの表示確認（自分のプロフィール）
      expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      expect(screen.getByText('画像を変更')).toBeInTheDocument();
    });

    test('他人のプロフィールページが正しく表示される', async () => {
      // 他人のプロフィールを表示
      api.users.getProfile.mockResolvedValue({
        success: true,
        data: mockOtherUser
      });

      renderWithAuth(mockUser); // 現在のユーザーはmockUser

      await waitFor(() => {
        expect(screen.getByText('otheruser')).toBeInTheDocument();
        expect(screen.getByText('その他のユーザーです')).toBeInTheDocument();
      });

      // 編集ボタンが表示されないことを確認（他人のプロフィール）
      expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
      expect(screen.queryByText('画像を変更')).not.toBeInTheDocument();
    });

    test('投稿一覧が正しく表示される', async () => {
      renderWithAuth();

      await waitFor(() => {
        // 投稿画像の表示確認
        const images = screen.getAllByRole('img');
        const postImages = images.filter(img => 
          img.getAttribute('alt')?.includes('投稿画像') || 
          img.getAttribute('src')?.includes('test-image')
        );
        expect(postImages).toHaveLength(2);
      });

      // 投稿へのリンク確認
      const postLinks = screen.getAllByRole('link').filter(link => 
        link.getAttribute('href')?.startsWith('/posts/')
      );
      expect(postLinks).toHaveLength(2);
    });

    test('投稿がない場合の表示', async () => {
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: [],
          last_key: null
        }
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument();
        expect(screen.getByText('最初の投稿をして、あなたの写真を共有しましょう！')).toBeInTheDocument();
        expect(screen.getByText('投稿する')).toBeInTheDocument();
      });
    });
  });

  describe('要件5.2: プロフィール編集機能', () => {
    test('プロフィール編集フォームが正しく表示される', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      });

      // 編集ボタンをクリック
      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('テストユーザーです')).toBeInTheDocument();
        expect(screen.getByText('変更を保存')).toBeInTheDocument();
        expect(screen.getByText('キャンセル')).toBeInTheDocument();
      });
    });

    test('プロフィール情報の更新が正常に動作する', async () => {
      const updatedProfile = {
        ...mockUser,
        username: 'updateduser',
        bio: '更新されたプロフィールです'
      };

      api.users.updateProfile.mockResolvedValue({
        success: true,
        data: updatedProfile
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      });

      // 編集モードに切り替え
      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // フォーム入力
      const usernameInput = screen.getByDisplayValue('testuser');
      const bioInput = screen.getByDisplayValue('テストユーザーです');

      fireEvent.change(usernameInput, { target: { value: 'updateduser' } });
      fireEvent.change(bioInput, { target: { value: '更新されたプロフィールです' } });

      // 保存ボタンをクリック
      fireEvent.click(screen.getByText('変更を保存'));

      await waitFor(() => {
        expect(api.users.updateProfile).toHaveBeenCalledWith('user123', {
          username: 'updateduser',
          bio: '更新されたプロフィールです',
          email: 'test@example.com'
        });
      });
    });

    test('バリデーションエラーが正しく表示される', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      });

      // 編集モードに切り替え
      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // 無効な入力
      const usernameInput = screen.getByDisplayValue('testuser');
      fireEvent.change(usernameInput, { target: { value: 'a' } }); // 短すぎる

      // 保存ボタンをクリック
      fireEvent.click(screen.getByText('変更を保存'));

      await waitFor(() => {
        expect(screen.getByText('ユーザー名は3文字以上で入力してください')).toBeInTheDocument();
      });

      // APIが呼ばれないことを確認
      expect(api.users.updateProfile).not.toHaveBeenCalled();
    });

    test('編集キャンセル機能が正常に動作する', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      });

      // 編集モードに切り替え
      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // 入力を変更
      const usernameInput = screen.getByDisplayValue('testuser');
      fireEvent.change(usernameInput, { target: { value: 'changeduser' } });

      // キャンセルボタンをクリック
      window.confirm = jest.fn(() => true);
      fireEvent.click(screen.getByText('キャンセル'));

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('changeduser')).not.toBeInTheDocument();
      });
    });
  });

  describe('要件5.3: 投稿削除機能', () => {
    test('自分の投稿に削除ボタンが表示される', async () => {
      renderWithAuth();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('投稿を削除');
        expect(deleteButtons).toHaveLength(2); // 2つの投稿に対して
      });
    });

    test('他人の投稿に削除ボタンが表示されない', async () => {
      // 他人のプロフィールを表示
      api.users.getProfile.mockResolvedValue({
        success: true,
        data: mockOtherUser
      });

      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: mockPosts.map(post => ({ ...post, user_id: 'other456' })),
          last_key: null
        }
      });

      renderWithAuth(mockUser); // 現在のユーザーはmockUser

      await waitFor(() => {
        expect(screen.getByText('otheruser')).toBeInTheDocument();
      });

      // 削除ボタンが表示されないことを確認
      expect(screen.queryByTitle('投稿を削除')).not.toBeInTheDocument();
    });

    test('投稿削除が正常に動作する', async () => {
      api.posts.deletePost.mockResolvedValue({
        success: true
      });

      renderWithAuth();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('投稿を削除');
        expect(deleteButtons).toHaveLength(2);
      });

      // 最初の削除ボタンをクリック
      fireEvent.click(screen.getAllByTitle('投稿を削除')[0]);

      await waitFor(() => {
        expect(screen.getByText('投稿を削除')).toBeInTheDocument();
        expect(screen.getByText('この投稿を削除してもよろしいですか？')).toBeInTheDocument();
      });

      // 削除確認
      fireEvent.click(screen.getByText('削除'));

      await waitFor(() => {
        expect(api.posts.deletePost).toHaveBeenCalledWith('post1');
      });
    });

    test('投稿削除のキャンセルが正常に動作する', async () => {
      renderWithAuth();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('投稿を削除');
        expect(deleteButtons).toHaveLength(2);
      });

      // 削除ボタンをクリック
      fireEvent.click(screen.getAllByTitle('投稿を削除')[0]);

      await waitFor(() => {
        expect(screen.getByText('投稿を削除')).toBeInTheDocument();
      });

      // キャンセルボタンをクリック
      fireEvent.click(screen.getByText('キャンセル'));

      await waitFor(() => {
        expect(screen.queryByText('この投稿を削除してもよろしいですか？')).not.toBeInTheDocument();
      });

      // APIが呼ばれないことを確認
      expect(api.posts.deletePost).not.toHaveBeenCalled();
    });
  });

  describe('要件5.4: 権限制御', () => {
    test('未認証ユーザーはログインページにリダイレクトされる', () => {
      renderWithAuth(null, false);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    test('存在しないユーザーのプロフィールアクセス時のエラー表示', async () => {
      api.users.getProfile.mockRejectedValue({
        status: 404,
        message: 'ユーザーが見つかりません'
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument();
        expect(screen.getByText('再試行')).toBeInTheDocument();
        expect(screen.getByText('ホームに戻る')).toBeInTheDocument();
      });
    });

    test('プロフィール画像アップロード権限チェック', async () => {
      // 他人のプロフィールを表示
      api.users.getProfile.mockResolvedValue({
        success: true,
        data: mockOtherUser
      });

      renderWithAuth(mockUser);

      await waitFor(() => {
        expect(screen.getByText('otheruser')).toBeInTheDocument();
      });

      // 画像変更ボタンが表示されないことを確認
      expect(screen.queryByText('画像を変更')).not.toBeInTheDocument();
    });
  });

  describe('要件6.3: エラーハンドリング', () => {
    test('プロフィール読み込みエラーの処理', async () => {
      api.users.getProfile.mockRejectedValue({
        message: 'サーバーエラーが発生しました'
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
        expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
        expect(screen.getByText('再試行')).toBeInTheDocument();
      });
    });

    test('投稿読み込みエラーの処理', async () => {
      api.posts.getUserPosts.mockRejectedValue({
        message: '投稿の読み込みに失敗しました'
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('投稿の読み込みに失敗しました')).toBeInTheDocument();
      });
    });

    test('プロフィール更新エラーの処理', async () => {
      api.users.updateProfile.mockRejectedValue({
        status: 409,
        message: 'このユーザー名は既に使用されています'
      });

      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      });

      // 編集モードに切り替え
      fireEvent.click(screen.getByText('プロフィールを編集'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // フォーム送信
      fireEvent.click(screen.getByText('変更を保存'));

      await waitFor(() => {
        expect(screen.getByText('このユーザー名は既に使用されています')).toBeInTheDocument();
      });
    });

    test('ネットワークエラー時の再試行機能', async () => {
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

      // 再試行ボタンをクリック
      fireEvent.click(screen.getByText('再試行'));

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量の投稿がある場合の無限スクロール', async () => {
      const largePosts = Array.from({ length: 50 }, (_, i) => ({
        post_id: `post${i}`,
        user_id: 'user123',
        image_url: `/test-image${i}.jpg`,
        caption: `テスト投稿${i}`,
        likes_count: i,
        comments_count: i % 3,
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
      }));

      // 最初の12件を返す
      api.posts.getUserPosts.mockResolvedValueOnce({
        success: true,
        data: {
          posts: largePosts.slice(0, 12),
          last_key: 'key12'
        }
      });

      renderWithAuth();

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        const postImages = images.filter(img => 
          img.getAttribute('src')?.includes('test-image')
        );
        expect(postImages.length).toBeGreaterThanOrEqual(12);
      });
    });

    test('画像の遅延読み込み設定確認', async () => {
      renderWithAuth();

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        const postImages = images.filter(img => 
          img.getAttribute('src')?.includes('test-image')
        );
        
        postImages.forEach(img => {
          expect(img).toHaveAttribute('loading', 'lazy');
        });
      });
    });
  });
});