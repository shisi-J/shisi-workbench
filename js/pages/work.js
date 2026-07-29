/**
 * 工作台账通用页面
 * 结构化表单录入 + 筛选 + Excel导出
 */

import { getByCategory, add, update, remove, getAll } from '../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../utils/attachments.js';

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 工作分类配置 - 每个分类有不同的字段定义
const CATEGORY_CONFIG = {
  project: {
    title: '项目管理',
    icon: '📊',
    desc: '跟踪项目进度，管理关键节点',
    fields: [
      { key: 'projectName', label: '项目名称', type: 'text', required: true },
      { key: 'client', label: '客户/甲方', type: 'text' },
      { key: 'status', label: '状态', type: 'select', options: ['规划中', '进行中', '待验收', '已完成', '已搁置'] },
      { key: 'startDate', label: '开始日期', type: 'date' },
      { key: 'endDate', label: '截止日期', type: 'date' },
      { key: 'budget', label: '预算金额', type: 'number' },
      { key: 'manager', label: '负责人', type: 'text' },
      { key: 'progress', label: '进度(%)', type: 'number' },
      { key: 'remark', label: '备注', type: 'textarea' },
    ],
  },
  procurement: {
    title: '采销管理',
    icon: '📦',
    desc: '采购销售台账，掌控收支流水',
    fields: [
      { key: 'itemName', label: '品名', type: 'text', required: true },
      { key: 'type', label: '类型', type: 'select', options: ['采购', '销售', '退货'] },
      { key: 'supplier', label: '供应商/客户', type: 'text' },
      { key: 'quantity', label: '数量', type: 'number' },
      { key: 'unit', label: '单位', type: 'text' },
      { key: 'unitPrice', label: '单价', type: 'number' },
      { key: 'totalAmount', label: '总金额', type: 'number' },
      { key: 'orderDate', label: '下单日期', type: 'date' },
      { key: 'status', label: '状态', type: 'select', options: ['待下单', '已下单', '已发货', '已签收', '已付款'] },
      { key: 'remark', label: '备注', type: 'textarea' },
    ],
  },
  finance: {
    title: '财务收付款',
    icon: '💰',
    desc: '收付款记录与票据管理',
    fields: [
      { key: 'type', label: '类型', type: 'select', options: ['收款', '付款', '报销'], required: true },
      { key: 'amount', label: '金额', type: 'number', required: true },
      { key: 'counterparty', label: '对方单位', type: 'text' },
      { key: 'category', label: '分类', type: 'select', options: ['货款', '服务费', '工资', '社保', '公积金', '税费', '其他'] },
      { key: 'payDate', label: '收付日期', type: 'date' },
      { key: 'method', label: '支付方式', type: 'select', options: ['银行转账', '微信', '支付宝', '现金', '支票'] },
      { key: 'invoiceType', label: '票据类型', type: 'select', options: ['无', '增值税专票', '增值税普票', '收据'] },
      { key: 'invoiceNo', label: '票据编号', type: 'text' },
      { key: 'status', label: '状态', type: 'select', options: ['待支付', '已支付', '已开票', '已完成'] },
      { key: 'remark', label: '备注', type: 'textarea' },
    ],
  },
  hr: {
    title: '人资社保公积金',
    icon: '👥',
    desc: '员工社保公积金台账',
    fields: [
      { key: 'employeeName', label: '员工姓名', type: 'text', required: true },
      { key: 'idNumber', label: '身份证号', type: 'text' },
      { key: 'itemType', label: '项目', type: 'select', options: ['社保', '公积金', '社保+公积金'] },
      { key: 'baseAmount', label: '缴纳基数', type: 'number' },
      { key: 'companyPart', label: '单位部分', type: 'number' },
      { key: 'personalPart', label: '个人部分', type: 'number' },
      { key: 'payMonth', label: '缴纳月份', type: 'date' },
      { key: 'status', label: '状态', type: 'select', options: ['待缴纳', '已缴纳', '已补缴', '已停缴'] },
      { key: 'remark', label: '备注', type: 'textarea' },
    ],
  },
  info: {
    title: '信息对接台账',
    icon: '📋',
    desc: '信息传递记录，确保不遗漏',
    fields: [
      { key: 'title', label: '信息标题', type: 'text', required: true },
      { key: 'fromParty', label: '来源方', type: 'text' },
      { key: 'toParty', label: '接收方', type: 'text' },
      { key: 'channel', label: '渠道', type: 'select', options: ['微信', '电话', '邮件', '会议', '文件', '其他'] },
      { key: 'content', label: '内容摘要', type: 'textarea' },
      { key: 'receiveDate', label: '接收日期', type: 'date' },
      { key: 'deadline', label: '处理期限', type: 'date' },
      { key: 'status', label: '状态', type: 'select', options: ['待处理', '处理中', '已完成', '已取消'] },
      { key: 'handler', label: '处理人', type: 'text' },
      { key: 'remark', label: '备注', type: 'textarea' },
    ],
  },
};

