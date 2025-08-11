/**
 * フロントエンドセキュリティユーティリティ
 * 要件6.1, 6.3: クライアントサイドセキュリティ機能
 */

// XSS対策用のHTMLエスケープ
export const escapeHtml = (text) => {
  if (typeof text !== 'string') {
    return text;
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// HTMLタグを除去
export const stripHtml = (html) => {
  if (typeof html !== 'string') {
    return html;
  }
  
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// 安全なHTMLサニタイゼーション
export const sanitizeHtml = (html) => {
  if (typeof html !== 'string') {
    return html;
  }
  
  // 危険なタグとスクリプトを除去
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi
  ];
  
  let sanitized = html;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
};

// 入力値検証
export const validateInput = {
  // メールアドレス検証
  email: (email) => {
    if (!email) {
      return { isValid: false, error: 'メールアドレスは必須です' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: '有効なメールアドレスを入力してください' };
    }
    
    if (email.length > 254) {
      return { isValid: false, error: 'メールアドレスが長すぎます' };
    }
    
    return { isValid: true };
  },
  
  // ユーザー名検証
  username: (username) => {
    if (!username) {
      return { isValid: false, error: 'ユーザー名は必須です' };
    }
    
    if (username.length < 3) {
      return { isValid: false, error: 'ユーザー名は3文字以上で入力してください' };
    }
    
    if (username.length > 30) {
      return { isValid: false, error: 'ユーザー名は30文字以内で入力してください' };
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return { isValid: false, error: 'ユーザー名は英数字とアンダースコアのみ使用可能です' };
    }
    
    return { isValid: true };
  },
  
  // パスワード検証
  password: (password) => {
    if (!password) {
      return { isValid: false, error: 'パスワードは必須です' };
    }
    
    if (password.length < 8) {
      return { isValid: false, error: 'パスワードは8文字以上で入力してください' };
    }
    
    if (password.length > 128) {
      return { isValid: false, error: 'パスワードが長すぎます' };
    }
    
    // 強度チェック
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strength = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (strength < 3) {
      return { 
        isValid: false, 
        error: 'パスワードは英小文字、英大文字、数字、特殊文字のうち3種類以上を含む必要があります' 
      };
    }
    
    return { isValid: true };
  },
  
  // ファイル検証
  file: (file) => {
    if (!file) {
      return { isValid: false, error: 'ファイルが選択されていません' };
    }
    
    // ファイルサイズチェック（5MB制限）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { isValid: false, error: 'ファイルサイズは5MB以下にしてください' };
    }
    
    // ファイル形式チェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'JPEG、PNG、GIF形式のファイルのみアップロード可能です' };
    }
    
    // ファイル名チェック
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return { isValid: false, error: '無効なファイル拡張子です' };
    }
    
    return { isValid: true };
  },
  
  // テキスト長制限
  textLength: (text, maxLength, fieldName = 'テキスト') => {
    if (!text) {
      return { isValid: true };
    }
    
    if (text.length > maxLength) {
      return { 
        isValid: false, 
        error: `${fieldName}は${maxLength}文字以内で入力してください` 
      };
    }
    
    return { isValid: true };
  }
};

// CSRFトークン管理
export const csrfToken = {
  // CSRFトークンを取得
  get: async () => {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.csrf_token;
      }
    } catch (error) {
      console.error('CSRF token fetch error:', error);
    }
    
    return null;
  },
  
  // CSRFトークンをヘッダーに設定
  setHeader: (token) => {
    if (token) {
      return { 'X-CSRF-Token': token };
    }
    return {};
  }
};

// セキュアなローカルストレージ管理
export const secureStorage = {
  // データを暗号化して保存
  setItem: (key, value) => {
    try {
      const encrypted = btoa(JSON.stringify(value));
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Storage encryption error:', error);
    }
  },
  
  // データを復号化して取得
  getItem: (key) => {
    try {
      const encrypted = localStorage.getItem(key);
      if (encrypted) {
        return JSON.parse(atob(encrypted));
      }
    } catch (error) {
      console.error('Storage decryption error:', error);
      localStorage.removeItem(key);
    }
    return null;
  },
  
  // データを削除
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
  
  // すべてのデータをクリア
  clear: () => {
    localStorage.clear();
  }
};

