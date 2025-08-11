/**
 * 完全なユーザージャーニーE2Eテスト
 * 要件: 全要件の統合検証
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { 
  renderWithProviders, 
  testUtils, 
  setupTestEnvironment, 
  mockTestData,
  performanceUtils
} from '../setup/testSetup';

// テスト環境セットアップ
setupTestEnvironment();

describe('Complete User Journey E2E Tests', () => {
  describe('新規ユーザーの完全なジャーニー', () => {
    test('ユーザー登録からプロフィール設定、投稿作成、インタラクションまでの完全フロー', async () => {
      const user = userEvent.setup();
      
      // パフォーマンス測定開始
      const startTime = performance.now();
      
      // 1. アプリケーション起動
      renderWithProviders(<App />);
      
      // 初期ローディング完了を待機
      await testUtils.waitForLoadingComplete();
      
      // 2. 新規登録ページへ移動
      await testUtils.navigateToPage('登録');
      
      // 登録フォームが表示されることを確認
      expect(screen.getByRole('heading', { name: /新規登録/i })).toBeInTheDocument();
      
      // 3. ユーザー登録
      const newUserData = {
        username: 'e2euser',
        email: 'e2e@example.com',
        password: 'E2EPassword123!'
      };
      
      await testUtils.registerUser(
        newUserData.username,
        newUserData.email,
        newUserData.password
      );
      
      // 登録成功後、ホームページにリダイレクトされることを確認
      await waitFor(() => {
        expect(window.location.pathname).toBe('/');
      });
      
      // 4. プロフィール設定
      await testUtils.navigateToPage('プロフィール');
      
      // プロフィール編集ボタンをクリック
      const editButton = screen.getByRole('button', { name: /編集/i });
      await user.click(editButton);
      
      // プロフィール情報を更新
      await testUtils.updateProfile('E2Eテストユーザーです。写真共有アプリをテスト中！');
      
      // 更新成功メッセージを確認
      testUtils.expectSuccessMessage('プロフィールを更新しました');
      
      // 5. 投稿作成
      await testUtils.navigateToPage('アップロード');
      
      // アップロードフォームが表示されることを確認
      expect(screen.getByRole('heading', { name: /新しい投稿/i })).toBeInTheDocument();
      
      // テスト用画像ファイルを作成
      const testImageFile = new File(['test image content'], 'test-image.jpg', {
        type: 'image/jpeg'
      });
      
      // 投稿を作成
      await testUtils.createPost('初めての投稿です！ #テスト #写真共有', testImageFile);
      
      // 投稿成功後、ホームページにリダイレクトされることを確認
      await waitFor(() => {
        expect(window.location.pathname).toBe('/');
      });
      
      // 6. タイムラインで投稿確認
      await testUtils.waitForElement('post-card');
      
      // 作成した投稿が表示されることを確認
      expect(screen.getByText('初めての投稿です！ #テスト #写真共有')).toBeInTheDocument();
      
      // 7. いいね機能テスト
      const likeButton = screen.getByTestId('like-button-test-post-1');
      await user.click(likeButton);
      
      // いいね数が増加することを確認
      await waitFor(() => {
        expect(screen.getByText('6')).toBeInTheDocument(); // 5 + 1
      });
      
      // 8. コメント機能テスト
      await testUtils.addComment('素晴らしい投稿ですね！');
      
      // コメントが表示されることを確認
      expect(screen.getByText('素晴らしい投稿ですね！')).toBeInTheDocument();
      
      // 9. 投稿詳細ページ確認
      const postCard = screen.getByTestId('post-card-test-post-1');
      await user.click(postCard);
      
      // 投稿詳細ページに移動することを確認
      await waitFor(() => {
        expect(window.location.pathname).toMatch(/\/posts\//);
      });
      
      // 詳細情報が表示されることを確認
      expect(screen.getByText('初めての投稿です！ #テスト #写真共有')).toBeInTheDocument();
      expect(screen.getByText('素晴らしい投稿ですね！')).toBeInTheDocument();
      
      // 10. プロフィールページで投稿確認
      await testUtils.navigateToPage('プロフィール');
      
      // 自分の投稿が表示されることを確認
      expect(screen.getByText('初めての投稿です！ #テスト #写真共有')).toBeInTheDocument();
      
      // パフォーマンス測定終了
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // パフォーマンス要件確認（10秒以内で完了）
      expect(totalTime).toBeLessThan(10000);
      
      console.log(`Complete user journey completed in ${totalTime.toFixed(2)}ms`);
    }, 30000); // 30秒タイムアウト
    
    test('エラーハンドリングとリカバリーフロー', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<App />);
      
      // 1. 無効な認証情報でログイン試行
      await testUtils.navigateToPage('ログイン');
      
      const emailInput = screen.getByLabelText(/メールアドレス/i);
      const passwordInput = screen.getByLabelText(/パスワード/i);
      const loginButton = screen.getByRole('button', { name: /ログイン/i });
      
      await user.type(emailInput, 'invalid@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);
      
      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        testUtils.expectErrorMessage('認証に失敗しました');
      });
      
      // 2. 正しい認証情報でリトライ
      await user.clear(emailInput);
      await user.clear(passwordInput);
      await testUtils.loginUser();
      
      // ログイン成功を確認
      await waitFor(() => {
        expect(window.location.pathname).toBe('/');
      });
      
      // 3. ネットワークエラーシミュレーション
      // APIモックを一時的にエラーを返すように変更
      const originalGetTimeline = require('../../../services/api').api.posts.getTimeline;
      require('../../../services/api').api.posts.getTimeline = jest.fn().mockRejectedValue(
        new Error('ネットワークエラー')
      );
      
      // ページをリロード
      window.location.reload();
      
      // エラー状態が適切に表示されることを確認
      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/i)).toBeInTheDocument();
      });
      
      // リトライボタンをクリック
      const retryButton = screen.getByRole('button', { name: /再試行/i });
      
      // APIモックを正常に戻す
      require('../../../services/api').api.posts.getTimeline = originalGetTimeline;
      
      await user.click(retryButton);
      
      // 正常にデータが読み込まれることを確認
      await testUtils.waitForElement('post-card');
    });
    
    test('レスポンシブデザインとアクセシビリティ', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<App />);
      
      // 1. モバイルビューポートでのテスト
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });
      
      window.dispatchEvent(new Event('resize'));
      
      await testUtils.loginUser();
      
      // モバイルナビゲーションが適切に動作することを確認
      const mobileMenuButton = screen.getByRole('button', { name: /メニュー/i });
      await user.click(mobileMenuButton);
      
      expect(screen.getByRole('navigation')).toBeVisible();
      
      // 2. キーボードナビゲーションテスト
      const firstFocusableElement = screen.getAllByRole('button')[0];
      firstFocusableElement.focus();
      
      // Tabキーでフォーカス移動
      await user.tab();
      expect(document.activeElement).not.toBe(firstFocusableElement);
      
      // 3. スクリーンリーダー対応確認
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
      });
      
      // ARIAラベルの確認
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });
  
  describe('マルチユーザーインタラクション', () => {
    test('複数ユーザー間のインタラクション', async () => {
      const user = userEvent.setup();
      
      // ユーザー1でログイン
      renderWithProviders(<App />);
      await testUtils.loginUser(
        mockTestData.users.testUser1.email,
        mockTestData.users.testUser1.password
      );
      
      // 投稿を作成
      await testUtils.navigateToPage('アップロード');
      await testUtils.createPost('ユーザー1の投稿');
      
      // ログアウト
      const logoutButton = screen.getByRole('button', { name: /ログアウト/i });
      await user.click(logoutButton);
      
      // ユーザー2でログイン
      await testUtils.loginUser(
        mockTestData.users.testUser2.email,
        mockTestData.users.testUser2.password
      );
      
      // ユーザー1の投稿にいいねとコメント
      await testUtils.toggleLike('test-post-1');
      await testUtils.addComment('ユーザー2からのコメント');
      
      // ユーザー1のプロフィールを確認
      await testUtils.navigateToPage('プロフィール');
      
      // 他のユーザーの投稿が適切に表示されることを確認
      expect(screen.getByText('ユーザー1の投稿')).toBeInTheDocument();
      expect(screen.getByText('ユーザー2からのコメント')).toBeInTheDocument();
    });
  });
  
  describe('パフォーマンステスト', () => {
    test('大量データでのパフォーマンス', async () => {
      // 大量の投稿データをモック
      const largeMockData = Array.from({ length: 100 }, (_, index) => ({
        post_id: `large-post-${index}`,
        user_id: 'test-user-1',
        image_url: `/test-image-${index}.jpg`,
        caption: `大量データテスト投稿 ${index}`,
        likes_count: Math.floor(Math.random() * 100),
        comments_count: Math.floor(Math.random() * 20),
        created_at: new Date(Date.now() - index * 60000).toISOString()
      }));
      
      // APIモックを大量データ用に更新
      require('../../../services/api').api.posts.getTimeline = jest.fn().mockResolvedValue({
        success: true,
        data: {
          posts: largeMockData.slice(0, 20),
          last_key: 'page-2',
          has_more: true
        }
      });
      
      const renderStartTime = performance.now();
      
      renderWithProviders(<App />);
      await testUtils.loginUser();
      
      const renderEndTime = performance.now();
      const renderTime = renderEndTime - renderStartTime;
      
      // レンダリング時間が3秒以内であることを確認
      expect(renderTime).toBeLessThan(3000);
      
      // 無限スクロールのテスト
      const scrollContainer = screen.getByTestId('posts-container');
      
      // スクロールイベントをシミュレート
      Object.defineProperty(scrollContainer, 'scrollTop', {
        writable: true,
        value: scrollContainer.scrollHeight,
      });
      
      scrollContainer.dispatchEvent(new Event('scroll'));
      
      // 追加データが読み込まれることを確認
      await waitFor(() => {
        expect(screen.getAllByTestId(/post-card-/).length).toBeGreaterThan(20);
      });
    });
    
    test('メモリリーク検出', async () => {
      const initialMemory = performanceUtils.measureMemoryUsage();
      
      renderWithProviders(<App />);
      await testUtils.loginUser();
      
      // 複数回のナビゲーションを実行
      for (let i = 0; i < 10; i++) {
        await testUtils.navigateToPage('プロフィール');
        await testUtils.navigateToPage('ホーム');
        await testUtils.navigateToPage('アップロード');
        await testUtils.navigateToPage('ホーム');
      }
      
      const finalMemory = performanceUtils.measureMemoryUsage();
      
      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
        const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;
        
        // メモリ使用量の増加が50%以内であることを確認
        expect(memoryIncreasePercent).toBeLessThan(50);
        
        console.log(`Memory usage increased by ${memoryIncreasePercent.toFixed(2)}%`);
      }
    });
  });
  
  describe('セキュリティテスト', () => {
    test('認証が必要なページへの不正アクセス防止', async () => {
      renderWithProviders(<App />);
      
      // 未認証状態で保護されたページにアクセス試行
      window.history.pushState({}, '', '/profile/test-user-1');
      
      // ログインページにリダイレクトされることを確認
      await waitFor(() => {
        expect(window.location.pathname).toBe('/login');
      });
    });
    
    test('XSS攻撃防止', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<App />);
      await testUtils.loginUser();
      
      // 悪意のあるスクリプトを含むコメントを投稿試行
      const maliciousScript = '<script>alert("XSS")</script>';
      
      await testUtils.addComment(maliciousScript);
      
      // スクリプトが実行されずにテキストとして表示されることを確認
      expect(screen.getByText(maliciousScript)).toBeInTheDocument();
      
      // アラートが表示されていないことを確認
      expect(window.alert).not.toHaveBeenCalled();
    });
  });
});