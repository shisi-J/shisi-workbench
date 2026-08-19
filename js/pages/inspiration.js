/**
 * 灵感库页面 - 全网链接灵感收藏
 * 链接录入 + AI自动解析 + 自动打标签 + 语音备注 + 卡片展示 + 检索筛选 + 导出
 */

import { getAll, add, update, remove } from '../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../utils/attachments.js';
import { parseShareText, isShareText, generateTagsFromParse } from '../utils/shareParser.js';

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 平台配置
const PLATFORMS = {
  bilibili: { name: 'B站', icon: '📺', class: 'bilibili', domains: ['bilibili.com', 'b23.tv', 'bili2233.cn', 'm.bilibili.com'] },
  douyin: { name: '抖音', icon: '🎵', class: 'douyin', domains: ['douyin.com', 'iesdouyin.com', 'v.douyin.com', 'dy.com', 'amemv.com'] },
  xhs: { name: '小红书', icon: '📕', class: 'xhs', domains: ['xiaohongshu.com', 'xhslink.com', 'm.xiaohongshu.com'] },
  weibo: { name: '微博', icon: '🐦', class: 'xhs', domains: ['weibo.com', 'weibo.cn', 'm.weibo.cn'] },
  zhihu: { name: '知乎', icon: '💭', class: 'bilibili', domains: ['zhihu.com', 'zhuanlan.zhihu.com'] },
  taobao: { name: '淘宝', icon: '🛒', class: 'xhs', domains: ['taobao.com', 'tmall.com', 'm.taobao.com'] },
  jdping: { name: '京东', icon: '📦', class: 'bilibili', domains: ['jd.com', 'm.jd.com'] },
  webpage: { name: '网页', icon: '🔗', class: 'xhs', domains: [] },
};

// 识别平台 - 改进检测逻辑
function detectPlatform(url) {
  const lower = (url || '').toLowerCase().trim();
  if (!lower) return 'webpage';

  // 先尝试通过域名匹配
  for (const [key, config] of Object.entries(PLATFORMS)) {
    if (key === 'webpage') continue;
    if (config.domains.some(d => lower.includes(d))) return key;
  }

  // 通过特征关键词匹配
  if (lower.includes('bilibili') || lower.includes('/bv') || lower.includes('/av')) return 'bilibili';
  if (lower.includes('douyin') || lower.includes('dy') || lower.includes('iesdouyin')) return 'douyin';
  if (lower.includes('xiaohongshu') || lower.includes('xhs') || lower.includes('小红书')) return 'xhs';

  return 'webpage';
}

// 从URL提取视频/内容ID（用于生成占位封面）
function extractContentId(url, platform) {
  try {
    const lower = url.toLowerCase();
    if (platform === 'bilibili') {
      const match = lower.match(/\/video\/(bv\w+)/i)
        || lower.match(/b23\.tv\/(\w+)/i)
        || lower.match(/[?&]bvid=(bv\w+)/i)
        || lower.match(/\/bv(\w+)/i);
      return match ? match[1] : '';
    }
    if (platform === 'douyin') {
      const match = lower.match(/\/video\/(\d+)/i)
        || lower.match(/\/(\d{15,})\b/i)
        || lower.match(/modal_id=(\d+)/i);
      return match ? match[1] : '';
    }
    if (platform === 'xhs') {
      const match = lower.match(/\/explore\/(\w+)/i)
        || lower.match(/\/discovery\/item\/(\w+)/i)
        || lower.match(/\/item\/(\w+)/i)
        || lower.match(/xhslink\.com\/(\w+)/i);
      return match ? match[1] : '';
    }
  } catch (e) {}
  return '';
}

// 生成占位封面URL
function generatePlaceholderCover(platform, contentId) {
  const gradients = {
    bilibili: 'linear-gradient(135deg, #FB7299, #E45A82)',
    douyin: 'linear-gradient(135deg, #25F4EE, #FE2C55)',
    xhs: 'linear-gradient(135deg, #FF2442, #FF6B81)',
    weibo: 'linear-gradient(135deg, #E6162D, #FF8200)',
    webpage: 'linear-gradient(135deg, #C77DFF, #7B2CBF)',
  };
  return gradients[platform] || gradients.webpage;
}

// AI生成标签（基于标题和摘要的简单关键词提取）
function generateAITags(title, summary, platform) {
  const tags = new Set();
  const text = `${title} ${summary}`.toLowerCase();

  // 平台标签
  if (platform && platform !== 'webpage') {
    tags.add(PLATFORMS[platform].name);
  }

  // 内容类型标签
  const typeKeywords = {
    '教程': ['教程', '教学', '怎么', '如何', '攻略', '指南', '入门', '详解'],
    '干货': ['干货', '技巧', '方法', '经验', '总结', '分享'],
    '灵感': ['灵感', '创意', '想法', 'idea', '设计'],
    '运营': ['运营', '涨粉', '变现', '流量', '账号', '起号'],
    '剪辑': ['剪辑', '剪映', '转场', '特效', '调色'],
    '文案': ['文案', '标题', '脚本', '话术'],
    '美食': ['美食', '做饭', '烹饪', '食谱', '好吃'],
    '旅行': ['旅行', '旅游', '攻略', '打卡', '风景'],
    '穿搭': ['穿搭', '时尚', 'ootd', '搭配'],
    '健身': ['健身', '运动', '减肥', '减脂', '训练'],
    '职场': ['职场', '工作', '面试', '简历', '升职'],
    '理财': ['理财', '投资', '基金', '股票', '存钱'],
  };

  for (const [tag, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.add(tag);
    }
  }

  // 如果没有匹配到任何标签，添加通用标签
  if (tags.size === 0) {
    tags.add('收藏');
  }

  return Array.from(tags).slice(0, 5);
}

