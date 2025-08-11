/**
 * E2Eテスト グローバルティアダウン
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🧹 Starting E2E test global teardown...');

  try {
    // 一時ファイルのクリーンアップ
    const tempDirs = ['test-data', 'temp-uploads'];
    
    for (const dir of tempDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`Cleaned up directory: ${dir}`);
      }
    }

    console.log('✅ E2E test global teardown completed');
  } catch (error) {
    console.error('❌ E2E test global teardown failed:', error);
    // ティアダウンのエラーはテスト結果に影響しないようにする
  }
};