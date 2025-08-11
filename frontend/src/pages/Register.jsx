import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthForm from '../components/Auth/AuthForm';
import FormField from '../components/Auth/FormField';

const Register = () => {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState({});

  // フォームバリデーション関数
  const validateForm = () => {
    const errors = {};

    // ユーザー名バリデーション
    if (!formData.username.trim()) {
      errors.username = 'ユーザー名は必須です';
    } else if (formData.username.length < 3) {
      errors.username = 'ユーザー名は3文字以上で入力してください';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'ユーザー名は英数字とアンダースコアのみ使用できます';
    }

    // メールアドレスバリデーション
    if (!formData.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    // パスワードバリデーション
    if (!formData.password) {
      errors.password = 'パスワードは必須です';
    } else if (formData.password.length < 6) {
      errors.password = 'パスワードは6文字以上で入力してください';
    }

    // パスワード確認バリデーション
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'パスワード確認は必須です';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'パスワードが一致しません';
    }

    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // リアルタイムバリデーション（該当フィールドのエラーをクリア）
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});

    // フォームバリデーション
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // 認証API呼び出し
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    
    if (result.success) {
      navigate('/');
    }
  };

  return (
    <AuthForm
      title="新規登録"
      subtitle="PhotoShareアカウントを作成"
      icon="bi bi-person-plus"
      error={error}
      onSubmit={handleSubmit}
      submitText="アカウント作成"
      loading={loading}
      footerContent={
        <p className="text-muted">
          既にアカウントをお持ちの方は{' '}
          <Link to="/login" className="text-decoration-none">
            ログイン
          </Link>
        </p>
      }
    >
      <FormField
        id="username"
        name="username"
        type="text"
        label="ユーザー名"
        value={formData.username}
        onChange={handleChange}
        error={validationErrors.username}
        helpText="3文字以上の英数字とアンダースコアで入力してください"
        required
        minLength={3}
        autoComplete="username"
      />

      <FormField
        id="email"
        name="email"
        type="email"
        label="メールアドレス"
        value={formData.email}
        onChange={handleChange}
        error={validationErrors.email}
        required
        autoComplete="email"
      />

      <FormField
        id="password"
        name="password"
        type="password"
        label="パスワード"
        value={formData.password}
        onChange={handleChange}
        error={validationErrors.password}
        helpText="6文字以上で入力してください"
        required
        minLength={6}
        autoComplete="new-password"
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="パスワード確認"
        value={formData.confirmPassword}
        onChange={handleChange}
        error={validationErrors.confirmPassword}
        required
        autoComplete="new-password"
      />
    </AuthForm>
  );
};

export default Register;