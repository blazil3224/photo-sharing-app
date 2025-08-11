import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthForm from '../AuthForm';

describe('AuthForm', () => {
  const defaultProps = {
    title: 'テストタイトル',
    subtitle: 'テストサブタイトル',
    icon: 'bi bi-test',
    onSubmit: jest.fn(),
    submitText: 'テスト送信',
    children: <input data-testid="test-input" />
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('基本的なレンダリングが正しく行われる', () => {
    render(<AuthForm {...defaultProps} />);
    
    expect(screen.getByText('テストタイトル')).toBeInTheDocument();
    expect(screen.getByText('テストサブタイトル')).toBeInTheDocument();
    expect(screen.getByText('テスト送信')).toBeInTheDocument();
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  test('エラーメッセージが表示される', () => {
    const errorMessage = 'テストエラーメッセージ';
    render(<AuthForm {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('alert-danger');
  });

  test('ローディング状態が正しく表示される', () => {
    render(<AuthForm {...defaultProps} loading={true} />);
    
    const submitButton = screen.getByRole('button', { type: 'submit' });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('処理中...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('spinner-border');
  });

  test('フォーム送信が正しく処理される', () => {
    const mockSubmit = jest.fn();
    render(<AuthForm {...defaultProps} onSubmit={mockSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: 'テスト送信' });
    fireEvent.click(submitButton);
    
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  test('フッターコンテンツが表示される', () => {
    const footerContent = <div data-testid="footer-content">フッターテスト</div>;
    render(<AuthForm {...defaultProps} footerContent={footerContent} />);
    
    expect(screen.getByTestId('footer-content')).toBeInTheDocument();
    expect(screen.getByText('フッターテスト')).toBeInTheDocument();
  });

  test('エラーがない場合はエラーメッセージが表示されない', () => {
    render(<AuthForm {...defaultProps} />);
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});