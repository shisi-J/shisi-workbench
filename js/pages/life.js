/**
 * 日常生活通用页面
 */

import { getByCategory, add, update, remove, getAll } from '../db.js';

const CATEGORY_CONFIG = {
  eat: { title: '吃', icon: '🍽️', desc: '记录每日饮食', unit: '餐' },
  fitness: { title: '健身', icon: '💪', desc: '记录运动打卡', unit: '次' },
  beauty: { title: '美丽', icon: '💄', desc: '护肤美容记录', unit: '次' },
  finance: { title: '理财', icon: '💎', desc: '收支投资记录', unit: '笔' },
  travel: { title: '旅游', icon: '✈️', desc: '旅行计划与记录', unit: '程' },
};

export default class LifePage {
  constructor({ container, route, params }) {
    this.container = container;
    this.route = route;
    this.params = params;
    this.category = params.category || 'eat';
    this.config = CATEGORY_CONFIG[this.category] || CATEGORY_CONFIG.eat;
    this.records = [];
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

  getHTML() {
    return `
      <div class="life-page">
        <div class="page-header">
          <div class="page-title">${this.config.icon} ${this.config.title}</div>
          <div class="page-subtitle">${this.config.desc} · 共 ${this.records.length} ${this.config.unit}</div>
        </div>

        ${this.renderListView()}

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderListView() {
    if (this.records.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">${this.config.icon}</div>
          <div class="empty-text">还没有记录<br>点击右下角 + 添加</div>
        </div>
      `;
    }
    return `
      <div id="recordList">
        ${this.records.map(r => {
          const fields = r.fields || {};
          const date = r.createdAt?.slice(0, 10) || '';
          return `
            <div class="list-item" data-id="${r.id}">
              <div class="list-item-icon">${this.config.icon}</div>
              <div class="list-item-content">
                <div class="list-item-title">${fields.title || fields.name || '记录'}</div>
                <div class="list-item-subtitle">
                  ${Object.entries(fields).filter(([k,v]) => k !== 'title' && k !== 'remark' && v).slice(0, 3).map(([k,v]) => `${k}: ${v}`).join(' · ')}
                  ${date ? ` · ${date}` : ''}
                </div>
                ${fields.remark ? `<div class="list-item-subtitle" style="margin-top: 2px;">📝 ${fields.remark}</div>` : ''}
              </div>
              <div style="display: flex; gap: var(--space-1);">
                <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary); padding: var(--space-2);">✏️</button>
                <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary); padding: var(--space-2);">🗑</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }



  bindEvents() {
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

    // 列表项点击编辑
    document.querySelectorAll('.list-item[data-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        // 排除按钮/链接点击
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(item.getAttribute('data-id'));
        const record = this.records.find(r => r.id === id);
        if (record) this.showFormModal(record);
      });
      item.style.cursor = 'pointer';
    });

    document.getElementById('addRecordBtn')?.addEventListener('click', () => {
      this.showFormModal();
    });
  }

  showFormModal(record = null) {
    const isEdit = !!record;
    const fields = this.getFormFields();
    const existing = record?.fields || {};

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑记录' : '添加记录'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        ${fields.map(f => {
          const val = existing[f.key] || '';
          if (f.type === 'textarea') {
            return `<div class="form-group"><label class="form-label">${f.label}</label><textarea class="form-textarea" id="field_${f.key}">${val}</textarea></div>`;
          }
          if (f.type === 'select') {
            return `<div class="form-group"><label class="form-label">${f.label}</label><select class="form-select" id="field_${f.key}"><option value="">请选择</option>${f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
          }
          return `<div class="form-group"><label class="form-label">${f.label}</label><input type="${f.type === 'number' ? 'number' : 'text'}" class="form-input" id="field_${f.key}" value="${val}" placeholder="输入${f.label}"></div>`;
        }).join('')}
        <button class="btn btn-primary btn-block" id="saveRecord">保存</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fieldData = {};
      for (const f of fields) {
        fieldData[f.key] = document.getElementById(`field_${f.key}`).value.trim();
      }
      const title = fieldData.title || fieldData.name || fieldData.weight || '记录';

      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields: fieldData });
      } else {
        await add('lifeRecords', { title, fields: fieldData, category: this.category });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  getFormFields() {
    const common = [
      { key: 'title', label: '标题', type: 'text' },
      { key: 'remark', label: '备注', type: 'textarea' },
    ];

    const specific = {
      eat: [
        { key: 'meal', label: '餐次', type: 'select', options: ['早餐', '午餐', '晚餐', '加餐'] },
        { key: 'food', label: '食物', type: 'text' },
        { key: 'calories', label: '热量(kcal)', type: 'number' },
      ],
      fitness: [
        { key: 'exercise', label: '运动项目', type: 'text' },
        { key: 'duration', label: '时长(分钟)', type: 'number' },
        { key: 'calories', label: '消耗(kcal)', type: 'number' },
      ],
      beauty: [
        { key: 'item', label: '项目', type: 'text' },
        { key: 'product', label: '使用产品', type: 'text' },
      ],

      finance: [
        { key: 'type', label: '类型', type: 'select', options: ['收入', '支出', '投资'] },
        { key: 'amount', label: '金额', type: 'number' },
        { key: 'category', label: '分类', type: 'text' },
      ],
      travel: [
        { key: 'destination', label: '目的地', type: 'text' },
        { key: 'startDate', label: '出发日期', type: 'text' },
        { key: 'endDate', label: '返回日期', type: 'text' },
        { key: 'budget', label: '预算', type: 'number' },
      ],
    };

    return [...(specific[this.category] || []), ...common];
  }

  onDestroy() {}
}
