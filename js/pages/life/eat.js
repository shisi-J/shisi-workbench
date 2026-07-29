/**
 * 吃 · 美食探店页面框架
 * 规划功能：按城市地区分类、奶茶甜品/小吃/地方菜系/火锅烧烤/减脂餐分类
 *           1-5星打分、填写评价、状态标记(想去/已打卡/好吃推荐)、挂载探店外链
 * 本次迭代：页面框架 + 基础数据加载，UI细节后续填充
 */

import { getByCategory, add, update, remove } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

const CATEGORY_OPTIONS = ['奶茶甜品', '小吃', '地方菜系', '火锅烧烤', '减脂餐'];
const STATUS_OPTIONS = ['想去', '已打卡', '好吃推荐'];

export default class EatPage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'eat';
    this.records = [];
    this.filterSubType = '';
    this.filterStatus = '';
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
    if (this.filterSubType) {
      filtered = filtered.filter(r => r.fields?.subType === this.filterSubType);
    }
    if (this.filterStatus) {
      filtered = filtered.filter(r => r.fields?.status === this.filterStatus);
    }
    return filtered;
  }

  getHTML() {
    const filtered = this.getFiltered();
    return `
      <div class="life-eat-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">🍽️ 吃 · 美食探店</div>
          <div class="page-subtitle">城市探店地图 · 共 ${filtered.length} 家店</div>
        </div>

        <!-- 筛选区 -->
        <div class="filter-bar" id="filterBar">
          <div class="filter-chip ${!this.filterSubType ? 'active' : ''}" data-subfilter="">全部分类</div>
          ${CATEGORY_OPTIONS.map(c => `<div class="filter-chip ${this.filterSubType === c ? 'active' : ''}" data-subfilter="${c}">${c}</div>`).join('')}
        </div>
        <div class="filter-bar" id="statusFilterBar">
          <div class="filter-chip ${!this.filterStatus ? 'active' : ''}" data-statusfilter="">全部状态</div>
          ${STATUS_OPTIONS.map(s => `<div class="filter-chip ${this.filterStatus === s ? 'active' : ''}" data-statusfilter="${s}">${s}</div>`).join('')}
        </div>

        <!-- 探店列表（框架） -->
        <div id="recordList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🍽️</div>
              <div class="empty-text">${this.records.length === 0 ? '还没有探店记录<br>点击 + 添加美食探店' : '没有匹配的探店记录'}</div>
            </div>
          ` : filtered.map(r => this.renderCard(r)).join('')}
        </div>

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderCard(r) {
    const f = r.fields || {};
    const stars = f.rating ? '⭐'.repeat(parseInt(f.rating)) : '';
    const date = r.createdAt?.slice(0, 10) || '';
    const statusTag = f.status ? `<span class="tag ${f.status === '好吃推荐' ? 'tag-brand' : ''}">${f.status}</span>` : '';
    const subTypeTag = f.subType ? `<span class="tag">${f.subType}</span>` : '';

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${f.title || f.shopName || '未命名'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.city ? `<span style="margin-right: var(--space-2);">📍 ${f.city}</span>` : ''}
          ${stars ? `<span style="margin-right: var(--space-2);">${stars}</span>` : ''}
          ${date}
        </div>
        ${f.review ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">${f.review}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${subTypeTag}${statusTag}
          ${f.url ? `<a href="${f.url}" target="_blank" class="tag" style="color: var(--brand);">🔗 外链</a>` : ''}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  bindEvents() {
    // 筛选
    document.querySelectorAll('[data-subfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterSubType = chip.getAttribute('data-subfilter') || '';
        this.render();
      });
    });
    document.querySelectorAll('[data-statusfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterStatus = chip.getAttribute('data-statusfilter') || '';
        this.render();
      });
    });

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

    document.getElementById('addRecordBtn')?.addEventListener('click', () => this.showFormModal());
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
          <div class="modal-title">${isEdit ? '编辑探店' : '添加探店'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">店名</label>
          <input type="text" class="form-input" id="field_title" value="${f.title || f.shopName || ''}" placeholder="餐厅/店名">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">城市地区</label>
            <input type="text" class="form-input" id="field_city" value="${f.city || ''}" placeholder="如：杭州·西湖区">
          </div>
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="field_subType">
              <option value="">请选择</option>
              ${CATEGORY_OPTIONS.map(o => `<option value="${o}" ${f.subType === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">打分</label>
            <select class="form-select" id="field_rating">
              <option value="">请选择</option>
              ${[5,4,3,2,1].map(n => `<option value="${n}" ${f.rating == n ? 'selected' : ''}>${'⭐'.repeat(n)} ${n}星</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select class="form-select" id="field_status">
              <option value="">请选择</option>
              ${STATUS_OPTIONS.map(o => `<option value="${o}" ${f.status === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">探店外链</label>
          <input type="url" class="form-input" id="field_url" value="${f.url || ''}" placeholder="美团/大众点评/小红书链接">
        </div>
        <div class="form-group">
          <label class="form-label">评价</label>
          <textarea class="form-textarea" id="field_review" placeholder="好吃吗？环境如何？">${f.review || ''}</textarea>
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

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = {};
      ['title', 'city', 'subType', 'rating', 'status', 'url', 'review'].forEach(k => {
        fields[k] = document.getElementById(`field_${k}`).value.trim();
      });
      const title = fields.title || '未命名探店';
      fields.attachments = getAttachments();
      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields });
      } else {
        await add('lifeRecords', { title, fields, category: this.category });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  onDestroy() {}
}
