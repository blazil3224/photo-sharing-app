import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormField from '../FormField';

describe('FormField', () => {
  const defaultProps = {
    id: 'test-field',
    name: 'testField',
    label: 'テストフィールド',
    value: '',
    onChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('基本的なレンダリングが正しく行われる', () => {
    render(<FormField {...defaultProps} />);
    
    expect(screen.getByLabelText('テストフィールド')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'test-field');
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'testField');
  });

  test('必須フィールドのマークが表示される', () => {
    render(<FormField {...defaultProps} required />);
    
    const label = screen.getByText('テストフィールド');
    expect(label.parentElement).toHaveTextContent('*');
  });

  test('エラーメッセージが表示される', () => {
    const errorMessage = 'テストエラー';
    render(<FormField {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('is-invalid');
    expect(screen.getByText(errorMessage)).toHaveClass('invalid-feedback');
  });

  test('ヘルプテキストが表示される', () => {
    const helpText = 'ヘルプテキスト';
    render(<FormField {...defaultProps} helpText={helpText} />);
    
    expect(screen.getByText(helpText)).toBeInTheDocument();
    expect(screen.getByText(helpText)).toHaveClass('form-text');
  });

  test('エラーがある場合はヘルプテキストが表示されない', () => {
    const helpText = 'ヘルプテキスト';
    const errorMessage = 'エラーメッセージ';
    render(<FormField {...defaultProps} helpText={helpText} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByText(helpText)).not.toBeInTheDocument();
  });

  test('入力値の変更が正しく処理される', () => {
    const mockOnChange = jest.fn();
    render(<FormField {...defaultProps} onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'テスト入力' } });
    
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  test('パスワードタイプが正しく設定される', () => {
    render(<FormField {...defaultProps} type="password" />);
    
    const input = screen.getByLabelText('テストフィールド');
    expect(input).toHaveAttribute('type', 'password');
  });

  test('プレースホルダーが設定される', () => {
    const placeholder = 'プレースホルダーテキスト';
    render(<FormField {...defaultProps} placeholder={placeholder} />);
    
    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  test('autoComplete属性が設定される', () => {
    render(<FormField {...defaultProps} autoComplete="username" />);
    
    expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'username');
  });

  test('minLengthとmaxLengthが設定される', () => {
    render(<FormField {...defaultProps} minLength={3} maxLength={20} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('minlength', '3');
    expect(input).toHaveAttribute('maxlength', '20');
  });
});