/**
 * 美丽 · 美妆穿搭页面框架
 * 规划功能：记录购买平台、红榜回购/黑榜排雷标签、护肤品/彩妆/穿搭分类管理
 *           支持穿搭灵感外链收藏
 * 本次迭代：页面框架 + 基础数据加载，UI细节后续填充
 */

import { getByCategory, add, update, remove } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

const BEAUTY_TYPES = ['护肤品', '彩妆', '穿搭', '美发', '美甲', '其他'];
const TAG_OPTIONS = ['🟢 红榜回购', '🔴 黑榜排雷', '🟡 一般'];
const PLATFORM_OPTIONS = ['淘宝', '京东', '拼多多', '抖音商城', '小红书', '得物', '专柜', '代购', '其他'];

export default class BeautyPage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'beauty';
    this.records = [];
    this.filterType = '';
    this.filterTag = '';
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
      filtered = filtered.filter(r => r.fields?.beautyType === this.filterType);
    }
    if (this.filterTag) {
      filtered = filtered.filter(r => r.fields?.tag === this.filterTag);
    }
    return filtered;
  }

  getHTML() {
    const filtered = this.getFiltered();
    return `
      <div class="life-beauty-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">💄 美丽 · 美妆穿搭</div>
          <div class="page-subtitle">红榜黑榜管理 · 共 ${filtered.length} 条记录</div>
        </div>

        <!-- 筛选区 -->
        <div class="filter-bar">
          <div class="filter-chip ${!this.filterType ? 'active' : ''}" data-typefilter="">全部分类</div>
          ${BEAUTY_TYPES.map(t => `<div class="filter-chip ${this.filterType === t ? 'active' : ''}" data-typefilter="${t}">${t}</div>`).join('')}
        </div>
        <div class="filter-bar">
          <div class="filter-chip ${!this.filterTag ? 'active' : ''}" data-tagfilter="">全部标签</div>
          ${TAG_OPTIONS.map(t => `<div class="filter-chip ${this.filterTag === t ? 'active' : ''}" data-tagfilter="${t}">${t}</div>`).join('')}
        </div>

        <!-- 记录列表 -->
        <div id="recordList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">💄</div>
              <div class="empty-text">${this.records.length === 0 ? '还没有美妆穿搭记录<br>点击 + 添加产品/穿搭' : '没有匹配的记录'}</div>
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
    const tagClass = f.tag?.includes('红榜') ? 'tag-brand' : (f.tag?.includes('黑榜') ? '' : '');
    const tagStyle = f.tag?.includes('黑榜') ? 'background: rgba(239,71,111,0.15); color: #EF476F;' : '';

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${f.title || f.product || '未命名'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.beautyType ? `<span class="tag" style="margin-right: var(--space-1);">${f.beautyType}</span>` : ''}
          ${f.brand ? `<span style="margin-right: var(--space-2);">${f.brand}</span>` : ''}
          ${f.buyPlatform ? `<span style="margin-right: var(--space-2);">🛒 ${f.buyPlatform}</span>` : ''}
          ${f.price ? `<span style="margin-right: var(--space-2);">💰 ¥${f.price}</span>` : ''}
          ${date}
        </div>
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${f.tag ? `<span class="tag ${tagClass}" style="${tagStyle}">${f.tag}</span>` : ''}
          ${f.inspirationUrl ? `<a href="${f.inspirationUrl}" target="_blank" class="tag" style="color: var(--brand);">🔗 穿搭灵感</a>` : ''}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  bindEvents() {
    document.querySelectorAll('[data-typefilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterType = chip.getAttribute('data-typefilter') || '';
        this.render();
      });
    });
    document.querySelectorAll('[data-tagfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterTag = chip.getAttribute('data-tagfilter') || '';
        this.render();
      });
    });

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
          <div class="modal-title">${isEdit ? '编辑记录' : '添加美妆/穿搭'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">名称</label>
          <input type="text" class="form-input" id="field_title" value="${f.title || f.product || ''}" placeholder="产品名/穿搭名">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="field_beautyType">
              <option value="">请选择</option>
              ${BEAUTY_TYPES.map(o => `<option value="${o}" ${f.beautyType === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">品牌</label>
            <input type="text" class="form-input" id="field_brand" value="${f.brand || ''}" placeholder="品牌名">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">购买平台</label>
            <select class="form-select" id="field_buyPlatform">
              <option value="">请选择</option>
              ${PLATFORM_OPTIONS.map(o => `<option value="${o}" ${f.buyPlatform === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">价格(¥)</label>
            <input type="number" class="form-input" id="field_price" value="${f.price || ''}" placeholder="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">标签</label>
          <select class="form-select" id="field_tag">
            <option value="">请选择</option>
            ${TAG_OPTIONS.map(o => `<option value="${o}" ${f.tag === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">穿搭灵感外链（选填）</label>
          <input type="url" class="form-input" id="field_inspirationUrl" value="${f.inspirationUrl || ''}" placeholder="小红书/抖音穿搭灵感链接">
        </div>
        <div class="form-group">
          <label class="form-label">使用感受/备注</label>
          <textarea class="form-textarea" id="field_remark" placeholder="使用感受、是否推荐等">${f.remark || ''}</textarea>
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
      ['title', 'beautyType', 'brand', 'buyPlatform', 'price', 'tag', 'inspirationUrl', 'remark'].forEach(k => {
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
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  onDestroy() {}
}
