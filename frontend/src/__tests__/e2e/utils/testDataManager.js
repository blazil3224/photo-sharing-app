/**
 * テストデータ作成・クリーンアップ自動化
 * 要件: テストデータ作成・クリーンアップ自動化
 */

import { api } from '../../../services/api';

class TestDataManager {
  constructor() {
    this.createdUsers = [];
    this.createdPosts = [];
    this.createdInteractions = [];
    this.testRunId = `test-${Date.now()}`;
  }

  // テストユーザー作成
  async createTestUser(userData = {}) {
    const defaultUserData = {
      username: `testuser_${this.testRunId}_${Math.random().toString(36).substr(2, 9)}`,
      email: `test_${this.testRunId}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      password: 'TestPassword123!',
      bio: 'テストユーザーです',
      profile_image: null
    };

    const finalUserData = { ...defaultUserData, ...userData };

    try {
      const response = await api.auth.register(
        finalUserData.username,
        finalUserData.email,
        finalUserData.password
      );

      const user = {
        ...response.data.user,
        password: finalUserData.password, // テスト用にパスワードを保持
        token: response.data.token
      };

      this.createdUsers.push(user);
      return user;
    } catch (error) {
      console.error('Failed to create test user:', error);
      throw error;
    }
  }

  // 複数テストユーザー作成
  async createMultipleTestUsers(count = 3) {
    const users = [];
    
    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser({
        username: `testuser${i}_${this.testRunId}`,
        email: `testuser${i}_${this.testRunId}@example.com`,
        bio: `テストユーザー${i + 1}です`
      });
      users.push(user);
    }

    return users;
  }

  // テスト投稿作成
  async createTestPost(userId, postData = {}) {
    const defaultPostData = {
      caption: `テスト投稿 ${this.testRunId} ${Math.random().toString(36).substr(2, 9)}`,
      image_key: `test-images/test-image-${Date.now()}.jpg`
    };

    const finalPostData = { ...defaultPostData, ...postData };

    try {
      // ユーザーとしてログイン
      const user = this.createdUsers.find(u => u.user_id === userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found in created users`);
      }

      // 投稿作成
      const response = await api.posts.createPost(finalPostData);
      const post = response.data;

