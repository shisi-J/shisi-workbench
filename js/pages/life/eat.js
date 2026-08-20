/**
 * 吃 · 美食探店（重构版）
 * 两大板块：
 *   🍳 学做菜 — 跟学视频 + 食谱收藏（减脂餐/懒人备餐/快手菜/好吃的菜/食谱）
 *   🍽️ 去探店 — 店铺打卡 + 避雷（好吃的店/避雷店铺/小吃/饮品）
 */

import { getByCategory, add, update, remove } from '../../db.js';
import { renderAttachmentList, renderUploadField, initUploadHandlers, bindCardAttachmentClicks } from '../../utils/attachments.js';

const COOK_CATEGORIES = ['减脂餐', '懒人备餐', '快手菜', '好吃的菜', '食谱'];
const COOK_STATUS = ['想学', '已学会', '常做'];
const SHOP_CATEGORIES = ['好吃的店', '避雷店铺', '小吃', '饮品'];
const SHOP_STATUS = ['想去', '已打卡', '好吃推荐', '避雷'];
const VIDEO_PLATFORMS = {
  bilibili: '📺 B站',
  douyin: '🎵 抖音',
  xhs: '📕 小红书',
  meituan: '美团',
  dianping: '大众点评',
  none: '无链接',
};

export default class EatPage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'eat';
    this.records = [];
    this.activeTab = 'cook';
    this.filterCategory = '';
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

  getCookRecords() {
    return this.records.filter(r => r.fields?.recordType === 'cook' || (!r.fields?.recordType && !r.fields?.shopName && r.fields?.recipe));
  }

  getShopRecords() {
    return this.records.filter(r => r.fields?.recordType === 'shop' || r.fields?.shopName || (!r.fields?.recordType && !r.fields?.recipe && (r.fields?.city || r.fields?.rating)));
  }

  getFiltered() {
    const base = this.activeTab === 'cook' ? this.getCookRecords() : this.getShopRecords();
    let filtered = [...base];
    if (this.filterCategory) {
      filtered = filtered.filter(r => r.fields?.subType === this.filterCategory);
    }
    if (this.filterStatus) {
      filtered = filtered.filter(r => r.fields?.status === this.filterStatus);
    }
    return filtered;
  }

  getHTML() {
    const filtered = this.getFiltered();
    const categories = this.activeTab === 'cook' ? COOK_CATEGORIES : SHOP_CATEGORIES;
    const statuses = this.activeTab === 'cook' ? COOK_STATUS : SHOP_STATUS;
    const tabLabel = this.activeTab === 'cook' ? '🍳 学做菜' : '🍽️ 去探店';
    const countLabel = this.activeTab === 'cook' ? '道食谱' : '家店';

    return `
      <div class="life-eat-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">🍽️ 吃 · 美食探店</div>
          <div class="page-subtitle">${tabLabel} · 共 ${filtered.length} ${countLabel}</div>
        </div>

        <!-- Tab 切换 -->
        <div class="eat-tabs" style="display:flex; gap:0; margin-bottom: var(--space-2); border-bottom: 1px solid var(--border-light);">
          <button class="eat-tab ${this.activeTab === 'cook' ? 'active' : ''}" data-tab="cook" style="flex:1; padding:8px 0; border:none; background:none; font-size: var(--font-sm); font-weight: var(--weight-semibold); color: ${this.activeTab === 'cook' ? 'var(--brand)' : 'var(--text-tertiary)'}; border-bottom: 2px solid ${this.activeTab === 'cook' ? 'var(--brand)' : 'transparent'}; cursor:pointer;">🍳 学做菜</button>
          <button class="eat-tab ${this.activeTab === 'shop' ? 'active' : ''}" data-tab="shop" style="flex:1; padding:8px 0; border:none; background:none; font-size: var(--font-sm); font-weight: var(--weight-semibold); color: ${this.activeTab === 'shop' ? 'var(--brand)' : 'var(--text-tertiary)'}; border-bottom: 2px solid ${this.activeTab === 'shop' ? 'var(--brand)' : 'transparent'}; cursor:pointer;">🍽️ 去探店</button>
        </div>

        <!-- 分类筛选 -->
        <div class="filter-bar" id="filterBar">
          <div class="filter-chip ${!this.filterCategory ? 'active' : ''}" data-catfilter="">全部分类</div>
          ${categories.map(c => `<div class="filter-chip ${this.filterCategory === c ? 'active' : ''}" data-catfilter="${c}">${c}</div>`).join('')}
        </div>
        <!-- 状态筛选 -->
        <div class="filter-bar" id="statusFilterBar">
          <div class="filter-chip ${!this.filterStatus ? 'active' : ''}" data-statusfilter="">全部状态</div>
          ${statuses.map(s => `<div class="filter-chip ${this.filterStatus === s ? 'active' : ''}" data-statusfilter="${s}">${s}</div>`).join('')}
        </div>

        <!-- 列表 -->
        <div id="recordList">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">${this.activeTab === 'cook' ? '🍳' : '🍽️'}</div>
              <div class="empty-text">${this.records.length === 0 ? '还没有记录<br>点击 + 添加' : '没有匹配的记录'}</div>
            </div>
          ` : filtered.map(r => this.activeTab === 'cook' ? this.renderCookCard(r) : this.renderShopCard(r)).join('')}
        </div>

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  // === 学做菜卡片 ===
  renderCookCard(r) {
    const f = r.fields || {};
    const stars = f.rating ? '⭐'.repeat(parseInt(f.rating)) : '';
    const date = r.createdAt?.slice(0, 10) || '';
    const statusTag = f.status ? `<span class="tag ${f.status === '已学会' ? 'tag-brand' : ''}">${f.status}</span>` : '';
    const subTypeTag = f.subType ? `<span class="tag">${f.subType}</span>` : '';
    const platformInfo = this.getPlatformInfo(f);

    return `
      <div class="card" data-id="${r.id}" style="cursor:pointer;">
        <div class="card-header">
          <div class="card-title">${f.title || '未命名食谱'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.cookType ? `<span style="margin-right: var(--space-2);"> ${f.cookType}</span>` : ''}
          ${stars ? `<span style="margin-right: var(--space-2);">${stars}</span>` : ''}
          ${date}
        </div>
        ${f.recipe ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">${f.recipe}</div>` : ''}
        <div style="display: flex; gap: var(--space-1); margin-top: var(--space-2); flex-wrap: wrap;">
          ${subTypeTag}${statusTag}${platformInfo}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  // === 去探店卡片 ===
  renderShopCard(r) {
    const f = r.fields || {};
    const isAvoid = f.subType === '避雷店铺' || f.status === '避雷';
    const stars = f.rating && !isAvoid ? '⭐'.repeat(parseInt(f.rating)) : '';
    const avoidTag = isAvoid ? `<span class="tag" style="background:rgba(239,71,111,0.1);color:#EF476F;">👎 避雷</span>` : '';
    const date = r.createdAt?.slice(0, 10) || '';
    const statusTag = f.status ? `<span class="tag ${f.status === '好吃推荐' ? 'tag-brand' : ''}">${f.status}</span>` : '';
    const subTypeTag = f.subType ? `<span class="tag">${f.subType}</span>` : '';
    const platformInfo = this.getPlatformInfo(f);

    return `
      <div class="card" data-id="${r.id}" style="cursor:pointer; ${isAvoid ? 'border-left: 3px solid #EF476F;' : ''}">
        <div class="card-header">
          <div class="card-title">${f.title || f.shopName || '未命名店铺'}</div>
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
          ${subTypeTag}${statusTag}${avoidTag}${platformInfo}
        </div>
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  // === 视频/外链标签 ===
  getPlatformInfo(f) {
    if (!f.url) return '';
    const platform = f.videoPlatform || this.detectPlatform(f.url);
    const label = VIDEO_PLATFORMS[platform] || '🔗 链接';
    const isVideo = ['bilibili', 'douyin', 'xhs'].includes(platform);
    return `<a href="${f.url}" target="_blank" class="tag" style="color: var(--brand); ${isVideo ? 'background:rgba(255,90,90,0.08);' : ''}">${isVideo ? '▶ ' : '🔗 '}${label.replace(' ', '')}</a>`;
  }

  detectPlatform(url) {
    if (!url) return 'none';
    if (url.includes('bilibili') || url.includes('b23.tv')) return 'bilibili';
    if (url.includes('douyin')) return 'douyin';
    if (url.includes('xiaohongshu') || url.includes('xhslink')) return 'xhs';
    if (url.includes('meituan')) return 'meituan';
    if (url.includes('dianping')) return 'dianping';
    return 'none';
  }

  bindEvents() {
    // Tab 切换
    document.querySelectorAll('.eat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.filterCategory = '';
        this.filterStatus = '';
        this.render();
      });
    });

    // 筛选
    document.querySelectorAll('[data-catfilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterCategory = chip.getAttribute('data-catfilter') || '';
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
    });

    document.getElementById('addRecordBtn')?.addEventListener('click', () => this.showFormModal());
    bindCardAttachmentClicks(this.records);
  }

  showFormModal(record = null) {
    const isEdit = !!record;
    const f = record?.fields || {};
    const recordType = f.recordType || this.activeTab;
    const isCook = recordType === 'cook';
    const categories = isCook ? COOK_CATEGORIES : SHOP_CATEGORIES;
    const statuses = isCook ? COOK_STATUS : SHOP_STATUS;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑' : '添加'}${isCook ? '食谱' : '探店'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>

        <!-- 板块切换 -->
        <div style="display:flex; gap:0; margin-bottom: var(--space-2); border-bottom: 1px solid var(--border-light);">
          <button class="form-tab ${isCook ? 'active' : ''}" data-formtab="cook" style="flex:1; padding:6px 0; border:none; background:none; font-size: var(--font-sm); font-weight: var(--weight-semibold); color: ${isCook ? 'var(--brand)' : 'var(--text-tertiary)'}; border-bottom: 2px solid ${isCook ? 'var(--brand)' : 'transparent'}; cursor:pointer;">🍳 学做菜</button>
          <button class="form-tab ${!isCook ? 'active' : ''}" data-formtab="shop" style="flex:1; padding:6px 0; border:none; background:none; font-size: var(--font-sm); font-weight: var(--weight-semibold); color: ${!isCook ? 'var(--brand)' : 'var(--text-tertiary)'}; border-bottom: 2px solid ${!isCook ? 'var(--brand)' : 'transparent'}; cursor:pointer;">🍽️ 去探店</button>
        </div>

        <div class="form-group">
          <label class="form-label">${isCook ? '菜名' : '店名'}</label>
          <input type="text" class="form-input" id="field_title" value="${f.title || f.shopName || ''}" placeholder="${isCook ? '菜名/食谱名' : '餐厅/店名'}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">${isCook ? '菜系类型' : '城市地区'}</label>
            <input type="text" class="form-input" id="field_city" value="${f.city || ''}" placeholder="${isCook ? '如：家常菜/中餐/西餐' : '如：杭州·西湖区'}">
          </div>
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="field_subType">
              <option value="">请选择</option>
              ${categories.map(o => `<option value="${o}" ${f.subType === o ? 'selected' : ''}>${o}</option>`).join('')}
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
              ${statuses.map(o => `<option value="${o}" ${f.status === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${isCook ? '视频/教程链接' : '探店外链'}</label>
          <input type="url" class="form-input" id="field_url" value="${f.url || ''}" placeholder="${isCook ? 'B站/抖音/小红书教程链接' : '美团/大众点评/小红书链接'}">
        </div>

        <div class="form-group">
          <label class="form-label">${isCook ? '食谱/做法备注' : '评价'}</label>
          <textarea class="form-textarea" id="field_review" placeholder="${isCook ? '食材、步骤、 tips...' : '好吃吗？环境如何？值不值？'}">${f.review || f.recipe || ''}</textarea>
        </div>

        ${renderUploadField(f.attachments || [])}
        <button class="btn btn-primary btn-block" id="saveRecord">保存</button>
      </div>
    `;
    document.body.appendChild(modal);
    const getAttachments = initUploadHandlers(modal, f.attachments || []);

    let currentTab = recordType;

    // 表单内 Tab 切换
    modal.querySelectorAll('.form-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentTab = tab.dataset.formtab;
        const isCookNow = currentTab === 'cook';
        const cats = isCookNow ? COOK_CATEGORIES : SHOP_CATEGORIES;
        const stats = isCookNow ? COOK_STATUS : SHOP_STATUS;
        modal.querySelectorAll('.form-tab').forEach(t => {
          const active = t.dataset.formtab === currentTab;
          t.style.color = active ? 'var(--brand)' : 'var(--text-tertiary)';
          t.style.borderBottom = active ? '2px solid var(--brand)' : '2px solid transparent';
        });
        const subSelect = modal.querySelector('#field_subType');
        subSelect.innerHTML = '<option value="">请选择</option>' + cats.map(o => `<option value="${o}">${o}</option>`).join('');
        const statSelect = modal.querySelector('#field_status');
        statSelect.innerHTML = '<option value="">请选择</option>' + stats.map(o => `<option value="${o}">${o}</option>`).join('');
        modal.querySelector('#field_title').placeholder = isCookNow ? '菜名/食谱名' : '餐厅/店名';
        modal.querySelector('#field_city').placeholder = isCookNow ? '如：家常菜/中餐/西餐' : '如：杭州·西湖区';
        modal.querySelector('#field_url').placeholder = isCookNow ? 'B站/抖音/小红书教程链接' : '美团/大众点评/小红书链接';
        modal.querySelector('#field_review').placeholder = isCookNow ? '食材、步骤、 tips...' : '好吃吗？环境如何？值不值？';
      });
    });

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = {};
      ['title', 'city', 'subType', 'rating', 'status', 'url', 'review'].forEach(k => {
        fields[k] = document.getElementById(`field_${k}`).value.trim();
      });
      fields.recordType = currentTab;
      fields.videoPlatform = this.detectPlatform(fields.url);
      if (currentTab === 'cook') {
        fields.recipe = fields.review;
      }
      fields.attachments = getAttachments();
      const title = fields.title || (currentTab === 'cook' ? '未命名食谱' : '未命名探店');
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
