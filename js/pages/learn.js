/**
 * 学习组通用页面
 * 嘻嘻风格卡片设计 + 分类标签体系 + 视频链接选填 + 课程章节分段进度 + 内置示例数据
 */

import { getByCategory, add, update, remove, getAll, getSetting, setSetting } from '../db.js';

// 学习分类配置
const CATEGORY_CONFIG = {
  expression: {
    title: '学习表达', icon: '📖', desc: '提升表达力，让沟通更高效',
    tags: ['全部', '听', '说', '读', '写'],
  },
  ai: {
    title: '学习AI', icon: '🤖', desc: '掌握AI工具，让效率翻倍',
    tags: ['全部', 'ChatGPT', 'AI绘画', 'AI写作', '效率工具'],
  },
  english: {
    title: '学习英语', icon: '🔤', desc: '每天进步一点点，英语不再难',
    tags: ['全部', '听', '说', '读', '写', '单词', '语法'],
  },
  media: {
    title: '学习新媒体', icon: '📱', desc: '短视频运营+内容创作技巧',
    tags: ['全部', '短视频运营', '剪辑', '带货', '账号起号'],
  },
  office: {
    title: 'Office技巧', icon: '💼', desc: 'Word/Excel/PPT实用技巧',
    tags: ['全部', 'Excel', 'Word', 'PPT', '快捷键'],
  },
};

// 平台配置
const PLATFORMS = {
  bilibili: { name: 'B站', icon: '📺', class: 'bilibili', domain: 'bilibili.com' },
  douyin: { name: '抖音', icon: '🎵', class: 'douyin', domain: 'douyin.com' },
  xhs: { name: '小红书', icon: '📕', class: 'xhs', domain: 'xiaohongshu.com' },
  other: { name: '其他', icon: '🔗', class: 'xhs', domain: '' },
};

// 自动识别平台
function detectPlatform(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('bilibili') || lower.includes('b23.tv')) return 'bilibili';
  if (lower.includes('douyin')) return 'douyin';
  if (lower.includes('xiaohongshu') || lower.includes('xhslink')) return 'xhs';
  return 'other';
}

