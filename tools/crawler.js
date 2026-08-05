/**
 * 颜究生情绪手机壁纸 - 多源壁纸爬虫工具
 * 
 * 支持的壁纸源：
 *   1. Pexels API    - 摄影类，免费CDN直链，无需防盗链处理
 *   2. Unsplash API  - 摄影类，免费CDN直链
 *   3. Wallhaven API - 动漫/游戏/风景，需API Key（可选）
 *   4. Pixabay API   - 综合类，需API Key
 *   5. 彼岸图网       - 4K壁纸，HTML抓取+Referer防盗链处理
 *   6. 3G壁纸        - 手机壁纸，HTML抓取
 * 
 * 使用方法：
 *   node tools/crawler.js                    # 全部源抓取
 *   node tools/crawler.js --source=pexels    # 仅Pexels
 *   node tools/crawler.js --source=netbian   # 仅彼岸图网
 *   node tools/crawler.js --dry-run          # 只打印不写文件
 * 
 * 环境变量：
 *   PEXELS_API_KEY    - Pexels API密钥 (https://www.pexels.com/api/)
 *   UNSPLASH_API_KEY  - Unsplash API密钥 (https://unsplash.com/developers)
 *   WALLHAVEN_API_KEY - Wallhaven API密钥 (https://wallhaven.cc/settings/account)
 *   PIXABAY_API_KEY   - Pixabay API密钥 (https://pixabay.com/api/docs/)
 * 
 * 输出：remote-config.json (部署到CDN即可让小程序自动更新)
 */

const fs = require('fs');
const path = require('path');

// ============ 命令行参数 ============
const args = process.argv.slice(2);
const sourceFilter = (args.find(a => a.startsWith('--source=')) || '').split('=')[1] || '';
const dryRun = args.includes('--dry-run');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const UNSPLASH_API_KEY = process.env.UNSPLASH_API_KEY || '';
const WALLHAVEN_API_KEY = process.env.WALLHAVEN_API_KEY || '';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';

// ============ 配置 ============
const OUTPUT_FILE = path.join(__dirname, '..', 'remote-config.json');
const TEMPLATE_FILE = path.join(__dirname, '..', 'remote-config-template.json');

// 分类搜索关键词映射（各源通用）
const CATEGORY_KEYWORDS = {
  healing:       { pexels: 'sunflower flowers warm', unsplash: 'sunflower-warm', wallhaven: '010', pixabay: 'sunflower+flower', netbian: '治愈', tag3g: '治愈' },
  latenight:     { pexels: 'night sky stars city night', unsplash: 'night-city', wallhaven: '011', pixabay: 'night+city+lights', netbian: '夜景', tag3g: '夜景' },
  motivation:    { pexels: 'mountain sunrise peak climbing', unsplash: 'mountain-sunrise', wallhaven: '100', pixabay: 'mountain+sunrise', netbian: '励志', tag3g: '励志' },
  loneliness:    { pexels: 'rain alone fog empty', unsplash: 'rain-fog', wallhaven: '101', pixabay: 'rain+fog+alone', netbian: '孤独', tag3g: '孤独' },
  love:          { pexels: 'couple rose romantic love', unsplash: 'couple-romantic', wallhaven: '001', pixabay: 'couple+love+rose', netbian: '爱情', tag3g: '爱情' },
  work:          { pexels: 'desk coffee laptop office', unsplash: 'desk-coffee', wallhaven: '110', pixabay: 'desk+coffee+laptop', netbian: '职场', tag3g: '职场' },
  nature:        { pexels: 'forest lake mountain landscape', unsplash: 'forest-lake', wallhaven: '111', pixabay: 'forest+lake+mountain', netbian: '风景', tag3g: '风景' },
  minimal:       { pexels: 'minimal simple white clean', unsplash: 'minimal-white', wallhaven: '010', pixabay: 'minimal+simple+white', netbian: '简约', tag3g: '简约' },
  cyberpunk:     { pexels: 'neon cyberpunk futuristic city', unsplash: 'neon-cyberpunk', wallhaven: '010', pixabay: 'neon+cyberpunk', netbian: '赛博朋克', tag3g: '科技' },
  chinesestyle:  { pexels: 'chinese ink temple traditional', unsplash: 'chinese-temple', wallhaven: '101', pixabay: 'chinese+ink+temple', netbian: '国风', tag3g: '国风' }
};

