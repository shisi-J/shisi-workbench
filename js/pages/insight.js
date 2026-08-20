/**
 * 感悟输出页面
 * 支持区分来源（学习/灵感/播客等）和输出类型（笔记/作品/总结等）
 */

import { getAll, add, update, remove } from '../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../utils/attachments.js';

// 来源类型配置
const SOURCE_TYPES = [
  { value: 'learn_expression', label: '📖 学习表达', color: '#118AB2' },
  { value: 'learn_ai', label: '🤖 学习AI', color: '#9D4EDD' },
  { value: 'learn_english', label: '🔤 学习英语', color: '#06D6A0' },
  { value: 'learn_media', label: '📱 学习新媒体', color: '#F78C6B' },
  { value: 'learn_office', label: '💼 Office技巧', color: '#073B4C' },
  { value: 'learn_finance', label: '💰 理财学习', color: '#FFD166' },
  { value: 'inspiration', label: '💡 灵感库', color: '#FFD166' },
  { value: 'podcast', label: '🎙️ 每日播客', color: '#EF476F' },
  { value: 'life', label: '🌿 生活记录', color: '#06D6A0' },
  { value: 'work', label: '💼 工作台账', color: '#118AB2' },
  { value: 'general', label: '⚫ 通用感悟', color: '#6C757D' },
];

// 输出类型配置
const OUTPUT_TYPES = [
  { value: 'note', label: '📝 学习笔记' },
  { value: 'work', label: '🔧 实践作品' },
  { value: 'summary', label: '📊 总结复盘' },
  { value: 'idea', label: '💡 灵感记录' },
  { value: 'essay', label: '✍️ 随笔感悟' },
];

function getSourceConfig(value) {
  return SOURCE_TYPES.find(s => s.value === value) || SOURCE_TYPES[SOURCE_TYPES.length - 1];
}

function getOutputConfig(value) {
  return OUTPUT_TYPES.find(o => o.value === value) || OUTPUT_TYPES[4];
}

export default class InsightPage {
  constructor({ container }) {
    this.container = container;
    this.insights = [];
    this.searchKeyword = '';
    this.filterSource = '';
  }