// 内置示例学习数据
const SEED_DATA = {
  expression: [
    {
      title: '金字塔原理：结构化表达的核心',
      description: '学会用金字塔结构组织语言，让对方一听就懂',
      url: 'https://www.bilibili.com/video/BV1x411Y7',
      platform: 'bilibili',
      tags: ['说'],
      notes: '结论先行 → 以上统下 → 归类分组 → 逻辑递进',
      chapters: [
        { title: '什么是金字塔原理', done: true },
        { title: '结论先行的三个要点', done: true },
        { title: 'MECE原则：不重叠不遗漏', done: false },
        { title: '实战演练：工作汇报', done: false },
      ],
    },
    {
      title: '演讲开场白的5种黄金公式',
      description: '好的开场是成功的一半，掌握这5种开场方式',
      url: '',
      platform: 'other',
      tags: ['说'],
      notes: '提问开场、故事开场、数据开场、引用开场、悬念开场',
      chapters: [
        { title: '提问式开场', done: false },
        { title: '故事型开场', done: false },
        { title: '数据冲击开场', done: false },
      ],
    },
    {
      title: '高情商沟通：如何优雅地说不',
      description: '职场中拒绝别人的艺术，既不伤和气又守住边界',
      url: 'https://www.xiaohongshu.com/explore/abc123',
      platform: 'xhs',
      tags: ['说', '写'],
      notes: '先肯定后转折 → 给替代方案 → 表达善意',
      chapters: [],
    },
  ],
  ai: [
    {
      title: 'ChatGPT提示词工程入门',
      description: '从零学会写高质量Prompt，让AI输出更精准',
      url: 'https://www.bilibili.com/video/BV1AI4y1',
      platform: 'bilibili',
      tags: ['ChatGPT', 'AI写作'],
      notes: '角色设定 + 任务描述 + 约束条件 + 输出格式',
      chapters: [
        { title: 'Prompt基本结构', done: true },
        { title: 'Few-shot Learning技巧', done: false },
        { title: 'Chain of Thought思维链', done: false },
      ],
    },
    {
      title: 'Midjourney保姆级教程',
      description: '零基础学AI绘画，从注册到出图全流程',
      url: 'https://www.douyin.com/video/7234',
      platform: 'douyin',
      tags: ['AI绘画'],
      notes: '/imagine → 描述词 + 风格 + 参数',
      chapters: [
        { title: '注册与基础设置', done: true },
        { title: '常用参数详解', done: false },
      ],
    },
  ],
  english: [
    {
      title: '艾宾浩斯记忆法背单词',
      description: '科学记忆曲线，高效背诵四六级/考研词汇',
      url: '',
      platform: 'other',
      tags: ['单词'],
      notes: '5分钟→30分钟→12小时→1天→2天→4天→7天→15天',
      chapters: [
        { title: '记忆曲线原理', done: true },
        { title: '第一天：列表记忆', done: true },
        { title: '第二天：复习+新词', done: false },
        { title: '第七天：周复习', done: false },
      ],
    },
    {
      title: 'BBC 6 Minute English精听',
      description: '每天6分钟，提升英语听力',
      url: 'https://www.bilibili.com/video/BV1BBC',
      platform: 'bilibili',
      tags: ['听', '读'],
      notes: '第一遍盲听 → 第二遍看字幕 → 第三遍跟读',
      chapters: [],
    },
    {
      title: '影子跟读法练口语',
      description: '像影子一样跟着原声读，快速提升口语流利度',
      url: 'https://www.douyin.com/video/7890',
      platform: 'douyin',
      tags: ['说'],
      notes: '选材2-3分钟 → 同步跟读 → 录音对比 → 重复',
      chapters: [
        { title: '选材与准备', done: false },
        { title: '同步跟读训练', done: false },
        { title: '录音对比纠音', done: false },
      ],
    },
  ],
  media: [
    {
      title: '抖音算法机制全解析',
      description: '理解推荐算法，让你的视频获得更多曝光',
      url: 'https://www.bilibili.com/video/BV1media',
      platform: 'bilibili',
      tags: ['短视频运营', '账号起号'],
      notes: '完播率 > 点赞 > 评论 > 转发 > 关注',
      chapters: [
        { title: '流量池机制', done: true },
        { title: '破播放量层级', done: false },
        { title: '标签与垂直度', done: false },
      ],
    },
    {
      title: '剪映转场技巧合集',
      description: '10种常用转场效果，让视频更流畅',
      url: 'https://www.douyin.com/video/jianying',
      platform: 'douyin',
      tags: ['剪辑'],
      notes: '运镜转场、遮罩转场、缩放转场、渐变转场',
      chapters: [
        { title: '基础转场', done: true },
        { title: '进阶：遮罩转场', done: false },
      ],
    },
    {
      title: '直播带货话术模板',
      description: '高转化直播话术，从留人到逼单全流程',
      url: '',
      platform: 'other',
      tags: ['带货', '账号起号'],
      notes: '留人话术 → 产品介绍 → 信任背书 → 逼单促单',
      chapters: [
        { title: '开场留人话术', done: false },
        { title: '产品卖点提炼', done: false },
        { title: '逼单与催单', done: false },
      ],
    },
  ],
  office: [
    {
      title: 'Excel VLOOKUP函数详解',
      description: '职场必会函数，数据查找利器',
      url: 'https://www.bilibili.com/video/BV1excel',
      platform: 'bilibili',
      tags: ['Excel'],
      notes: '=VLOOKUP(查找值, 数据范围, 列号, 精确匹配)',
      chapters: [
        { title: '基础语法', done: true },
        { title: '模糊匹配应用', done: false },
        { title: '与IFERROR组合', done: false },
      ],
    },
    {
      title: 'PPT设计四原则',
      description: '对比、重复、对齐、亲密性，让PPT更专业',
      url: '',
      platform: 'other',
      tags: ['PPT'],
      notes: 'CRAP原则：Contrast, Repetition, Alignment, Proximity',
      chapters: [],
    },
  ],
};

