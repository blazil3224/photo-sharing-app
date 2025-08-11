import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <i className="bi bi-camera me-2"></i>
          PhotoShare
        </Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {user && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">
                    <i className="bi bi-house me-1"></i>
                    ホーム
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/upload">
                    <i className="bi bi-plus-circle me-1"></i>
                    投稿
                  </Link>
                </li>
              </>
            )}
          </ul>
          
          <ul className="navbar-nav">
            {user ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to={`/profile/${user.user_id}`}>
                    <i className="bi bi-person me-1"></i>
                    {user.username}
                  </Link>
                </li>
                <li className="nav-item">
                  <button 
                    className="btn btn-outline-light btn-sm"
                    onClick={handleLogout}
                  >
                    <i className="bi bi-box-arrow-right me-1"></i>
                    ログアウト
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">
                    ログイン
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">
                    新規登録
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header;