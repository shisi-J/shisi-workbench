/**
 * 社交 · 人情往来页面
 * 三大子模块：人情礼尚往来 / 聚会聚餐 / 活动
 * 功能：礼尚往来记账、关系维护提醒、聚会记录、活动管理
 */

import { getByCategory, add, update, remove } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

// 本地日期格式化
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 子分类
const TABS = [
  { key: 'gift', label: '礼尚往来', icon: '🎁' },
  { key: 'gathering', label: '聚会聚餐', icon: '🍽️' },
  { key: 'activity', label: '活动', icon: '🎉' },
];

// 礼物类型
const GIFT_TYPES = ['红包', '礼品', '宴请', '伴手礼', '礼金', '其他'];
// 关系标签
const RELATION_OPTIONS = ['家人', '恋人', '亲戚', '朋友', '同事', '同学', '邻居', '商业伙伴', '其他'];
// 场景
const SCENE_OPTIONS = ['婚礼', '生日', '节日', '满月', '乔迁', '探病', '丧事', '日常', '感谢', '道歉', '其他'];
// 聚会类型
const GATHERING_TYPES = ['家庭聚餐', '朋友聚会', '同事团建', '商务宴请', '生日派对', '节日庆祝', '其他'];
// 活动类型
const ACTIVITY_TYPES = ['户外运动', '文化展览', '演出观影', '旅游出行', '志愿服务', '学习培训', '兴趣社团', '其他'];

