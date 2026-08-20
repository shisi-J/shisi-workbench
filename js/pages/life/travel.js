/**
 * 旅游 · 行程游记页面框架
 * 规划功能：状态(想去/准备中/已去)、内置出行打包勾选清单
 *           可填行程预算、挂载旅行攻略外链
 * 本次迭代：页面框架 + 基础数据加载，UI细节后续填充
 */

import { getByCategory, add, update, remove } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

const STATUS_OPTIONS = ['想去', '准备中', '已去'];
const PACKING_TEMPLATE = [
  '身份证/护照', '银行卡/现金', '手机充电器', '充电宝', '耳机',
  '换洗衣物', '外套', '睡衣', '拖鞋', '洗漱用品',
  '护肤品/防晒', '雨伞', '水杯', '常备药品', '口罩',
];

export default class TravelPage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'travel';
    this.records = [];
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
    if (this.filterStatus) {
      filtered = filtered.filter(r => r.fields?.status === this.filterStatus);
    }
    return filtered;
  }

  getHTML() {
    const filtered = this.getFiltered();
    return `
      <div class="life-travel-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">✈️ 旅游 · 行程游记</div>
          <div class="page-subtitle">想去就去 · 共 ${filtered.length} 个行程</div>
        </div>

        <!-- 状态筛选 -->
        <div class="filter-bar">
          <div class="filter-chip ${!this.filterStatus ? 'active' : ''}" data-statusfilter="">全部</div>
          ${STATUS_OPTIONS.map(s => `<div class="filter-chip ${this.filterStatus === s ? 'active' : ''}" data-statusfilter="${s}">${s}</div>`).join('')}
        </div>

        <!-- 行程列表 -->
        <div id="recordList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">✈️</div>
              <div class="empty-text">${this.records.length === 0 ? '还没有行程记录<br>点击 + 添加想去的地方' : '没有匹配的行程'}</div>
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
    const statusColor = f.status === '想去' ? 'var(--brand)' : (f.status === '准备中' ? 'var(--warning)' : 'var(--success)');
    const statusTag = f.status ? `<span class="tag" style="background: ${statusColor}; color: white;">${f.status}</span>` : '';

    // 打包进度
    const packing = f.packing ? JSON.parse(f.packing) : null;
    let packingProgress = '';
    if (packing && Array.isArray(packing)) {
      const done = packing.filter(p => p.done).length;
      packingProgress = `<span class="tag" style="background: var(--bg-inset);">🎒 ${done}/${packing.length}</span>`;
    }

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${f.title || f.destination || '未命名行程'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.destination ? `<span style="margin-right: var(--space-2);">📍 ${f.destination}</span>` : ''}
          ${f.startDate ? `<span style="margin-right: var(--space-2);">🗓️ ${f.startDate}${f.endDate ? ' ~ ' + f.endDate : ''}</span>` : ''}
          ${f.budget ? `<span style="margin-right: var(--space-2);">💰 ¥${f.budget}</span>` : ''}
        </div>
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${statusTag}${packingProgress}
          ${f.guideUrl ? `<a href="${f.guideUrl}" target="_blank" class="tag" style="color: var(--brand);">🔗 攻略外链</a>` : ''}
        </div>
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  bindEvents() {
    document.querySelectorAll('[data-statusfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterStatus = chip.getAttribute('data-statusfilter') || '';
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
    const packing = f.packing ? JSON.parse(f.packing) : PACKING_TEMPLATE.map(item => ({ item, done: false }));

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑行程' : '添加行程'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">行程标题</label>
          <input type="text" class="form-input" id="field_title" value="${f.title || ''}" placeholder="如：国庆日本之旅">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">目的地</label>
            <input type="text" class="form-input" id="field_destination" value="${f.destination || ''}" placeholder="大阪+京都">
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select class="form-select" id="field_status">
              <option value="">请选择</option>
              ${STATUS_OPTIONS.map(o => `<option value="${o}" ${f.status === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">出发日期</label>
            <input type="date" class="form-input" id="field_startDate" value="${f.startDate || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">返回日期</label>
            <input type="date" class="form-input" id="field_endDate" value="${f.endDate || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">预算(¥)</label>
          <input type="number" class="form-input" id="field_budget" value="${f.budget || ''}" placeholder="12000">
        </div>
        <div class="form-group">
          <label class="form-label">旅行攻略外链</label>
          <input type="url" class="form-input" id="field_guideUrl" value="${f.guideUrl || ''}" placeholder="小红书/马蜂窝攻略链接">
        </div>

        <!-- 打包清单 -->
        <div class="form-group">
          <label class="form-label">🎒 出行打包清单</label>
          <div id="packingList" style="display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; padding: var(--space-2); background: var(--bg-inset); border-radius: var(--radius-xs);">
            ${packing.map((p, i) => `
              <div class="pack-toggle" data-pack-idx="${i}" data-checked="${p.done ? '1' : '0'}" style="font-size: var(--font-sm); display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 0;">
                <span class="pack-box" style="width:18px;height:18px;border:2px solid ${p.done ? 'var(--brand)' : 'var(--border-color)'};border-radius:4px;background:${p.done ? 'var(--brand)' : 'transparent'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0;">${p.done ? '✓' : ''}</span>
                <span>${p.item}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="field_remark" placeholder="行程亮点、注意事项等">${f.remark || ''}</textarea>
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

    // 打包清单切换（自定义toggle，不用原生checkbox）
    modal.querySelectorAll('.pack-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const box = el.querySelector('.pack-box');
        const isChecked = el.dataset.checked === '1';
        const newState = !isChecked;
        el.dataset.checked = newState ? '1' : '0';
        if (newState) {
          box.style.background = 'var(--brand)';
          box.style.borderColor = 'var(--brand)';
          box.textContent = '✓';
        } else {
          box.style.background = 'transparent';
          box.style.borderColor = 'var(--border-color)';
          box.textContent = '';
        }
      });
    });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = {};
      ['title', 'destination', 'status', 'startDate', 'endDate', 'budget', 'guideUrl', 'remark'].forEach(k => {
        fields[k] = document.getElementById(`field_${k}`).value.trim();
      });

      // 收集打包清单状态
      const updatedPacking = packing.map((p, i) => ({
        item: p.item,
        done: document.querySelector(`[data-pack-idx="${i}"]`)?.dataset.checked === '1',
      }));
      fields.packing = JSON.stringify(updatedPacking);

      const title = fields.title || fields.destination || '未命名行程';
      fields.attachments = getAttachments();
      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields });
      } else {
        await add('lifeRecords', { title, fields, category: this.category });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 行程已添加');
    });
  }

  onDestroy() {}
}
