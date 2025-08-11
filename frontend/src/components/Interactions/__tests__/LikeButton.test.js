import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LikeButton from '../LikeButton';

// AuthContextのモック
const mockAuthContext = {
  user: { user_id: '1', username: 'testuser' },
  isAuthenticated: true
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// APIのモック
const mockToggleLike = jest.fn();
jest.mock('../../../services/api', () => ({
  api: {
    interactions: {
      toggleLike: mockToggleLike
    }
  }
}));

describe('LikeButton', () => {
  const defaultProps = {
    postId: 'test-post-1',
    initialLiked: false,
    initialCount: 0,
    onLikeChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockToggleLike.mockResolvedValue({
      data: { liked: true, likes_count: 1 }
    });
  });

  describe('基本レンダリング', () => {
    test('いいねボタンが正しく表示される', () => {
      render(<LikeButton {...defaultProps} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByTitle('いいね (0件)')).toBeInTheDocument();
    });

    test('いいね済み状態で表示される', () => {
      render(
        <LikeButton 
          {...defaultProps} 
          initialLiked={true} 
          initialCount={5} 
        />
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByTitle('いいねを取り消す (5件)')).toBeInTheDocument();
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-danger');
    });

    test('カウント非表示オプションが機能する', () => {
      render(
        <LikeButton 
          {...defaultProps} 
          showCount={false} 
        />
      );
      
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('サイズオプション', () => {
    test('小サイズで表示される', () => {
      render(<LikeButton {...defaultProps} size="small" />);
      
      const icon = screen.getByRole('button').querySelector('i');
      expect(icon).toHaveClass('fs-6');
    });

    test('大サイズで表示される', () => {
      render(<LikeButton {...defaultProps} size="large" />);
      
      const icon = screen.getByRole('button').querySelector('i');
      expect(icon).toHaveClass('fs-3');
    });
  });

  describe('いいね機能', () => {
    test('いいねボタンクリックで状態が変更される', async () => {
      const user = userEvent.setup();
      const onLikeChange = jest.fn();
      
      render(
        <LikeButton 
          {...defaultProps} 
          onLikeChange={onLikeChange} 
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // オプティミスティック更新の確認
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(button).toHaveClass('text-danger');
      
      // API呼び出しの確認
      await waitFor(() => {
        expect(mockToggleLike).toHaveBeenCalledWith('test-post-1');
      });
      
      // コールバック呼び出しの確認
      await waitFor(() => {
        expect(onLikeChange).toHaveBeenCalledWith('test-post-1', true, 1);
      });
    });

    test('いいね取り消しが機能する', async () => {
      const user = userEvent.setup();
      mockToggleLike.mockResolvedValue({
        data: { liked: false, likes_count: 0 }
      });
      
      render(
        <LikeButton 
          {...defaultProps} 
          initialLiked={true}
          initialCount={1}
        />
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // オプティミスティック更新の確認
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(button).toHaveClass('text-dark');
    });

    test('連続クリックが防止される', async () => {
      const user = userEvent.setup();
      mockToggleLike.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { liked: true, likes_count: 1 } }), 100))
      );
      
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // 連続でクリック
      await user.click(button);
      await user.click(button);
      
      // API呼び出しは1回のみ
      await waitFor(() => {
        expect(mockToggleLike).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('エラーハンドリング', () => {
    test('API エラー時にロールバックされる', async () => {
      const user = userEvent.setup();
      mockToggleLike.mockRejectedValue(new Error('Network error'));
      
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // エラー後に元の状態に戻る
      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(button).toHaveClass('text-dark');
      });
      
      // エラーメッセージが表示される
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    test('エラーメッセージが自動で消える', async () => {
      const user = userEvent.setup();
      mockToggleLike.mockRejectedValue(new Error('Test error'));
      
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // エラーメッセージが表示される
      await waitFor(() => {
        expect(screen.getByText(/Test error/)).toBeInTheDocument();
      });
      
      // 3秒後にエラーメッセージが消える
      await waitFor(() => {
        expect(screen.queryByText(/Test error/)).not.toBeInTheDocument();
      }, { timeout: 4000 });
    });
  });

  describe('認証状態', () => {
    test('未認証時はボタンが無効化される', () => {
      mockAuthContext.isAuthenticated = false;
      
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByText(/ログインが必要です/)).toBeInTheDocument();
    });

    test('未認証時のクリックでエラーメッセージが表示される', async () => {
      const user = userEvent.setup();
      mockAuthContext.isAuthenticated = false;
      
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // ボタンは無効化されているが、直接呼び出しをテスト
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/ログインが必要です/)).toBeInTheDocument();
      });
    });
  });

  describe('アクセシビリティ', () => {
    test('適切なARIAラベルが設定される', () => {
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'いいね (0件)');
      expect(button).toHaveAttribute('title', 'いいね (0件)');
    });

    test('ローディング中のスピナーにaria-labelが設定される', async () => {
      const user = userEvent.setup();
      mockToggleLike.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { liked: true, likes_count: 1 } }), 100))
      );
      
      render(<LikeButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(screen.getByText('処理中...')).toBeInTheDocument();
    });
  });
});