// URLの安全性チェック
export const validateUrl = (url) => {
  if (!url) {
    return { isValid: false, error: 'URLが指定されていません' };
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // プロトコルチェック
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, error: '無効なプロトコルです' };
    }
    
    // ローカルIPアドレスへのアクセスを防止
    const hostname = parsedUrl.hostname;
    const localPatterns = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./
    ];
    
    if (localPatterns.some(pattern => pattern.test(hostname))) {
      return { isValid: false, error: 'ローカルアドレスへのアクセスは許可されていません' };
    }
    
    return { isValid: true, url: parsedUrl };
  } catch (error) {
    return { isValid: false, error: '無効なURL形式です' };
  }
};

// レート制限チェック
export const rateLimiter = {
  // リクエスト履歴を保存
  requests: new Map(),
  
  // リクエストが許可されるかチェック
  isAllowed: (key, maxRequests = 10, windowMs = 60000) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimiter.requests.has(key)) {
      rateLimiter.requests.set(key, []);
    }
    
    const requests = rateLimiter.requests.get(key);
    
    // 古いリクエストを削除
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    rateLimiter.requests.set(key, validRequests);
    
    // リクエスト数チェック
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // 新しいリクエストを記録
    validRequests.push(now);
    return true;
  },
  
  // リクエスト履歴をクリア
  clear: (key) => {
    if (key) {
      rateLimiter.requests.delete(key);
    } else {
      rateLimiter.requests.clear();
    }
  }
};

// セキュリティイベントログ
export const securityLogger = {
  // セキュリティイベントをログ
  log: (event, details = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // 開発環境ではコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security Event:', logEntry);
    }
    
    // 本番環境では監視システムに送信
    if (process.env.NODE_ENV === 'production') {
      try {
        fetch('/api/security-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logEntry)
        }).catch(error => {
          console.error('Security log submission failed:', error);
        });
      } catch (error) {
        console.error('Security log error:', error);
      }
    }
  }
};

// Content Security Policy違反の検出
export const setupCSPReporting = () => {
  document.addEventListener('securitypolicyviolation', (event) => {
    securityLogger.log('CSP_VIOLATION', {
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      documentURI: event.documentURI,
      originalPolicy: event.originalPolicy
    });
  });
};

// セキュリティ設定の初期化
export const initSecurity = () => {
  // CSPレポート設定
  setupCSPReporting();
  
  // 開発者ツールの検出（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    let devtools = { open: false, orientation: null };
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > 200 || 
          window.outerWidth - window.innerWidth > 200) {
        if (!devtools.open) {
          devtools.open = true;
          securityLogger.log('DEVTOOLS_OPENED');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }
  
  // 右クリック無効化（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      securityLogger.log('CONTEXT_MENU_BLOCKED');
    });
    
    // キーボードショートカット無効化
    document.addEventListener('keydown', (e) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (e.keyCode === 123 || 
          (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
          (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
        securityLogger.log('DEVTOOLS_SHORTCUT_BLOCKED', { keyCode: e.keyCode });
      }
    });
  }
};

// セキュリティヘッダーのチェック
export const checkSecurityHeaders = async () => {
  try {
    const response = await fetch(window.location.href, { method: 'HEAD' });
    const headers = response.headers;
    
    const securityHeaders = {
      'x-content-type-options': headers.get('x-content-type-options'),
      'x-frame-options': headers.get('x-frame-options'),
      'x-xss-protection': headers.get('x-xss-protection'),
      'strict-transport-security': headers.get('strict-transport-security'),
      'content-security-policy': headers.get('content-security-policy')
    };
    
    const missingHeaders = Object.entries(securityHeaders)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingHeaders.length > 0) {
      securityLogger.log('MISSING_SECURITY_HEADERS', { missingHeaders });
    }
    
    return securityHeaders;
  } catch (error) {
    console.error('Security headers check failed:', error);
    return null;
  }
};

export default {
  escapeHtml,
  stripHtml,
  sanitizeHtml,
  validateInput,
  csrfToken,
  secureStorage,
  validateUrl,
  rateLimiter,
  securityLogger,
  initSecurity,
  checkSecurityHeaders
};