/**
 * E2Eテスト グローバルセットアップ
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🚀 Starting E2E test global setup...');

  try {
    // テストレポートディレクトリの作成
    const reportsDir = path.join(process.cwd(), 'test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // テストデータディレクトリの作成
    const testDataDir = path.join(process.cwd(), 'test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // 環境変数の設定
    process.env.NODE_ENV = 'test';
    process.env.REACT_APP_API_URL = 'http://localhost:5000';
    process.env.REACT_APP_ENVIRONMENT = 'test';

    console.log('✅ E2E test global setup completed');
  } catch (error) {
    console.error('❌ E2E test global setup failed:', error);
    throw error;
  }
};