export default class WorkPage {
  constructor({ container, route, params, navigate }) {
    this.container = container;
    this.route = route;
    this.params = params;
    this.navigate = navigate;
    this.category = params.category || 'project';
    this.config = CATEGORY_CONFIG[this.category] || CATEGORY_CONFIG.project;
    this.records = [];
    this.filterStatus = 'all';
    this.searchKeyword = '';
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.records = await getByCategory('workRecords', this.category);
    } catch (e) {
      this.records = [];
    }
  }

  getHTML() {
    const filtered = this.getFiltered();
    const statusField = this.config.fields.find(f => f.key === 'status');
    const statuses = statusField?.options || [];

    return `
      <div class="work-page">
        <div class="page-header">
          <div class="page-title">${this.config.icon} ${this.config.title}</div>
          <div class="page-subtitle">${this.config.desc}</div>
        </div>

        <!-- 工具栏 -->
        <div class="card" style="padding: var(--space-3);">
          <div style="display: flex; gap: var(--space-2); align-items: center;">
            <input type="text" class="form-input" id="searchInput" placeholder="搜索..." value="${this.searchKeyword}" style="flex: 1;">
            <button class="btn btn-secondary btn-sm" id="exportBtn">📊 导出</button>
          </div>
          ${statuses.length > 0 ? `
            <div class="filter-bar" style="margin-top: var(--space-2); padding: 0;">
              <div class="filter-chip ${this.filterStatus === 'all' ? 'active' : ''}" data-st="all">全部 ${this.records.length}</div>
              ${statuses.map(st => {
                const count = this.records.filter(r => r.fields?.status === st).length;
                return `<div class="filter-chip ${this.filterStatus === st ? 'active' : ''}" data-st="${st}">${st} ${count}</div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>

        <!-- 记录列表 -->
        <div id="recordList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">${this.config.icon}</div>
              <div class="empty-text">暂无记录<br>点击右下角 + 添加</div>
            </div>
          ` : filtered.map(record => this.renderRecord(record)).join('')}
        </div>

        <!-- 添加按钮 -->
        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderRecord(record) {
    const fields = record.fields || {};
    const titleField = this.config.fields.find(f => f.required) || this.config.fields[0];
    const title = fields[titleField.key] || '未命名';
    const status = fields.status;
    const statusBadge = status ? `<span class="tag ${this.getStatusClass(status)}">${status}</span>` : '';

    // 获取关键信息展示
    const keyFields = this.config.fields.slice(0, 4).filter(f => f.key !== 'remark' && fields[f.key]);
    const infoItems = keyFields.map(f => {
      let val = fields[f.key];
      if (f.type === 'number' && val) val = `¥${val}`;
      if (f.type === 'date' && val) val = val.slice(0, 10);
      return `<span style="font-size: var(--font-sm); color: var(--text-tertiary);">${f.label}: ${val}</span>`;
    }).join(' · ');

    return `
      <div class="list-item" data-id="${record.id}" style="cursor: pointer;">
        <div class="list-item-icon">${this.config.icon}</div>
        <div class="list-item-content">
          <div class="list-item-title">${title}</div>
          <div class="list-item-subtitle" style="display: flex; gap: var(--space-1); flex-wrap: wrap;">
            ${statusBadge}
            ${infoItems}
          </div>
          ${renderAttachmentList(fields.attachments, record.id)}
        </div>
        <div style="display: flex; gap: var(--space-1);">
          <button data-action="edit" data-id="${record.id}" style="color: var(--text-tertiary); padding: var(--space-2);">✏️</button>
          <button data-action="delete" data-id="${record.id}" style="color: var(--text-tertiary); padding: var(--space-2);">🗑</button>
        </div>
      </div>
    `;
  }

  getStatusClass(status) {
    const doneStatuses = ['已完成', '已支付', '已缴纳', '已签收'];
    const pendingStatuses = ['待支付', '待缴纳', '待处理', '待下单', '规划中'];
    if (doneStatuses.includes(status)) return 'tag-success';
    if (pendingStatuses.includes(status)) return 'tag-warning';
    if (status === '已搁置' || status === '已取消') return 'tag-danger';
    return 'tag-brand';
  }

  getFiltered() {
    let filtered = [...this.records];
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(r => r.fields?.status === this.filterStatus);
    }
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      filtered = filtered.filter(r => {
        const allValues = Object.values(r.fields || {}).join(' ').toLowerCase();
        return allValues.includes(kw);
      });
    }
    return filtered;
  }

  bindEvents() {
    // 搜索
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      this.searchKeyword = e.target.value;
      const filtered = this.getFiltered();
      const list = document.getElementById('recordList');
      list.innerHTML = filtered.length === 0
        ? `<div class="empty-state"><div class="empty-icon">${this.config.icon}</div><div class="empty-text">未找到匹配记录</div></div>`
        : filtered.map(r => this.renderRecord(r)).join('');
      this.bindListEvents();
    });

    // 筛选
    document.querySelectorAll('[data-st]').forEach(el => {
      el.addEventListener('click', () => {
        this.filterStatus = el.getAttribute('data-st');
        this.render();
      });
    });

    // 导出
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportExcel();
    });

    // 列表事件
    this.bindListEvents();

    // 添加
    document.getElementById('addRecordBtn')?.addEventListener('click', () => {
      this.showFormModal();
    });
  }

  bindListEvents() {
    // 列表项点击编辑
    document.querySelectorAll('.list-item[data-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        // 排除按钮/链接点击
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(item.getAttribute('data-id'));
        const record = this.records.find(r => r.id === id);
        if (record) this.showFormModal(record);
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
        await remove('workRecords', id);
        await this.loadData();
        this.render();
        window.showToast('已删除');
      });
    });

    // 附件点击：预览/下载
    bindCardAttachmentClicks(this.records);
  }

  showFormModal(record = null) {
    const isEdit = !!record;
    const fields = this.config.fields;
    const existingValues = record?.fields || {};

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑记录' : '添加记录'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        ${fields.map(f => {
          const val = existingValues[f.key] || '';
          if (f.type === 'select') {
            return `
              <div class="form-group">
                <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
                <select class="form-select" id="field_${f.key}">
                  <option value="">请选择</option>
                  ${f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
              </div>
            `;
          }
          if (f.type === 'textarea') {
            return `
              <div class="form-group">
                <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
                <textarea class="form-textarea" id="field_${f.key}" placeholder="输入${f.label}...">${val}</textarea>
              </div>
            `;
          }
          return `
            <div class="form-group">
              <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
              <input type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}"
                class="form-input" id="field_${f.key}" placeholder="输入${f.label}" value="${val}">
            </div>
          `;
        }).join('')}
        ${renderUploadField(existingValues.attachments || [])}
        <button class="btn btn-primary btn-block" id="saveRecord">${isEdit ? '更新' : '保存'}</button>
      </div>
    `;
    document.body.appendChild(modal);

    const getAttachments = initUploadHandlers(modal, existingValues.attachments || []);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fieldData = {};
      for (const f of fields) {
        const el = document.getElementById(`field_${f.key}`);
        fieldData[f.key] = el.value.trim();
        if (f.required && !fieldData[f.key]) {
          window.showToast(`请填写${f.label}`);
          return;
        }
      }

      const titleField = fields.find(f => f.required) || fields[0];
      const title = fieldData[titleField.key];

      fieldData.attachments = getAttachments();

      if (isEdit) {
        await update('workRecords', record.id, { title, fields: fieldData });
      } else {
        await add('workRecords', { title, fields: fieldData, status: fieldData.status || '', category: this.category });
      }

      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  exportExcel() {
    const data = this.getFiltered();
    if (data.length === 0) {
      window.showToast('暂无数据可导出');
      return;
    }

    // 构建导出数据
    const fields = this.config.fields;
    const headers = fields.map(f => f.label);
    const rows = data.map(record => {
      const vals = fields.map(f => record.fields?.[f.key] || '');
      return vals;
    });

    // 使用 SheetJS 导出
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, this.config.title);

    const date = localDateStr(new Date());
    XLSX.writeFile(wb, `${this.config.title}-${date}.xlsx`);
    window.showToast('✅ 已导出 Excel');
  }

  onDestroy() {}
}
