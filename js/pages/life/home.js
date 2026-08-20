/**
 * 小屋 · 安家置业页面
 * 功能：看房买房/水电硬装/软装收纳/幸福感小物 分类管理
 *       各平台安利排雷、链接收藏、红黑榜标签
 */

import { getByCategory, add, update, remove } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

const HOME_TYPES = ['看房买房', '水电硬装', '软装收纳', '幸福感小物'];
const TAG_OPTIONS = ['🟢 红榜安利', '🔴 黑榜排雷', '🟡 一般', '📌 待入手'];
const PLATFORM_OPTIONS = ['小红书', '抖音', 'B站', '淘宝', '京东', '拼多多', '闲鱼', '宜家', '实体店', '其他'];

// 自动识别平台
function detectPlatform(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('xiaohongshu') || lower.includes('xhslink')) return '小红书';
  if (lower.includes('douyin')) return '抖音';
  if (lower.includes('bilibili') || lower.includes('b23.tv')) return 'B站';
  if (lower.includes('taobao')) return '淘宝';
  if (lower.includes('jd.com')) return '京东';
  if (lower.includes('pinduoduo')) return '拼多多';
  if (lower.includes('idle.fish') || lower.includes('goofish')) return '闲鱼';
  return '其他';
}

export default class HomePage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'home';
    this.records = [];
    this.filterType = '';
    this.filterTag = '';
    this.searchKeyword = '';
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.records = await getByCategory('lifeRecords', this.category);
    } catch (e) {
      this.records = [];
    }
  }

  getFiltered() {
    let filtered = [...this.records];
    if (this.filterType) {
      filtered = filtered.filter(r => r.fields?.homeType === this.filterType);
    }
    if (this.filterTag) {
      filtered = filtered.filter(r => r.fields?.tag === this.filterTag);
    }
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(r =>
        (r.title || '').toLowerCase().includes(kw) ||
        (r.fields?.remark || '').toLowerCase().includes(kw) ||
        (r.fields?.product || '').toLowerCase().includes(kw)
      );
    }
    return filtered;
  }

  getStats() {
    const total = this.records.length;
    const red = this.records.filter(r => r.fields?.tag === '🟢 红榜安利').length;
    const black = this.records.filter(r => r.fields?.tag === '🔴 黑榜排雷').length;
    const pending = this.records.filter(r => r.fields?.tag === '📌 待入手').length;
    return { total, red, black, pending };
  }

  getHTML() {
    const filtered = this.getFiltered();
    const stats = this.getStats();

    return `
      <div class="life-home-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">🏠 小屋 · 安家置业</div>
          <div class="page-subtitle">看房买房 · 硬装软装 · 幸福感小物 · 共 ${filtered.length} 条记录</div>
        </div>

        <!-- 统计小标签 -->
        <div class="home-stat-row" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);flex-wrap:wrap;">
          <div style="font-size:var(--font-xs);padding:3px 10px;border-radius:var(--radius-full);background:var(--bg-inset);color:var(--text-tertiary);">📦 共 ${stats.total}</div>
          <div style="font-size:var(--font-xs);padding:3px 10px;border-radius:var(--radius-full);background:rgba(6,214,160,0.15);color:#06D6A0;">🟢 安利 ${stats.red}</div>
          <div style="font-size:var(--font-xs);padding:3px 10px;border-radius:var(--radius-full);background:rgba(239,71,111,0.15);color:#EF476F;">🔴 排雷 ${stats.black}</div>
          <div style="font-size:var(--font-xs);padding:3px 10px;border-radius:var(--radius-full);background:rgba(255,209,102,0.15);color:#FFD166;">📌 待入 ${stats.pending}</div>
        </div>

        <!-- 分类筛选 -->
        <div class="filter-bar">
          <div class="filter-chip ${!this.filterType ? 'active' : ''}" data-typefilter="">全部分类</div>
          ${HOME_TYPES.map(t => `<div class="filter-chip ${this.filterType === t ? 'active' : ''}" data-typefilter="${t}">${t}</div>`).join('')}
        </div>
        <!-- 标签筛选 -->
        <div class="filter-bar">
          <div class="filter-chip ${!this.filterTag ? 'active' : ''}" data-tagfilter="">全部标签</div>
          ${TAG_OPTIONS.map(t => `<div class="filter-chip ${this.filterTag === t ? 'active' : ''}" data-tagfilter="${t}">${t}</div>`).join('')}
        </div>

        <!-- 搜索栏 -->
        <div style="position:relative;margin-bottom:var(--space-3);">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none;">🔍</span>
          <input type="text" class="form-input" id="homeSearch" placeholder="搜索标题、产品名、备注..." value="${this.searchKeyword}" style="padding-left:36px;">
        </div>

        <!-- 记录列表 -->
        <div id="recordList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🏠</div>
              <div class="empty-text">${this.records.length === 0 ? '还没有小屋记录<br>点击 + 添加看房/硬装/软装/好物' : '没有匹配的记录'}</div>
            </div>
          ` : filtered.map(r => this.renderCard(r)).join('')}
        </div>

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderCard(r) {
    const f = r.fields || {};
    const date = r.createdAt?.slice(0, 10) || '';
    const tagColor = f.tag === '🟢 红榜安利' ? '#06D6A0' : (f.tag === '🔴 黑榜排雷' ? '#EF476F' : (f.tag === '📌 待入手' ? '#FFD166' : '#999'));
    const typeIcon = HOME_TYPES.indexOf(f.homeType);
    const typeEmoji = ['🔑', '🔧', '🛋️', '✨'][typeIcon] || '🏠';

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${typeEmoji} ${f.title || f.product || '未命名'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.homeType ? `<span style="margin-right: var(--space-2);">📂 ${f.homeType}</span>` : ''}
          ${f.platform ? `<span style="margin-right: var(--space-2);">🛒 ${f.platform}</span>` : ''}
          ${f.price ? `<span style="margin-right: var(--space-2);">💰 ¥${f.price}</span>` : ''}
        </div>
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${f.tag ? `<span class="tag" style="background: ${tagColor}; color: white;">${f.tag}</span>` : ''}
          ${f.url ? `<a href="${f.url}" target="_blank" class="tag" style="color: var(--brand);">🔗 链接</a>` : ''}
          ${date ? `<span class="tag" style="background: var(--bg-inset); color: var(--text-tertiary);">${date}</span>` : ''}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  bindEvents() {
    // 分类筛选
    document.querySelectorAll('[data-typefilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterType = chip.getAttribute('data-typefilter') || '';
        this.render();
      });
    });
    // 标签筛选
    document.querySelectorAll('[data-tagfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterTag = chip.getAttribute('data-tagfilter') || '';
        this.render();
      });
    });
    // 搜索
    document.getElementById('homeSearch')?.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      const filtered = this.getFiltered();
      const listEl = document.getElementById('recordList');
      if (listEl) {
        listEl.innerHTML = filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🏠</div>
            <div class="empty-text">${this.records.length === 0 ? '还没有小屋记录<br>点击 + 添加看房/硬装/软装/好物' : '没有匹配的记录'}</div>
          </div>` : filtered.map(r => this.renderCard(r)).join('');
        this.bindCardEvents();
      }
    });
    // 添加
    document.getElementById('addRecordBtn')?.addEventListener('click', () => this.showFormModal());
    // 卡片事件
    this.bindCardEvents();
  }

  bindCardEvents() {
    // 编辑/删除
    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const record = this.records.find(r => r.id === id);
        if (record) this.showFormModal(record);
      });
    });
    document.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        await remove('lifeRecords', id);
        await this.loadData();
        this.render();
        window.showToast('已删除');
      });
    });
    // 卡片点击编辑
    document.querySelectorAll('.card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const record = this.records.find(r => r.id === id);
        if (record) this.showFormModal(record);
      });
      card.style.cursor = 'pointer';
    });
    // 附件点击：预览/下载
    bindCardAttachmentClicks(this.records);
  }

  showFormModal(record = null) {
    const isEdit = !!record;
    const f = record?.fields || {};

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑记录' : '添加小屋记录'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input type="text" class="form-input" id="field_title" value="${f.title || ''}" placeholder="如：XX小区看房记录 / 乳胶漆选品 / 收纳盒安利" autofocus>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="field_homeType">
              ${HOME_TYPES.map(t => `<option value="${t}" ${f.homeType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">标签</label>
            <select class="form-select" id="field_tag">
              <option value="">请选择</option>
              ${TAG_OPTIONS.map(t => `<option value="${t}" ${f.tag === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">平台</label>
            <select class="form-select" id="field_platform">
              ${PLATFORM_OPTIONS.map(p => `<option value="${p}" ${f.platform === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">价格(¥)</label>
            <input type="number" class="form-input" id="field_price" value="${f.price || ''}" placeholder="如：299">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">产品/链接</label>
          <input type="url" class="form-input" id="field_url" value="${f.url || ''}" placeholder="粘贴小红书/抖音/B站/淘宝链接">
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="field_remark" placeholder="安利理由/排雷原因/看房感受/选购要点...">${f.remark || ''}</textarea>
        </div>
        ${renderUploadField(f.attachments || [])}
        <button class="btn btn-primary btn-block" id="saveRecord">保存</button>
      </div>
    `;
    document.body.appendChild(modal);
    const getAttachments = initUploadHandlers(modal, f.attachments || []);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // 自动识别平台
    document.getElementById('field_url').addEventListener('blur', (e) => {
      const url = e.target.value;
      if (url) {
        const detected = detectPlatform(url);
        document.getElementById('field_platform').value = detected;
      }
    });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = {};
      ['title', 'homeType', 'tag', 'platform', 'price', 'url', 'remark'].forEach(k => {
        fields[k] = document.getElementById(`field_${k}`).value.trim();
      });
      const title = fields.title || '未命名';
      fields.attachments = getAttachments();
      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields });
      } else {
        await add('lifeRecords', { title, fields, category: this.category });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 记录已添加');
    });
  }

  onDestroy() {}
}