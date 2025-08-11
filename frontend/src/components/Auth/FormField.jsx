import React from 'react';

/**
 * 再利用可能なフォームフィールドコンポーネント
 * バリデーションエラー表示とBootstrapスタイリングを統合
 */
const FormField = ({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  error,
  helpText,
  required = false,
  minLength,
  maxLength,
  placeholder,
  autoComplete,
  className = '',
  ...props
}) => {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      <input
        type={type}
        className={`form-control ${error ? 'is-invalid' : ''} ${className}`}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...props}
      />
      {error ? (
        <div className="invalid-feedback">
          {error}
        </div>
      ) : helpText ? (
        <div className="form-text">
          {helpText}
        </div>
      ) : null}
    </div>
  );
};

export default FormField;