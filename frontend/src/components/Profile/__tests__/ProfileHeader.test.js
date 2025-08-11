import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ProfileHeader from '../ProfileHeader';

// AuthContextのモック
const mockAuthContext = {
  user: { user_id: 'current-user', username: 'currentuser' },
  isAuthenticated: true
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

// テスト用のプロフィールデータ
const mockProfile = {
  user_id: 'test-user',
  username: 'testuser',
  email: 'test@example.com',
  bio: 'テストユーザーの自己紹介です。',
  profile_image: '/test-avatar.png',
  created_at: '2024-01-01T00:00:00Z'
};

describe('ProfileHeader', () => {
  const defaultProps = {
    profile: mockProfile,
    postsCount: 10,
    onEditClick: jest.fn(),
    onImageUpload: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本レンダリング', () => {
    test('プロフィール情報が正しく表示される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('テストユーザーの自己紹介です。')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('2024年1月に参加')).toBeInTheDocument();
    });

    test('プロフィール画像が表示される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} />
        </TestWrapper>
      );
      
      const profileImage = screen.getByAltText('testuserのプロフィール画像');
      expect(profileImage).toBeInTheDocument();
      expect(profileImage).toHaveAttribute('src', '/test-avatar.png');
    });

    test('デフォルト画像が表示される', () => {
      const profileWithoutImage = { ...mockProfile, profile_image: null };
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={profileWithoutImage} />
        </TestWrapper>
      );
      
      const profileImage = screen.getByAltText('testuserのプロフィール画像');
      expect(profileImage).toHaveAttribute('src', '/default-avatar.png');
    });
  });

  describe('自分のプロフィール表示', () => {
    test('自分のプロフィールでは編集ボタンが表示される', () => {
      const ownProfile = { ...mockProfile, user_id: 'current-user' };
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={ownProfile} />
        </TestWrapper>
      );
      
      expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
      expect(screen.getByText('画像を変更')).toBeInTheDocument();
    });

    test('編集ボタンクリックでonEditClickが呼ばれる', async () => {
      const user = userEvent.setup();
      const onEditClick = jest.fn();
      const ownProfile = { ...mockProfile, user_id: 'current-user' };
      
      render(
        <TestWrapper>
          <ProfileHeader 
            {...defaultProps} 
            profile={ownProfile}
            onEditClick={onEditClick}
          />
        </TestWrapper>
      );
      
      const editButton = screen.getByText('プロフィールを編集');
      await user.click(editButton);
      
      expect(onEditClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('他人のプロフィール表示', () => {
    test('他人のプロフィールでは編集ボタンが表示されない', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
      expect(screen.queryByText('画像を変更')).not.toBeInTheDocument();
    });
  });

  describe('画像アップロード機能', () => {
    test('有効な画像ファイルをアップロードできる', async () => {
      const user = userEvent.setup();
      const onImageUpload = jest.fn().mockResolvedValue();
      const ownProfile = { ...mockProfile, user_id: 'current-user' };
      
      render(
        <TestWrapper>
          <ProfileHeader 
            {...defaultProps} 
            profile={ownProfile}
            onImageUpload={onImageUpload}
          />
        </TestWrapper>
      );
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(onImageUpload).toHaveBeenCalledWith(file);
      });
    });

    test('無効なファイル形式でエラーが表示される', async () => {
      const user = userEvent.setup();
      const ownProfile = { ...mockProfile, user_id: 'current-user' };
      
      // alertのモック
      window.alert = jest.fn();
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={ownProfile} />
        </TestWrapper>
      );
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      expect(window.alert).toHaveBeenCalledWith(
        'JPEG、PNG形式の画像ファイルのみアップロード可能です'
      );
    });

    test('ファイルサイズが大きすぎる場合エラーが表示される', async () => {
      const user = userEvent.setup();
      const ownProfile = { ...mockProfile, user_id: 'current-user' };
      
      // alertのモック
      window.alert = jest.fn();
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={ownProfile} />
        </TestWrapper>
      );
      
      // 6MBのファイルを作成
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      });
      Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });
      
      const fileInput = document.querySelector('input[type="file"]');
      await user.upload(fileInput, largeFile);
      
      expect(window.alert).toHaveBeenCalledWith(
        'ファイルサイズは5MB以下にしてください'
      );
    });
  });

  describe('ローディング状態', () => {
    test('ローディング中はプレースホルダーが表示される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} loading={true} />
        </TestWrapper>
      );
      
      expect(screen.getAllByText('', { selector: '.placeholder' })).toHaveLength(4);
    });
  });

  describe('プロフィールが存在しない場合', () => {
    test('ユーザーが見つからないメッセージが表示される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={null} />
        </TestWrapper>
      );
      
      expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument();
      expect(screen.getByText('このユーザーは存在しないか、削除された可能性があります。')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ホームに戻る/ })).toBeInTheDocument();
    });
  });

  describe('統計情報表示', () => {
    test('投稿数が正しく表示される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} postsCount={1234} />
        </TestWrapper>
      );
      
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    test('投稿数が0の場合も正しく表示される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} postsCount={0} />
        </TestWrapper>
      );
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('自己紹介表示', () => {
    test('自己紹介がない場合は表示されない', () => {
      const profileWithoutBio = { ...mockProfile, bio: null };
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={profileWithoutBio} />
        </TestWrapper>
      );
      
      expect(screen.queryByText('テストユーザーの自己紹介です。')).not.toBeInTheDocument();
    });

    test('改行を含む自己紹介が正しく表示される', () => {
      const profileWithMultilineBio = { 
        ...mockProfile, 
        bio: '1行目\n2行目\n3行目' 
      };
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={profileWithMultilineBio} />
        </TestWrapper>
      );
      
      const bioElement = screen.getByText('1行目\n2行目\n3行目');
      expect(bioElement).toHaveStyle('white-space: pre-wrap');
    });
  });

  describe('アクセシビリティ', () => {
    test('プロフィール画像に適切なalt属性が設定される', () => {
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} />
        </TestWrapper>
      );
      
      const profileImage = screen.getByAltText('testuserのプロフィール画像');
      expect(profileImage).toBeInTheDocument();
    });

    test('ファイル入力に適切なaccept属性が設定される', () => {
      const ownProfile = { ...mockProfile, user_id: 'current-user' };
      
      render(
        <TestWrapper>
          <ProfileHeader {...defaultProps} profile={ownProfile} />
        </TestWrapper>
      );
      
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/jpg');
    });
  });
});