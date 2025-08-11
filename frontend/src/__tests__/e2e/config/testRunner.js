/**
 * CI/CDパイプライン用テスト実行設定
 * 要件: CI/CDパイプラインでのテスト実行設定
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class TestRunner {
  constructor(options = {}) {
    this.options = {
      environment: process.env.NODE_ENV || 'test',
      parallel: process.env.CI ? false : true, // CIでは並列実行を無効化
      timeout: 30000,
      retries: process.env.CI ? 2 : 0,
      coverage: true,
      reporters: ['default', 'junit'],
      ...options
    };

    this.testResults = {
      startTime: null,
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: null,
      errors: []
    };
  }

  // テスト環境の準備
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    try {
      // 環境変数の設定
      process.env.NODE_ENV = 'test';
      process.env.REACT_APP_API_URL = 'http://localhost:5000';
      process.env.REACT_APP_ENVIRONMENT = 'test';

      // テスト用データベースの準備（必要に応じて）
      if (process.env.CI) {
        await this.setupCIEnvironment();
      } else {
        await this.setupLocalEnvironment();
      }

      // テストデータディレクトリの作成
      const testDataDir = path.join(process.cwd(), 'test-data');
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      console.log('✅ Test environment setup completed');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      throw error;
    }
  }

  // CI環境固有のセットアップ
  async setupCIEnvironment() {
    console.log('🚀 Setting up CI environment...');

    // Docker コンテナの起動（必要に応じて）
    if (process.env.USE_DOCKER_SERVICES) {
      try {
        execSync('docker-compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
        
        // サービスの起動を待機
        await this.waitForServices();
      } catch (error) {
        console.error('Failed to start Docker services:', error);
        throw error;
      }
    }

    // CI固有の設定
    this.options.parallel = false;
    this.options.timeout = 60000; // CI環境では長めのタイムアウト
    this.options.retries = 3;
  }

  // ローカル環境固有のセットアップ
  async setupLocalEnvironment() {
    console.log('🏠 Setting up local environment...');

    // ローカル開発サーバーの起動確認
    try {
      const response = await fetch('http://localhost:5000/health');
      if (!response.ok) {
        throw new Error('Backend server is not running');
      }
    } catch (error) {
      console.warn('⚠️ Backend server is not running. Some tests may fail.');
    }
  }

  // サービスの起動を待機
  async waitForServices(maxWaitTime = 60000) {
    const services = [
      { name: 'Backend API', url: 'http://localhost:5000/health' },
      { name: 'DynamoDB Local', url: 'http://localhost:8000' }
    ];

    const startTime = Date.now();

    for (const service of services) {
      console.log(`⏳ Waiting for ${service.name}...`);
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const response = await fetch(service.url);
          if (response.ok) {
            console.log(`✅ ${service.name} is ready`);
            break;
          }
        } catch (error) {
          // サービスがまだ起動していない
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // テストスイートの実行
  async runTestSuite(suiteName = 'all') {
    console.log(`🧪 Running test suite: ${suiteName}`);
    
    this.testResults.startTime = new Date();

    try {
      await this.setupTestEnvironment();

      const testCommand = this.buildTestCommand(suiteName);
      console.log(`Executing: ${testCommand}`);

      const result = execSync(testCommand, { 
        stdio: 'pipe',
        encoding: 'utf8',
        env: { ...process.env, CI: process.env.CI || 'false' }
      });

      await this.parseTestResults(result);
      
      console.log('✅ Test suite completed successfully');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.testResults.errors.push(error.message);
      throw error;
    } finally {
      this.testResults.endTime = new Date();
      await this.cleanup();
      await this.generateReports();
    }
  }

  // テストコマンドの構築
  buildTestCommand(suiteName) {
    const baseCommand = 'npm test';
    const options = [];

    // テストファイルパターンの指定
    const testPatterns = {
      all: '__tests__/**/*.test.js',
      e2e: '__tests__/e2e/**/*.test.js',
      integration: '__tests__/integration/**/*.test.js',
      unit: '__tests__/**/*.test.js --ignore="__tests__/e2e/**" --ignore="__tests__/integration/**"',
      performance: '__tests__/performance/**/*.test.js',
      security: '__tests__/security/**/*.test.js'
    };

    if (testPatterns[suiteName]) {
      options.push(`--testPathPattern="${testPatterns[suiteName]}"`);
    }

    // その他のオプション
    options.push('--watchAll=false');
    options.push(`--maxWorkers=${this.options.parallel ? '50%' : '1'}`);
    options.push(`--testTimeout=${this.options.timeout}`);

    if (this.options.coverage) {
      options.push('--coverage');
      options.push('--coverageDirectory=coverage');
    }

    if (this.options.retries > 0) {
      options.push(`--testRetries=${this.options.retries}`);
    }

    // CI環境での追加オプション
    if (process.env.CI) {
      options.push('--ci');
      options.push('--silent');
      options.push('--reporters=default');
      options.push('--reporters=jest-junit');
    }

    return `${baseCommand} ${options.join(' ')}`;
  }

  // テスト結果の解析
  async parseTestResults(output) {
    try {
      // Jest出力からテスト結果を抽出
      const lines = output.split('\n');
      
      for (const line of lines) {
        if (line.includes('Tests:')) {
          const match = line.match(/(\d+) passed.*?(\d+) failed.*?(\d+) skipped.*?(\d+) total/);
          if (match) {
            this.testResults.passedTests = parseInt(match[1]);
            this.testResults.failedTests = parseInt(match[2]);
            this.testResults.skippedTests = parseInt(match[3]);
            this.testResults.totalTests = parseInt(match[4]);
          }
        }
      }

      // カバレッジ情報の抽出
      if (this.options.coverage) {
        await this.extractCoverageInfo();
      }
    } catch (error) {
      console.error('Failed to parse test results:', error);
    }
  }

  // カバレッジ情報の抽出
  async extractCoverageInfo() {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        this.testResults.coverage = {
          statements: coverageData.total.statements.pct,
          branches: coverageData.total.branches.pct,
          functions: coverageData.total.functions.pct,
          lines: coverageData.total.lines.pct
        };
      }
    } catch (error) {
      console.error('Failed to extract coverage info:', error);
    }
  }

  // テスト環境のクリーンアップ
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');

    try {
      // Docker コンテナの停止（CI環境）
      if (process.env.CI && process.env.USE_DOCKER_SERVICES) {
        execSync('docker-compose -f docker-compose.test.yml down', { stdio: 'inherit' });
      }

      // 一時ファイルの削除
      const tempDirs = ['test-data', 'temp-uploads'];
      for (const dir of tempDirs) {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      }

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  // テストレポートの生成
  async generateReports() {
    console.log('📊 Generating test reports...');

    try {
      const reportData = {
        ...this.testResults,
        duration: this.testResults.endTime - this.testResults.startTime,
        environment: this.options.environment,
        timestamp: new Date().toISOString()
      };

      // JSON レポート
      const jsonReportPath = path.join(process.cwd(), 'test-reports', 'test-results.json');
      fs.mkdirSync(path.dirname(jsonReportPath), { recursive: true });
      fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2));

      // HTML レポート（簡易版）
      await this.generateHtmlReport(reportData);

      // CI環境用のJUnit XMLレポート
      if (process.env.CI) {
        await this.generateJunitReport(reportData);
      }

      console.log('✅ Reports generated successfully');
    } catch (error) {
      console.error('❌ Failed to generate reports:', error);
    }
  }

  // HTML レポートの生成
  async generateHtmlReport(reportData) {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Results - Photo Sharing App</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .passed { border-left: 4px solid #28a745; }
        .failed { border-left: 4px solid #dc3545; }
        .coverage { border-left: 4px solid #007bff; }
        .errors { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Photo Sharing App - Test Results</h1>
        <p>Generated: ${reportData.timestamp}</p>
        <p>Duration: ${Math.round(reportData.duration / 1000)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric passed">
            <h3>Passed Tests</h3>
            <p style="font-size: 2em; margin: 0;">${reportData.passedTests}</p>
        </div>
        <div class="metric failed">
            <h3>Failed Tests</h3>
            <p style="font-size: 2em; margin: 0;">${reportData.failedTests}</p>
        </div>
        <div class="metric">
            <h3>Total Tests</h3>
            <p style="font-size: 2em; margin: 0;">${reportData.totalTests}</p>
        </div>
        ${reportData.coverage ? `
        <div class="metric coverage">
            <h3>Coverage</h3>
            <p>Lines: ${reportData.coverage.lines}%</p>
            <p>Statements: ${reportData.coverage.statements}%</p>
            <p>Functions: ${reportData.coverage.functions}%</p>
            <p>Branches: ${reportData.coverage.branches}%</p>
        </div>
        ` : ''}
    </div>
    
    ${reportData.errors.length > 0 ? `
    <div class="errors">
        <h3>Errors</h3>
        <ul>
            ${reportData.errors.map(error => `<li>${error}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `;

    const htmlReportPath = path.join(process.cwd(), 'test-reports', 'test-results.html');
    fs.writeFileSync(htmlReportPath, htmlContent);
  }

  // JUnit XMLレポートの生成
  async generateJunitReport(reportData) {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="PhotoSharingApp" tests="${reportData.totalTests}" failures="${reportData.failedTests}" time="${reportData.duration / 1000}">
    <testsuite name="E2E Tests" tests="${reportData.totalTests}" failures="${reportData.failedTests}" time="${reportData.duration / 1000}">
        ${reportData.errors.map(error => `
        <testcase name="Test Error" classname="TestRunner">
            <failure message="${error}"></failure>
        </testcase>
        `).join('')}
    </testsuite>
</testsuites>`;

    const xmlReportPath = path.join(process.cwd(), 'test-reports', 'junit.xml');
    fs.writeFileSync(xmlReportPath, xmlContent);
  }

  // テスト結果の取得
  getTestResults() {
    return this.testResults;
  }

  // テスト成功判定
  isTestSuccessful() {
    return this.testResults.failedTests === 0 && this.testResults.errors.length === 0;
  }
}

// CLI実行用のメイン関数
async function main() {
  const args = process.argv.slice(2);
  const suiteName = args[0] || 'all';

  const runner = new TestRunner();

  try {
    await runner.runTestSuite(suiteName);
    
    const results = runner.getTestResults();
    console.log('\n📊 Test Summary:');
    console.log(`Total: ${results.totalTests}`);
    console.log(`Passed: ${results.passedTests}`);
    console.log(`Failed: ${results.failedTests}`);
    console.log(`Duration: ${Math.round((results.endTime - results.startTime) / 1000)}s`);

    if (results.coverage) {
      console.log(`Coverage: ${results.coverage.lines}% lines`);
    }

    if (!runner.isTestSuccessful()) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// CLI実行時
if (require.main === module) {
  main();
}

export default TestRunner;