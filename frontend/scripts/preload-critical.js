/**
 * クリティカルリソースのプリロード設定生成スクリプト
 * 要件6.4: バンドルサイズ最適化とコード分割実装
 */

const fs = require('fs');
const path = require('path');

// ビルドディレクトリのパス
const buildDir = path.join(__dirname, '../build');
const staticDir = path.join(buildDir, 'static');

// クリティカルリソースの特定
function identifyCriticalResources() {
  const criticalResources = [];

  try {
    // CSS ファイルの検索
    const cssDir = path.join(staticDir, 'css');
    if (fs.existsSync(cssDir)) {
      const cssFiles = fs.readdirSync(cssDir)
        .filter(file => file.endsWith('.css') && !file.includes('.map'))
        .map(file => `/static/css/${file}`);
      criticalResources.push(...cssFiles);
    }

    // メインJSファイルの検索
    const jsDir = path.join(staticDir, 'js');
    if (fs.existsSync(jsDir)) {
      const jsFiles = fs.readdirSync(jsDir)
        .filter(file => file.endsWith('.js') && !file.includes('.map'))
        .sort((a, b) => {
          // main.js を最優先
          if (a.includes('main')) return -1;
          if (b.includes('main')) return 1;
          // runtime.js を次に優先
          if (a.includes('runtime')) return -1;
          if (b.includes('runtime')) return 1;
          return 0;
        })
        .slice(0, 3) // 最初の3つのファイルのみ
        .map(file => `/static/js/${file}`);
      criticalResources.push(...jsFiles);
    }

    return criticalResources;
  } catch (error) {
    console.error('Critical resources identification failed:', error);
    return [];
  }
}

// プリロードタグの生成
function generatePreloadTags(resources) {
  return resources.map(resource => {
    let asAttribute = 'script';
    let crossorigin = '';

    if (resource.endsWith('.css')) {
      asAttribute = 'style';
    } else if (resource.endsWith('.js')) {
      asAttribute = 'script';
      crossorigin = ' crossorigin';
    }

    return `<link rel="preload" href="${resource}" as="${asAttribute}"${crossorigin}>`;
  }).join('\n    ');
}

// index.htmlの更新
function updateIndexHtml(preloadTags) {
  const indexPath = path.join(buildDir, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found in build directory');
    return;
  }

  let indexContent = fs.readFileSync(indexPath, 'utf8');

  // 既存のプリロードタグを削除
  indexContent = indexContent.replace(
    /\s*<link rel="preload"[^>]*>\s*/g,
    ''
  );

  // 新しいプリロードタグを挿入
  const headCloseIndex = indexContent.indexOf('</head>');
  if (headCloseIndex !== -1) {
    const beforeHead = indexContent.substring(0, headCloseIndex);
    const afterHead = indexContent.substring(headCloseIndex);
    
    indexContent = beforeHead + 
      '    <!-- Critical Resource Preloads -->\n' +
      '    ' + preloadTags + '\n' +
      '    ' + afterHead;
  }

  fs.writeFileSync(indexPath, indexContent);
  console.log('✅ index.html updated with preload tags');
}

// リソースヒントの生成
function generateResourceHints() {
  const hints = [
    '<link rel="dns-prefetch" href="//fonts.googleapis.com">',
    '<link rel="dns-prefetch" href="//fonts.gstatic.com">',
    '<link rel="preconnect" href="//fonts.googleapis.com" crossorigin>',
    '<link rel="preconnect" href="//fonts.gstatic.com" crossorigin>'
  ];

  // API エンドポイントのプリコネクト
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  hints.push(`<link rel="preconnect" href="${apiUrl}" crossorigin>`);

  return hints.join('\n    ');
}

// バンドル分析レポートの生成
function generateBundleReport(resources) {
  const report = {
    timestamp: new Date().toISOString(),
    criticalResources: resources,
    resourceCount: resources.length,
    estimatedSize: 0
  };

  // ファイルサイズの計算
  resources.forEach(resource => {
    const filePath = path.join(buildDir, resource);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      report.estimatedSize += stats.size;
    }
  });

  // レポートファイルの保存
  const reportPath = path.join(buildDir, 'bundle-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('📊 Bundle Report:');
  console.log(`  Critical Resources: ${report.resourceCount}`);
  console.log(`  Estimated Size: ${(report.estimatedSize / 1024).toFixed(2)} KB`);
  console.log(`  Report saved to: ${reportPath}`);
}

// Service Worker の更新
function updateServiceWorker() {
  const swPath = path.join(buildDir, 'sw.js');
  
  if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // キャッシュバージョンの更新
    const timestamp = Date.now();
    swContent = swContent.replace(
      /const CACHE_VERSION = ['"][^'"]*['"];?/,
      `const CACHE_VERSION = 'v${timestamp}';`
    );
    
    fs.writeFileSync(swPath, swContent);
    console.log('🔄 Service Worker cache version updated');
  }
}

// メイン実行関数
function main() {
  console.log('🚀 Starting critical resource preload generation...');

  if (!fs.existsSync(buildDir)) {
    console.error('❌ Build directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  try {
    // クリティカルリソースの特定
    const criticalResources = identifyCriticalResources();
    console.log(`📦 Found ${criticalResources.length} critical resources`);

    // プリロードタグの生成
    const preloadTags = generatePreloadTags(criticalResources);
    
    // リソースヒントの生成
    const resourceHints = generateResourceHints();
    
    // index.htmlの更新
    updateIndexHtml(preloadTags + '\n    ' + resourceHints);
    
    // バンドル分析レポートの生成
    generateBundleReport(criticalResources);
    
    // Service Worker の更新
    updateServiceWorker();

    console.log('✅ Critical resource preload generation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during preload generation:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  main();
}

module.exports = {
  identifyCriticalResources,
  generatePreloadTags,
  generateResourceHints,
  updateIndexHtml,
  generateBundleReport
};