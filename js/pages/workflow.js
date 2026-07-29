/**
 * 工作流页面
 * 管理标准化流程，支持步骤编排和分类筛选
 */

import { getAll, add, update, remove } from '../db.js';

const CATEGORIES = [
  { key: 'all', label: '全部', icon: '📋' },
  { key: 'daily', label: '日常', icon: '🔄' },
  { key: 'project', label: '项目', icon: '📊' },
  { key: 'finance', label: '财务', icon: '💰' },
  { key: 'hr', label: '人事', icon: '👥' },
  { key: 'other', label: '其他', icon: '📌' },
];

export default class WorkflowPage {
  constructor({ container, route, navigate }) {
    this.container = container;
    this.route = route;
    this.navigate = navigate;
    this.filterCategory = 'all';
    this.allItems = [];
  }

  async render() {
    try {
      this.allItems = await getAll('workflows');
    } catch (e) {
      this.allItems = [];
    }

    const totalCount = this.allItems.length;

    this.container.innerHTML = `
      <div class="workflow-page">
        <div class="page-header">
          <div class="page-title">📋 工作流</div>
          <div class="page-subtitle">标准化你的重复性工作 · 共 ${totalCount} 个流程</div>
        </div>

        <!-- 分类筛选 -->
        <div class="filter-row" id="wfFilters" style="margin-bottom: var(--space-3);">
          ${CATEGORIES.map(c => `
            <button class="filter-chip ${this.filterCategory === c.key ? 'active' : ''}" data-cat="${c.key}">
              ${c.icon} ${c.label}
            </button>
          `).join('')}
        </div>

        <!-- 工作流列表 -->
        <div id="wfList">
          ${this.renderList()}
        </div>

        <!-- 添加按钮 -->
        <button class="fab" id="addWorkflow" aria-label="添加工作流">+</button>
      </div>
    `;

    this.bindEvents();
  }

  renderList() {
    let items = this.allItems;
    if (this.filterCategory !== 'all') {
      items = items.filter(i => i.category === this.filterCategory);
    }
    items = [...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (items.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">还没有工作流<br>点击 + 创建第一个流程</div>
        </div>
      `;
    }

    return items.map(item => {
      const cat = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[5];
      const steps = item.steps || [];
      const stepCount = steps.length;
      const date = (item.createdAt || '').slice(0, 10);
      return `
        <div class="card list-item-card" data-id="${item.id}" style="margin-bottom: var(--space-2); cursor: pointer;">
          <div style="display: flex; align-items: flex-start; gap: var(--space-2);">
            <span style="font-size: 20px; flex-shrink: 0;">${cat.icon}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);">
                <div class="list-item-title" style="font-weight: var(--weight-semibold);">${this.escape(item.title || '未命名流程')}</div>
                <span class="badge" style="background: var(--brand-lighter); color: var(--text-brand); font-size: var(--font-xs); padding: 2px 8px; border-radius: var(--radius-full); flex-shrink: 0;">${stepCount} 步</span>
              </div>
              ${steps.length > 0 ? `
                <div style="margin-top: var(--space-2);">
                  ${steps.slice(0, 3).map((s, i) => `
                    <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 2px;">
                      <span style="width: 18px; height: 18px; border-radius: 50%; background: var(--brand-lighter); color: var(--text-brand); font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${i + 1}</span>
                      <span>${this.escape(s.text || s)}</span>
                    </div>
                  `).join('')}
                  ${steps.length > 3 ? `<div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-left: 24px;">还有 ${steps.length - 3} 步...</div>` : ''}
                </div>
              ` : ''}
              <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 4px;">${date}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    document.querySelectorAll('#wfFilters .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterCategory = chip.getAttribute('data-cat');
        document.querySelectorAll('#wfFilters .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('wfList').innerHTML = this.renderList();
        this.bindListEvents();
      });
    });

    document.getElementById('addWorkflow')?.addEventListener('click', () => {
      this.showModal();
    });

    this.bindListEvents();
  }

  bindListEvents() {
    document.querySelectorAll('#wfList .list-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.getAttribute('data-id'));
        const item = this.allItems.find(i => i.id === id);
        if (item) this.showModal(item);
      });
    });
  }

  showModal(item = null) {
    const isEdit = !!item;
    const steps = item?.steps || [];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑工作流' : '创建工作流'}</div>
          <button class="modal-close" id="wfClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">流程名称</label>
          <input type="text" class="form-input" id="wfTitle" placeholder="如：月度财务结算流程" value="${this.escape(item?.title || '')}" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="form-select" id="wfCategory">
            ${CATEGORIES.filter(c => c.key !== 'all').map(c => `
              <option value="${c.key}" ${item?.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">流程步骤</label>
          <div id="wfSteps" style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${steps.length > 0 ? steps.map((s, i) => this.renderStepInput(i, s.text || s)).join('') : this.renderStepInput(0, '')}
          </div>
          <button class="btn btn-outline btn-sm" id="wfAddStep" style="margin-top: var(--space-2); width: 100%;">+ 添加步骤</button>
        </div>
        ${isEdit ? `
          <div style="display: flex; gap: var(--space-2);">
            <button class="btn btn-danger" id="wfDelete" style="flex: 0 0 auto;">删除</button>
            <button class="btn btn-primary btn-block" id="wfSave">保存</button>
          </div>
        ` : `
          <button class="btn btn-primary btn-block" id="wfSave">保存</button>
        `}
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('wfClose')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    let stepIndex = modal.querySelectorAll('#wfSteps .wf-step-input').length;

    document.getElementById('wfAddStep')?.addEventListener('click', () => {
      const container = modal.querySelector('#wfSteps');
      const div = document.createElement('div');
      div.innerHTML = this.renderStepInput(stepIndex, '');
      container.appendChild(div.firstElementChild);
      stepIndex++;
    });

    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('wf-step-remove')) {
        e.target.closest('.wf-step-row').remove();
      }
    });

    document.getElementById('wfSave')?.addEventListener('click', async () => {
      const title = document.getElementById('wfTitle').value.trim();
      if (!title) { window.showToast('请输入流程名称'); return; }
      const category = document.getElementById('wfCategory').value;
      const stepInputs = modal.querySelectorAll('.wf-step-input');
      const newSteps = Array.from(stepInputs).map(input => ({ text: input.value.trim() })).filter(s => s.text);

      try {
        if (isEdit) {
          await update('workflows', item.id, { title, category, steps: newSteps });
          window.showToast('已更新');
        } else {
          await add('workflows', { title, category, steps: newSteps });
          window.showToast('已创建');
        }
        close();
        await this.render();
      } catch (e) {
        window.showToast('保存失败：' + e.message);
      }
    });

    document.getElementById('wfDelete')?.addEventListener('click', async () => {
      if (!confirm('确定删除这个工作流？')) return;
      try {
        await remove('workflows', item.id);
        window.showToast('已删除');
        close();
        await this.render();
      } catch (e) {
        window.showToast('删除失败：' + e.message);
      }
    });
  }

  renderStepInput(index, value) {
    return `
      <div class="wf-step-row" style="display: flex; gap: var(--space-1); align-items: center;">
        <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--brand-lighter); color: var(--text-brand); font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${index + 1}</span>
        <input type="text" class="form-input wf-step-input" placeholder="步骤 ${index + 1}" value="${this.escape(value)}" style="flex: 1;">
        ${index > 0 ? '<button class="wf-step-remove" style="background: none; border: none; color: var(--danger); font-size: 18px; padding: 4px 8px; cursor: pointer;">✕</button>' : ''}
      </div>
    `;
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  onDestroy() {}
}
