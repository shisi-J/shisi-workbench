/**
 * 每日播客页面
 * 博主风格设计：渐变 Hero 头部 + 统计卡片网格 + 紧凑卡片列表
 */

import { getAll, add, update, remove } from '../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../utils/attachments.js';

// 平台配置
const PLATFORMS = {
  xiaoyuzhou: { name: '小宇宙', icon: '🎙️', class: 'xiaoyuzhou', color: '#7C5CFF' },
  bilibili: { name: 'B站', icon: '📺', class: 'bilibili', color: '#FB7299' },
  douyin: { name: '抖音', icon: '🎵', class: 'douyin', color: '#25F4EE' },
  other: { name: '其他', icon: '🔗', class: 'other', color: '#888' },
};

// 内容类型配置
const TYPE_CONFIG = {
  '全部': { icon: '🎧', label: '全部', color: '#9D4EDD' },
  '对话': { icon: '💬', label: '对话', color: '#4361EE' },
  '辩论': { icon: '⚔️', label: '辩论', color: '#EF476F' },
  '演讲': { icon: '📢', label: '演讲', color: '#06D6A0' },
  '纪录片': { icon: '🎬', label: '纪录片', color: '#118AB2' },
  '新闻': { icon: '📰', label: '新闻', color: '#FFD166' },
  '财经': { icon: '💰', label: '财经', color: '#06D6A0' },
};

// 自动识别平台
function detectPlatform(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('xiaoyuzhou') || lower.includes('xyzfm')) return 'xiaoyuzhou';
  if (lower.includes('bilibili') || lower.includes('b23.tv')) return 'bilibili';
  if (lower.includes('douyin')) return 'douyin';
  return 'other';
}

