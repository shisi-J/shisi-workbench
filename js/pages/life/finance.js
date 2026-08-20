/**
 * 理财 · 收支记账页面框架
 * 规划功能：收支分类录入、自动统计月度结余与储蓄目标进度、导出账单
 * 本次迭代：页面框架 + 基础数据加载，UI细节后续填充
 */

import { getByCategory, add, update, remove, getSetting, setSetting } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const INCOME_CATEGORIES = ['工资', '副业', '投资收益', '红包礼金', '其他收入'];
const EXPENSE_CATEGORIES = ['餐饮', '交通', '住房', '购物', '娱乐', '医疗', '教育', '日用', '其他支出'];

export default class LifeFinancePage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'finance';
    this.records = [];
    this.savingsGoal = null;
    this.filterType = '';
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.records = await getByCategory('lifeRecords', this.category);
      this.savingsGoal = await getSetting('finance_savings_goal', null);
    } catch (e) {
      this.records = [];
    }
  }

  getFiltered() {
    let filtered = [...this.records];
    if (this.filterType) {
      filtered = filtered.filter(r => r.fields?.type === this.filterType);
    }
    return filtered;
  }

  getHTML() {
    const now = new Date();
    const monthStr = localDateStr(now).slice(0, 7);
    const monthRecords = this.records.filter(r => r.createdAt?.startsWith(monthStr));

    let monthIncome = 0, monthExpense = 0, monthInvest = 0;
    monthRecords.forEach(r => {
      const amt = parseFloat(r.fields?.amount) || 0;
      const type = r.fields?.type;
      if (type === '收入') monthIncome += amt;
      else if (type === '支出') monthExpense += amt;
      else if (type === '投资') monthInvest += amt;
    });
    const monthBalance = monthIncome - monthExpense;
    const goalProgress = this.savingsGoal ? Math.min(100, ((monthBalance / parseFloat(this.savingsGoal)) * 100).toFixed(0)) : null;

    return `
      <div class="life-finance-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">💎 理财 · 收支记账</div>
          <div class="page-subtitle">${now.getFullYear()}年${now.getMonth() + 1}月 · 共 ${this.records.length} 笔</div>
        </div>

        <!-- 月度统计 -->
        <div class="stats-grid">
          <div class="stat-card gradient">
            <div class="stat-icon">💰</div>
            <div class="stat-label">本月收入</div>
            <div class="stat-value">¥${monthIncome.toFixed(0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💸</div>
            <div class="stat-label">本月支出</div>
            <div class="stat-value" style="color: var(--danger);">¥${monthExpense.toFixed(0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-label">本月结余</div>
            <div class="stat-value" style="color: ${monthBalance >= 0 ? 'var(--success)' : 'var(--danger)'};">¥${monthBalance.toFixed(0)}</div>
          </div>
          ${this.savingsGoal ? `
            <div class="stat-card">
              <div class="stat-icon">🎯</div>
              <div class="stat-label">储蓄目标 ¥${this.savingsGoal}</div>
              <div class="stat-value" style="font-size: var(--font-md); color: ${goalProgress >= 100 ? 'var(--success)' : 'var(--warning)'};">${goalProgress}%</div>
            </div>
          ` : ''}
        </div>

        <!-- 操作栏 -->
        <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-3);">
          <button class="btn btn-outline btn-sm" id="exportBtn">📊 导出账单</button>
          <button class="btn btn-outline btn-sm" id="setGoalBtn">🎯 设置储蓄目标</button>
        </div>

        <!-- 筛选 -->
        <div class="filter-bar">
          <div class="filter-chip ${!this.filterType ? 'active' : ''}" data-typefilter="">全部</div>
          <div class="filter-chip ${this.filterType === '收入' ? 'active' : ''}" data-typefilter="收入">收入</div>
          <div class="filter-chip ${this.filterType === '支出' ? 'active' : ''}" data-typefilter="支出">支出</div>
          <div class="filter-chip ${this.filterType === '投资' ? 'active' : ''}" data-typefilter="投资">投资</div>
        </div>

        <!-- 记录列表 -->
        <div id="recordList">
          ${this.getFiltered().length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">💎</div>
              <div class="empty-text">${this.records.length === 0 ? '还没有收支记录<br>点击 + 记一笔' : '没有匹配的记录'}</div>
            </div>
          ` : this.getFiltered().reverse().map(r => this.renderCard(r)).join('')}
        </div>

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderCard(r) {
    const f = r.fields || {};
    const date = r.createdAt?.slice(0, 10) || '';
    const typeColor = f.type === '收入' ? 'var(--success)' : (f.type === '支出' ? 'var(--danger)' : 'var(--brand)');
    const typeIcon = f.type === '收入' ? '💰' : (f.type === '支出' ? '💸' : '📈');

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${typeIcon} ${f.title || f.category || '记账'}</div>
          <div style="display: flex; gap: var(--space-1); align-items: center;">
            <span style="font-weight: var(--weight-bold); color: ${typeColor};">¥${f.amount || 0}</span>
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm); color: var(--text-tertiary);">
          <span class="tag" style="margin-right: var(--space-1);">${f.type || ''}</span>
          ${f.category ? `<span style="margin-right: var(--space-2);">${f.category}</span>` : ''}
          ${date}
        </div>
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
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
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
    document.getElementById('setGoalBtn')?.addEventListener('click', () => this.showGoalModal());
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
          <div class="modal-title">${isEdit ? '编辑记录' : '记一笔'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">类型</label>
          <select class="form-select" id="field_type">
            <option value="收入" ${f.type === '收入' ? 'selected' : ''}>💰 收入</option>
            <option value="支出" ${f.type === '支出' ? 'selected' : ''}>💸 支出</option>
            <option value="投资" ${f.type === '投资' ? 'selected' : ''}>📈 投资</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">金额(¥)</label>
          <input type="number" step="0.01" class="form-input" id="field_amount" value="${f.amount || ''}" placeholder="0.00" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="form-select" id="field_category">
            <option value="">请选择</option>
            ${[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map(o => `<option value="${o}" ${f.category === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <input type="text" class="form-input" id="field_remark" value="${f.remark || ''}" placeholder="可选备注">
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

    // 类型联动分类
    const typeSelect = document.getElementById('field_type');
    const catSelect = document.getElementById('field_category');
    typeSelect.addEventListener('change', () => {
      const type = typeSelect.value;
      const cats = type === '收入' ? INCOME_CATEGORIES : (type === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);
      catSelect.innerHTML = '<option value="">请选择</option>' + cats.map(o => `<option value="${o}">${o}</option>`).join('');
    });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = {};
      ['type', 'amount', 'category', 'remark'].forEach(k => {
        fields[k] = document.getElementById(`field_${k}`).value.trim();
      });
      if (!fields.amount) { window.showToast('请输入金额'); return; }
      const title = `${fields.type} ¥${fields.amount}`;
      fields.attachments = getAttachments();
      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields });
      } else {
        await add('lifeRecords', { title, fields, category: this.category });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已记录');
    });
  }

  showGoalModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">🎯 设置月度储蓄目标</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">每月目标存多少钱？(¥)</label>
          <input type="number" class="form-input" id="goalInput" value="${this.savingsGoal || ''}" placeholder="如：5000" autofocus>
        </div>
        <button class="btn btn-primary btn-block" id="saveGoal">保存</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveGoal').addEventListener('click', async () => {
      const val = document.getElementById('goalInput').value.trim();
      if (val) {
        await setSetting('finance_savings_goal', val);
        this.savingsGoal = val;
        close();
        this.render();
        window.showToast('✅ 储蓄目标已设置');
      }
    });
  }

  exportData() {
    if (this.records.length === 0) {
      window.showToast('暂无数据可导出');
      return;
    }

    const headers = ['日期', '类型', '金额', '分类', '备注'];
    const rows = this.records.map(r => {
      const f = r.fields || {};
      return [
        (r.createdAt || '').slice(0, 10),
        f.type || '',
        f.amount || '',
        f.category || '',
        f.remark || '',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '账单');
    const date = localDateStr(new Date());
    XLSX.writeFile(wb, `账单-${date}.xlsx`);
    window.showToast('✅ 账单已导出');
  }

  onDestroy() {}
}