// 语音识别支持检测
function isSpeechSupported() {
  return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
}

export default class InspirationPage {
  constructor({ container }) {
    this.container = container;
    this.inspirations = [];
    this.searchKeyword = '';
    this.filterTag = null;
    this.allTags = [];
    this.recognition = null;
    this.isRecording = false;
  }

  async render() {
    try {
      this.inspirations = await getAll('inspirations');
      this.inspirations.sort((a, b) => {
        const fa = a.favorite ? 1 : 0;
        const fb = b.favorite ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    } catch (e) {
      this.inspirations = [];
    }

    // 收集所有标签
    this.allTags = [...new Set(this.inspirations.flatMap(i => i.tags || []))].sort();

    // 检查是否有分享数据待导入
    const pendingShare = sessionStorage.getItem('pendingShare');
    if (pendingShare) {
      sessionStorage.removeItem('pendingShare');
      const shareData = JSON.parse(pendingShare);
      // 延迟显示导入弹窗，等页面渲染完成
      setTimeout(() => this.showImportModal(shareData), 300);
    }

    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  getHTML() {
    const filtered = this.getFiltered();

    return `
      <div class="inspiration-page">
        <div class="page-header">
          <div class="page-title">💡 灵感库</div>
          <div class="page-subtitle">全网链接收藏，共 ${this.inspirations.length} 条灵感</div>
        </div>

        <!-- 链接录入区 -->
        <div class="inspiration-input-area">
          <div class="inspiration-input-row">
            <input type="text" class="form-input" id="urlInput" placeholder="粘贴分享口令/链接（支持抖音/小红书/B站等）..." style="flex: 1;">
            <button class="btn btn-secondary btn-sm" id="pasteBtn" title="读取剪贴板">📋</button>
            <button class="btn btn-primary btn-sm" id="parseBtn">解析</button>
          </div>
          <div id="parseResult" style="display: none;"></div>
        </div>

        <!-- 搜索与筛选 -->
        <div class="inspiration-search-row">
          <input type="text" class="form-input" id="searchInput" placeholder="搜索标题、标签、备注..." value="${this.searchKeyword}">
        </div>

        ${this.allTags.length > 0 ? `
          <div class="filter-bar">
            <div class="filter-chip ${!this.filterTag ? 'active' : ''}" data-tag-filter="">全部</div>
            ${this.allTags.map(tag => `
              <div class="filter-chip ${this.filterTag === tag ? 'active' : ''}" data-tag-filter="${tag}">${tag}</div>
            `).join('')}
          </div>
        ` : ''}

        <!-- 导出按钮 -->
        ${this.inspirations.length > 0 ? `
          <div class="inspiration-export-row">
            <button class="btn btn-outline btn-sm" id="exportMd">📝 导出Markdown</button>
            <button class="btn btn-outline btn-sm" id="exportExcel">📊 导出Excel</button>
          </div>
        ` : ''}

        <!-- 灵感卡片列表 -->
        <div id="inspirationList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">💡</div>
              <div class="empty-text">${this.inspirations.length === 0 ? '还没有收藏灵感<br>粘贴链接开始收藏吧' : '没有匹配的灵感'}</div>
            </div>
          ` : filtered.map(item => this.renderCard(item)).join('')}
        </div>
      </div>
    `;
  }

  renderCard(item) {
    const platform = PLATFORMS[item.platform] || PLATFORMS.webpage;
    const cover = item.cover || generatePlaceholderCover(item.platform, '');
    const isGradient = cover.startsWith('linear-gradient');
    const tags = item.tags || [];
    // 转义URL中的特殊字符，防止HTML属性断裂
    const safeUrl = (item.url || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    return `
      <div class="inspiration-card" data-id="${item.id}">
        <div class="inspiration-card-thumb" style="${isGradient ? `background: ${cover};` : ''}">
          ${!isGradient ? `<img src="${cover}" alt="${item.title || ''}" onerror="this.style.display='none'; this.parentElement.style.background='${generatePlaceholderCover(item.platform, '')}';">` : ''}
          <div class="inspiration-card-platform">
            <span class="platform-badge ${platform.class}">${platform.icon}</span>
          </div>
          ${item.favorite ? '<div class="inspiration-card-fav">⭐</div>' : ''}
        </div>
        <div class="inspiration-card-body">
          <div class="inspiration-card-title">${item.title || '未命名灵感'}</div>
          ${item.author ? `<div class="inspiration-card-author">👤 ${item.author}</div>` : ''}
          ${item.summary ? `<div class="inspiration-card-summary">${item.summary}</div>` : ''}
          ${tags.length > 0 ? `
            <div class="inspiration-card-tags">
              ${tags.map(t => `<span class="tag tag-brand">${t}</span>`).join('')}
            </div>
          ` : ''}
          ${item.notes ? `<div class="inspiration-card-note">📝 ${item.notes}</div>` : ''}
          ${renderAttachmentList(item.attachments, item.id)}
          <div class="inspiration-card-footer">
            ${item.url ? `<button class="btn btn-sm btn-primary" data-action="open" data-url="${safeUrl}">🔗 打开</button>` : ''}
            <button class="btn btn-sm btn-outline" data-action="detail" data-id="${item.id}">详情</button>
            <div style="flex:1;"></div>
            <button class="btn btn-sm btn-outline" data-action="edit" data-id="${item.id}">✏️</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}">🗑</button>
          </div>
        </div>
      </div>
    `;
  }

  getFiltered() {
    let filtered = [...this.inspirations];

    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title || '').toLowerCase().includes(kw) ||
        (i.summary || '').toLowerCase().includes(kw) ||
        (i.notes || '').toLowerCase().includes(kw) ||
        (i.tags || []).some(t => t.toLowerCase().includes(kw))
      );
    }

    if (this.filterTag) {
      filtered = filtered.filter(i => (i.tags || []).includes(this.filterTag));
    }

    return filtered;
  }

  bindEvents() {
    // 链接录入
    document.getElementById('parseBtn')?.addEventListener('click', () => {
      const url = document.getElementById('urlInput').value.trim();
      if (url) this.parseUrl(url);
    });

    document.getElementById('urlInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const url = e.target.value.trim();
        if (url) this.parseUrl(url);
      }
    });

    // 输入框实时检测分享口令
    let inputTimer = null;
    document.getElementById('urlInput')?.addEventListener('input', (e) => {
      clearTimeout(inputTimer);
      const text = e.target.value.trim();
      if (!text) {
        document.getElementById('parseResult').style.display = 'none';
        return;
      }
      // 防抖：输入停止300ms后检测
      inputTimer = setTimeout(() => {
        if (isShareText(text)) {
          this.showShareParseResult(text);
        }
      }, 300);
    });

    // 粘贴按钮 - 智能识别剪贴板内容
    document.getElementById('pasteBtn')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const trimmed = text.trim();
          document.getElementById('urlInput').value = trimmed;
          // 智能识别：分享口令→自动解析，纯链接→直接填入
          if (isShareText(trimmed)) {
            this.showShareParseResult(trimmed);
          } else {
            // 纯链接，直接解析
            this.parseUrl(trimmed);
          }
        } else {
          window.showToast('剪贴板为空');
        }
      } catch (e) {
        window.showToast('请手动粘贴链接');
      }
    });

    // 搜索
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      const filtered = this.getFiltered();
      const list = document.getElementById('inspirationList');
      list.innerHTML = filtered.length === 0
        ? '<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-text">没有匹配的灵感</div></div>'
        : filtered.map(item => this.renderCard(item)).join('');
      this.bindCardEvents();
    });

    // 标签筛选
    document.querySelectorAll('[data-tag-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterTag = chip.getAttribute('data-tag-filter') || null;
        this.render();
      });
    });

    // 导出
    document.getElementById('exportMd')?.addEventListener('click', () => this.exportMarkdown());
    document.getElementById('exportExcel')?.addEventListener('click', () => this.exportExcel());

    // 卡片事件
    this.bindCardEvents();
  }

  bindCardEvents() {
    // 卡片点击编辑
    document.querySelectorAll('.inspiration-card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // 排除按钮/链接点击
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const item = this.inspirations.find(i => i.id === id);
        if (item) this.showEditModal(item);
      });
      card.style.cursor = 'pointer';
    });

    // 打开链接 - 在用户点击事件中同步调用 window.open
    document.querySelectorAll('[data-action="open"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const rawUrl = el.getAttribute('data-url') || '';
        // 解码HTML实体
        const url = rawUrl.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
        if (url) {
          // 确保URL有协议前缀
          const fullUrl = url.startsWith('http') ? url : 'https://' + url;
          const newTab = window.open(fullUrl, '_blank', 'noopener,noreferrer');
          if (!newTab) {
            // 如果被拦截，尝试 location.href
            window.location.href = fullUrl;
          }
        } else {
          window.showToast('无效链接');
        }
      });
    });

    // 详情
    document.querySelectorAll('[data-action="detail"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const item = this.inspirations.find(i => i.id === id);
        if (item) this.showDetailModal(item);
      });
    });

    // 编辑
    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const item = this.inspirations.find(i => i.id === id);
        if (item) this.showEditModal(item);
      });
    });

    // 删除
    document.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        await remove('inspirations', id);
        await this.render();
        window.showToast('已删除');
      });
    });

    // 附件点击：预览/下载
    bindCardAttachmentClicks(this.inspirations);
  }

  // === 链接解析 ===

  async parseUrl(url) {
    const resultDiv = document.getElementById('parseResult');
    const platform = detectPlatform(url);
    const contentId = extractContentId(url, platform);
    const platformConfig = PLATFORMS[platform];

    // 显示解析中状态
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div class="parse-loading">
        <div class="loading-spinner"></div>
        <span>正在解析链接... ${platformConfig.icon} ${platformConfig.name}</span>
      </div>
    `;

    try {
      // 降级方案：根据平台生成信息
      let metaData = {
        title: '',
        author: '',
        cover: '',
        summary: '',
      };

      if (platform === 'bilibili') {
        metaData.title = contentId ? `B站视频 ${contentId.toUpperCase()}` : 'B站视频';
        metaData.cover = generatePlaceholderCover(platform, contentId);
        metaData.summary = '来自Bilibili的视频内容，点击打开查看详情';
      } else if (platform === 'douyin') {
        metaData.title = contentId ? `抖音视频 ${contentId}` : '抖音视频';
        metaData.cover = generatePlaceholderCover(platform, contentId);
        metaData.summary = '来自抖音的短视频内容，点击打开查看详情';
      } else if (platform === 'xhs') {
        metaData.title = contentId ? `小红书笔记 ${contentId}` : '小红书笔记';
        metaData.cover = generatePlaceholderCover(platform, contentId);
        metaData.summary = '来自小红书的图文/视频笔记，点击打开查看详情';
      } else if (platform === 'weibo') {
        metaData.title = '微博内容';
        metaData.cover = generatePlaceholderCover(platform, '');
        metaData.summary = '来自微博的内容，点击打开查看详情';
      } else if (platform === 'zhihu') {
        metaData.title = contentId ? `知乎文章 ${contentId}` : '知乎内容';
        metaData.cover = generatePlaceholderCover(platform, '');
        metaData.summary = '来自知乎的文章/回答，点击打开查看详情';
      } else {
        // 普通网页：提取域名和路径信息
        let domain = '';
        let pathInfo = '';
        try {
          const urlObj = new URL(url);
          domain = urlObj.hostname.replace('www.', '').replace('m.', '');
          // 提取路径中有意义的部分
          const pathParts = urlObj.pathname.split('/').filter(p => p && !p.match(/^\d+$/));
          if (pathParts.length > 0) {
            pathInfo = ' · ' + decodeURIComponent(pathParts[pathParts.length - 1]).replace(/[-_]/g, ' ');
          }
        } catch (e) {
          domain = '网页';
        }
        metaData.title = domain + pathInfo;
        metaData.cover = generatePlaceholderCover('webpage', '');
        metaData.summary = `来自 ${domain} 的网页内容`;
      }

      // AI自动生成标签
      const aiTags = generateAITags(metaData.title, metaData.summary, platform);

      // 直接弹出编辑弹窗
      resultDiv.innerHTML = '';
      resultDiv.style.display = 'none';

      this.showAddModal({
        url,
        platform,
        title: metaData.title,
        author: metaData.author,
        cover: metaData.cover,
        summary: metaData.summary,
        tags: aiTags,
      });

    } catch (e) {
      // 解析失败也不报错，直接让用户手动填写
      resultDiv.innerHTML = '';
      resultDiv.style.display = 'none';
      this.showAddModal({
        url,
        platform,
        title: '',
        author: '',
        cover: generatePlaceholderCover(platform, ''),
        summary: '',
        tags: [],
      });
      window.showToast('链接解析降级，请手动补充信息');
    }
  }

  // === 分享口令解析结果显示 ===

  showShareParseResult(text) {
    const parsed = parseShareText(text);
    if (!parsed) return;

    const resultDiv = document.getElementById('parseResult');
    resultDiv.style.display = 'block';

    // 构建绿色解析结果卡片
    resultDiv.innerHTML = `
      <div class="share-parse-card">
        <div class="share-parse-header">
          <span class="share-parse-platform">${parsed.platformIcon} ${parsed.platformName}</span>
          <span class="share-parse-badge">✅ 已识别</span>
        </div>
        ${parsed.author ? `<div class="share-parse-row"><span class="share-parse-label">👤 作者</span><span class="share-parse-value">${parsed.author}</span></div>` : ''}
        ${parsed.title ? `<div class="share-parse-row"><span class="share-parse-label">📌 标题</span><span class="share-parse-value">${parsed.title}</span></div>` : ''}
        ${parsed.summary ? `<div class="share-parse-row"><span class="share-parse-label">📝 摘要</span><span class="share-parse-value">${parsed.summary}</span></div>` : ''}
        ${parsed.url ? `<div class="share-parse-row"><span class="share-parse-label">🔗 链接</span><span class="share-parse-value share-parse-url">${parsed.url}</span></div>` : ''}
        <div class="share-parse-actions">
          <button class="btn btn-primary btn-sm" id="applyParseBtn">应用解析结果</button>
          <button class="btn btn-outline btn-sm" id="dismissParseBtn">忽略</button>
        </div>
      </div>
    `;

    // 应用解析结果
    document.getElementById('applyParseBtn')?.addEventListener('click', () => {
      const aiTags = generateTagsFromParse(parsed);
      resultDiv.innerHTML = '';
      resultDiv.style.display = 'none';
      document.getElementById('urlInput').value = '';

      this.showAddModal({
        url: parsed.url || parsed.rawText,
        platform: parsed.platform !== 'webpage' ? parsed.platform : detectPlatform(parsed.url || ''),
        title: parsed.title || (parsed.author ? `${parsed.platformName} - ${parsed.author}` : ''),
        author: parsed.author,
        cover: generatePlaceholderCover(parsed.platform !== 'webpage' ? parsed.platform : 'webpage', ''),
        summary: parsed.summary || '',
        tags: aiTags,
        notes: '',
      });
      window.showToast(`✅ 已解析：${parsed.platformIcon} ${parsed.platformName} · ${parsed.author || '未知作者'}`);
    });

    // 忽略
    document.getElementById('dismissParseBtn')?.addEventListener('click', () => {
      resultDiv.innerHTML = '';
      resultDiv.style.display = 'none';
    });
  }

  // === 添加/编辑弹窗 ===

  showAddModal(data) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    const platformConfig = PLATFORMS[data.platform] || PLATFORMS.webpage;
    const cover = data.cover || generatePlaceholderCover(data.platform, '');
    const isGradient = cover.startsWith('linear-gradient');
    const isEdit = !!data.id;

    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">收藏灵感</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>

        <!-- 封面预览 -->
        <div class="inspiration-preview-cover" style="${isGradient ? `background: ${cover};` : ''}">
          ${!isGradient ? `<img src="${cover}" alt="封面" onerror="this.style.display='none'; this.parentElement.style.background='${generatePlaceholderCover(data.platform, '')}';">` : ''}
          <span class="platform-badge ${platformConfig.class}">${platformConfig.icon} ${platformConfig.name}</span>
        </div>

        <div class="form-group">
          <label class="form-label">链接</label>
          <input type="url" class="form-input" id="inspUrl" value="${data.url || ''}" placeholder="链接地址">
        </div>
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input" id="inspTitle" value="${data.title || ''}" placeholder="灵感标题" autofocus>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">平台</label>
            <select class="form-select" id="inspPlatform">
              ${Object.entries(PLATFORMS).map(([key, p]) => `
                <option value="${key}" ${data.platform === key ? 'selected' : ''}>${p.icon} ${p.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">作者</label>
            <input type="text" class="form-input" id="inspAuthor" value="${data.author || ''}" placeholder="作者/UP主">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">封面链接（选填）</label>
          <input type="url" class="form-input" id="inspCover" value="${isGradient ? '' : cover}" placeholder="封面图片URL">
        </div>
        <div class="form-group">
          <label class="form-label">内容摘要</label>
          <textarea class="form-textarea" id="inspSummary" placeholder="内容摘要..." style="min-height: 60px;">${data.summary || ''}</textarea>
        </div>

        <!-- AI标签区 -->
        <div class="form-group">
          <label class="form-label">
            标签
            <button class="btn btn-sm btn-outline" id="aiTagBtn" style="margin-left: var(--space-2); padding: 2px 8px; font-size: var(--font-xs);">🤖 AI生成</button>
          </label>
          <div class="tag-suggestions" id="tagSuggestions">
            ${(data.tags || []).map(t => `<span class="tag-suggestion selected" data-tag-name="${t}">${t}</span>`).join('')}
          </div>
          <input type="text" class="form-input" id="inspTags" value="${(data.tags || []).join(',')}" placeholder="标签（逗号分隔）" style="margin-top: var(--space-2);">
        </div>

        <!-- 备注区 + 语音输入 -->
        <div class="form-group">
          <label class="form-label">
            灵感备注
            ${isSpeechSupported() ? `<button class="btn btn-sm btn-outline" id="voiceBtn" style="margin-left: var(--space-2); padding: 2px 8px; font-size: var(--font-xs);">🎤 语音输入</button>` : ''}
          </label>
          <textarea class="form-textarea" id="inspNotes" placeholder="记录你此刻的想法..." style="min-height: 80px;">${data.notes || ''}</textarea>
          ${isSpeechSupported() ? '<div class="voice-hint" id="voiceHint" style="display: none;">正在聆听... 点击停止</div>' : ''}
        </div>

        <div class="form-group">
          <div id="favToggle" data-fav="${data.favorite ? '1' : '0'}" style="display: flex; align-items: center; gap: 8px; padding: 10px var(--space-2); background: var(--bg-inset); border-radius: var(--radius-xs); cursor: pointer; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
            <span id="favBox" style="width: 22px; height: 22px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: ${data.favorite ? 'var(--brand)' : 'transparent'}; border-color: ${data.favorite ? 'var(--brand)' : 'var(--border-default)'}; color: var(--text-inverse); font-size: 14px; line-height: 1;">${data.favorite ? '✓' : ''}</span>
            <span style="font-size: var(--font-sm); flex: 1;">⭐ 收藏置顶</span>
          </div>
        </div>

        <!-- 同步到其他模块 -->
        ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">同步到其他模块（选填）</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: var(--space-2); background: var(--bg-inset); border-radius: var(--radius-xs);">
            <div class="sync-toggle" data-target="learn-ai" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🤖 学习AI
            </div>
            <div class="sync-toggle" data-target="learn-english" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🔤 学习英语
            </div>
            <div class="sync-toggle" data-target="learn-media" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              📱 新媒体
            </div>
            <div class="sync-toggle" data-target="learn-expression" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              📖 学习表达
            </div>
            <div class="sync-toggle" data-target="podcast" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🎙️ 播客
            </div>
            <div class="sync-toggle" data-target="insight" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🧠 感悟输出
            </div>
            <div class="sync-toggle" data-target="life-fitness" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              💪 健身打卡
            </div>
            <div class="sync-toggle" data-target="life-eat" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🍽️ 美食探店
            </div>
            <div class="sync-toggle" data-target="life-beauty" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              💄 美妆穿搭
            </div>
            <div class="sync-toggle" data-target="life-travel" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              ✈️ 行程游记
            </div>
            <div class="sync-toggle" data-target="life-home" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🏠 小屋
            </div>
            <div class="sync-toggle" data-target="life-social" data-checked="0" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); padding: 8px; border-radius: var(--radius-xs); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;">
              <span class="sync-box" style="width: 18px; height: 18px; border: 2px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; line-height: 1; color: var(--text-inverse);"></span>
              🤝 社交
            </div>
          </div>
        </div>
        ` : ''}

        ${renderUploadField(data.attachments || [])}
        <button class="btn btn-primary btn-block" id="saveInsp">保存灵感</button>
      </div>
    `;
    document.body.appendChild(modal);

    const getAttachments = initUploadHandlers(modal, data.attachments || []);
    modal._getAttachments = getAttachments;

    const close = () => {
      this.stopVoiceInput();
      modal.remove();
    };
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // 标签管理
    const tagsInput = document.getElementById('inspTags');
    let selectedTags = new Set(data.tags || []);

    const updateTagsInput = () => {
      tagsInput.value = Array.from(selectedTags).join(',');
    };

    const renderTagSuggestions = () => {
      const container = document.getElementById('tagSuggestions');
      container.innerHTML = Array.from(selectedTags).map(t =>
        `<span class="tag-suggestion selected" data-tag-name="${t}">${t}</span>`
      ).join('');
      container.querySelectorAll('.tag-suggestion').forEach(tag => {
        tag.addEventListener('click', () => {
          const tagName = tag.getAttribute('data-tag-name');
          selectedTags.delete(tagName);
          renderTagSuggestions();
          updateTagsInput();
        });
      });
    };

    renderTagSuggestions();

    // 手动输入标签同步
    tagsInput.addEventListener('blur', () => {
      const tags = tagsInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      selectedTags = new Set(tags);
      renderTagSuggestions();
    });

    // AI生成标签
    document.getElementById('aiTagBtn')?.addEventListener('click', () => {
      const title = document.getElementById('inspTitle').value.trim();
      const summary = document.getElementById('inspSummary').value.trim();
      const platform = document.getElementById('inspPlatform').value;
      if (!title && !summary) {
        window.showToast('请先填写标题或摘要');
        return;
      }
      const aiTags = generateAITags(title, summary, platform);
      aiTags.forEach(t => selectedTags.add(t));
      renderTagSuggestions();
      updateTagsInput();
      window.showToast(`✅ AI生成了 ${aiTags.length} 个标签`);
    });

    // 语音输入
    document.getElementById('voiceBtn')?.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopVoiceInput();
      } else {
        this.startVoiceInput(modal);
      }
    });

    // 收藏置顶切换（用 click 事件，不用原生 checkbox）
    document.getElementById('favToggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const toggle = e.currentTarget;
      const box = document.getElementById('favBox');
      const isFav = toggle.dataset.fav === '1';
      const newState = !isFav;
      toggle.dataset.fav = newState ? '1' : '0';
      if (newState) {
        box.style.background = 'var(--brand)';
        box.style.borderColor = 'var(--brand)';
        box.textContent = '✓';
      } else {
        box.style.background = 'transparent';
        box.style.borderColor = 'var(--border-default)';
        box.textContent = '';
      }
    });

    // 同步模块切换
    modal.querySelectorAll('.sync-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const box = el.querySelector('.sync-box');
        const isChecked = el.dataset.checked === '1';
        const newState = !isChecked;
        el.dataset.checked = newState ? '1' : '0';
        if (newState) {
          box.style.background = 'var(--brand)';
          box.style.borderColor = 'var(--brand)';
          box.textContent = '✓';
          el.style.background = 'var(--brand)15';
        } else {
          box.style.background = 'transparent';
          box.style.borderColor = 'var(--border-default)';
          box.textContent = '';
          el.style.background = '';
        }
      });
    });

    // 保存
    document.getElementById('saveInsp').addEventListener('click', async () => {
      const url = document.getElementById('inspUrl').value.trim();
      const title = document.getElementById('inspTitle').value.trim();
      if (!url && !title) {
        window.showToast('请输入链接或标题');
        return;
      }

      const platform = document.getElementById('inspPlatform').value;
      const coverInput = document.getElementById('inspCover').value.trim();
      const tags = tagsInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);

      const record = {
        url,
        title: title || '未命名灵感',
        platform,
        author: document.getElementById('inspAuthor').value.trim(),
        cover: coverInput || generatePlaceholderCover(platform, ''),
        summary: document.getElementById('inspSummary').value.trim(),
        tags,
        notes: document.getElementById('inspNotes').value.trim(),
        favorite: document.getElementById('favToggle').dataset.fav === '1',
        attachments: getAttachments(),
      };

      await add('inspirations', record);

      // 同步到其他选中模块
      const syncTargets = modal.querySelectorAll('.sync-toggle[data-checked="1"]');
      for (const cb of syncTargets) {
        const target = cb.getAttribute('data-target');
        try {
          if (target.startsWith('learn-')) {
            const cat = target.replace('learn-', '');
            await add('learnings', {
              url: url,
              title: title || '未命名灵感',
              platform: platform,
              cover: coverInput || generatePlaceholderCover(platform, ''),
              description: document.getElementById('inspSummary').value.trim(),
              notes: document.getElementById('inspNotes').value.trim(),
              tags: tags,
              category: cat,
              checked: false,
            });
          } else if (target === 'podcast') {
            await add('podcasts', {
              url: url,
              title: title || '未命名灵感',
              platform: platform,
              cover: coverInput || generatePlaceholderCover(platform, ''),
              description: document.getElementById('inspSummary').value.trim(),
              notes: '',
              type: '对话',
              duration: '',
              checked: false,
            });
          } else if (target === 'insight') {
            await add('insights', {
              title: title || '未命名灵感',
              content: document.getElementById('inspSummary').value.trim() || document.getElementById('inspNotes').value.trim(),
              sourceType: 'inspiration',
              sourceTitle: title || '未命名灵感',
              sourceUrl: url,
              outputType: 'idea',
              tags: tags,
            });
          } else if (target.startsWith('life-')) {
            const cat = target.replace('life-', '');
            const videoPlatform = platform === 'bilibili' ? 'bilibili'
              : platform === 'douyin' ? 'douyin'
              : platform === 'xhs' ? 'xhs'
              : 'none';
            await add('lifeRecords', {
              title: title || '未命名灵感',
              fields: {
                title: title || '未命名灵感',
                videoUrl: url,
                videoPlatform,
                trainType: '跟练视频',
                remark: document.getElementById('inspSummary').value.trim(),
              },
              category: cat,
            });
          }
        } catch (e) {}
      }

      const syncCount = syncTargets.length;
      close();
      await this.render();
      window.showToast(syncCount > 0 ? `✅ 灵感已收藏，同步到 ${syncCount} 个模块` : '✅ 灵感已收藏');
    });
  }

  // === 导入分享内容弹窗 ===

  showImportModal(shareData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📥 导入分享内容</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">链接</label>
          <input type="url" class="form-input" id="importUrl" value="${shareData.url || ''}" placeholder="链接">
        </div>
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input" id="importTitle" value="${shareData.title || ''}" placeholder="标题">
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="importNote" placeholder="来自分享的内容">${shareData.text || ''}</textarea>
        </div>
        <div style="padding:8px;background:var(--bg-inset);border-radius:8px;font-size:13px;color:var(--text-tertiary);margin-bottom:12px;">
          💡 平台和标签将自动识别
        </div>
        <button class="btn btn-primary btn-block" id="confirmImport">导入到灵感库</button>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    
    document.getElementById('confirmImport').addEventListener('click', async () => {
      const url = document.getElementById('importUrl').value.trim();
      const title = document.getElementById('importTitle').value.trim();
      const note = document.getElementById('importNote').value.trim();
      if (!url && !title) { window.showToast('请输入链接或标题'); return; }
      
      // 自动识别平台
      let platform = 'webpage';
      const lower = (url || '').toLowerCase();
      if (lower.includes('bilibili') || lower.includes('b23.tv')) platform = 'bilibili';
      else if (lower.includes('douyin')) platform = 'douyin';
      else if (lower.includes('xiaohongshu') || lower.includes('xhslink')) platform = 'xhs';
      
      await add('inspirations', {
        url, title: title || '分享内容', platform,
        author: '', cover: '', summary: note,
        tags: ['分享导入'], notes: '', favorite: false,
      });
      close();
      this.render();
      window.showToast('✅ 已导入到灵感库');
    });
  }

  // === 语音输入 ===

  startVoiceInput(modal) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.showToast('浏览器不支持语音输入');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    const textarea = modal.querySelector('#inspNotes');
    const voiceBtn = modal.querySelector('#voiceBtn');
    const voiceHint = modal.querySelector('#voiceHint');
    let finalText = textarea.value;

    this.recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      textarea.value = finalText + interimText;
    };

    this.recognition.onerror = (event) => {
      window.showToast('语音识别出错: ' + event.error);
      this.stopVoiceInput();
    };

    this.recognition.onend = () => {
      this.stopVoiceInput();
    };

    this.recognition.start();
    this.isRecording = true;
    voiceBtn.textContent = '🔴 停止';
    voiceBtn.classList.add('recording');
    if (voiceHint) voiceHint.style.display = 'block';
  }

  stopVoiceInput() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
    this.isRecording = false;
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceHint = document.getElementById('voiceHint');
    if (voiceBtn) {
      voiceBtn.textContent = '🎤 语音输入';
      voiceBtn.classList.remove('recording');
    }
    if (voiceHint) voiceHint.style.display = 'none';
  }

  // === 编辑弹窗 ===

  showEditModal(item) {
    this.showAddModal({
      ...item,
    });

    // 修改保存按钮逻辑：克隆按钮移除原有事件监听，再绑定更新逻辑
    const modal = document.querySelector('.modal-overlay.active');
    if (!modal) return;

    const oldBtn = modal.querySelector('#saveInsp');
    const saveBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(saveBtn, oldBtn);
    saveBtn.textContent = '更新';

    saveBtn.addEventListener('click', async () => {
      const url = modal.querySelector('#inspUrl').value.trim();
      const title = modal.querySelector('#inspTitle').value.trim();
      if (!url && !title) {
        window.showToast('请输入链接或标题');
        return;
      }

      const platform = modal.querySelector('#inspPlatform').value;
      const coverInput = modal.querySelector('#inspCover').value.trim();
      const tags = modal.querySelector('#inspTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);

      const attachments = modal._getAttachments();
      await update('inspirations', item.id, {
        url,
        title: title || '未命名灵感',
        platform,
        author: modal.querySelector('#inspAuthor').value.trim(),
        cover: coverInput || generatePlaceholderCover(platform, ''),
        summary: modal.querySelector('#inspSummary').value.trim(),
        tags,
        notes: modal.querySelector('#inspNotes').value.trim(),
        favorite: modal.querySelector('#favToggle').dataset.fav === '1',
        attachments,
      });

      this.stopVoiceInput();
      modal.remove();
      await this.render();
      window.showToast('✅ 已更新');
    });
  }

  // === 详情弹窗 ===

  showDetailModal(item) {
    const platform = PLATFORMS[item.platform] || PLATFORMS.webpage;
    const cover = item.cover || generatePlaceholderCover(item.platform, '');
    const isGradient = cover.startsWith('linear-gradient');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">灵感详情</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>

        <!-- 封面 -->
        <div class="inspiration-detail-cover" style="${isGradient ? `background: ${cover};` : ''}">
          ${!isGradient ? `<img src="${cover}" alt="封面" onerror="this.style.display='none'; this.parentElement.style.background='${generatePlaceholderCover(item.platform, '')}';">` : ''}
          <span class="platform-badge ${platform.class}">${platform.icon} ${platform.name}</span>
        </div>

        <div class="inspiration-detail-title">${item.title || '未命名灵感'}</div>

        ${item.author ? `<div class="inspiration-detail-author">👤 ${item.author}</div>` : ''}

        ${item.summary ? `
          <div class="inspiration-detail-section">
            <div class="inspiration-detail-label">内容摘要</div>
            <div class="inspiration-detail-content">${item.summary}</div>
          </div>
        ` : ''}

        ${(item.tags || []).length > 0 ? `
          <div class="inspiration-detail-section">
            <div class="inspiration-detail-label">标签</div>
            <div class="inspiration-detail-tags">
              ${item.tags.map(t => `<span class="tag tag-brand">${t}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${item.notes ? `
          <div class="inspiration-detail-section">
            <div class="inspiration-detail-label">📝 灵感备注</div>
            <div class="inspiration-detail-note">${item.notes}</div>
          </div>
        ` : ''}

        <div class="inspiration-detail-section">
          <div class="inspiration-detail-label">链接</div>
          <div class="inspiration-detail-url">${item.url || '无'}</div>
        </div>

        <div class="inspiration-detail-meta">
          <span>收藏于 ${(item.createdAt || '').slice(0, 10)}</span>
        </div>

        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
          ${item.url ? `<button class="btn btn-primary" style="flex: 1;" id="openLink">🔗 打开链接</button>` : ''}
          <button class="btn btn-outline" id="editDetail">✏️ 编辑</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('openLink')?.addEventListener('click', () => {
      if (item.url) {
        const fullUrl = item.url.startsWith('http') ? item.url : 'https://' + item.url;
        const newTab = window.open(fullUrl, '_blank', 'noopener,noreferrer');
        if (!newTab) {
          window.location.href = fullUrl;
        }
      } else {
        window.showToast('无效链接');
      }
    });

    document.getElementById('editDetail')?.addEventListener('click', () => {
      close();
      this.showEditModal(item);
    });
  }

  // === 导出功能 ===

  exportMarkdown() {
    const data = this.getFiltered();
    if (data.length === 0) {
      window.showToast('暂无数据可导出');
      return;
    }

    let md = `# 💡 灵感库\n\n> 导出时间：${new Date().toLocaleString('zh-CN')}\n> 共 ${data.length} 条灵感\n\n`;

    data.forEach((item, i) => {
      const platform = PLATFORMS[item.platform] || PLATFORMS.webpage;
      md += `## ${i + 1}. ${item.title || '未命名灵感'}\n\n`;
      md += `- **平台**: ${platform.icon} ${platform.name}\n`;
      if (item.author) md += `- **作者**: ${item.author}\n`;
      if (item.url) md += `- **链接**: [${item.url}](${item.url})\n`;
      if (item.tags && item.tags.length > 0) md += `- **标签**: ${item.tags.map(t => `\`${t}\``).join(' ')}\n`;
      if (item.summary) md += `- **摘要**: ${item.summary}\n`;
      if (item.notes) md += `- **备注**: ${item.notes}\n`;
      md += `- **收藏时间**: ${(item.createdAt || '').slice(0, 10)}\n\n`;
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = localDateStr(new Date());
    a.href = url;
    a.download = `灵感库-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.showToast('✅ 已导出 Markdown');
  }

  exportExcel() {
    const data = this.getFiltered();
    if (data.length === 0) {
      window.showToast('暂无数据可导出');
      return;
    }

    const headers = ['标题', '平台', '作者', '链接', '标签', '摘要', '备注', '收藏时间'];
    const rows = data.map(item => {
      const platform = PLATFORMS[item.platform] || PLATFORMS.webpage;
      return [
        item.title || '',
        platform.name,
        item.author || '',
        item.url || '',
        (item.tags || []).join(' / '),
        item.summary || '',
        item.notes || '',
        (item.createdAt || '').slice(0, 10),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '灵感库');

    const date = localDateStr(new Date());
    XLSX.writeFile(wb, `灵感库-${date}.xlsx`);
    window.showToast('✅ 已导出 Excel');
  }

  onDestroy() {
    this.stopVoiceInput();
  }
}
