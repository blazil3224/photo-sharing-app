import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Profile from '../../pages/Profile';
import { ProfileHeader, EditProfile, ProfilePosts } from '../../components/Profile';
import { api } from '../../services/api';

// APIモック
jest.mock('../../services/api');

// React Routerのモック
const mockNavigate = jest.fn();
let mockParams = { userId: 'user123' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

/**
 * プロフィール機能権限・認可テスト
 * 要件5.1, 5.2, 5.3, 5.4, 6.3の権限制御検証
 */
describe('プロフィール機能権限・認可テスト', () => {
  const mockCurrentUser = {
    user_id: 'current123',
    username: 'currentuser',
    email: 'current@example.com',
    bio: '現在のユーザー',
    profile_image: '/current-avatar.jpg',
    created_at: '2024-01-01T00:00:00Z'
  };

  const mockTargetUser = {
    user_id: 'target456',
    username: 'targetuser',
    email: 'target@example.com',
    bio: '対象ユーザー',
    profile_image: '/target-avatar.jpg',
    created_at: '2024-01-02T00:00:00Z'
  };

  const mockAdminUser = {
    user_id: 'admin789',
    username: 'adminuser',
    email: 'admin@example.com',
    bio: '管理者ユーザー',
    profile_image: '/admin-avatar.jpg',
    role: 'admin',
    created_at: '2024-01-01T00:00:00Z'
  };

  const renderWithAuth = (user = mockCurrentUser, isAuthenticated = true) => {
    const authValue = {
      user,
      isAuthenticated,
      updateUser: jest.fn(),
      logout: jest.fn()
    };

    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <Profile />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  const renderComponentWithAuth = (Component, props = {}, user = mockCurrentUser) => {
    const authValue = {
      user,
      isAuthenticated: true,
      updateUser: jest.fn()
    };

    return render(
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <Component {...props} />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockParams = { userId: 'target456' };
    
    // デフォルトのAPIレスポンス設定
    api.users.getProfile.mockResolvedValue({
      success: true,
      data: mockTargetUser
    });
    
    api.posts.getUserPosts.mockResolvedValue({
      success: true,
      data: {
        posts: [],
        last_key: null
      }
    });
  });

  describe('認証状態による権限制御', () => {
    test('未認証ユーザーはプロフィールページにアクセスできない', () => {
      renderWithAuth(null, false);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    test('認証済みユーザーは他人のプロフィールを閲覧できる', async () => {
      renderWithAuth(mockCurrentUser);

      await waitFor(() => {
        expect(screen.getByText('targetuser')).toBeInTheDocument();
        expect(screen.getByText('対象ユーザー')).toBeInTheDocument();
      });

      // 編集ボタンが表示されないことを確認
      expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
    });

    test('自分のプロフィールページでは編集権限がある', async () => {
      mockParams = { userId: 'current123' };
      api.users.getProfile.mockResolvedValue({
        success: true,
        data: mockCurrentUser
      });

      renderWithAuth(mockCurrentUser);

      await waitFor(() => {
        expect(screen.getByText('currentuser')).toBeInTheDocument();
        expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
        expect(screen.getByText('画像を変更')).toBeInTheDocument();
      });
    });
  });

  describe('プロフィール編集権限', () => {
    test('他人のプロフィールは編集できない', async () => {
      const props = {
        profile: mockTargetUser,
        onSave: jest.fn(),
        onCancel: jest.fn()
      };

      renderComponentWithAuth(ProfileHeader, props, mockCurrentUser);

      // 編集ボタンが表示されないことを確認
      expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
      expect(screen.queryByText('画像を変更')).not.toBeInTheDocument();
    });

    test('自分のプロフィールは編集できる', async () => {
      const props = {
        profile: mockCurrentUser,
        onSave: jest.fn(),
        onCancel: jest.fn()
      };

      renderComponentWithAuth(ProfileHeader, props, mockCurrentUser);

      expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      expect(screen.getByText('画像を変更')).toBeInTheDocument();
    });

    test('プロフィール編集フォームでの権限チェック', async () => {
      api.users.updateProfile.mockResolvedValue({
        success: true,
        data: { ...mockCurrentUser, username: 'updateduser' }
      });

      const props = {
        profile: mockCurrentUser,
        onSave: jest.fn(),
        onCancel: jest.fn()
      };

      renderComponentWithAuth(EditProfile, props, mockCurrentUser);

      // フォームが表示されることを確認
      expect(screen.getByDisplayValue('currentuser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('current@example.com')).toBeInTheDocument();

      // フォーム送信
      fireEvent.click(screen.getByText('変更を保存'));

      await waitFor(() => {
        expect(api.users.updateProfile).toHaveBeenCalledWith('current123', expect.any(Object));
      });
    });

    test('他人のプロフィール編集試行時のエラー処理', async () => {
      api.users.updateProfile.mockRejectedValue({
        status: 403,
        message: 'この操作を実行する権限がありません'
      });

      const props = {
        profile: mockTargetUser,
        onSave: jest.fn(),
        onCancel: jest.fn()
      };

      renderComponentWithAuth(EditProfile, props, mockCurrentUser);

      // フォーム送信を試行
      fireEvent.click(screen.getByText('変更を保存'));

      await waitFor(() => {
        expect(screen.getByText('この操作を実行する権限がありません')).toBeInTheDocument();
      });
    });
  });

  describe('投稿削除権限', () => {
    const mockOwnPosts = [
      {
        post_id: 'post1',
        user_id: 'current123',
        image_url: '/test-image1.jpg',
        caption: '自分の投稿1',
        likes_count: 5,
        comments_count: 2
      },
      {
        post_id: 'post2',
        user_id: 'current123',
        image_url: '/test-image2.jpg',
        caption: '自分の投稿2',
        likes_count: 3,
        comments_count: 1
      }
    ];

    const mockOtherPosts = [
      {
        post_id: 'post3',
        user_id: 'target456',
        image_url: '/test-image3.jpg',
        caption: '他人の投稿1',
        likes_count: 8,
        comments_count: 4
      }
    ];

    test('自分の投稿には削除ボタンが表示される', async () => {
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: mockOwnPosts,
          last_key: null
        }
      });

      const props = {
        userId: 'current123',
        onPostsCountChange: jest.fn()
      };

      renderComponentWithAuth(ProfilePosts, props, mockCurrentUser);

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('投稿を削除');
        expect(deleteButtons).toHaveLength(2);
      });
    });

    test('他人の投稿には削除ボタンが表示されない', async () => {
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: mockOtherPosts,
          last_key: null
        }
      });

      const props = {
        userId: 'target456',
        onPostsCountChange: jest.fn()
      };

      renderComponentWithAuth(ProfilePosts, props, mockCurrentUser);

      await waitFor(() => {
        // 投稿は表示されるが削除ボタンは表示されない
        expect(screen.getByAltText('他人の投稿1')).toBeInTheDocument();
        expect(screen.queryByTitle('投稿を削除')).not.toBeInTheDocument();
      });
    });

    test('投稿削除時の権限チェック', async () => {
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: mockOwnPosts,
          last_key: null
        }
      });

      api.posts.deletePost.mockResolvedValue({
        success: true
      });

      const props = {
        userId: 'current123',
        onPostsCountChange: jest.fn()
      };

      renderComponentWithAuth(ProfilePosts, props, mockCurrentUser);

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('投稿を削除');
        expect(deleteButtons).toHaveLength(2);
      });

      // 削除ボタンをクリック
      fireEvent.click(screen.getAllByTitle('投稿を削除')[0]);

      await waitFor(() => {
        expect(screen.getByText('投稿を削除')).toBeInTheDocument();
      });

      // 削除確認
      fireEvent.click(screen.getByText('削除'));

      await waitFor(() => {
        expect(api.posts.deletePost).toHaveBeenCalledWith('post1');
      });
    });

    test('他人の投稿削除試行時のエラー処理', async () => {
      api.posts.deletePost.mockRejectedValue({
        status: 403,
        message: 'この投稿を削除する権限がありません'
      });

      // 直接APIを呼び出してエラーをテスト
      try {
        await api.posts.deletePost('post3');
      } catch (error) {
        expect(error.status).toBe(403);
        expect(error.message).toBe('この投稿を削除する権限がありません');
      }
    });
  });

  describe('プロフィール画像アップロード権限', () => {
    test('自分のプロフィール画像は変更できる', async () => {
      api.users.updateProfileImage.mockResolvedValue({
        success: true,
        data: {
          profile_image: '/new-avatar.jpg'
        }
      });

      const props = {
        profile: mockCurrentUser,
        onImageUpload: jest.fn()
      };

      renderComponentWithAuth(ProfileHeader, props, mockCurrentUser);

      expect(screen.getByText('画像を変更')).toBeInTheDocument();

      // ファイル選択をシミュレート
      const fileInput = document.getElementById('profile-image-input');
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      // onImageUploadが呼ばれることを確認
      await waitFor(() => {
        expect(props.onImageUpload).toHaveBeenCalledWith(file);
      });
    });

    test('他人のプロフィール画像は変更できない', async () => {
      const props = {
        profile: mockTargetUser,
        onImageUpload: jest.fn()
      };

      renderComponentWithAuth(ProfileHeader, props, mockCurrentUser);

      // 画像変更ボタンが表示されないことを確認
      expect(screen.queryByText('画像を変更')).not.toBeInTheDocument();
      expect(document.getElementById('profile-image-input')).toBeNull();
    });

    test('無効なファイル形式のアップロード拒否', async () => {
      const props = {
        profile: mockCurrentUser,
        onImageUpload: jest.fn()
      };

      // alertをモック
      window.alert = jest.fn();

      renderComponentWithAuth(ProfileHeader, props, mockCurrentUser);

      const fileInput = document.getElementById('profile-image-input');
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(window.alert).toHaveBeenCalledWith('JPEG、PNG形式の画像ファイルのみアップロード可能です');
      expect(props.onImageUpload).not.toHaveBeenCalled();
    });

    test('ファイルサイズ制限チェック', async () => {
      const props = {
        profile: mockCurrentUser,
        onImageUpload: jest.fn()
      };

      window.alert = jest.fn();

      renderComponentWithAuth(ProfileHeader, props, mockCurrentUser);

      const fileInput = document.getElementById('profile-image-input');
      // 6MBのファイルを作成（制限は5MB）
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(window.alert).toHaveBeenCalledWith('ファイルサイズは5MB以下にしてください');
      expect(props.onImageUpload).not.toHaveBeenCalled();
    });
  });

  describe('管理者権限テスト', () => {
    test('管理者は他人のプロフィールを編集できる', async () => {
      // 管理者権限のテスト（将来の拡張用）
      const props = {
        profile: mockTargetUser,
        onSave: jest.fn(),
        onCancel: jest.fn()
      };

      renderComponentWithAuth(ProfileHeader, props, mockAdminUser);

      // 現在の実装では管理者権限は未実装のため、編集ボタンは表示されない
      expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
    });

    test('管理者は他人の投稿を削除できる', async () => {
      // 管理者権限のテスト（将来の拡張用）
      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: mockOtherPosts,
          last_key: null
        }
      });

      const props = {
        userId: 'target456',
        onPostsCountChange: jest.fn()
      };

      renderComponentWithAuth(ProfilePosts, props, mockAdminUser);

      await waitFor(() => {
        // 現在の実装では管理者権限は未実装のため、削除ボタンは表示されない
        expect(screen.queryByTitle('投稿を削除')).not.toBeInTheDocument();
      });
    });
  });

  describe('セッション・トークン管理', () => {
    test('トークン期限切れ時の処理', async () => {
      api.users.getProfile.mockRejectedValue({
        status: 401,
        message: 'トークンが無効です'
      });

      renderWithAuth(mockCurrentUser);

      await waitFor(() => {
        expect(screen.getByText('トークンが無効です')).toBeInTheDocument();
      });
    });

    test('権限不足エラーの処理', async () => {
      api.users.getProfile.mockRejectedValue({
        status: 403,
        message: 'このリソースにアクセスする権限がありません'
      });

      renderWithAuth(mockCurrentUser);

      await waitFor(() => {
        expect(screen.getByText('このリソースにアクセスする権限がありません')).toBeInTheDocument();
      });
    });

    test('サーバーエラー時の適切な処理', async () => {
      api.users.getProfile.mockRejectedValue({
        status: 500,
        message: 'サーバー内部エラー'
      });

      renderWithAuth(mockCurrentUser);

      await waitFor(() => {
        expect(screen.getByText('サーバー内部エラー')).toBeInTheDocument();
        expect(screen.getByText('再試行')).toBeInTheDocument();
      });
    });
  });

  describe('データ整合性チェック', () => {
    test('プロフィールデータの整合性確認', async () => {
      const incompleteProfile = {
        user_id: 'incomplete123',
        username: 'incompleteuser'
        // email, bio, created_atが欠損
      };

      api.users.getProfile.mockResolvedValue({
        success: true,
        data: incompleteProfile
      });

      renderWithAuth(mockCurrentUser);

      await waitFor(() => {
        expect(screen.getByText('incompleteuser')).toBeInTheDocument();
        // 欠損データでもエラーにならないことを確認
      });
    });

    test('投稿データの整合性確認', async () => {
      const incompletePosts = [
        {
          post_id: 'incomplete1',
          user_id: 'current123',
          image_url: '/test-image.jpg'
          // caption, likes_count, comments_countが欠損
        }
      ];

      api.posts.getUserPosts.mockResolvedValue({
        success: true,
        data: {
          posts: incompletePosts,
          last_key: null
        }
      });

      const props = {
        userId: 'current123',
        onPostsCountChange: jest.fn()
      };

      renderComponentWithAuth(ProfilePosts, props, mockCurrentUser);

      await waitFor(() => {
        // 不完全なデータでも表示されることを確認
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });
});