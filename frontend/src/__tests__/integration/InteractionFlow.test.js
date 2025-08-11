import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import PostCard from '../../components/Posts/PostCard';
import PostDetail from '../../components/Posts/PostDetail';
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
      getPost: jest.fn(),
      deletePost: jest.fn()
    }
  }
}));

// React Routerのモック
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ postId: 'test-post-1' })
}));

// テスト用のAuthContextプロバイダー
const TestAuthProvider = ({ children, user = null, isAuthenticated = false }) => {
  const authValue = {
    user,
    isAuthenticated,
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

// テスト用の投稿データ
const mockPost = {
  post_id: 'test-post-1',
  user_id: 'user-1',
  image_url: 'https://example.com/image.jpg',
  caption: 'テスト投稿',
  created_at: '2024-01-01T10:00:00Z',
  likes_count: 5,
  comments_count: 3,
  user_liked: false,
  user: {
    user_id: 'user-1',
    username: 'testuser',
    profile_image: '/avatar.png'
  }
};

const mockUser = {
  user_id: 'current-user',
  username: 'currentuser',
  profile_image: '/current-avatar.png'
};

const mockComments = [
  {
    interaction_id: 'comment-1',
    user_id: 'user-2',
    content: 'いいね！',
    created_at: '2024-01-01T11:00:00Z',
    user: {
      user_id: 'user-2',
      username: 'commenter1',
      profile_image: '/commenter1.png'
    }
  },
  {
    interaction_id: 'comment-2',
    user_id: 'user-3',
    content: '素晴らしい写真ですね',
    created_at: '2024-01-01T12:00:00Z',
    user: {
      user_id: 'user-3',
      username: 'commenter2',
      profile_image: '/commenter2.png'
    }
  }
];

describe('インタラクション機能の統合テスト', () => {
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
    
    api.interactions.getPostComments.mockResolvedValue({
      data: { comments: mockComments, last_key: null }
    });
    
    api.posts.getPost.mockResolvedValue({
      data: mockPost
    });
  });

  describe('PostCard でのインタラクション', () => {
    test('いいねボタンクリックでUI状態が正しく更新される', async () => {
      const user = userEvent.setup();
      const onLikeToggle = jest.fn();
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard 
            post={mockPost} 
            onLikeToggle={onLikeToggle}
          />
        </TestAuthProvider>
      );
      
      // 初期状態の確認
      expect(screen.getByText('5件のいいね')).toBeInTheDocument();
      
      // いいねボタンをクリック
      const likeButton = screen.getByRole('button', { name: /いいね/ });
      await user.click(likeButton);
      
      // オプティミスティック更新の確認
      await waitFor(() => {
        expect(screen.getByText('6件のいいね')).toBeInTheDocument();
      });
      
      // API呼び出しの確認
      expect(api.interactions.toggleLike).toHaveBeenCalledWith('test-post-1');
      
      // 親コンポーネントのコールバック呼び出し確認
      expect(onLikeToggle).toHaveBeenCalledWith('test-post-1');
    });

    test('いいね取り消しが正しく動作する', async () => {
      const user = userEvent.setup();
      const likedPost = { ...mockPost, user_liked: true, likes_count: 6 };
      
      api.interactions.toggleLike.mockResolvedValue({
        data: { liked: false, likes_count: 5 }
      });
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard post={likedPost} />
        </TestAuthProvider>
      );
      
      // 初期状態（いいね済み）の確認
      expect(screen.getByText('6件のいいね')).toBeInTheDocument();
      const likeButton = screen.getByRole('button', { name: /いいねを取り消す/ });
      expect(likeButton).toHaveClass('text-danger');
      
      // いいね取り消し
      await user.click(likeButton);
      
      // UI更新の確認
      await waitFor(() => {
        expect(screen.getByText('5件のいいね')).toBeInTheDocument();
      });
      
      // ボタンの状態変更確認
      expect(likeButton).toHaveClass('text-dark');
    });

    test('未認証ユーザーはいいねできない', async () => {
      const user = userEvent.setup();
      
      render(
        <TestAuthProvider isAuthenticated={false}>
          <PostCard post={mockPost} />
        </TestAuthProvider>
      );
      
      const likeButton = screen.getByRole('button', { name: /いいね/ });
      expect(likeButton).toBeDisabled();
      
      // クリックしてもAPI呼び出しされない
      await user.click(likeButton);
      expect(api.interactions.toggleLike).not.toHaveBeenCalled();
      
      // 未認証メッセージの確認
      expect(screen.getByText(/ログインが必要です/)).toBeInTheDocument();
    });
  });

  describe('PostDetail でのインタラクション', () => {
    test('投稿詳細ページでコメント投稿が正しく動作する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostDetail />
        </TestAuthProvider>
      );
      
      // 投稿データの読み込み待ち
      await waitFor(() => {
        expect(screen.getByText('テスト投稿')).toBeInTheDocument();
      });
      
      // コメント投稿フォームの確認
      const commentInput = screen.getByPlaceholderText('コメントを追加...');
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      
      // コメントを入力
      await user.type(commentInput, '素晴らしい投稿ですね！');
      
      // 投稿ボタンをクリック
      await user.click(submitButton);
      
      // API呼び出しの確認
      await waitFor(() => {
        expect(api.interactions.addComment).toHaveBeenCalledWith('test-post-1', {
          content: '素晴らしい投稿ですね！'
        });
      });
      
      // フォームがリセットされることを確認
      expect(commentInput.value).toBe('');
    });

    test('コメント一覧が正しく表示される', async () => {
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostDetail />
        </TestAuthProvider>
      );
      
      // 投稿データの読み込み待ち
      await waitFor(() => {
        expect(screen.getByText('テスト投稿')).toBeInTheDocument();
      });
      
      // コメント一覧の確認
      await waitFor(() => {
        expect(screen.getByText('いいね！')).toBeInTheDocument();
        expect(screen.getByText('素晴らしい写真ですね')).toBeInTheDocument();
        expect(screen.getByText('commenter1')).toBeInTheDocument();
        expect(screen.getByText('commenter2')).toBeInTheDocument();
      });
    });

    test('空のコメントは投稿できない', async () => {
      const user = userEvent.setup();
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostDetail />
        </TestAuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('テスト投稿')).toBeInTheDocument();
      });
      
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      
      // 空の状態では投稿ボタンが無効
      expect(submitButton).toBeDisabled();
      
      // 空白のみ入力
      const commentInput = screen.getByPlaceholderText('コメントを追加...');
      await user.type(commentInput, '   ');
      
      await user.click(submitButton);
      
      // エラーメッセージの確認
      await waitFor(() => {
        expect(screen.getByText('コメントを入力してください')).toBeInTheDocument();
      });
      
      // API呼び出しされないことを確認
      expect(api.interactions.addComment).not.toHaveBeenCalled();
    });
  });

  describe('エラーハンドリングとネットワーク障害', () => {
    test('いいねAPIエラー時にロールバックされる', async () => {
      const user = userEvent.setup();
      
      // API エラーを模擬
      api.interactions.toggleLike.mockRejectedValue(new Error('ネットワークエラー'));
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard post={mockPost} />
        </TestAuthProvider>
      );
      
      // 初期状態の確認
      expect(screen.getByText('5件のいいね')).toBeInTheDocument();
      
      const likeButton = screen.getByRole('button', { name: /いいね/ });
      await user.click(likeButton);
      
      // エラー後に元の状態に戻ることを確認
      await waitFor(() => {
        expect(screen.getByText('5件のいいね')).toBeInTheDocument();
      });
      
      // エラーメッセージの表示確認
      expect(screen.getByText(/ネットワークエラー/)).toBeInTheDocument();
    });

    test('コメント投稿APIエラー時の処理', async () => {
      const user = userEvent.setup();
      
      // API エラーを模擬
      api.interactions.addComment.mockRejectedValue(new Error('投稿に失敗しました'));
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostDetail />
        </TestAuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('テスト投稿')).toBeInTheDocument();
      });
      
      const commentInput = screen.getByPlaceholderText('コメントを追加...');
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      
      await user.type(commentInput, 'エラーテスト');
      await user.click(submitButton);
      
      // エラーメッセージの確認
      await waitFor(() => {
        expect(screen.getByText(/投稿に失敗しました/)).toBeInTheDocument();
      });
      
      // 入力内容は保持されることを確認
      expect(commentInput.value).toBe('エラーテスト');
    });

    test('ネットワーク遅延時のローディング状態', async () => {
      const user = userEvent.setup();
      
      // 遅延を模擬
      api.interactions.toggleLike.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { liked: true, likes_count: 6 } }), 1000)
        )
      );
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard post={mockPost} />
        </TestAuthProvider>
      );
      
      const likeButton = screen.getByRole('button', { name: /いいね/ });
      await user.click(likeButton);
      
      // ローディング状態の確認
      expect(screen.getByText('処理中...')).toBeInTheDocument();
      
      // 完了後の状態確認
      await waitFor(() => {
        expect(screen.getByText('6件のいいね')).toBeInTheDocument();
      }, { timeout: 2000 });
      
      // ローディング状態が解除されることを確認
      expect(screen.queryByText('処理中...')).not.toBeInTheDocument();
    });

    test('連続クリック防止機能', async () => {
      const user = userEvent.setup();
      
      // 遅延を模擬
      api.interactions.toggleLike.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { liked: true, likes_count: 6 } }), 500)
        )
      );
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard post={mockPost} />
        </TestAuthProvider>
      );
      
      const likeButton = screen.getByRole('button', { name: /いいね/ });
      
      // 連続でクリック
      await user.click(likeButton);
      await user.click(likeButton);
      await user.click(likeButton);
      
      // API呼び出しは1回のみ
      await waitFor(() => {
        expect(api.interactions.toggleLike).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('UI状態の整合性テスト', () => {
    test('複数のPostCardで独立したいいね状態管理', async () => {
      const user = userEvent.setup();
      
      const post1 = { ...mockPost, post_id: 'post-1', likes_count: 5 };
      const post2 = { ...mockPost, post_id: 'post-2', likes_count: 10 };
      
      // 異なるレスポンスを設定
      api.interactions.toggleLike
        .mockResolvedValueOnce({ data: { liked: true, likes_count: 6 } })
        .mockResolvedValueOnce({ data: { liked: true, likes_count: 11 } });
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <div>
            <PostCard post={post1} />
            <PostCard post={post2} />
          </div>
        </TestAuthProvider>
      );
      
      // 初期状態の確認
      expect(screen.getByText('5件のいいね')).toBeInTheDocument();
      expect(screen.getByText('10件のいいね')).toBeInTheDocument();
      
      // 最初の投稿にいいね
      const likeButtons = screen.getAllByRole('button', { name: /いいね/ });
      await user.click(likeButtons[0]);
      
      // 最初の投稿のみ更新されることを確認
      await waitFor(() => {
        expect(screen.getByText('6件のいいね')).toBeInTheDocument();
        expect(screen.getByText('10件のいいね')).toBeInTheDocument();
      });
      
      // 2番目の投稿にいいね
      await user.click(likeButtons[1]);
      
      // 両方の投稿が正しく更新されることを確認
      await waitFor(() => {
        expect(screen.getByText('6件のいいね')).toBeInTheDocument();
        expect(screen.getByText('11件のいいね')).toBeInTheDocument();
      });
    });

    test('コメント数の動的更新', async () => {
      const user = userEvent.setup();
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostDetail />
        </TestAuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('コメント (3)')).toBeInTheDocument();
      });
      
      // コメントを投稿
      const commentInput = screen.getByPlaceholderText('コメントを追加...');
      await user.type(commentInput, '新しいコメント');
      
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      await user.click(submitButton);
      
      // コメント数が更新されることを確認
      await waitFor(() => {
        expect(screen.getByText('コメント (4)')).toBeInTheDocument();
      });
    });
  });

  describe('アクセシビリティとユーザビリティ', () => {
    test('キーボードナビゲーションが機能する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostDetail />
        </TestAuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('テスト投稿')).toBeInTheDocument();
      });
      
      const commentInput = screen.getByPlaceholderText('コメントを追加...');
      
      // Tab キーでフォーカス移動
      await user.tab();
      expect(commentInput).toHaveFocus();
      
      // コメント入力
      await user.type(commentInput, 'キーボードテスト');
      
      // Ctrl+Enter で投稿
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      // API呼び出しの確認
      await waitFor(() => {
        expect(api.interactions.addComment).toHaveBeenCalledWith('test-post-1', {
          content: 'キーボードテスト'
        });
      });
    });

    test('スクリーンリーダー対応のARIAラベル', () => {
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard post={mockPost} />
        </TestAuthProvider>
      );
      
      const likeButton = screen.getByRole('button', { name: /いいね \(5件\)/ });
      expect(likeButton).toHaveAttribute('aria-label', 'いいね (5件)');
      expect(likeButton).toHaveAttribute('title', 'いいね (5件)');
    });

    test('エラーメッセージのアクセシビリティ', async () => {
      const user = userEvent.setup();
      
      api.interactions.toggleLike.mockRejectedValue(new Error('エラーテスト'));
      
      render(
        <TestAuthProvider user={mockUser} isAuthenticated={true}>
          <PostCard post={mockPost} />
        </TestAuthProvider>
      );
      
      const likeButton = screen.getByRole('button', { name: /いいね/ });
      await user.click(likeButton);
      
      // エラーメッセージがaria-liveリージョンで通知されることを確認
      await waitFor(() => {
        const errorMessage = screen.getByText(/エラーテスト/);
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });
});