// 每个分类期望获取的数量
const PER_CATEGORY = 15;

// ============ 通用请求函数 ============
async function fetchUrl(url, options = {}) {
  const defaultOpts = {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };
  const opts = { ...defaultOpts, ...options };
  if (options.headers) {
    opts.headers = { ...defaultOpts.headers, ...options.headers };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ============ 1. Pexels API ============
async function crawlPexels(category, keywords) {
  if (!PEXELS_API_KEY) {
    console.log('  [Pexels] 跳过 - 未设置 PEXELS_API_KEY');
    return [];
  }

  const query = keywords.pexels;
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${PER_CATEGORY}&orientation=portrait`;

  try {
    const res = await fetchUrl(url, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const wallpapers = data.photos.map(p => ({
      source: 'pexels',
      id: `pexels-${p.id}`,
      url: `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=1080`,
      thumb: `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=400`,
      width: p.width,
      height: p.height
    }));

    console.log(`  [Pexels] "${query}" 获取 ${wallpapers.length} 张`);
    return wallpapers;
  } catch (err) {
    console.warn(`  [Pexels] 失败: ${err.message}`);
    return [];
  }
}

// ============ 2. Unsplash API ============
async function crawlUnsplash(category, keywords) {
  if (!UNSPLASH_API_KEY) {
    console.log('  [Unsplash] 跳过 - 未设置 UNSPLASH_API_KEY');
    return [];
  }

  const query = keywords.unsplash;
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${PER_CATEGORY}&orientation=portrait`;

  try {
    const res = await fetchUrl(url, {
      headers: { 'Authorization': `Client-ID ${UNSPLASH_API_KEY}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const wallpapers = data.results.map(p => ({
      source: 'unsplash',
      id: `unsplash-${p.id}`,
      url: `${p.urls.raw}&w=1080&h=1920&fit=crop&fm=jpg&q=80`,
      thumb: p.urls.small,
      width: p.width,
      height: p.height
    }));

    console.log(`  [Unsplash] "${query}" 获取 ${wallpapers.length} 张`);
    return wallpapers;
  } catch (err) {
    console.warn(`  [Unsplash] 失败: ${err.message}`);
    return [];
  }
}

// ============ 3. Wallhaven API ============
async function crawlWallhaven(category, keywords) {
  const query = keywords.wallhaven;
  // categories: 100=general, 010=anime, 001=people, 110=general+anime
  // purity: 100=SFW, ratio: portrait
  const params = new URLSearchParams({
    q: keywords.pixabay,
    categories: query,
    purity: '100',
    ratios: 'portrait',
    sorting: 'relevance',
    page: 1
  });

  const headers = {};
  if (WALLHAVEN_API_KEY) {
    headers['X-API-Key'] = WALLHAVEN_API_KEY;
  }

  try {
    const res = await fetchUrl(`https://wallhaven.cc/api/v1/search?${params}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data.data) throw new Error('无数据');

    const wallpapers = data.data
      .filter(w => w.path && w.thumbs)
      .slice(0, PER_CATEGORY)
      .map(w => ({
        source: 'wallhaven',
        id: `wallhaven-${w.id}`,
        url: w.path,
        thumb: w.thumbs.small || w.thumbs.original,
        width: w.dimension_x,
        height: w.dimension_y
      }));

    console.log(`  [Wallhaven] 获取 ${wallpapers.length} 张`);
    return wallpapers;
  } catch (err) {
    console.warn(`  [Wallhaven] 失败: ${err.message}`);
    return [];
  }
}

// ============ 4. Pixabay API ============
async function crawlPixabay(category, keywords) {
  if (!PIXABAY_API_KEY) {
    console.log('  [Pixabay] 跳过 - 未设置 PIXABAY_API_KEY');
    return [];
  }

  const query = keywords.pixabay;
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=${PER_CATEGORY}&safesearch=true`;

  try {
    const res = await fetchUrl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data.hits) throw new Error('无数据');

    const wallpapers = data.hits.map(h => ({
      source: 'pixabay',
      id: `pixabay-${h.id}`,
      url: h.largeImageURL,
      thumb: h.previewURL,
      width: h.imageWidth,
      height: h.imageHeight
    }));

    console.log(`  [Pixabay] "${query}" 获取 ${wallpapers.length} 张`);
    return wallpapers;
  } catch (err) {
    console.warn(`  [Pixabay] 失败: ${err.message}`);
    return [];
  }
}

// ============ 5. 彼岸图网 (pic.netbian.com) ============
async function crawlNetbian(category, keywords) {
  const tag = keywords.netbian;
  // 彼岸图网搜索页: https://pic.netbian.com/e/search/index.php?searchid=xxx
  // 实际用分类页更稳定: https://pic.netbian.com/4kmeinv/  等
  // 手机壁纸: https://pic.netbian.com/touxiang/
  // 这里用搜索接口
  const searchUrl = `https://pic.netbian.com/e/search/index.php?keyboard=${encodeURIComponent(tag)}&show=title&tempid=1`;

  try {
    const res = await fetchUrl(searchUrl, {
      headers: {
        'Referer': 'https://pic.netbian.com/',
        'Cookie': ''
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // 提取图片: <img ... src="https://img.netbian.com/file/..." 或 /file/...
    const imgRegex = /<a\s+href="\/tupian\/(\d+)\.html"[^>]*>\s*<img[^>]*src="(https?:\/\/[^"]+|\/file\/[^"]+)"[^>]*>/g;
    const wallpapers = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null && wallpapers.length < PER_CATEGORY) {
      let imgUrl = match[2];
      if (imgUrl.startsWith('/')) {
        imgUrl = 'https://pic.netbian.com' + imgUrl;
      }
      // 缩略图转大图: _small -> 无后缀; /s_ -> /
      const fullUrl = imgUrl.replace(/_small\./, '.').replace(/\/s_/, '/');

      wallpapers.push({
        source: 'netbian',
        id: `netbian-${match[1]}`,
        url: fullUrl,
        thumb: imgUrl,
        // 注意: 彼岸图网有防盗链，需服务端代理
        needsProxy: true,
        proxyUrl: fullUrl
      });
    }

    console.log(`  [彼岸图网] "${tag}" 获取 ${wallpapers.length} 张`);
    return wallpapers;
  } catch (err) {
    console.warn(`  [彼岸图网] 失败: ${err.message}（可能需要网络代理或站点结构已变更）`);
    return [];
  }
}

// ============ 6. 3G壁纸 (www.3gbizhi.com) ============
async function crawl3G(category, keywords) {
  const tag = keywords.tag3g;
  const searchUrl = `https://www.3gbizhi.com/search/${encodeURIComponent(tag)}.html`;

  try {
    const res = await fetchUrl(searchUrl, {
      headers: { 'Referer': 'https://www.3gbizhi.com/' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // 提取壁纸详情页链接和缩略图
    const imgRegex = /<a\s+href="\/bizhi\/(\d+)\.html"[^>]*>\s*<img[^>]*src="(https?:\/\/[^"]+)"[^>]*alt="([^"]*)"/g;
    const wallpapers = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null && wallpapers.length < PER_CATEGORY) {
      const thumbUrl = match[2];
      // 3G壁纸缩略图转大图: /s_ -> / ; _290. -> _1080.
      const fullUrl = thumbUrl.replace(/\/s_/, '/').replace(/_\d+\./, '_1080.');

      wallpapers.push({
        source: '3gbizhi',
        id: `3gbizhi-${match[1]}`,
        url: fullUrl,
        thumb: thumbUrl,
        needsProxy: true,
        proxyUrl: fullUrl
      });
    }

    console.log(`  [3G壁纸] "${tag}" 获取 ${wallpapers.length} 张`);
    return wallpapers;
  } catch (err) {
    console.warn(`  [3G壁纸] 失败: ${err.message}（可能需要网络代理或站点结构已变更）`);
    return [];
  }
}

// ============ 爬取调度 ============
const CRAWLERS = {
  pexels: crawlPexels,
  unsplash: crawlUnsplash,
  wallhaven: crawlWallhaven,
  pixabay: crawlPixabay,
  netbian: crawlNetbian,
  '3gbizhi': crawl3G
};

async function crawlCategory(category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return [];

  const sources = sourceFilter ? [sourceFilter] : Object.keys(CRAWLERS);
  const allWallpapers = [];

  for (const source of sources) {
    const crawler = CRAWLERS[source];
    if (!crawler) continue;
    try {
      const wallpapers = await crawler(category, keywords);
      allWallpapers.push(...wallpapers);
    } catch (err) {
      console.warn(`  [${source}] 异常: ${err.message}`);
    }
    // 礼貌延迟，避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }

  // 按源分组去重
  const seen = new Set();
  return allWallpapers.filter(w => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
}

// ============ 主流程 ============
async function main() {
  console.log('====================================');
  console.log('  颜究生壁纸 - 多源爬虫工具');
  console.log('====================================');

  if (dryRun) console.log('  [试运行模式] 不写入文件\n');

  const sources = sourceFilter ? [sourceFilter] : Object.keys(CRAWLERS);
  console.log(`  数据源: ${sources.join(', ')}`);
  console.log(`  API Keys: Pexels=${!!PEXELS_API_KEY} Unsplash=${!!UNSPLASH_API_KEY} Wallhaven=${!!WALLHAVEN_API_KEY} Pixabay=${!!PIXABAY_API_KEY}\n`);

  // 读取模板配置
  const config = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8'));

  // 新增 wallpaperItems 字段存放完整壁纸数据（含多源URL）
  if (!config.wallpaperItems) {
    config.wallpaperItems = {};
  }

  console.log('\n开始抓取...\n');

  let totalNew = 0;
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    console.log(`\n[${category}] 抓取中...`);
    const wallpapers = await crawlCategory(category);

    if (wallpapers.length > 0) {
      // 合并到已有数据（去重）
      const existing = config.wallpaperItems[category] || [];
      const existingIds = new Set(existing.map(w => w.id));
      const newOnes = wallpapers.filter(w => !existingIds.has(w.id));
      config.wallpaperItems[category] = [...existing, ...newOnes];
      totalNew += newOnes.length;
      console.log(`  -> 新增 ${newOnes.length} 张 (总计 ${config.wallpaperItems[category].length} 张)`);
    }
  }

  // 更新版本号
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const versionParts = (config.version || '1.0.0').split('.').map(Number);
  versionParts[2] = (versionParts[2] || 0) + 1;
  config.version = versionParts.join('.');
  config.updatedAt = dateStr;
  config.lastCrawlSources = sources;

  // 统计
  console.log('\n====================================');
  console.log('  抓取完成统计');
  console.log('====================================');
  let totalAll = 0;
  const sourceStats = {};
  for (const [cat, items] of Object.entries(config.wallpaperItems)) {
    if (!Array.isArray(items)) continue; // 跳过 _note 等非数组字段
    console.log(`  ${cat}: ${items.length} 张`);
    totalAll += items.length;
    items.forEach(item => {
      sourceStats[item.source] = (sourceStats[item.source] || 0) + 1;
    });
  }
  console.log(`  ────────────────────`);
  console.log(`  总计: ${totalAll} 张 (本次新增 ${totalNew} 张)`);
  console.log(`  各源: ${Object.entries(sourceStats).map(([s, c]) => `${s}=${c}`).join(', ')}`);

  if (dryRun) {
    console.log('\n[试运行] 未写入文件');
    return;
  }

  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(config, null, 2), 'utf8');
  console.log(`\n[完成] 配置已保存: ${OUTPUT_FILE}`);
  console.log('\n部署步骤:');
  console.log('  1. 上传 remote-config.json 到CDN');
  console.log('  2. 确保 data/wallpapers.js 的 REMOTE_URL 指向该CDN地址');
  console.log('  3. 国内源(netbian/3gbizhi)的图片需配合 proxy.js 代理使用');
  console.log('  4. 小程序后台需配置图片域名白名单:');
  console.log('     - images.pexels.com (Pexels)');
  console.log('     - images.unsplash.com (Unsplash)');
  console.log('     - w.wallhaven.cc (Wallhaven)');
  console.log('     - cdn.pixabay.com (Pixabay)');
  console.log('     - 你的代理域名 (国内源)');
}

// 检查fetch支持
if (typeof fetch === 'undefined') {
  console.error('[错误] 需要Node.js 18+ 或安装 node-fetch');
  process.exit(1);
}

main().catch(err => {
  console.error('[错误]', err);
  process.exit(1);
});
