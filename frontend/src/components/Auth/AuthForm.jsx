import React from 'react';

/**
 * 認証フォーム用の共通レイアウトコンポーネント
 * ログイン・登録フォームで共通のスタイリングを提供
 */
const AuthForm = ({
  title,
  subtitle,
  icon,
  error,
  children,
  onSubmit,
  submitText,
  loading = false,
  footerContent
}) => {
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <i className={`${icon} display-4 text-primary`}></i>
                <h2 className="mt-2">{title}</h2>
                <p className="text-muted">{subtitle}</p>
              </div>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit}>
                {children}

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      処理中...
                    </>
                  ) : (
                    submitText
                  )}
                </button>
              </form>

              {footerContent && (
                <div className="text-center mt-3">
                  {footerContent}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;