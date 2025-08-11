import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  escapeHtml, 
  stripHtml, 
  sanitizeHtml, 
  validateInput, 
  csrfToken,
  secureStorage,
  validateUrl,
  rateLimiter,
  securityLogger
} from '../../utils/security';

// Fetch APIのモック
global.fetch = jest.fn();

/**
 * セキュリティ機能テスト
 * 要件6.1, 6.3: セキュリティ機能の検証
 */
describe('セキュリティ機能テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    rateLimiter.clear();
  });

  describe('XSS対策', () => {
    test('HTMLエスケープが正常に動作する', () => {
      const maliciousInput = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(maliciousInput);
      
      expect(escaped).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
      expect(escaped).not.toContain('<script>');
    });

    test('HTMLタグの除去が正常に動作する', () => {
      const htmlInput = '<p>Hello <strong>World</strong></p>';
      const stripped = stripHtml(htmlInput);
      
      expect(stripped).toBe('Hello World');
      expect(stripped).not.toContain('<p>');
      expect(stripped).not.toContain('<strong>');
    });

    test('危険なHTMLのサニタイゼーションが正常に動作する', () => {
      const dangerousHtml = `
        <p>Safe content</p>
        <script>alert('XSS')</script>
        <iframe src="javascript:alert('XSS')"></iframe>
        <img src="x" onerror="alert('XSS')">
        <a href="javascript:alert('XSS')">Link</a>
      `;
      
      const sanitized = sanitizeHtml(dangerousHtml);
      
      expect(sanitized).toContain('Safe content');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('入力値検証', () => {
    test('メールアドレス検証が正常に動作する', () => {
      // 有効なメールアドレス
      expect(validateInput.email('test@example.com')).toEqual({ isValid: true });
      expect(validateInput.email('user.name+tag@domain.co.jp')).toEqual({ isValid: true });
      
      // 無効なメールアドレス
      expect(validateInput.email('')).toEqual({ 
        isValid: false, 
        error: 'メールアドレスは必須です' 
      });
      expect(validateInput.email('invalid-email')).toEqual({ 
        isValid: false, 
        error: '有効なメールアドレスを入力してください' 
      });
      expect(validateInput.email('a'.repeat(250) + '@example.com')).toEqual({ 
        isValid: false, 
        error: 'メールアドレスが長すぎます' 
      });
    });

    test('ユーザー名検証が正常に動作する', () => {
      // 有効なユーザー名
      expect(validateInput.username('testuser')).toEqual({ isValid: true });
      expect(validateInput.username('user_123')).toEqual({ isValid: true });
      
      // 無効なユーザー名
      expect(validateInput.username('')).toEqual({ 
        isValid: false, 
        error: 'ユーザー名は必須です' 
      });
      expect(validateInput.username('ab')).toEqual({ 
        isValid: false, 
        error: 'ユーザー名は3文字以上で入力してください' 
      });
      expect(validateInput.username('a'.repeat(31))).toEqual({ 
        isValid: false, 
        error: 'ユーザー名は30文字以内で入力してください' 
      });
      expect(validateInput.username('user-name')).toEqual({ 
        isValid: false, 
        error: 'ユーザー名は英数字とアンダースコアのみ使用可能です' 
      });
    });

    test('パスワード検証が正常に動作する', () => {
      // 有効なパスワード
      expect(validateInput.password('Password123!')).toEqual({ isValid: true });
      expect(validateInput.password('MySecure@Pass1')).toEqual({ isValid: true });
      
      // 無効なパスワード
      expect(validateInput.password('')).toEqual({ 
        isValid: false, 
        error: 'パスワードは必須です' 
      });
      expect(validateInput.password('short')).toEqual({ 
        isValid: false, 
        error: 'パスワードは8文字以上で入力してください' 
      });
      expect(validateInput.password('password')).toEqual({ 
        isValid: false, 
        error: 'パスワードは英小文字、英大文字、数字、特殊文字のうち3種類以上を含む必要があります' 
      });
    });

    test('ファイル検証が正常に動作する', () => {
      // 有効なファイル
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      expect(validateInput.file(validFile)).toEqual({ isValid: true });
      
      // 無効なファイル（サイズ超過）
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      expect(validateInput.file(largeFile)).toEqual({ 
        isValid: false, 
        error: 'ファイルサイズは5MB以下にしてください' 
      });
      
      // 無効なファイル（形式）
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(validateInput.file(invalidFile)).toEqual({ 
        isValid: false, 
        error: 'JPEG、PNG、GIF形式のファイルのみアップロード可能です' 
      });
    });
  });

  describe('CSRF保護', () => {
    test('CSRFトークンの取得が正常に動作する', async () => {
      const mockToken = 'csrf-token-123';
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrf_token: mockToken })
      });

      const token = await csrfToken.get();
      
      expect(token).toBe(mockToken);
      expect(fetch).toHaveBeenCalledWith('/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });
    });

    test('CSRFトークンヘッダーの設定が正常に動作する', () => {
      const token = 'csrf-token-123';
      const headers = csrfToken.setHeader(token);
      
      expect(headers).toEqual({ 'X-CSRF-Token': token });
    });

    test('CSRFトークンが無い場合は空のヘッダーを返す', () => {
      const headers = csrfToken.setHeader(null);
      
      expect(headers).toEqual({});
    });
  });

  describe('セキュアストレージ', () => {
    test('データの暗号化保存と復号化取得が正常に動作する', () => {
      const testData = { username: 'testuser', id: 123 };
      
      secureStorage.setItem('testKey', testData);
      const retrieved = secureStorage.getItem('testKey');
      
      expect(retrieved).toEqual(testData);
    });

    test('存在しないキーに対してnullを返す', () => {
      const result = secureStorage.getItem('nonexistentKey');
      
      expect(result).toBeNull();
    });

    test('データの削除が正常に動作する', () => {
      secureStorage.setItem('testKey', 'testValue');
      secureStorage.removeItem('testKey');
      
      const result = secureStorage.getItem('testKey');
      expect(result).toBeNull();
    });

    test('全データのクリアが正常に動作する', () => {
      secureStorage.setItem('key1', 'value1');
      secureStorage.setItem('key2', 'value2');
      
      secureStorage.clear();
      
      expect(secureStorage.getItem('key1')).toBeNull();
      expect(secureStorage.getItem('key2')).toBeNull();
    });
  });

  describe('URL検証', () => {
    test('有効なURLの検証が正常に動作する', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com/path',
        'https://subdomain.example.com/path?query=value'
      ];

      validUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.url).toBeInstanceOf(URL);
      });
    });

    test('無効なURLの検証が正常に動作する', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'ftp://example.com',
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>'
      ];

      invalidUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('ローカルIPアドレスへのアクセスを防止する', () => {
      const localUrls = [
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://192.168.1.1',
        'http://10.0.0.1',
        'http://172.16.0.1'
      ];

      localUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('ローカルアドレス');
      });
    });
  });

  describe('レート制限', () => {
    test('レート制限が正常に動作する', () => {
      const key = 'test-key';
      const maxRequests = 3;
      const windowMs = 1000;

      // 制限内のリクエスト
      for (let i = 0; i < maxRequests; i++) {
        expect(rateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(true);
      }

      // 制限を超えるリクエスト
      expect(rateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(false);
    });

    test('時間窓の経過後にリクエストが再び許可される', (done) => {
      const key = 'test-key-2';
      const maxRequests = 1;
      const windowMs = 100;

      // 最初のリクエスト
      expect(rateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(true);
      
      // 制限を超えるリクエスト
      expect(rateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(false);

      // 時間窓経過後
      setTimeout(() => {
        expect(rateLimiter.isAllowed(key, maxRequests, windowMs)).toBe(true);
        done();
      }, windowMs + 10);
    });

    test('レート制限のクリアが正常に動作する', () => {
      const key = 'test-key-3';
      
      // リクエストを制限まで実行
      rateLimiter.isAllowed(key, 1, 1000);
      expect(rateLimiter.isAllowed(key, 1, 1000)).toBe(false);
      
      // クリア後は再び許可される
      rateLimiter.clear(key);
      expect(rateLimiter.isAllowed(key, 1, 1000)).toBe(true);
    });
  });

  describe('セキュリティログ', () => {
    test('セキュリティイベントのログが正常に動作する', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // 開発環境でのテスト
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      securityLogger.log('TEST_EVENT', { detail: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Security Event:',
        expect.objectContaining({
          event: 'TEST_EVENT',
          details: { detail: 'test' }
        })
      );
      
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    test('本番環境でのセキュリティログ送信', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      fetch.mockResolvedValueOnce({ ok: true });
      
      securityLogger.log('PRODUCTION_EVENT', { detail: 'test' });
      
      expect(fetch).toHaveBeenCalledWith('/api/security-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('PRODUCTION_EVENT')
      });
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('統合セキュリティテスト', () => {
    test('複数のセキュリティ機能が連携して動作する', async () => {
      // 1. 入力値検証
      const userInput = '<script>alert("XSS")</script>test@example.com';
      const sanitizedInput = sanitizeHtml(userInput);
      expect(sanitizedInput).not.toContain('<script>');
      
      // 2. レート制限チェック
      const rateLimitKey = 'integration-test';
      expect(rateLimiter.isAllowed(rateLimitKey, 5, 1000)).toBe(true);
      
      // 3. CSRFトークン取得
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrf_token: 'integration-token' })
      });
      
      const token = await csrfToken.get();
      expect(token).toBe('integration-token');
      
      // 4. セキュアストレージ
      const secureData = { sanitizedInput, token };
      secureStorage.setItem('integrationTest', secureData);
      const retrieved = secureStorage.getItem('integrationTest');
      expect(retrieved).toEqual(secureData);
    });

    test('セキュリティ違反時の適切な処理', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // レート制限違反
      const key = 'violation-test';
      for (let i = 0; i <= 5; i++) {
        rateLimiter.isAllowed(key, 5, 1000);
      }
      
      // 無効なURL
      const result = validateUrl('javascript:alert("XSS")');
      expect(result.isValid).toBe(false);
      
      // セキュリティログの確認
      securityLogger.log('SECURITY_VIOLATION', { type: 'test' });
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});