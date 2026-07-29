/**
 * 分享口令解析工具
 * 自动识别抖音、小红书、B站、微博、知乎等平台分享文本
 * 支持纯 URL 和混合分享文本两种输入
 */

// 平台识别规则
const PLATFORM_PATTERNS = {
  douyin: {
    name: '抖音',
    icon: '🎵',
    keywords: ['抖音', 'iesdouyin', 'v.douyin', 'douyin.com'],
    authorRegex: /(?:看看|打开)【(.+?)】/,
    urlRegex: /https?:\/\/[^\s]*douyin\.com[^\s]*/i,
    shareCodeRegex: /[:：]\s*\d{1,2}[ap]m\s*[\d/]+\s*([A-Za-z0-9@.:/]+)/i,
  },
  xhs: {
    name: '小红书',
    icon: '📕',
    keywords: ['小红书', 'xhslink', 'xiaohongshu'],
    authorRegex: /(?:发现|看看)【(.+?)】/,
    urlRegex: /https?:\/\/[^\s]*(?:xhslink\.com|xiaohongshu\.com)[^\s]*/i,
  },
  bilibili: {
    name: 'B站',
    icon: '📺',
    keywords: ['哔哩哔哩', 'bilibili', 'b23.tv', 'BV', 'b站'],
    authorRegex: /【(.+?)】/,
    urlRegex: /https?:\/\/[^\s]*(?:b23\.tv|bilibili\.com)[^\s]*/i,
  },
  weibo: {
    name: '微博',
    icon: '🐦',
    keywords: ['微博', 'weibo'],
    authorRegex: /【(.+?)】/,
    urlRegex: /https?:\/\/[^\s]*weibo\.[^\s]*/i,
  },
  zhihu: {
    name: '知乎',
    icon: '💭',
    keywords: ['知乎', 'zhihu'],
    authorRegex: /【(.+?)】/,
    urlRegex: /https?:\/\/[^\s]*zhihu\.com[^\s]*/i,
  },
};

// 域名→平台映射（用于纯URL检测）
const DOMAIN_MAP = {
  'douyin.com': 'douyin',
  'iesdouyin.com': 'douyin',
  'v.douyin.com': 'douyin',
  'dy.com': 'douyin',
  'xiaohongshu.com': 'xhs',
  'xhslink.com': 'xhs',
  'bilibili.com': 'bilibili',
  'b23.tv': 'bilibili',
  'bili2233.cn': 'bilibili',
  'weibo.com': 'weibo',
  'weibo.cn': 'weibo',
  'zhihu.com': 'zhihu',
};

/**
 * 判断输入是否为分享口令（而非纯URL）
 * 分享口令通常包含中文描述、平台关键词等
 */
export function isShareText(input) {
  if (!input || typeof input !== 'string') return false;
  const text = input.trim();
  // 纯URL（以http开头且无中文）
  if (/^https?:\/\/\S+$/i.test(text) && !/[\u4e00-\u9fa5]/.test(text)) {
    return false;
  }
  // 包含平台关键词 + 中文 → 分享口令
  const hasPlatformKeyword = Object.values(PLATFORM_PATTERNS).some(p =>
    p.keywords.some(kw => text.includes(kw))
  );
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  return hasPlatformKeyword || (hasChinese && text.length > 10);
}

/**
 * 从文本中检测平台
 */
export function detectPlatformFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. 先按关键词匹配（最可靠）
  for (const [key, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.keywords.some(kw => text.includes(kw) || lower.includes(kw.toLowerCase()))) {
      return key;
    }
  }

  // 2. 按URL域名匹配
  for (const [domain, platform] of Object.entries(DOMAIN_MAP)) {
    if (lower.includes(domain)) return platform;
  }

  return null;
}

/**
 * 从分享文本中提取URL
 */
export function extractUrl(text) {
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s，。、！？]*/i);
  return match ? match[0] : '';
}

/**
 * 从分享文本中提取作者名
 */
function extractAuthor(text, platform) {
  if (!text || !platform) return '';
  const pattern = PLATFORM_PATTERNS[platform];
  if (!pattern) return '';

  // 尝试匹配 【作者名】
  const match = text.match(pattern.authorRegex);
  if (match) {
    let author = match[1].trim();
    // 清理 "的作品" / "的视频" / "的笔记" 等后缀
    author = author.replace(/的(?:作品|视频|笔记|文章|微博|回答).*/, '');
    return author;
  }

  return '';
}

/**
 * 从分享文本中提取内容描述
 */
