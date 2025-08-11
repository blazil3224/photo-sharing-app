/**
 * E2Eテスト用Jest設定
 * 要件: 全機能を網羅するE2Eテストシナリオ実装
 */

module.exports = {
  // テスト環境
  testEnvironment: 'jsdom',
  
  // セットアップファイル
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js',
    '<rootDir>/src/__tests__/e2e/setup/testSetup.js'
  ],
  
  // テストファイルパターン
  testMatch: [
    '<rootDir>/src/__tests__/e2e/**/*.test.js'
  ],
  
  // モジュール名マッピング
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__tests__/__mocks__/fileMock.js'
  },
  
  // カバレッジ設定
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/**/*.test.js',
    '!src/__tests__/**/*',
    '!src/setupTests.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // タイムアウト設定
  testTimeout: 30000,
  
  // 並列実行設定
  maxWorkers: process.env.CI ? 1 : '50%',
  
  // レポーター設定
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-reports',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporters', {
      publicPath: 'test-reports',
      filename: 'test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Photo Sharing App - E2E Test Report'
    }]
  ],
  
  // グローバル設定
  globals: {
    'process.env': {
      NODE_ENV: 'test',
      REACT_APP_API_URL: 'http://localhost:5000',
      REACT_APP_ENVIRONMENT: 'test'
    }
  },
  
  // 変換設定
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  
  // モジュール解決
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // セットアップとティアダウン
  globalSetup: '<rootDir>/src/__tests__/e2e/setup/globalSetup.js',
  globalTeardown: '<rootDir>/src/__tests__/e2e/setup/globalTeardown.js',
  
  // 詳細出力
  verbose: true,
  
  // エラー時の詳細表示
  errorOnDeprecated: true,
  
  // キャッシュ設定
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // ウォッチモード設定
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // 実行前後のフック
  setupFiles: [
    '<rootDir>/src/__tests__/e2e/setup/polyfills.js'
  ]
};