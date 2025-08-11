import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Upload from '../Upload';

// UploadFormコンポーネントのモック
jest.mock('../../components/Posts', () => ({
  UploadForm: ({ onUploadSuccess, onClose }) => (
    <div data-testid="upload-form">
      <button onClick={() => onUploadSuccess({ id: '123' })}>
        Mock Upload Success
      </button>
      <button onClick={onClose}>Mock Close</button>
    </div>
  )
}));

// React Routerのモック
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// テスト用のAuthContextプロバイダー
const TestAuthProvider = ({ children, isAuthenticated = true, user = { id: '1', username: 'testuser' } }) => {
  const authValue = {
    user: isAuthenticated ? user : null,
    isAuthenticated,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false
  };
  
  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

const renderUploadPage = (authProps = {}) => {
  return render(
    <BrowserRouter>
      <TestAuthProvider {...authProps}>
        <Upload />
      </TestAuthProvider>
    </BrowserRouter>
  );
};

describe('Upload Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('認証状態', () => {
    test('認証済みユーザーにはアップロードフォームが表示される', () => {
      renderUploadPage({ isAuthenticated: true });
      
      expect(screen.getByTestId('upload-form')).toBeInTheDocument();
    });
    
    test('未認証ユーザーはログインページにリダイレクトされる', () => {
      renderUploadPage({ isAuthenticated: false });
      
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      expect(screen.queryByTestId('upload-form')).not.toBeInTheDocument();
    });
  });
  
  describe('イベントハンドリング', () => {
    test('アップロード成功時にホームページにリダイレクトされる', () => {
      renderUploadPage({ isAuthenticated: true });
      
      const successButton = screen.getByText('Mock Upload Success');
      successButton.click();
      
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: {
          message: '投稿が正常にアップロードされました！',
          newPost: { id: '123' }
        }
      });
    });
    
    test('キャンセル時に前のページに戻る', () => {
      renderUploadPage({ isAuthenticated: true });
      
      const closeButton = screen.getByText('Mock Close');
      closeButton.click();
      
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });
  
  describe('レスポンシブレイアウト', () => {
    test('適切なBootstrapクラスが適用されている', () => {
      renderUploadPage({ isAuthenticated: true });
      
      const container = screen.getByTestId('upload-form').closest('.container');
      expect(container).toHaveClass('container', 'mt-4');
      
      const row = container.querySelector('.row');
      expect(row).toHaveClass('row', 'justify-content-center');
      
      const col = row.querySelector('.col-12');
      expect(col).toHaveClass('col-12', 'col-md-8', 'col-lg-6');
    });
  });
});