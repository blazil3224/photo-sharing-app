import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthForm from '../components/Auth/AuthForm';
import FormField from '../components/Auth/FormField';

const Login = () => {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [validationErrors, setValidationErrors] = useState({});

  // フォームバリデーション関数
  const validateForm = () => {
    const errors = {};

    // ユーザー名バリデーション
    if (!formData.username.trim()) {
      errors.username = 'ユーザー名は必須です';
    }

    // パスワードバリデーション
    if (!formData.password) {
      errors.password = 'パスワードは必須です';
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

    const result = await login(formData);
    if (result.success) {
      navigate('/');
    }
  };

  return (
    <AuthForm
      title="ログイン"
      subtitle="PhotoShareにログイン"
      icon="bi bi-camera"
      error={error}
      onSubmit={handleSubmit}
      submitText="ログイン"
      loading={loading}
      footerContent={
        <p className="text-muted">
          アカウントをお持ちでない方は{' '}
          <Link to="/register" className="text-decoration-none">
            新規登録
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
        required
        autoComplete="username"
      />

      <FormField
        id="password"
        name="password"
        type="password"
        label="パスワード"
        value={formData.password}
        onChange={handleChange}
        error={validationErrors.password}
        required
        autoComplete="current-password"
      />
    </AuthForm>
  );
};

export default Login;