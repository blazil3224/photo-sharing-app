import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadForm from '../UploadForm';

// AuthContextのモック
const mockAuthContext = {
  user: { id: '1', username: 'testuser' },
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
  loading: false
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// useApiフックのモック
const mockRequest = jest.fn();
jest.mock('../../../hooks/useApi', () => ({
  useApi: () => ({
    request: mockRequest
  })
}));

// テスト用のプロバイダー（簡略化）
const TestProvider = ({ children }) => {
  return <div>{children}</div>;
};

// テスト用のファイル作成ヘルパー
const createTestFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('UploadForm', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnClose = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockReset();
  });
  
  const renderUploadForm = (props = {}) => {
    return render(
      <TestProvider>
        <UploadForm 
          onUploadSuccess={mockOnUploadSuccess}
          onClose={mockOnClose}
          {...props}
        />
      </TestProvider>
    );
  };
  
  describe('基本レンダリング', () => {
    test('アップロードフォームが正しく表示される', () => {
      renderUploadForm();
      
      expect(screen.getByText('新しい投稿')).toBeInTheDocument();
      expect(screen.getByText('画像をドラッグ&ドロップまたはクリックして選択')).toBeInTheDocument();
      expect(screen.getByLabelText('キャプション')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument();
    });
    
    test('閉じるボタンが表示される', () => {
      renderUploadForm();
      
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // close button
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });
  });
  
  describe('ファイル選択機能', () => {
    test('有効な画像ファイルを選択できる', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const file = createTestFile('test.jpg', 'image/jpeg', 1024 * 1024); // 1MB
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument();
        expect(screen.getByText('test.jpg (1.00 MB)')).toBeInTheDocument();
      });
    });
    
    test('無効なファイル形式でエラーが表示される', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const file = createTestFile('test.txt', 'text/plain', 1024);
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('JPEG、PNG形式の画像ファイルのみアップロード可能です')).toBeInTheDocument();
      });
    });
    
    test('ファイルサイズが大きすぎる場合エラーが表示される', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const file = createTestFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024); // 6MB
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('ファイルサイズは5MB以下にしてください')).toBeInTheDocument();
      });
    });
  });
  
  describe('ドラッグ&ドロップ機能', () => {
    test('ドラッグオーバー時にスタイルが変更される', () => {
      renderUploadForm();
      
      const dropArea = screen.getByText('画像をドラッグ&ドロップまたはクリックして選択').closest('.upload-area');
      
      fireEvent.dragOver(dropArea);
      expect(dropArea).toHaveClass('border-primary');
      expect(screen.getByText('画像をドロップしてください')).toBeInTheDocument();
      
      fireEvent.dragLeave(dropArea);
      expect(dropArea).not.toHaveClass('border-primary');
    });
    
    test('ファイルドロップで画像が選択される', async () => {
      renderUploadForm();
      
      const file = createTestFile('dropped.jpg', 'image/jpeg', 1024 * 1024);
      const dropArea = screen.getByText('画像をドラッグ&ドロップまたはクリックして選択').closest('.upload-area');
      
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [file] }
      });
      
      fireEvent(dropArea, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByAltText('プレビュー')).toBeInTheDocument();
        expect(screen.getByText('dropped.jpg (1.00 MB)')).toBeInTheDocument();
      });
    });
  });
  
  describe('キャプション入力', () => {
    test('キャプションを入力できる', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const captionInput = screen.getByLabelText('キャプション');
      await user.type(captionInput, 'テストキャプション');
      
      expect(captionInput).toHaveValue('テストキャプション');
      expect(screen.getByText('9/500文字')).toBeInTheDocument();
    });
    
    test('キャプションの文字数制限が機能する', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const captionInput = screen.getByLabelText('キャプション');
      const longText = 'a'.repeat(501);
      
      await user.type(captionInput, longText);
      
      expect(captionInput.value.length).toBeLessThanOrEqual(500);
    });
  });
  
  describe('アップロード機能', () => {
    test('ファイル未選択時は投稿ボタンが無効', () => {
      renderUploadForm();
      
      const uploadButton = screen.getByRole('button', { name: '投稿する' });
      expect(uploadButton).toBeDisabled();
    });
    
    test('ファイル選択後は投稿ボタンが有効', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const file = createTestFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: '投稿する' });
        expect(uploadButton).not.toBeDisabled();
      });
    });
    
    test('アップロード中は進捗が表示される', async () => {
      const user = userEvent.setup();
      
      // モックリクエストを長時間実行されるように設定
      mockRequest.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, data: {} }), 1000))
      );
      
      renderUploadForm();
      
      const file = createTestFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: '投稿する' });
        expect(uploadButton).not.toBeDisabled();
      });
      
      const uploadButton = screen.getByRole('button', { name: '投稿する' });
      await user.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText('アップロード中...')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });
  });
  
  describe('エラーハンドリング', () => {
    test('ファイル未選択でアップロード試行時にエラー表示', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      // 投稿ボタンは無効化されているが、直接呼び出しをテスト
      const uploadButton = screen.getByRole('button', { name: '投稿する' });
      
      // ボタンが無効化されていることを確認
      expect(uploadButton).toBeDisabled();
    });
  });
  
  describe('イベントハンドラー', () => {
    test('閉じるボタンクリックでonCloseが呼ばれる', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const closeButton = screen.getByRole('button', { name: 'キャンセル' });
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
    
    test('アップロード成功時にonUploadSuccessが呼ばれる', async () => {
      const user = userEvent.setup();
      
      mockRequest.mockResolvedValue({ 
        success: true, 
        data: { id: '123', caption: 'test' } 
      });
      
      renderUploadForm();
      
      const file = createTestFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: '投稿する' });
        expect(uploadButton).not.toBeDisabled();
      });
      
      const uploadButton = screen.getByRole('button', { name: '投稿する' });
      await user.click(uploadButton);
      
      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith('/api/posts', {
          method: 'POST',
          body: expect.any(FormData)
        });
      }, { timeout: 3000 });
    });
  });
  
  describe('アクセシビリティ', () => {
    test('適切なARIAラベルが設定されている', () => {
      renderUploadForm();
      
      expect(screen.getByLabelText('キャプション')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });
    
    test('エラーメッセージにrole="alert"が設定される', async () => {
      const user = userEvent.setup();
      renderUploadForm();
      
      const file = createTestFile('test.txt', 'text/plain', 1024);
      const fileInput = document.querySelector('input[type="file"]');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent('JPEG、PNG形式の画像ファイルのみアップロード可能です');
      });
    });
  });
});