  async render() {
    try {
      this.insights = await getAll('insights');
      this.insights.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (e) {
      this.insights = [];
    }

    this.container.innerHTML = `
      <div class="insight-page">
        <div class="page-header">
          <div class="page-title">🧠 感悟输出</div>
          <div class="page-subtitle">学习输出 · 实践作品 · 灵感思考 · 共 ${this.insights.length} 篇</div>
        </div>

        <input type="text" class="form-input mb-3" id="searchInsight" placeholder="搜索感悟..." value="${this.searchKeyword}">

        <!-- 来源筛选 -->
        <div class="filter-bar" style="margin-bottom: var(--space-3);">
          <div class="filter-chip ${!this.filterSource ? 'active' : ''}" data-sourcefilter="">全部</div>
          ${SOURCE_TYPES.map(s => `<div class="filter-chip ${this.filterSource === s.value ? 'active' : ''}" data-sourcefilter="${s.value}">${s.label}</div>`).join('')}
        </div>

        <div id="insightList">
          ${this.renderInsightList()}
        </div>

        <button class="fab" id="addInsightBtn">+</button>
      </div>
    `;
    this.bindEvents();
  }

  getFiltered() {
    let filtered = [...this.insights];
    if (this.filterSource) {
      filtered = filtered.filter(i => i.sourceType === this.filterSource);
    }
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title || '').toLowerCase().includes(kw) ||
        (i.content || '').toLowerCase().includes(kw) ||
        (i.sourceTitle || '').toLowerCase().includes(kw)
      );
    }
    return filtered;
  }

  renderInsightList() {
    const filtered = this.getFiltered();

    if (filtered.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <div class="empty-text">${this.insights.length === 0 ? '还没有感悟记录<br>点击 + 记录你的思考' : '没有匹配的感悟'}</div>
        </div>
      `;
    }

    return filtered.map(insight => {
      const srcCfg = getSourceConfig(insight.sourceType);
      const outCfg = getOutputConfig(insight.outputType);

      return `
      <div class="card" data-id="${insight.id}" style="cursor: pointer;">
        <div class="card-header">
          <div class="card-title">${insight.title || '无标题'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${insight.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${insight.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <!-- 来源与输出类型标签 -->
        <div style="display: flex; gap: var(--space-1); margin-bottom: var(--space-1); flex-wrap: wrap;">
          <span class="tag" style="background: ${srcCfg.color}20; color: ${srcCfg.color};">${srcCfg.label}</span>
          <span class="tag" style="background: var(--bg-inset); color: var(--text-secondary);">${outCfg.label}</span>
        </div>
        <!-- 关联来源标题 -->
        ${insight.sourceTitle ? `
          <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-bottom: var(--space-1);">
            📎 来源：${insight.sourceTitle}
            ${insight.sourceUrl ? `<a href="${(insight.sourceUrl || '').replace(/"/g, '&quot;')}" target="_blank" style="color: var(--brand); margin-left: 4px;" onclick="event.stopPropagation()">查看</a>` : ''}
          </div>
        ` : ''}
        <div class="card-body" style="
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden; font-size: var(--font-sm);
        ">${(insight.content || '').replace(/<[^>]+>/g, '')}</div>
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${(insight.tags || []).map(t => `<span class="tag tag-brand">${t}</span>`).join('')}
          ${insight.mood ? `<span class="tag">${insight.mood}</span>` : ''}
          <span class="tag" style="margin-left: auto;">${(insight.createdAt || '').slice(0, 10)}</span>
        </div>
        ${renderAttachmentList(insight.attachments, insight.id)}
      </div>
    `}).join('');
  }

  bindEvents() {
    const searchInput = document.getElementById('searchInsight');
    searchInput?.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      const listEl = document.getElementById('insightList');
      if (listEl) {
        listEl.innerHTML = this.renderInsightList();
        this.bindCardEvents();
      }
    });

    // 来源筛选
    document.querySelectorAll('[data-sourcefilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterSource = chip.getAttribute('data-sourcefilter') || '';
        const listEl = document.getElementById('insightList');
        if (listEl) {
          listEl.innerHTML = this.renderInsightList();
          this.bindCardEvents();
        }
        // 更新筛选高亮
        document.querySelectorAll('[data-sourcefilter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    document.getElementById('addInsightBtn')?.addEventListener('click', () => {
      this.showModal();
    });

    this.bindCardEvents();
  }

  bindCardEvents() {
    // 卡片点击编辑
    document.querySelectorAll('.card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const insight = this.insights.find(i => i.id === id);
        if (insight) this.showModal(insight);
      });
    });

    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const insight = this.insights.find(i => i.id === id);
        if (insight) this.showModal(insight);
      });
    });

    document.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        await remove('insights', id);
        this.render();
        window.showToast('已删除');
      });
    });

    bindCardAttachmentClicks(this.insights);
  }

  showModal(insight = null) {
    const isEdit = !!insight;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑感悟' : '写感悟'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <input type="text" class="form-input" id="insightTitle" placeholder="标题" value="${insight?.title || ''}" autofocus>
        </div>
        <!-- 来源与输出类型 -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">来源类型</label>
            <select class="form-select" id="insightSource">
              ${SOURCE_TYPES.map(s => `<option value="${s.value}" ${insight?.sourceType === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">输出类型</label>
            <select class="form-select" id="insightOutput">
              ${OUTPUT_TYPES.map(o => `<option value="${o.value}" ${insight?.outputType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">来源标题（选填）</label>
            <input type="text" class="form-input" id="insightSourceTitle" placeholder="如：ChatGPT提示词工程入门" value="${insight?.sourceTitle || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">来源链接（选填）</label>
            <input type="url" class="form-input" id="insightSourceUrl" placeholder="https://..." value="${insight?.sourceUrl || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <select class="form-select" id="insightMood">
              <option value="">选择心情</option>
              <option value="😊 开心" ${insight?.mood === '😊 开心' ? 'selected' : ''}>😊 开心</option>
              <option value="😌 平静" ${insight?.mood === '😌 平静' ? 'selected' : ''}>😌 平静</option>
              <option value="🤔 思考" ${insight?.mood === '🤔 思考' ? 'selected' : ''}>🤔 思考</option>
              <option value="😤 愤怒" ${insight?.mood === '😤 愤怒' ? 'selected' : ''}>😤 愤怒</option>
              <option value="😢 难过" ${insight?.mood === '😢 难过' ? 'selected' : ''}>😢 难过</option>
            </select>
          </div>
          <div class="form-group">
            <input type="text" class="form-input" id="insightTags" placeholder="标签(逗号分隔)" value="${(insight?.tags || []).join(',')}">
          </div>
        </div>
        <div class="form-group">
          <textarea class="form-textarea" id="insightContent" placeholder="写下你的感悟、学习笔记或实践总结..." style="min-height: 200px;">${insight?.content || ''}</textarea>
        </div>
        ${renderUploadField(insight?.attachments || [])}
        <button class="btn btn-primary btn-block" id="saveInsight">保存</button>
      </div>
    `;
    document.body.appendChild(modal);
    const getAttachments = initUploadHandlers(modal, insight?.attachments || []);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveInsight').addEventListener('click', async () => {
      const title = document.getElementById('insightTitle').value.trim();
      const content = document.getElementById('insightContent').value.trim();
      if (!content) { window.showToast('请输入内容'); return; }
      const mood = document.getElementById('insightMood').value;
      const tags = document.getElementById('insightTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const sourceType = document.getElementById('insightSource').value;
      const outputType = document.getElementById('insightOutput').value;
      const sourceTitle = document.getElementById('insightSourceTitle').value.trim();
      const sourceUrl = document.getElementById('insightSourceUrl').value.trim();

      const attachments = getAttachments();
      const data = { content, mood, tags, sourceType, outputType, sourceTitle, sourceUrl, attachments };
      if (isEdit) {
        await update('insights', insight.id, { title: title || '无标题', ...data });
      } else {
        await add('insights', { title: title || '无标题', ...data });
      }
      close();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已保存');
    });
  }

  onDestroy() {}
}
