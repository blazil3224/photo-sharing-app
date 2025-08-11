import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CommentSection from '../CommentSection';

// AuthContextのモック
const mockAuthContext = {
  user: { user_id: '1', username: 'testuser', profile_image: '/test-avatar.png' },
  isAuthenticated: true
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// APIのモック
const mockGetPostComments = jest.fn();
const mockAddComment = jest.fn();

jest.mock('../../../services/api', () => ({
  api: {
    interactions: {
      getPostComments: mockGetPostComments,
      addComment: mockAddComment
    }
  }
}));

// テスト用のコメントデータ
const mockComments = [
  {
    interaction_id: 'comment-1',
    user_id: 'user-1',
    content: 'テストコメント1',
    created_at: '2024-01-01T10:00:00Z',
    user: {
      user_id: 'user-1',
      username: 'user1',
      profile_image: '/avatar1.png'
    }
  },
  {
    interaction_id: 'comment-2',
    user_id: 'user-2',
    content: 'テストコメント2',
    created_at: '2024-01-01T11:00:00Z',
    user: {
      user_id: 'user-2',
      username: 'user2',
      profile_image: '/avatar2.png'
    }
  }
];

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('CommentSection', () => {
  const defaultProps = {
    postId: 'test-post-1',
    initialComments: [],
    initialCount: 0,
    onCommentChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPostComments.mockResolvedValue({
      data: { comments: mockComments, last_key: null }
    });
    mockAddComment.mockResolvedValue({
      data: {
        interaction_id: 'new-comment',
        user_id: '1',
        content: '新しいコメント',
        created_at: new Date().toISOString()
      }
    });
  });

  describe('基本レンダリング', () => {
    test('コメントセクションが正しく表示される', async () => {
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('コメント (0)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('コメントを追加...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /投稿/ })).toBeInTheDocument();
    });

    test('初期コメントが表示される', () => {
      render(
        <TestWrapper>
          <CommentSection 
            {...defaultProps} 
            initialComments={mockComments}
            initialCount={2}
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('コメント (2)')).toBeInTheDocument();
      expect(screen.getByText('テストコメント1')).toBeInTheDocument();
      expect(screen.getByText('テストコメント2')).toBeInTheDocument();
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
    });

    test('コメントがない場合のメッセージが表示される', () => {
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('まだコメントがありません')).toBeInTheDocument();
      expect(screen.getByText('最初のコメントを投稿してみましょう！')).toBeInTheDocument();
    });
  });

  describe('コメント投稿機能', () => {
    test('コメントを投稿できる', async () => {
      const user = userEvent.setup();
      const onCommentChange = jest.fn();
      
      render(
        <TestWrapper>
          <CommentSection 
            {...defaultProps} 
            onCommentChange={onCommentChange}
          />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      
      await user.type(textarea, '新しいコメント');
      await user.click(submitButton);
      
      expect(mockAddComment).toHaveBeenCalledWith('test-post-1', {
        content: '新しいコメント'
      });
      
      await waitFor(() => {
        expect(onCommentChange).toHaveBeenCalledWith('test-post-1', 1);
      });
    });

    test('空のコメントは投稿できない', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      expect(submitButton).toBeDisabled();
      
      // 空白のみのコメント
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      await user.type(textarea, '   ');
      
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('コメントを入力してください')).toBeInTheDocument();
      });
      
      expect(mockAddComment).not.toHaveBeenCalled();
    });

    test('文字数制限が機能する', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      const longText = 'a'.repeat(501);
      
      await user.type(textarea, longText);
      
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('コメントは500文字以内で入力してください')).toBeInTheDocument();
      });
      
      expect(mockAddComment).not.toHaveBeenCalled();
    });

    test('Ctrl+Enterで投稿できる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      await user.type(textarea, 'Ctrl+Enterテスト');
      
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      expect(mockAddComment).toHaveBeenCalledWith('test-post-1', {
        content: 'Ctrl+Enterテスト'
      });
    });
  });

  describe('コメント読み込み機能', () => {
    test('初期読み込みが実行される', async () => {
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockGetPostComments).toHaveBeenCalledWith('test-post-1', {
          limit: 20
        });
      });
    });

    test('更新ボタンでコメントを再読み込みできる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection 
            {...defaultProps} 
            initialComments={mockComments}
            initialCount={2}
          />
        </TestWrapper>
      );
      
      const refreshButton = screen.getByRole('button', { name: /更新/ });
      await user.click(refreshButton);
      
      await waitFor(() => {
        expect(mockGetPostComments).toHaveBeenCalledWith('test-post-1', {
          limit: 20
        });
      });
    });

    test('さらに読み込むボタンが機能する', async () => {
      const user = userEvent.setup();
      mockGetPostComments.mockResolvedValueOnce({
        data: { comments: mockComments, last_key: 'next-key' }
      });
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /さらに読み込む/ })).toBeInTheDocument();
      });
      
      const loadMoreButton = screen.getByRole('button', { name: /さらに読み込む/ });
      await user.click(loadMoreButton);
      
      await waitFor(() => {
        expect(mockGetPostComments).toHaveBeenCalledWith('test-post-1', {
          limit: 20,
          last_key: 'next-key'
        });
      });
    });
  });

  describe('エラーハンドリング', () => {
    test('コメント読み込みエラーが表示される', async () => {
      mockGetPostComments.mockRejectedValue(new Error('読み込みエラー'));
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/読み込みエラー/)).toBeInTheDocument();
      });
    });

    test('コメント投稿エラーが表示される', async () => {
      const user = userEvent.setup();
      mockAddComment.mockRejectedValue(new Error('投稿エラー'));
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      await user.type(textarea, 'エラーテスト');
      
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/投稿エラー/)).toBeInTheDocument();
      });
    });
  });

  describe('認証状態', () => {
    test('未認証時はログインメッセージが表示される', () => {
      mockAuthContext.isAuthenticated = false;
      mockAuthContext.user = null;
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('コメントを投稿するにはログインしてください')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'ログイン' })).toBeInTheDocument();
    });
  });

  describe('UI機能', () => {
    test('テキストエリアが自動リサイズされる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      
      // 複数行のテキストを入力
      await user.type(textarea, 'line1\nline2\nline3');
      
      // テキストエリアの高さが調整されることを確認
      expect(textarea.style.height).not.toBe('38px');
    });

    test('文字数カウンターが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      await user.type(textarea, 'test');
      
      expect(screen.getByText('4/500')).toBeInTheDocument();
    });

    test('文字数が450を超えると警告色になる', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      const longText = 'a'.repeat(451);
      await user.type(textarea, longText);
      
      const counter = screen.getByText('451/500');
      expect(counter).toHaveClass('text-warning');
    });
  });

  describe('アクセシビリティ', () => {
    test('適切なARIAラベルが設定される', () => {
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByRole('button', { name: /投稿/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('コメントを追加...')).toBeInTheDocument();
    });

    test('ローディング中のスピナーにaria-labelが設定される', async () => {
      const user = userEvent.setup();
      mockAddComment.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );
      
      render(
        <TestWrapper>
          <CommentSection {...defaultProps} />
        </TestWrapper>
      );
      
      const textarea = screen.getByPlaceholderText('コメントを追加...');
      await user.type(textarea, 'テスト');
      
      const submitButton = screen.getByRole('button', { name: /投稿/ });
      await user.click(submitButton);
      
      expect(screen.getByText('送信中...')).toBeInTheDocument();
    });
  });
});