export default class LearnPage {
  constructor({ container, route, params, navigate }) {
    this.container = container;
    this.route = route;
    this.params = params;
    this.navigate = navigate;
    this.category = params.category || 'expression';
    this.config = CATEGORY_CONFIG[this.category] || CATEGORY_CONFIG.expression;
    this.learnings = [];
    this.filterTag = '全部';
    this.filterStatus = 'all';
    this.seeded = false;
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.learnings = await getByCategory('learnings', this.category);

      // 如果没有数据，加载内置示例（仅首次，用持久化标记防止删除后复活）
      if (this.learnings.length === 0 && SEED_DATA[this.category]) {
        const seedKey = `seed_learn_${this.category}`;
        const alreadySeeded = await getSetting(seedKey, false);
        if (!alreadySeeded) {
          await setSetting(seedKey, true);
          for (const item of SEED_DATA[this.category]) {
            await add('learnings', {
              ...item,
              category: this.category,
              checked: false,
            });
          }
          this.learnings = await getByCategory('learnings', this.category);
        }
      }
    } catch (e) {
      this.learnings = [];
    }
  }

  // 获取章节进度
  getChapterProgress(item) {
    const chapters = item.chapters || [];
    if (chapters.length === 0) return null;
    const done = chapters.filter(c => c.done).length;
    return { done, total: chapters.length, percent: Math.round(done / chapters.length * 100) };
  }

  // 获取整体进度
  getOverallProgress() {
    if (this.learnings.length === 0) return { checked: 0, total: 0, percent: 0, chapters: { done: 0, total: 0 }, pending: 0, withLink: 0 };
    const checked = this.learnings.filter(l => l.checked).length;
    const pending = this.learnings.filter(l => !l.checked).length;
    const withLink = this.learnings.filter(l => l.url).length;
    let chapterDone = 0, chapterTotal = 0;
    this.learnings.forEach(l => {
      const chapters = l.chapters || [];
      chapterDone += chapters.filter(c => c.done).length;
      chapterTotal += chapters.length;
    });
    return {
      checked,
      total: this.learnings.length,
      percent: Math.round(checked / this.learnings.length * 100),
      pending,
      withLink,
      chapters: { done: chapterDone, total: chapterTotal },
    };
  }

  getHTML() {
    const filtered = this.getFiltered();
    const progress = this.getOverallProgress();

    return `
      <div class="learn-page">
        <!-- 页面头部 - 博主风格 -->
        <div class="learn-hero">
          <div class="learn-hero-bg"></div>
          <div class="learn-hero-content">
            <div class="learn-hero-icon">${this.config.icon}</div>
            <div class="learn-hero-text">
              <div class="learn-hero-title">${this.config.title}</div>
              <div class="learn-hero-desc">${this.config.desc}</div>
            </div>
            <div class="learn-hero-percent">
              <div class="learn-hero-percent-num">${progress.percent}<span>%</span></div>
              <div class="learn-hero-percent-label">完成率</div>
            </div>
          </div>
        </div>

        <!-- 统计卡片网格 -->
        <div class="learn-stats-grid">
          <div class="learn-stat-card">
            <div class="learn-stat-icon">📚</div>
            <div class="learn-stat-value">${progress.total}</div>
            <div class="learn-stat-label">学习内容</div>
          </div>
          <div class="learn-stat-card done">
            <div class="learn-stat-icon">✅</div>
            <div class="learn-stat-value">${progress.checked}</div>
            <div class="learn-stat-label">已打卡</div>
          </div>
          <div class="learn-stat-card pending">
            <div class="learn-stat-icon">⬜</div>
            <div class="learn-stat-value">${progress.pending}</div>
            <div class="learn-stat-label">待学习</div>
          </div>
          <div class="learn-stat-card chapter">
            <div class="learn-stat-icon">📖</div>
            <div class="learn-stat-value">${progress.chapters.done}<span class="learn-stat-sub">/${progress.chapters.total}</span></div>
            <div class="learn-stat-label">章节进度</div>
          </div>
        </div>

        <!-- 分类标签筛选 -->
        <div class="filter-bar">
          ${this.config.tags.map(tag => `
            <div class="filter-chip ${this.filterTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</div>
          `).join('')}
        </div>

        <!-- 状态筛选 -->
        <div class="filter-bar">
          <div class="filter-chip ${this.filterStatus === 'all' ? 'active' : ''}" data-st="all">全部状态</div>
          <div class="filter-chip ${this.filterStatus === 'pending' ? 'active' : ''}" data-st="pending">⬜ 进行中</div>
          <div class="filter-chip ${this.filterStatus === 'done' ? 'active' : ''}" data-st="done">✅ 已完成</div>
        </div>

        <!-- 学习卡片列表 -->
        <div id="learnList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">${this.config.icon}</div>
              <div class="empty-text">${this.filterTag !== '全部' || this.filterStatus !== 'all' ? '没有匹配的学习内容' : '还没有学习内容<br>点击右下角 + 添加'}</div>
            </div>
          ` : filtered.map(item => this.renderCard(item)).join('')}
        </div>

        <!-- 添加按钮 -->
        <button class="fab" id="addLearnBtn">+</button>
      </div>
    `;
  }

  renderCard(item) {
    const platform = item.url ? (PLATFORMS[item.platform] || PLATFORMS.other) : null;
    const tags = item.tags || [];
    const chapterProgress = this.getChapterProgress(item);
    const hasUrl = !!item.url;
    const attachments = item.attachments || [];

    return `
      <div class="learn-card" data-id="${item.id}">
        ${hasUrl ? `
          <div class="learn-card-thumb" data-action="open" data-url="${item.url}">
            ${(() => {
              const cover = item.cover || '';
              const isGradient = cover.startsWith('linear-gradient') || cover.startsWith('radial-gradient');
              if (cover && !isGradient) {
                return `<img src="${cover}" alt="${item.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="cover-placeholder" style="display: none;">${this.config.icon}</div>`;
              } else if (isGradient) {
                return `<div class="cover-placeholder" style="background: ${cover}; -webkit-background-clip: padding-box; background-clip: padding-box;">${this.config.icon}</div>`;
              } else {
                return `<div class="cover-placeholder">${this.config.icon}</div>`;
              }
            })()}
            <div class="learn-card-platform">
              <span class="platform-badge ${platform.class}">${platform.icon}</span>
            </div>
            <div class="learn-card-play">▶</div>
          </div>
        ` : ''}
        <div class="learn-card-body">
          <div class="learn-card-title">${item.title || '未命名'}</div>
          ${item.description ? `<div class="learn-card-desc">${item.description}</div>` : ''}

          <!-- 标签 -->
          ${tags.length > 0 ? `
            <div class="learn-card-tags">
              ${tags.map(t => `<span class="tag tag-brand">${t}</span>`).join('')}
            </div>
          ` : ''}

          <!-- 章节进度 -->
          ${chapterProgress ? `
            <div class="chapter-progress" data-id="${item.id}">
              <div class="chapter-progress-header">
                <span class="chapter-progress-label">📖 课程章节</span>
                <span class="chapter-progress-count">${chapterProgress.done}/${chapterProgress.total}</span>
              </div>
              <div class="chapter-progress-bar">
                <div class="chapter-progress-fill" style="width: ${chapterProgress.percent}%"></div>
              </div>
              <div class="chapter-list">
                ${(item.chapters || []).map((ch, i) => `
                  <div class="chapter-item ${ch.done ? 'done' : ''}" data-chapter-idx="${i}" data-learn-id="${item.id}">
                    <div class="chapter-checkbox ${ch.done ? 'checked' : ''}">${ch.done ? '✓' : ''}</div>
                    <span class="chapter-title">${ch.title}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 学习笔记 -->
          ${item.notes ? `
            <div class="learn-card-note">📝 ${item.notes}</div>
          ` : ''}

          <!-- 学习产出附件 -->
          ${attachments.length > 0 ? `
            <div class="learn-attachments">
              <div class="learn-attachments-header">📎 学习产出（${attachments.length}）</div>
              <div class="learn-attachments-list">
                ${attachments.map((att, i) => `
                  <div class="learn-attachment-item" data-att-idx="${i}" data-learn-id="${item.id}">
                    <span class="learn-attachment-icon">${this.getFileIcon(att.type)}</span>
                    <span class="learn-attachment-name">${att.name}</span>
                    <span class="learn-attachment-size">${this.formatFileSize(att.size)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 底部操作 -->
          <div class="learn-card-footer">
            <div class="learn-card-actions">
              ${hasUrl ? `<button class="btn btn-sm btn-outline" data-action="open" data-url="${item.url}">🔗 打开</button>` : ''}
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${item.id}">✏️</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}">🗑</button>
            </div>
            <button class="checkin-btn ${item.checked ? 'done' : 'pending'}" data-action="checkin" data-id="${item.id}">
              ${item.checked ? '✅ 已打卡' : '⬜ 打卡'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getFiltered() {
    let filtered = [...this.learnings];
    // 标签筛选
    if (this.filterTag !== '全部') {
      filtered = filtered.filter(l => (l.tags || []).includes(this.filterTag));
    }
    // 状态筛选
    if (this.filterStatus === 'pending') {
      filtered = filtered.filter(l => !l.checked);
    } else if (this.filterStatus === 'done') {
      filtered = filtered.filter(l => l.checked);
    }
    return filtered;
  }

  bindEvents() {
    // 标签筛选
    document.querySelectorAll('[data-tag]').forEach(el => {
      el.addEventListener('click', () => {
        this.filterTag = el.getAttribute('data-tag');
        this.render();
      });
    });

    // 状态筛选
    document.querySelectorAll('[data-st]').forEach(el => {
      el.addEventListener('click', () => {
        this.filterStatus = el.getAttribute('data-st');
        this.render();
      });
    });

    // 打开链接
    document.querySelectorAll('[data-action="open"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = el.getAttribute('data-url');
        if (url) window.open(url, '_blank');
      });
    });

    // 章节切换
    document.querySelectorAll('.chapter-item').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const learnId = parseInt(el.getAttribute('data-learn-id'));
        const chapterIdx = parseInt(el.getAttribute('data-chapter-idx'));
        const item = this.learnings.find(l => l.id === learnId);
        if (item && item.chapters && item.chapters[chapterIdx]) {
          item.chapters[chapterIdx].done = !item.chapters[chapterIdx].done;
          await update('learnings', learnId, { chapters: item.chapters });
          await this.loadData();
          this.render();
        }
      });
    });

    // 打卡
    document.querySelectorAll('[data-action="checkin"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const item = this.learnings.find(l => l.id === id);
        if (item) {
          await update('learnings', id, {
            checked: !item.checked,
            checkedAt: !item.checked ? new Date().toISOString() : null,
          });
          await this.loadData();
          this.render();
          window.showToast(item.checked ? '已取消打卡' : '✅ 打卡成功');
        }
      });
    });

    // 编辑
    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.getAttribute('data-id'));
        const item = this.learnings.find(l => l.id === id);
        if (item) this.showAddModal(item);
      });
    });

    // 删除
    document.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = parseInt(el.getAttribute('data-id'));
        await remove('learnings', id);
        await this.loadData();
        this.render();
        window.showToast('已删除');
      });
    });

    // 卡片点击编辑
    document.querySelectorAll('.learn-card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // 排除按钮/链接点击
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const item = this.learnings.find(l => l.id === id);
        if (item) this.showAddModal(item);
      });
      card.style.cursor = 'pointer';
    });

    // 附件点击：预览/下载
    document.querySelectorAll('.learn-attachment-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const learnId = parseInt(el.getAttribute('data-learn-id'));
        const attIdx = parseInt(el.getAttribute('data-att-idx'));
        const item = this.learnings.find(l => l.id === learnId);
        if (item && item.attachments && item.attachments[attIdx]) {
          this.previewAttachment(item.attachments[attIdx]);
        }
      });
    });

    // 添加
    document.getElementById('addLearnBtn')?.addEventListener('click', () => {
      this.showAddModal();
    });
  }

  showAddModal(item = null) {
    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    const chapters = item?.chapters || [];

    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑学习内容' : '添加学习内容'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input type="text" class="form-input" id="learnTitle" placeholder="如：剪映调色教程" value="${item?.title || ''}" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">视频链接（选填）</label>
          <input type="url" class="form-input" id="learnUrl" placeholder="粘贴B站/抖音/小红书链接，不填也可" value="${item?.url || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">平台</label>
            <select class="form-select" id="learnPlatform">
              ${Object.entries(PLATFORMS).map(([key, p]) => `
                <option value="${key}" ${item?.platform === key ? 'selected' : ''}>${p.icon} ${p.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">时长</label>
            <input type="text" class="form-input" id="learnDuration" placeholder="如：15分钟" value="${item?.duration || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">标签</label>
          <div class="tag-suggestions" id="tagSuggestions">
            ${this.config.tags.filter(t => t !== '全部').map(t => `
              <span class="tag-suggestion ${(item?.tags || []).includes(t) ? 'selected' : ''}" data-tag-name="${t}">${t}</span>
            `).join('')}
          </div>
          <input type="text" class="form-input" id="learnTags" placeholder="或手动输入标签（逗号分隔）" value="${(item?.tags || []).join(',')}" style="margin-top: var(--space-2);">
        </div>
        <div class="form-group">
          <label class="form-label">简介</label>
          <textarea class="form-textarea" id="learnDesc" placeholder="简单描述内容...">${item?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">课程章节（选填）</label>
          <div id="chapterEditor" style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${chapters.length > 0 ? chapters.map((ch, i) => this.renderChapterInput(i, ch.title, ch.done)).join('') : ''}
          </div>
          <button class="btn btn-outline btn-sm" id="addChapter" style="margin-top: var(--space-2); width: 100%;">+ 添加章节</button>
        </div>
        <div class="form-group">
          <label class="form-label">学习笔记</label>
          <textarea class="form-textarea" id="learnNotes" placeholder="记录学习要点...">${item?.notes || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">📎 学习产出附件（选填）</label>
          <div id="attachmentList" style="display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-2);">
            ${(item?.attachments || []).map((att, i) => `
              <div class="attachment-row" data-att-row="${i}">
                <span>${this.getFileIcon(att.type)}</span>
                <span class="attachment-row-name">${att.name}</span>
                <span class="attachment-row-size">${this.formatFileSize(att.size)}</span>
                <button type="button" class="attachment-remove" data-att-remove="${i}" style="background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;padding:2px 6px;">✕</button>
              </div>
            `).join('')}
          </div>
          <label class="btn btn-outline btn-sm" style="display:block;text-align:center;cursor:pointer;border:2px dashed var(--border-default);">
            📁 选择文件上传
            <input type="file" id="learnFiles" multiple style="display:none;" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.json,.zip,.rar">
          </label>
          <div id="uploadStatus" style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px;text-align:center;"></div>
        </div>
        <button class="btn btn-primary btn-block" id="saveLearn">${isEdit ? '更新' : '保存'}</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // 自动识别平台
    document.getElementById('learnUrl').addEventListener('blur', (e) => {
      const url = e.target.value;
      if (url) {
        const detected = detectPlatform(url);
        document.getElementById('learnPlatform').value = detected;
      }
    });

    // 标签建议选择
    const tagsInput = document.getElementById('learnTags');
    let selectedTags = new Set((item?.tags || []));
    modal.querySelectorAll('.tag-suggestion').forEach(tag => {
      tag.addEventListener('click', () => {
        const tagName = tag.getAttribute('data-tag-name');
        if (selectedTags.has(tagName)) {
          selectedTags.delete(tagName);
          tag.classList.remove('selected');
        } else {
          selectedTags.add(tagName);
          tag.classList.add('selected');
        }
        tagsInput.value = Array.from(selectedTags).join(',');
      });
    });

    // 章节编辑
    let chapterIndex = chapters.length;
    document.getElementById('addChapter')?.addEventListener('click', () => {
      const container = modal.querySelector('#chapterEditor');
      const div = document.createElement('div');
      div.innerHTML = this.renderChapterInput(chapterIndex, '', false);
      container.appendChild(div.firstElementChild);
      chapterIndex++;
    });

    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('chapter-remove')) {
        e.target.closest('.chapter-input-row').remove();
      }
      if (e.target.classList.contains('chapter-toggle')) {
        const isChecked = e.target.dataset.checked === '1';
        const newState = !isChecked;
        e.target.dataset.checked = newState ? '1' : '0';
        if (newState) {
          e.target.style.background = 'var(--brand)';
          e.target.style.borderColor = 'var(--brand)';
          e.target.textContent = '✓';
        } else {
          e.target.style.background = 'transparent';
          e.target.style.borderColor = 'var(--border-default)';
          e.target.textContent = '';
        }
      }
    });

    // 文件上传
    let pendingAttachments = [...(item?.attachments || [])];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

    document.getElementById('learnFiles')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const statusEl = document.getElementById('uploadStatus');
      const listEl = document.getElementById('attachmentList');

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          statusEl.textContent = `⚠️ ${file.name} 超过10MB限制，已跳过`;
          continue;
        }
        statusEl.textContent = `⏳ 正在读取 ${file.name}...`;
        try {
          const dataUrl = await this.fileToDataUrl(file);
          pendingAttachments.push({
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
          });
          // 刷新附件列表
          const row = document.createElement('div');
          row.className = 'attachment-row';
          row.dataset.attRow = pendingAttachments.length - 1;
          row.innerHTML = `
            <span>${this.getFileIcon(file.type)}</span>
            <span class="attachment-row-name">${file.name}</span>
            <span class="attachment-row-size">${this.formatFileSize(file.size)}</span>
            <button type="button" class="attachment-remove" data-att-remove="${pendingAttachments.length - 1}" style="background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;padding:2px 6px;">✕</button>
          `;
          listEl.appendChild(row);
          statusEl.textContent = `✅ ${file.name} 已添加`;
        } catch (err) {
          statusEl.textContent = `❌ ${file.name} 读取失败`;
        }
      }
      e.target.value = ''; // 允许重复选择同一文件
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    });

    // 删除附件
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('attachment-remove')) {
        const idx = parseInt(e.target.dataset.attRemove);
        pendingAttachments[idx] = null; // 标记删除，不改变索引
        e.target.closest('.attachment-row').remove();
      }
    });

    // 保存
    document.getElementById('saveLearn').addEventListener('click', async () => {
      const title = document.getElementById('learnTitle').value.trim();
      if (!title) { window.showToast('请输入标题'); return; }

      const url = document.getElementById('learnUrl').value.trim();
      const tagsStr = document.getElementById('learnTags').value.trim();
      const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

      // 收集章节
      const chapterInputs = modal.querySelectorAll('.chapter-input');
      const newChapters = Array.from(chapterInputs).map((input, i) => {
        const toggle = input.closest('.chapter-input-row')?.querySelector('.chapter-toggle');
        return {
          title: input.value.trim(),
          done: toggle ? toggle.dataset.checked === '1' : false,
        };
      }).filter(c => c.title);

      const data = {
        title,
        url,
        platform: url ? document.getElementById('learnPlatform').value : 'other',
        duration: document.getElementById('learnDuration').value.trim(),
        cover: item?.cover || '',
        description: document.getElementById('learnDesc').value.trim(),
        tags,
        notes: document.getElementById('learnNotes').value.trim(),
        chapters: newChapters,
        attachments: pendingAttachments.filter(a => a !== null), // 过滤已删除的
        category: this.category,
      };

      if (isEdit) {
        await update('learnings', item.id, data);
      } else {
        await add('learnings', { ...data, checked: false });
      }

      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  // 获取文件图标
  getFileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document')) return '📘';
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📗';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📙';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '🗜️';
    if (type.includes('json') || type.includes('text') || type.includes('markdown')) return '📝';
    if (type.includes('audio')) return '🎵';
    if (type.includes('video')) return '🎬';
    return '📄';
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  // 文件转 DataURL
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 下载附件
  downloadAttachment(att) {
    const link = document.createElement('a');
    link.href = att.dataUrl;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // 预览附件（图片/PDF在新窗口打开，其他下载）
  previewAttachment(att) {
    if (att.type?.startsWith('image/') || att.type?.includes('pdf')) {
      const w = window.open('');
      if (w) {
        w.document.write(att.type?.includes('pdf')
          ? `<iframe src="${att.dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`
          : `<img src="${att.dataUrl}" style="max-width:100%;height:auto;">`);
        w.document.title = att.name;
      }
    } else {
      this.downloadAttachment(att);
    }
  }

  renderChapterInput(index, title, done) {
    return `
      <div class="chapter-input-row" style="display: flex; gap: var(--space-1); align-items: center;">
        <div class="chapter-toggle" data-checked="${done ? '1' : '0'}" style="flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 2px solid ${done ? 'var(--brand)' : 'var(--border-default)'}; border-radius: 4px; background: ${done ? 'var(--brand)' : 'transparent'}; color: #fff; font-size: 12px; flex-shrink: 0;">${done ? '✓' : ''}</div>
        <input type="text" class="form-input chapter-input" placeholder="第 ${index + 1} 章标题" value="${title}" style="flex: 1;">
        ${index > 0 ? '<button class="chapter-remove" style="background: none; border: none; color: var(--danger); font-size: 18px; padding: 4px 8px; cursor: pointer;">✕</button>' : ''}
      </div>
    `;
  }

  onDestroy() {}
}