export default class SocialPage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'social';
    this.records = [];
    this.activeTab = 'gift';
    this.filterRelation = '';
    this.filterScene = '';
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
    let filtered = this.records.filter(r => r.fields?.subType === this.activeTab);
    if (this.filterRelation) {
      filtered = filtered.filter(r => r.fields?.relation === this.filterRelation);
    }
    if (this.filterScene) {
      if (this.activeTab === 'gathering') {
        filtered = filtered.filter(r => r.fields?.gatheringType === this.filterScene);
      } else if (this.activeTab === 'activity') {
        filtered = filtered.filter(r => r.fields?.activityType === this.filterScene);
      } else {
        filtered = filtered.filter(r => r.fields?.scene === this.filterScene);
      }
    }
    return filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  // 统计数据
  getGiftStats() {
    const gifts = this.records.filter(r => r.fields?.subType === 'gift');
    const given = gifts.filter(r => r.fields?.direction === '送出');
    const received = gifts.filter(r => r.fields?.direction === '收到');
    const givenValue = given.reduce((sum, r) => sum + (parseFloat(r.fields?.value) || 0), 0);
    const receivedValue = received.reduce((sum, r) => sum + (parseFloat(r.fields?.value) || 0), 0);
    const needReturn = gifts.filter(r => r.fields?.status === '需要回礼').length;
    return { given: given.length, received: received.length, givenValue, receivedValue, needReturn };
  }

  getGatheringStats() {
    const gatherings = this.records.filter(r => r.fields?.subType === 'gathering');
    const totalCost = gatherings.reduce((sum, r) => sum + (parseFloat(r.fields?.cost) || 0), 0);
    const totalPeople = gatherings.reduce((sum, r) => sum + (parseInt(r.fields?.peopleCount) || 0), 0);
    return { count: gatherings.length, totalCost, totalPeople };
  }

  getActivityStats() {
    const activities = this.records.filter(r => r.fields?.subType === 'activity');
    const upcoming = activities.filter(r => r.fields?.activityDate >= localDateStr(new Date()) && r.fields?.status !== '已结束').length;
    const finished = activities.filter(r => r.fields?.status === '已结束').length;
    return { count: activities.length, upcoming, finished };
  }

  getHTML() {
    const filtered = this.getFiltered();
    return `
      <div class="life-social-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">🤝 社交 · 人情往来</div>
          <div class="page-subtitle">礼尚往来 · 聚会聚餐 · 活动管理</div>
        </div>

        <!-- Tab切换 -->
        <div class="social-tabs">
          ${TABS.map(t => `
            <div class="social-tab ${this.activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
              <span class="social-tab-icon">${t.icon}</span>
              <span class="social-tab-label">${t.label}</span>
            </div>
          `).join('')}
        </div>

        <!-- 内容区 -->
        <div id="socialContent">
          ${this.renderTabContent()}
        </div>

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderTabContent() {
    if (this.activeTab === 'gift') return this.renderGiftTab();
    if (this.activeTab === 'gathering') return this.renderGatheringTab();
    return this.renderActivityTab();
  }

  // === 礼尚往来 Tab ===
  renderGiftTab() {
    const stats = this.getGiftStats();
    const filtered = this.getFiltered();
    return `
      <!-- 统计卡片 -->
      <div class="social-stats-row">
        <div class="social-stat-card give">
          <div class="social-stat-icon">📤</div>
          <div class="social-stat-num">${stats.given}</div>
          <div class="social-stat-label">送出</div>
          <div class="social-stat-value">¥${stats.givenValue}</div>
        </div>
        <div class="social-stat-card receive">
          <div class="social-stat-icon">📥</div>
          <div class="social-stat-num">${stats.received}</div>
          <div class="social-stat-label">收到</div>
          <div class="social-stat-value">¥${stats.receivedValue}</div>
        </div>
        <div class="social-stat-card return">
          <div class="social-stat-icon">🔄</div>
          <div class="social-stat-num">${stats.needReturn}</div>
          <div class="social-stat-label">待回礼</div>
          <div class="social-stat-value">${stats.needReturn > 0 ? '需关注' : '无'}</div>
        </div>
      </div>

      <!-- 关系筛选 -->
      <div class="filter-bar">
        <div class="filter-chip ${!this.filterRelation ? 'active' : ''}" data-relfilter="">全部关系</div>
        ${RELATION_OPTIONS.map(r => `<div class="filter-chip ${this.filterRelation === r ? 'active' : ''}" data-relfilter="${r}">${r}</div>`).join('')}
      </div>

      <!-- 记录列表 -->
      <div id="recordList">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🎁</div>
            <div class="empty-text">暂无人情记录<br>点击 + 添加礼尚往来</div>
          </div>
        ` : filtered.map(r => this.renderGiftCard(r)).join('')}
      </div>
    `;
  }

  renderGiftCard(r) {
    const f = r.fields || {};
    const isGiven = f.direction === '送出';
    const directionColor = isGiven ? '#EF476F' : '#06D6A0';
    const directionBg = isGiven ? 'rgba(239,71,111,0.12)' : 'rgba(6,214,160,0.12)';
    const needReturn = f.status === '需要回礼';
    const date = r.createdAt?.slice(0, 10) || f.date || '';

    return `
      <div class="card social-gift-card" data-id="${r.id}" style="border-left: 3px solid ${directionColor};">
        <div class="card-header">
          <div class="card-title">${f.giftType || '🎁'} ${f.contactName || '未记录'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          <span class="social-direction-tag" style="background:${directionBg};color:${directionColor};padding:2px 8px;border-radius:var(--radius-full);font-size:var(--font-xs);margin-right:var(--space-2);">${isGiven ? '📤 送出' : '📥 收到'}</span>
          ${f.relation ? `<span style="margin-right:var(--space-2);">💕 ${f.relation}</span>` : ''}
          ${f.scene ? `<span style="margin-right:var(--space-2);">🎉 ${f.scene}</span>` : ''}
          ${f.value ? `<span style="margin-right:var(--space-2);font-weight:600;color:${directionColor};">¥${f.value}</span>` : ''}
          ${date ? `<span style="color:var(--text-tertiary);">📅 ${date}</span>` : ''}
        </div>
        ${f.location ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📍 ${f.location}</div>` : ''}
        ${f.myFeeling || f.theirFeeling ? `
          <div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">
            ${f.myFeeling ? `<span style="margin-right:var(--space-2);">😊 我的感受: ${f.myFeeling}</span>` : ''}
            ${f.theirFeeling ? `<span>🙂 对方反应: ${f.theirFeeling}</span>` : ''}
          </div>
        ` : ''}
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-tertiary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${needReturn ? `<span class="tag" style="background:rgba(255,209,102,0.2);color:#FFD166;">⚠️ 需要回礼</span>` : ''}
          ${f.status && f.status !== '需要回礼' ? `<span class="tag" style="background:var(--bg-inset);color:var(--text-tertiary);">${f.status}</span>` : ''}
          ${!f.status ? `<span class="tag" style="background:rgba(6,214,160,0.12);color:#06D6A0;">✅ 已了结</span>` : ''}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  // === 聚会聚餐 Tab ===
  renderGatheringTab() {
    const stats = this.getGatheringStats();
    const filtered = this.getFiltered();
    return `
      <!-- 统计卡片 -->
      <div class="social-stats-row">
        <div class="social-stat-card">
          <div class="social-stat-icon">🍽️</div>
          <div class="social-stat-num">${stats.count}</div>
          <div class="social-stat-label">聚会次数</div>
        </div>
        <div class="social-stat-card">
          <div class="social-stat-icon">👥</div>
          <div class="social-stat-num">${stats.totalPeople}</div>
          <div class="social-stat-label">累计参与</div>
        </div>
        <div class="social-stat-card">
          <div class="social-stat-icon">💰</div>
          <div class="social-stat-num">¥${stats.totalCost}</div>
          <div class="social-stat-label">总花费</div>
        </div>
      </div>

      <!-- 类型筛选 -->
      <div class="filter-bar">
        <div class="filter-chip ${!this.filterScene ? 'active' : ''}" data-scfilter="">全部类型</div>
        ${GATHERING_TYPES.map(t => `<div class="filter-chip ${this.filterScene === t ? 'active' : ''}" data-scfilter="${t}">${t}</div>`).join('')}
      </div>

      <!-- 记录列表 -->
      <div id="recordList">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🍽️</div>
            <div class="empty-text">暂无聚会记录<br>点击 + 记录一次聚会</div>
          </div>
        ` : filtered.map(r => this.renderGatheringCard(r)).join('')}
      </div>
    `;
  }

  renderGatheringCard(r) {
    const f = r.fields || {};
    const date = f.date || r.createdAt?.slice(0, 10) || '';
    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${f.gatheringType || '🍽️'} ${f.title || '聚会'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${date ? `<span style="margin-right:var(--space-2);">📅 ${date}</span>` : ''}
          ${f.location ? `<span style="margin-right:var(--space-2);">📍 ${f.location}</span>` : ''}
          ${f.peopleCount ? `<span style="margin-right:var(--space-2);">👥 ${f.peopleCount}人</span>` : ''}
          ${f.cost ? `<span style="font-weight:600;color:var(--brand);">¥${f.cost}</span>` : ''}
        </div>
        ${f.participants ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">🙋 ${f.participants}</div>` : ''}
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-tertiary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${f.gatheringType ? `<span class="tag" style="background:var(--bg-inset);color:var(--text-tertiary);">${f.gatheringType}</span>` : ''}
          ${f.rating ? `<span class="tag" style="background:rgba(255,209,102,0.15);color:#FFD166;">${'⭐'.repeat(parseInt(f.rating))}</span>` : ''}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  // === 活动 Tab ===
  renderActivityTab() {
    const stats = this.getActivityStats();
    const filtered = this.getFiltered();
    return `
      <!-- 统计卡片 -->
      <div class="social-stats-row">
        <div class="social-stat-card">
          <div class="social-stat-icon">📊</div>
          <div class="social-stat-num">${stats.count}</div>
          <div class="social-stat-label">总活动</div>
        </div>
        <div class="social-stat-card">
          <div class="social-stat-icon">⏰</div>
          <div class="social-stat-num">${stats.upcoming}</div>
          <div class="social-stat-label">即将开始</div>
        </div>
        <div class="social-stat-card">
          <div class="social-stat-icon">✅</div>
          <div class="social-stat-num">${stats.finished}</div>
          <div class="social-stat-label">已结束</div>
        </div>
      </div>

      <!-- 类型筛选 -->
      <div class="filter-bar">
        <div class="filter-chip ${!this.filterScene ? 'active' : ''}" data-scfilter="">全部类型</div>
        ${ACTIVITY_TYPES.map(t => `<div class="filter-chip ${this.filterScene === t ? 'active' : ''}" data-scfilter="${t}">${t}</div>`).join('')}
      </div>

      <!-- 记录列表 -->
      <div id="recordList">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <div class="empty-text">暂无活动记录<br>点击 + 添加活动</div>
          </div>
        ` : filtered.map(r => this.renderActivityCard(r)).join('')}
      </div>
    `;
  }

  renderActivityCard(r) {
    const f = r.fields || {};
    const isUpcoming = f.activityDate && f.activityDate >= localDateStr(new Date()) && f.status !== '已结束';
    const statusColor = isUpcoming ? '#118AB2' : (f.status === '已结束' ? '#06D6A0' : 'var(--text-tertiary)');
    const statusBg = isUpcoming ? 'rgba(17,138,178,0.12)' : (f.status === '已结束' ? 'rgba(6,214,160,0.12)' : 'var(--bg-inset)');

    return `
      <div class="card" data-id="${r.id}" style="${isUpcoming ? 'border-left: 3px solid #118AB2;' : ''}">
        <div class="card-header">
          <div class="card-title">${f.activityType || '🎉'} ${f.title || '活动'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.activityDate ? `<span style="margin-right:var(--space-2);">📅 ${f.activityDate}</span>` : ''}
          ${f.location ? `<span style="margin-right:var(--space-2);">📍 ${f.location}</span>` : ''}
          ${f.organizer ? `<span style="margin-right:var(--space-2);">👤 ${f.organizer}</span>` : ''}
        </div>
        ${f.participants ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">🙋 ${f.participants}</div>` : ''}
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-tertiary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${f.activityType ? `<span class="tag" style="background:var(--bg-inset);color:var(--text-tertiary);">${f.activityType}</span>` : ''}
          <span class="tag" style="background:${statusBg};color:${statusColor};">${isUpcoming ? '⏰ 即将开始' : (f.status || '待定')}</span>
          ${f.cost ? `<span class="tag" style="background:rgba(255,209,102,0.15);color:#FFD166;">¥${f.cost}</span>` : ''}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  // === 事件绑定 ===
  bindEvents() {
    // Tab切换
    document.querySelectorAll('.social-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.getAttribute('data-tab');
        this.filterRelation = '';
        this.filterScene = '';
        this.render();
      });
    });

    // 关系筛选
    document.querySelectorAll('[data-relfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterRelation = chip.getAttribute('data-relfilter') || '';
        this.render();
      });
    });

    // 场景/类型筛选
    document.querySelectorAll('[data-scfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterScene = chip.getAttribute('data-scfilter') || '';
        this.render();
      });
    });

    // 编辑
    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const record = this.records.find(r => r.id === id);
        if (record) this.showFormModal(record);
      });
    });

    // 删除
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

    // 添加
    document.getElementById('addRecordBtn')?.addEventListener('click', () => this.showFormModal());
    // 附件
    bindCardAttachmentClicks(this.records);
  }

  // === 表单弹窗 ===
  showFormModal(record = null) {
    const isEdit = !!record;
    const f = record?.fields || {};

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑记录' : '添加' + TABS.find(t => t.key === this.activeTab)?.label}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div id="formContent">
          ${this.renderForm(this.activeTab, f)}
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

    // 礼尚往来的送出/收到切换
    if (this.activeTab === 'gift') {
      modal.querySelectorAll('.direction-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          modal.querySelectorAll('.direction-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--bg-inset)';
            b.style.color = 'var(--text-tertiary)';
            b.style.borderColor = 'var(--border-default)';
          });
          btn.classList.add('active');
          const dir = btn.dataset.dir;
          if (dir === '送出') {
            btn.style.background = 'rgba(239,71,111,0.1)';
            btn.style.color = '#EF476F';
            btn.style.borderColor = '#EF476F';
          } else {
            btn.style.background = 'rgba(6,214,160,0.1)';
            btn.style.color = '#06D6A0';
            btn.style.borderColor = '#06D6A0';
          }
        });
      });
    }

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = this.collectForm(this.activeTab, modal);
      if (!fields) return;
      fields.attachments = getAttachments();
      fields.subType = this.activeTab;

      if (isEdit) {
        const title = fields.title || fields.contactName || fields.gatheringType || '社交记录';
        await update('lifeRecords', record.id, { title, fields, updatedAt: new Date().toISOString() });
      } else {
        await add('lifeRecords', { category: this.category, title: fields.title || fields.contactName || fields.gatheringType || '社交记录', fields, createdAt: new Date().toISOString() });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  renderForm(tab, f) {
    if (tab === 'gift') return this.renderGiftForm(f);
    if (tab === 'gathering') return this.renderGatheringForm(f);
    return this.renderActivityForm(f);
  }

  renderGiftForm(f) {
    const direction = f.direction || '送出';
    return `
      <!-- 送出/收到切换 -->
      <div class="form-group">
        <label class="form-label">方向</label>
        <div style="display:flex;gap:var(--space-2);">
          <button type="button" class="direction-btn ${direction === '送出' ? 'active' : ''}" data-dir="送出" style="flex:1;padding:var(--space-2);border:2px solid var(--border-default);border-radius:var(--radius-md);background:${direction === '送出' ? 'rgba(239,71,111,0.1)' : 'var(--bg-inset)'};color:${direction === '送出' ? '#EF476F' : 'var(--text-tertiary)'};font-weight:600;cursor:pointer;">📤 送出</button>
          <button type="button" class="direction-btn ${direction === '收到' ? 'active' : ''}" data-dir="收到" style="flex:1;padding:var(--space-2);border:2px solid var(--border-default);border-radius:var(--radius-md);background:${direction === '收到' ? 'rgba(6,214,160,0.1)' : 'var(--bg-inset)'};color:${direction === '收到' ? '#06D6A0' : 'var(--text-tertiary)'};font-weight:600;cursor:pointer;">📥 收到</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">联系人姓名 *</label>
        <input type="text" class="form-input" id="field_contactName" value="${f.contactName || ''}" placeholder="如：张三" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">礼物类型</label>
          <select class="form-select" id="field_giftType">
            ${GIFT_TYPES.map(t => `<option value="${t}" ${f.giftType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">价值(¥)</label>
          <input type="number" class="form-input" id="field_value" value="${f.value || ''}" placeholder="如：500">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">关系</label>
          <select class="form-select" id="field_relation">
            <option value="">请选择</option>
            ${RELATION_OPTIONS.map(r => `<option value="${r}" ${f.relation === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">场景</label>
          <select class="form-select" id="field_scene">
            <option value="">请选择</option>
            ${SCENE_OPTIONS.map(s => `<option value="${s}" ${f.scene === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">日期</label>
          <input type="date" class="form-input" id="field_date" value="${f.date || localDateStr(new Date())}">
        </div>
        <div class="form-group">
          <label class="form-label">地点</label>
          <input type="text" class="form-input" id="field_location" value="${f.location || ''}" placeholder="如：XX酒店">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">我的感受</label>
          <input type="text" class="form-input" id="field_myFeeling" value="${f.myFeeling || ''}" placeholder="如：开心、感动">
        </div>
        <div class="form-group">
          <label class="form-label">对方反应</label>
          <input type="text" class="form-input" id="field_theirFeeling" value="${f.theirFeeling || ''}" placeholder="如：很开心、感谢">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">状态</label>
        <select class="form-select" id="field_status">
          <option value="" ${!f.status ? 'selected' : ''}>已了结</option>
          <option value="需要回礼" ${f.status === '需要回礼' ? 'selected' : ''}>⚠️ 需要回礼</option>
          <option value="已回礼" ${f.status === '已回礼' ? 'selected' : ''}>✅ 已回礼</option>
          <option value="待跟进" ${f.status === '待跟进' ? 'selected' : ''}>📌 待跟进</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="field_remark" placeholder="补充说明...">${f.remark || ''}</textarea>
      </div>
    `;
  }

  renderGatheringForm(f) {
    return `
      <div class="form-group">
        <label class="form-label">聚会标题 *</label>
        <input type="text" class="form-input" id="field_title" value="${f.title || ''}" placeholder="如：老王生日聚餐" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">聚会类型</label>
          <select class="form-select" id="field_gatheringType">
            ${GATHERING_TYPES.map(t => `<option value="${t}" ${f.gatheringType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">日期</label>
          <input type="date" class="form-input" id="field_date" value="${f.date || localDateStr(new Date())}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">地点</label>
          <input type="text" class="form-input" id="field_location" value="${f.location || ''}" placeholder="如：海底捞XX店">
        </div>
        <div class="form-group">
          <label class="form-label">人数</label>
          <input type="number" class="form-input" id="field_peopleCount" value="${f.peopleCount || ''}" placeholder="如：8">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">花费(¥)</label>
          <input type="number" class="form-input" id="field_cost" value="${f.cost || ''}" placeholder="如：800">
        </div>
        <div class="form-group">
          <label class="form-label">评分</label>
          <select class="form-select" id="field_rating">
            <option value="" ${!f.rating ? 'selected' : ''}>不评分</option>
            <option value="1" ${f.rating === '1' ? 'selected' : ''}>⭐</option>
            <option value="2" ${f.rating === '2' ? 'selected' : ''}>⭐⭐</option>
            <option value="3" ${f.rating === '3' ? 'selected' : ''}>⭐⭐⭐</option>
            <option value="4" ${f.rating === '4' ? 'selected' : ''}>⭐⭐⭐⭐</option>
            <option value="5" ${f.rating === '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">参与人员</label>
        <input type="text" class="form-input" id="field_participants" value="${f.participants || ''}" placeholder="多人用逗号分隔">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="field_remark" placeholder="菜品推荐、氛围感受...">${f.remark || ''}</textarea>
      </div>
    `;
  }

  renderActivityForm(f) {
    return `
      <div class="form-group">
        <label class="form-label">活动名称 *</label>
        <input type="text" class="form-input" id="field_title" value="${f.title || ''}" placeholder="如：周末爬山" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">活动类型</label>
          <select class="form-select" id="field_activityType">
            ${ACTIVITY_TYPES.map(t => `<option value="${t}" ${f.activityType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">活动日期</label>
          <input type="date" class="form-input" id="field_activityDate" value="${f.activityDate || localDateStr(new Date())}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">地点</label>
          <input type="text" class="form-input" id="field_location" value="${f.location || ''}" placeholder="如：XX公园">
        </div>
        <div class="form-group">
          <label class="form-label">组织者</label>
          <input type="text" class="form-input" id="field_organizer" value="${f.organizer || ''}" placeholder="如：小李">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">花费(¥)</label>
          <input type="number" class="form-input" id="field_cost" value="${f.cost || ''}" placeholder="如：200">
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select class="form-select" id="field_status">
            <option value="待定" ${!f.status || f.status === '待定' ? 'selected' : ''}>📌 待定</option>
            <option value="已确认" ${f.status === '已确认' ? 'selected' : ''}>✅ 已确认</option>
            <option value="进行中" ${f.status === '进行中' ? 'selected' : ''}>🔄 进行中</option>
            <option value="已结束" ${f.status === '已结束' ? 'selected' : ''}>🏁 已结束</option>
            <option value="已取消" ${f.status === '已取消' ? 'selected' : ''}>❌ 已取消</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">参与人员</label>
        <input type="text" class="form-input" id="field_participants" value="${f.participants || ''}" placeholder="多人用逗号分隔">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="field_remark" placeholder="活动详情、注意事项...">${f.remark || ''}</textarea>
      </div>
    `;
  }

  collectForm(tab, modal) {
    const get = (id) => {
      const el = modal.querySelector(`#field_${id}`);
      return el ? el.value.trim() : '';
    };

    if (tab === 'gift') {
      const contactName = get('contactName');
      if (!contactName) { window.showToast('请输入联系人姓名'); return null; }
      const activeDirBtn = modal.querySelector('.direction-btn.active');
      return {
        direction: activeDirBtn?.getAttribute('data-dir') || '送出',
        contactName,
        giftType: get('giftType'),
        value: get('value'),
        relation: get('relation'),
        scene: get('scene'),
        date: get('date'),
        location: get('location'),
        myFeeling: get('myFeeling'),
        theirFeeling: get('theirFeeling'),
        status: get('status'),
        remark: get('remark'),
        title: `${get('giftType') || '礼物'} - ${contactName}`,
      };
    }

    if (tab === 'gathering') {
      const title = get('title');
      if (!title) { window.showToast('请输入聚会标题'); return null; }
      return {
        title,
        gatheringType: get('gatheringType'),
        date: get('date'),
        location: get('location'),
        peopleCount: get('peopleCount'),
        cost: get('cost'),
        rating: get('rating'),
        participants: get('participants'),
        remark: get('remark'),
      };
    }

    // activity
    const title = get('title');
    if (!title) { window.showToast('请输入活动名称'); return null; }
    return {
      title,
      activityType: get('activityType'),
      activityDate: get('activityDate'),
      location: get('location'),
      organizer: get('organizer'),
      cost: get('cost'),
      status: get('status'),
      participants: get('participants'),
      remark: get('remark'),
    };
  }

  onDestroy() {}
}
