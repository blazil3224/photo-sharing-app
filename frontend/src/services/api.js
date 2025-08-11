/**
 * API通信クライアント
 * Axiosを使用したHTTPリクエスト処理
 * セキュリティ機能統合版
 */
import axios from 'axios';
import { csrfToken, rateLimiter, securityLogger, validateInput } from '../utils/security';

// APIベースURL設定
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Axiosインスタンス作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CSRF保護のためクッキーを含める
});

// リクエストインターセプター（認証トークン自動付与 + セキュリティ機能）
apiClient.interceptors.request.use(
  async (config) => {
    // レート制限チェック
    const rateLimitKey = `api:${config.method}:${config.url}`;
    if (!rateLimiter.isAllowed(rateLimitKey, 100, 60000)) { // 1分間に100リクエスト
      securityLogger.log('RATE_LIMIT_EXCEEDED', { url: config.url, method: config.method });
      throw new Error('リクエスト制限に達しました。しばらく後でお試しください。');
    }

    // 認証トークンを追加
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // CSRFトークンを追加（POST, PUT, DELETE, PATCHリクエストの場合）
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
      try {
        const csrfTokenValue = await csrfToken.get();
        if (csrfTokenValue) {
          config.headers = { ...config.headers, ...csrfToken.setHeader(csrfTokenValue) };
        }
      } catch (error) {
        console.warn('CSRF token fetch failed:', error);
      }
    }

    // セキュリティヘッダーを追加
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター（エラーハンドリング + セキュリティログ）
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;

    // セキュリティ関連エラーのログ
    if (status === 401) {
      securityLogger.log('UNAUTHORIZED_ACCESS', { url });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (status === 403) {
      securityLogger.log('FORBIDDEN_ACCESS', { url });
    } else if (status === 429) {
      securityLogger.log('RATE_LIMIT_SERVER', { url });
    } else if (status >= 500) {
      securityLogger.log('SERVER_ERROR', { url, status });
    } else if (!error.response) {
      securityLogger.log('NETWORK_ERROR', { url });
    }
    
    // エラーレスポンスの統一化
    const errorMessage = error.response?.data?.error?.message || 
                        error.response?.data?.message || 
                        error.message || 
                        'ネットワークエラーが発生しました';
    
    return Promise.reject({
      ...error,
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data
    });
  }
);

// API関数群
export const api = {
  // 認証関連
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    register: (userData) => apiClient.post('/auth/register', userData),
    logout: () => apiClient.post('/auth/logout'),
    refreshToken: () => apiClient.post('/auth/refresh'),
    getCurrentUser: () => apiClient.get('/auth/me'),
  },

  // 投稿関連
  posts: {
    getTimeline: (params = {}) => apiClient.get('/posts', { params }),
    getPost: (postId) => apiClient.get(`/posts/${postId}`),
    createPost: (postData) => apiClient.post('/posts', postData),
    deletePost: (postId) => apiClient.delete(`/posts/${postId}`),
    getUserPosts: (userId, params = {}) => apiClient.get(`/users/${userId}/posts`, { params }),
  },

  // インタラクション関連
  interactions: {
    toggleLike: (postId) => apiClient.post(`/posts/${postId}/like`),
    getPostLikes: (postId, params = {}) => apiClient.get(`/posts/${postId}/likes`, { params }),
    addComment: (postId, commentData) => apiClient.post(`/posts/${postId}/comments`, commentData),
    getPostComments: (postId, params = {}) => apiClient.get(`/posts/${postId}/comments`, { params }),
  },

  // プロフィール関連
  users: {
    getProfile: (userId) => apiClient.get(`/users/${userId}`),
    updateProfile: (userId, profileData) => apiClient.put(`/users/${userId}`, profileData),
    updateProfileImage: (userId, formData) => apiClient.post(`/users/${userId}/profile-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  },

  // 画像関連
  images: {
    getUploadUrl: (fileName, contentType) => apiClient.post('/images/upload-url', {
      file_name: fileName,
      content_type: contentType,
    }),
    uploadToS3: (uploadUrl, file) => axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    }),
  },
};

export default apiClient;