export default class PodcastPage {
  constructor({ container, route, params, navigate }) {
    this.container = container;
    this.route = route;
    this.params = params;
    this.navigate = navigate;
    this.podcasts = [];
    this.filterType = '全部';
    this.filterStatus = 'all';
    this.searchKeyword = '';
    this.seeded = false;
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.podcasts = await getAll('podcasts');
      this.podcasts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      if (this.podcasts.length === 0) this.podcasts = [];
    } catch (e) {
      this.podcasts = [];
    }
  }

  getStats() {
    const total = this.podcasts.length;
    const checked = this.podcasts.filter(p => p.checked).length;
    const pending = total - checked;
    const types = new Set(this.podcasts.map(p => p.type).filter(Boolean)).size;
    return { total, checked, pending, types };
  }

  getFiltered() {
    let filtered = [...this.podcasts];
    if (this.filterType !== '全部') {
      filtered = filtered.filter(p => p.type === this.filterType);
    }
    if (this.filterStatus === 'pending') {
      filtered = filtered.filter(p => !p.checked);
    } else if (this.filterStatus === 'done') {
      filtered = filtered.filter(p => p.checked);
    }
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(p =>
        (p.title || '').toLowerCase().includes(kw) ||
        (p.description || '').toLowerCase().includes(kw) ||
        (p.tags || []).some(t => t.toLowerCase().includes(kw))
      );
    }
    return filtered;
  }

  getHTML() {
    const filtered = this.getFiltered();
    const stats = this.getStats();
    const percent = stats.total > 0 ? Math.round(stats.checked / stats.total * 100) : 0;

    return `
      <div class="podcast-page">
        <!-- 博主风格 Hero 头部 -->
        <div class="podcast-hero">
          <div class="podcast-hero-bg"></div>
          <div class="podcast-hero-content">
            <div class="podcast-hero-icon">🎙️</div>
            <div class="podcast-hero-text">
              <div class="podcast-hero-title">每日播客</div>
              <div class="podcast-hero-desc">对话·辩论·演讲·纪录片·新闻·财经</div>
            </div>
            <div class="podcast-hero-percent">
              <div class="podcast-hero-percent-num">${percent}<span>%</span></div>
              <div class="podcast-hero-percent-label">收听率</div>
            </div>
          </div>
        </div>

        <!-- 统计卡片网格 -->
        <div class="podcast-stats-grid">
          <div class="podcast-stat-card">
            <div class="podcast-stat-icon">🎧</div>
            <div class="podcast-stat-value">${stats.total}</div>
            <div class="podcast-stat-label">总集数</div>
          </div>
          <div class="podcast-stat-card done">
            <div class="podcast-stat-icon">✅</div>
            <div class="podcast-stat-value">${stats.checked}</div>
            <div class="podcast-stat-label">已收听</div>
          </div>
          <div class="podcast-stat-card pending">
            <div class="podcast-stat-icon">⬜</div>
            <div class="podcast-stat-value">${stats.pending}</div>
            <div class="podcast-stat-label">待收听</div>
          </div>
          <div class="podcast-stat-card type">
            <div class="podcast-stat-icon">🏷️</div>
            <div class="podcast-stat-value">${stats.types}</div>
            <div class="podcast-stat-label">内容类型</div>
          </div>
        </div>

        <!-- 搜索栏 -->
        <div class="podcast-search-bar">
          <span class="podcast-search-icon">🔍</span>
          <input type="text" class="podcast-search-input" id="podcastSearch" placeholder="搜索播客标题、简介、标签..." value="${this.searchKeyword}">
          ${this.searchKeyword ? '<button class="podcast-search-clear" id="searchClear">✕</button>' : ''}
        </div>

        <!-- 筛选栏 -->
        <div class="podcast-filter-bar">
          <div class="podcast-filter-scroll">
            ${Object.entries(TYPE_CONFIG).map(([type, conf]) => `
              <div class="podcast-filter-chip ${this.filterType === type ? 'active' : ''}" data-type="${type}" style="${this.filterType === type ? `background:${conf.color}22; color:${conf.color}; border-color:${conf.color}44` : ''}">
                ${conf.icon} ${conf.label}
              </div>
            `).join('')}
          </div>
          <div class="podcast-filter-status">
            <div class="podcast-status-chip ${this.filterStatus === 'all' ? 'active' : ''}" data-st="all">全部</div>
            <div class="podcast-status-chip ${this.filterStatus === 'pending' ? 'active' : ''}" data-st="pending">⬜ 待听</div>
            <div class="podcast-status-chip ${this.filterStatus === 'done' ? 'active' : ''}" data-st="done">✅ 已听</div>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="podcast-list" id="podcastList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🎙️</div>
              <div class="empty-text">
                ${this.searchKeyword || this.filterType !== '全部' || this.filterStatus !== 'all'
                  ? '没有匹配的播客内容，试试其他关键词'
                  : '还没有播客内容<br>点击右下角 + 添加'}
              </div>
            </div>
          ` : filtered.map(item => this.renderCard(item)).join('')}
        </div>

        <!-- 添加按钮 -->
        <button class="fab" id="addPodcastBtn">+</button>
      </div>
    `;
  }

  renderCard(item) {
    const platform = item.url ? (PLATFORMS[item.platform] || PLATFORMS.other) : null;
    const tags = item.tags || [];
    const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG['全部'];
    const hasUrl = !!item.url;
    const typeColor = typeConfig.color || '#9D4EDD';

    return `
      <div class="podcast-card ${item.checked ? 'checked' : ''}" data-id="${item.id}">
        <!-- 缩略图 -->
        <div class="podcast-card-thumb" ${hasUrl ? `data-action="open" data-url="${item.url}"` : ''} style="background: linear-gradient(135deg, ${typeColor}44, ${typeColor}22);">
          ${(() => {
            const cover = item.cover || '';
            const isGradient = cover.startsWith('linear-gradient') || cover.startsWith('radial-gradient');
            if (cover && !isGradient) {
              return `<img src="${cover}" alt="${item.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="podcast-card-placeholder" style="display:none;">${typeConfig.icon}</div>`;
            } else if (isGradient) {
              return `<div class="podcast-card-placeholder" style="background: ${cover}; -webkit-background-clip: padding-box; background-clip: padding-box;">${typeConfig.icon}</div>`;
            } else {
              return `<div class="podcast-card-placeholder">${typeConfig.icon}</div>`;
            }
          })()}
          ${platform ? `
            <div class="podcast-card-badge" style="background:${platform.color}">
              ${platform.icon}
            </div>
          ` : ''}
          ${hasUrl ? `<div class="podcast-card-play">▶</div>` : ''}
          ${item.duration ? `<div class="podcast-card-dur">${item.duration}</div>` : ''}
        </div>

        <!-- 内容体 -->
        <div class="podcast-card-body">
          <!-- 类型 + 收听状态 -->
          <div class="podcast-card-meta">
            <span class="podcast-meta-tag" style="background:${typeColor}18; color:${typeColor}">${typeConfig.icon} ${item.type || '对话'}</span>
            ${item.duration ? `<span class="podcast-meta-tag">⏱ ${item.duration}</span>` : ''}
            ${platform ? `<span class="podcast-meta-tag">${platform.icon} ${platform.name}</span>` : ''}
          </div>

          <!-- 标题 -->
          <div class="podcast-card-title">${item.title || '未命名'}</div>

          <!-- 简介 -->
          ${item.description ? `<div class="podcast-card-desc">${item.description}</div>` : ''}

          <!-- 标签 -->
          ${tags.length > 0 ? `
            <div class="podcast-card-tags">
              ${tags.map(t => `<span class="podcast-tag">${t}</span>`).join('')}
            </div>
          ` : ''}

          <!-- 笔记 -->
          ${item.notes ? `
            <div class="podcast-card-note">📝 ${item.notes}</div>
          ` : ''}

          <!-- 附件 -->
          ${renderAttachmentList(item.attachments, item.id)}

          <!-- 底部操作 -->
          <div class="podcast-card-footer">
            <div class="podcast-card-actions">
              ${hasUrl ? `<button class="btn btn-sm btn-outline" data-action="open" data-url="${item.url}">🔗 打开</button>` : ''}
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${item.id}">✏️</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}">🗑</button>
            </div>
            <button class="checkin-btn ${item.checked ? 'done' : 'pending'}" data-action="checkin" data-id="${item.id}">
              ${item.checked ? '✅ 已收听' : '⬜ 标记收听'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 类型筛选
    document.querySelectorAll('[data-type]').forEach(el => {
      el.addEventListener('click', () => {
        this.filterType = el.getAttribute('data-type');
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

    // 搜索
    const searchInput = document.getElementById('podcastSearch');
    searchInput?.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      const filtered = this.getFiltered();
      const listEl = document.getElementById('podcastList');
      if (listEl) {
        listEl.innerHTML = filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🎙️</div>
            <div class="empty-text">
              ${this.searchKeyword || this.filterType !== '全部' || this.filterStatus !== 'all'
                ? '没有匹配的播客内容，试试其他关键词'
                : '还没有播客内容<br>点击右下角 + 添加'}
            </div>
          </div>` : filtered.map(item => this.renderCard(item)).join('');
        this.bindCardEvents();
      }
    });

    // 搜索清除
    document.getElementById('searchClear')?.addEventListener('click', () => {
      this.searchKeyword = '';
      this.render();
    });

    this.bindCardEvents();

    // 添加按钮
    document.getElementById('addPodcastBtn')?.addEventListener('click', () => {
      this.showAddModal();
    });
  }

  bindCardEvents() {
    // 卡片点击编辑
    document.querySelectorAll('.podcast-card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // 排除按钮/链接点击
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const item = this.podcasts.find(p => p.id === id);
        if (item) this.showAddModal(item);
      });
      card.style.cursor = 'pointer';
    });

    // 打开链接
    document.querySelectorAll('[data-action="open"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = el.getAttribute('data-url');
        if (url) window.open(url, '_blank');
      });
    });

    // 收听打卡
    document.querySelectorAll('[data-action="checkin"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const item = this.podcasts.find(p => p.id === id);
        if (item) {
          await update('podcasts', id, {
            checked: !item.checked,
            checkedAt: !item.checked ? new Date().toISOString() : null,
          });
          await this.loadData();
          this.render();
          window.showToast(item.checked ? '已取消标记' : '✅ 标记已收听');
        }
      });
    });

    // 编辑
    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const item = this.podcasts.find(p => p.id === id);
        if (item) this.showAddModal(item);
      });
    });

    // 删除
    document.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        await remove('podcasts', id);
        await this.loadData();
        this.render();
        window.showToast('已删除');
      });
    });

    // 附件点击：预览/下载
    bindCardAttachmentClicks(this.podcasts);
  }

  showAddModal(item = null) {
    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';

    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑播客内容' : '添加播客内容'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input type="text" class="form-input" id="podcastTitle" placeholder="如：对话罗振宇：时间的朋友" value="${item?.title || ''}" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">链接（选填）</label>
          <input type="url" class="form-input" id="podcastUrl" placeholder="粘贴小宇宙/B站/抖音链接" value="${item?.url || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">平台</label>
            <select class="form-select" id="podcastPlatform">
              ${Object.entries(PLATFORMS).map(([key, p]) => `
                <option value="${key}" ${item?.platform === key ? 'selected' : ''}>${p.icon} ${p.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">时长</label>
            <input type="text" class="form-input" id="podcastDuration" placeholder="如：45分钟" value="${item?.duration || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">内容类型</label>
          <select class="form-select" id="podcastType">
            ${Object.entries(TYPE_CONFIG).filter(([k]) => k !== '全部').map(([type, conf]) => `
              <option value="${type}" ${item?.type === type ? 'selected' : ''}>${conf.icon} ${conf.label}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">标签</label>
          <input type="text" class="form-input" id="podcastTags" placeholder="标签（逗号分隔）" value="${(item?.tags || []).join(',')}">
        </div>
        <div class="form-group">
          <label class="form-label">简介</label>
          <textarea class="form-textarea" id="podcastDesc" placeholder="简单描述内容...">${item?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">收听笔记</label>
          <textarea class="form-textarea" id="podcastNotes" placeholder="记录关键观点和启发...">${item?.notes || ''}</textarea>
        </div>
        ${renderUploadField(item?.attachments || [])}
        <button class="btn btn-primary btn-block" id="savePodcast">${isEdit ? '更新' : '保存'}</button>
      </div>
    `;
    document.body.appendChild(modal);
    const getAttachments = initUploadHandlers(modal, item?.attachments || []);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('podcastUrl').addEventListener('blur', (e) => {
      const url = e.target.value;
      if (url) {
        const detected = detectPlatform(url);
        document.getElementById('podcastPlatform').value = detected;
      }
    });

    document.getElementById('savePodcast').addEventListener('click', async () => {
      const title = document.getElementById('podcastTitle').value.trim();
      if (!title) { window.showToast('请输入标题'); return; }

      const url = document.getElementById('podcastUrl').value.trim();
      const tagsStr = document.getElementById('podcastTags').value.trim();
      const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

      const data = {
        title,
        url,
        platform: url ? document.getElementById('podcastPlatform').value : 'other',
        duration: document.getElementById('podcastDuration').value.trim(),
        type: document.getElementById('podcastType').value,
        cover: item?.cover || '',
        description: document.getElementById('podcastDesc').value.trim(),
        tags,
        notes: document.getElementById('podcastNotes').value.trim(),
        attachments: getAttachments(),
      };

      if (isEdit) {
        await update('podcasts', item.id, data);
      } else {
        await add('podcasts', { ...data, checked: false });
      }

      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  onDestroy() {}
}