      this.createdPosts.push(post);
      return post;
    } catch (error) {
      console.error('Failed to create test post:', error);
      throw error;
    }
  }

  // 複数テスト投稿作成
  async createMultipleTestPosts(userId, count = 5) {
    const posts = [];
    
    for (let i = 0; i < count; i++) {
      const post = await this.createTestPost(userId, {
        caption: `テスト投稿${i + 1} ${this.testRunId}`,
        image_key: `test-images/test-image-${i + 1}-${Date.now()}.jpg`
      });
      posts.push(post);
    }

    return posts;
  }

  // テストインタラクション作成
  async createTestInteraction(postId, userId, interactionData = {}) {
    const defaultInteractionData = {
      type: 'like' // 'like' or 'comment'
    };

    const finalInteractionData = { ...defaultInteractionData, ...interactionData };

    try {
      let response;
      
      if (finalInteractionData.type === 'like') {
        response = await api.interactions.toggleLike(postId);
      } else if (finalInteractionData.type === 'comment') {
        const content = finalInteractionData.content || `テストコメント ${this.testRunId}`;
        response = await api.interactions.addComment(postId, content);
      }

      const interaction = {
        post_id: postId,
        user_id: userId,
        type: finalInteractionData.type,
        ...response.data
      };

      this.createdInteractions.push(interaction);
      return interaction;
    } catch (error) {
      console.error('Failed to create test interaction:', error);
      throw error;
    }
  }

  // テストシナリオデータセット作成
  async createScenarioDataSet(scenarioName) {
    const dataSets = {
      // 基本的なユーザージャーニー用データ
      basicUserJourney: async () => {
        const user = await this.createTestUser({
          username: `journey_user_${this.testRunId}`,
          email: `journey_${this.testRunId}@example.com`
        });

        const posts = await this.createMultipleTestPosts(user.user_id, 3);
        
        return { user, posts };
      },

      // マルチユーザーインタラクション用データ
      multiUserInteraction: async () => {
        const users = await this.createMultipleTestUsers(3);
        const posts = [];
        const interactions = [];

        // 各ユーザーが投稿を作成
        for (const user of users) {
          const userPosts = await this.createMultipleTestPosts(user.user_id, 2);
          posts.push(...userPosts);
        }

        // ユーザー間でインタラクション
        for (let i = 0; i < users.length; i++) {
          for (let j = 0; j < posts.length; j++) {
            if (posts[j].user_id !== users[i].user_id) {
              // 他のユーザーの投稿にいいね
              const like = await this.createTestInteraction(
                posts[j].post_id,
                users[i].user_id,
                { type: 'like' }
              );
              interactions.push(like);

              // コメントも追加
              const comment = await this.createTestInteraction(
                posts[j].post_id,
                users[i].user_id,
                { 
                  type: 'comment',
                  content: `${users[i].username}からのコメント`
                }
              );
              interactions.push(comment);
            }
          }
        }

        return { users, posts, interactions };
      },

      // パフォーマンステスト用大量データ
      performanceTest: async () => {
        const users = await this.createMultipleTestUsers(10);
        const posts = [];

        // 各ユーザーが多数の投稿を作成
        for (const user of users) {
          const userPosts = await this.createMultipleTestPosts(user.user_id, 20);
          posts.push(...userPosts);
        }

        return { users, posts };
      },

      // エラーハンドリングテスト用データ
      errorHandling: async () => {
        const validUser = await this.createTestUser({
          username: `valid_user_${this.testRunId}`,
          email: `valid_${this.testRunId}@example.com`
        });

        // 無効なデータも含める
        const invalidUserData = {
          username: '', // 無効なユーザー名
          email: 'invalid-email', // 無効なメール
          password: '123' // 弱いパスワード
        };

        return { validUser, invalidUserData };
      }
    };

    if (!dataSets[scenarioName]) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    return await dataSets[scenarioName]();
  }

  // テストデータのバックアップ
  backupTestData() {
    const backup = {
      testRunId: this.testRunId,
      timestamp: new Date().toISOString(),
      users: this.createdUsers.map(user => ({ ...user, password: undefined })), // パスワードは除外
      posts: this.createdPosts,
      interactions: this.createdInteractions
    };

    // LocalStorageに保存（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      localStorage.setItem(`testDataBackup_${this.testRunId}`, JSON.stringify(backup));
    }

    return backup;
  }

  // テストデータの復元
  restoreTestData(backupData) {
    this.testRunId = backupData.testRunId;
    this.createdUsers = backupData.users;
    this.createdPosts = backupData.posts;
    this.createdInteractions = backupData.interactions;
  }

  // 個別データクリーンアップ
  async cleanupUser(userId) {
    try {
      // ユーザーの投稿を削除
      const userPosts = this.createdPosts.filter(post => post.user_id === userId);
      for (const post of userPosts) {
        await api.posts.deletePost(post.post_id);
      }

      // ユーザーを削除
      await api.profile.deleteProfile(userId);

      // ローカルリストから削除
      this.createdUsers = this.createdUsers.filter(user => user.user_id !== userId);
      this.createdPosts = this.createdPosts.filter(post => post.user_id !== userId);
      this.createdInteractions = this.createdInteractions.filter(
        interaction => interaction.user_id !== userId
      );

      console.log(`Cleaned up user: ${userId}`);
    } catch (error) {
      console.error(`Failed to cleanup user ${userId}:`, error);
    }
  }

  async cleanupPost(postId) {
    try {
      await api.posts.deletePost(postId);

      // ローカルリストから削除
      this.createdPosts = this.createdPosts.filter(post => post.post_id !== postId);
      this.createdInteractions = this.createdInteractions.filter(
        interaction => interaction.post_id !== postId
      );

      console.log(`Cleaned up post: ${postId}`);
    } catch (error) {
      console.error(`Failed to cleanup post ${postId}:`, error);
    }
  }

  // 全テストデータクリーンアップ
  async cleanupAllTestData() {
    console.log(`Starting cleanup for test run: ${this.testRunId}`);

    // インタラクションのクリーンアップ（必要に応じて）
    for (const interaction of this.createdInteractions) {
      try {
        if (interaction.type === 'like') {
          await api.interactions.toggleLike(interaction.post_id);
        }
        // コメントは投稿削除時に自動削除される想定
      } catch (error) {
        console.warn(`Failed to cleanup interaction:`, error);
      }
    }

    // 投稿のクリーンアップ
    for (const post of this.createdPosts) {
      await this.cleanupPost(post.post_id);
    }

    // ユーザーのクリーンアップ
    for (const user of this.createdUsers) {
      await this.cleanupUser(user.user_id);
    }

    // ローカルストレージのクリーンアップ
    if (process.env.NODE_ENV === 'development') {
      localStorage.removeItem(`testDataBackup_${this.testRunId}`);
    }

    // 配列をクリア
    this.createdUsers = [];
    this.createdPosts = [];
    this.createdInteractions = [];

    console.log(`Cleanup completed for test run: ${this.testRunId}`);
  }

  // テストデータの統計情報
  getTestDataStats() {
    return {
      testRunId: this.testRunId,
      usersCount: this.createdUsers.length,
      postsCount: this.createdPosts.length,
      interactionsCount: this.createdInteractions.length,
      createdAt: new Date().toISOString()
    };
  }

  // テストデータの検証
  validateTestData() {
    const issues = [];

    // ユーザーデータの検証
    this.createdUsers.forEach(user => {
      if (!user.user_id || !user.username || !user.email) {
        issues.push(`Invalid user data: ${JSON.stringify(user)}`);
      }
    });

    // 投稿データの検証
    this.createdPosts.forEach(post => {
      if (!post.post_id || !post.user_id) {
        issues.push(`Invalid post data: ${JSON.stringify(post)}`);
      }

      // 投稿のユーザーが存在するかチェック
      const userExists = this.createdUsers.some(user => user.user_id === post.user_id);
      if (!userExists) {
        issues.push(`Post ${post.post_id} references non-existent user ${post.user_id}`);
      }
    });

    // インタラクションデータの検証
    this.createdInteractions.forEach(interaction => {
      if (!interaction.post_id || !interaction.user_id) {
        issues.push(`Invalid interaction data: ${JSON.stringify(interaction)}`);
      }

      // 関連する投稿とユーザーが存在するかチェック
      const postExists = this.createdPosts.some(post => post.post_id === interaction.post_id);
      const userExists = this.createdUsers.some(user => user.user_id === interaction.user_id);

      if (!postExists) {
        issues.push(`Interaction references non-existent post ${interaction.post_id}`);
      }
      if (!userExists) {
        issues.push(`Interaction references non-existent user ${interaction.user_id}`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// グローバルテストデータマネージャーインスタンス
let globalTestDataManager = null;

export const getTestDataManager = () => {
  if (!globalTestDataManager) {
    globalTestDataManager = new TestDataManager();
  }
  return globalTestDataManager;
};

export const resetTestDataManager = () => {
  globalTestDataManager = null;
};

// テストフック用のユーティリティ
export const useTestDataManager = () => {
  const manager = getTestDataManager();

  // テスト開始時のセットアップ
  const setupTest = async (scenarioName) => {
    return await manager.createScenarioDataSet(scenarioName);
  };

  // テスト終了時のクリーンアップ
  const cleanupTest = async () => {
    await manager.cleanupAllTestData();
  };

  return {
    manager,
    setupTest,
    cleanupTest
  };
};

export default TestDataManager;