function extractDescription(text, platform) {
  if (!text) return '';
  let desc = text;

  // 移除开头的数字（如 "9.46"）
  desc = desc.replace(/^\d+(\.\d+)?\s*/, '');

  // 移除"复制打开XXX"前缀
  desc = desc.replace(/复制打开[^，,]*[，,]?/i, '');

  // 移除平台名称
  if (platform) {
    const pattern = PLATFORM_PATTERNS[platform];
    if (pattern) {
      pattern.keywords.forEach(kw => {
        desc = desc.replace(new RegExp(kw, 'gi'), '');
      });
    }
  }

  // 移除【作者名】部分
  desc = desc.replace(/【[^】]+】/g, '');

  // 移除URL
  desc = desc.replace(/https?:\/\/[^\s]*/gi, '');

  // 移除"看看"/"发现"等引导词
  desc = desc.replace(/^(看看|发现|打开)\s*/, '');

  // 移除尾部的口令码（如 ":2pm 01/03 PXM:/ A@G.VY"）
  desc = desc.replace(/[:：]\s*\d{1,2}[ap]m\s*[\d/]+\s*[A-Za-z0-9@.:/\s]*$/i, '');

  // 移除尾部的纯字母数字口令（如 "v.douyin.com/xxxxx" 或随机字符）
  desc = desc.replace(/\s+[A-Za-z0-9@.:/]{5,}\s*$/i, '');

  // 清理多余空格和标点
  desc = desc.replace(/\s+/g, ' ').replace(/^[，,、\s]+|[，,、\s]+$/g, '').trim();

  return desc;
}

/**
 * 从分享文本中提取分享口令码
 */
function extractShareCode(text, platform) {
  if (!text) return '';
  const pattern = PLATFORM_PATTERNS[platform];
  if (!pattern || !pattern.shareCodeRegex) return '';

  const match = text.match(pattern.shareCodeRegex);
  return match ? match[1] : '';
}

/**
 * 从描述中生成简短标题（截取前一句或前20字）
 */
function generateTitle(description, author, platformName) {
  if (!description) {
    if (author) return `${platformName || ''} - ${author}`.trim();
    return '';
  }
  // 取第一个句子（按！？。！？分割）
  const firstSentence = description.split(/[！？。!?\n]/)[0].trim();
  if (firstSentence.length <= 20) return firstSentence;
  // 超过20字截断
  return firstSentence.slice(0, 20) + '...';
}

/**
 * 解析分享文本，返回结构化信息
 *
 * @param {string} input - 用户输入的分享文本或URL
 * @returns {object|null} 解析结果，包含 platform, author, title, summary, url, shareCode, rawText, isShareText
 */
export function parseShareText(input) {
  if (!input || typeof input !== 'string') return null;

  const text = input.trim();
  if (!text) return null;

  const platform = detectPlatformFromText(text);
  const url = extractUrl(text);
  const isShare = isShareText(text);

  // 纯URL且无法识别平台
  if (!platform && !isShare) {
    return {
      platform: 'webpage',
      platformName: '网页',
      platformIcon: '🔗',
      author: '',
      title: '',
      summary: '',
      url: url || text,
      shareCode: '',
      rawText: text,
      isShareText: false,
    };
  }

  // 无法识别平台但有分享文本特征
  if (!platform) {
    const desc = extractDescription(text, null);
    return {
      platform: 'webpage',
      platformName: '网页',
      platformIcon: '🔗',
      author: '',
      title: generateTitle(desc, '', '网页'),
      summary: desc,
      url,
      shareCode: '',
      rawText: text,
      isShareText: true,
    };
  }

  const pattern = PLATFORM_PATTERNS[platform];
  const author = extractAuthor(text, platform);
  const description = extractDescription(text, platform);
  const shareCode = extractShareCode(text, platform);

  return {
    platform,
    platformName: pattern.name,
    platformIcon: pattern.icon,
    author,
    title: generateTitle(description, author, pattern.name),
    summary: description,
    url,
    shareCode,
    rawText: text,
    isShareText: isShare,
  };
}

/**
 * 根据解析结果生成AI标签
 */
export function generateTagsFromParse(parsed) {
  if (!parsed) return ['收藏'];
  const tags = new Set();
  const text = `${parsed.title || ''} ${parsed.summary || ''} ${parsed.author || ''}`.toLowerCase();

  // 平台标签
  if (parsed.platform && parsed.platform !== 'webpage') {
    tags.add(parsed.platformName);
  }

  // 内容类型标签
  const typeKeywords = {
    '教程': ['教程', '教学', '怎么', '如何', '攻略', '指南', '入门'],
    '干货': ['干货', '技巧', '方法', '经验', '总结', '分享'],
    '灵感': ['灵感', '创意', '想法', 'idea', '设计'],
    '运营': ['运营', '涨粉', '变现', '流量', '账号', '起号', '自媒体'],
    '剪辑': ['剪辑', '剪映', '转场', '特效', '调色'],
    '文案': ['文案', '标题', '脚本', '话术'],
    '美食': ['美食', '做饭', '烹饪', '食谱'],
    '旅行': ['旅行', '旅游', '攻略', '打卡', '风景'],
    '穿搭': ['穿搭', '时尚', 'ootd', '搭配'],
    '健身': ['健身', '运动', '减肥', '减脂', '训练'],
    '职场': ['职场', '工作', '面试', '简历', '升职'],
    '理财': ['理财', '投资', '基金', '股票', '存钱'],
    '收藏夹': ['收藏夹', '收藏', '整理'],
  };

  for (const [tag, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.add(tag);
    }
  }

  if (tags.size === 0) tags.add('收藏');
  return Array.from(tags).slice(0, 5);
}

export default { parseShareText, isShareText, detectPlatformFromText, extractUrl, generateTagsFromParse };
