/**
 * 个人知识库页面
 * 分类管理个人知识笔记，支持标签筛选和全文搜索
 */

import { getAll, add, update, remove, count } from '../db.js';

const CATEGORIES = [
  { key: 'all', label: '全部', icon: '📁' },
  { key: 'work', label: '工作', icon: '💼' },
  { key: 'study', label: '学习', icon: '📚' },
  { key: 'life', label: '生活', icon: '🌱' },
  { key: 'tech', label: '技术', icon: '💻' },
  { key: 'other', label: '其他', icon: '📌' },
];

export default class KnowledgePage {
  constructor({ container, route, navigate }) {
    this.container = container;
    this.route = route;
    this.navigate = navigate;
    this.filterCategory = 'all';
    this.searchQuery = '';
    this.allItems = [];
  }

  async render() {
    try {
      this.allItems = await getAll('knowledge');
    } catch (e) {
      this.allItems = [];
    }

    const totalCount = this.allItems.length;
    const catCounts = {};
    CATEGORIES.forEach(c => {
      if (c.key === 'all') {
        catCounts[c.key] = totalCount;
      } else {
        catCounts[c.key] = this.allItems.filter(i => i.category === c.key).length;
      }
    });

    this.container.innerHTML = `
      <div class="knowledge-page">
        <div class="page-header">
          <div class="page-title">📁 个人知识库</div>
          <div class="page-subtitle">积累你的知识碎片 · 共 ${totalCount} 条</div>
        </div>

        <!-- 搜索栏 -->
        <div class="search-bar" style="margin-bottom: var(--space-3);">
          <input type="text" class="form-input" id="kbSearch" placeholder="🔍 搜索知识笔记..." value="${this.searchQuery}">
        </div>

        <!-- 分类筛选 -->
        <div class="filter-row" id="kbFilters" style="margin-bottom: var(--space-3);">
          ${CATEGORIES.map(c => `
            <button class="filter-chip ${this.filterCategory === c.key ? 'active' : ''}" data-cat="${c.key}">
              ${c.icon} ${c.label} <span style="opacity:0.6;font-size:var(--font-xs);">${catCounts[c.key]}</span>
            </button>
          `).join('')}
        </div>

        <!-- 知识列表 -->
        <div id="kbList">
          ${this.renderList()}
        </div>

        <!-- 添加按钮 -->
        <button class="fab" id="addKnowledge" aria-label="添加知识">+</button>
      </div>
    `;

    this.bindEvents();
  }

  renderList() {
    let items = this.allItems;

    // 分类筛选
    if (this.filterCategory !== 'all') {
      items = items.filter(i => i.category === this.filterCategory);
    }

    // 搜索筛选
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.content || '').toLowerCase().includes(q) ||
        (i.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // 按时间倒序
    items = [...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (items.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <div class="empty-text">${this.searchQuery ? '未找到匹配的知识笔记' : '还没有知识笔记<br>点击 + 添加第一条'}</div>
        </div>
      `;
    }

    return items.map(item => {
      const cat = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[5];
      const date = (item.createdAt || '').slice(0, 10);
      const preview = (item.content || '').slice(0, 100);
      return `
        <div class="card list-item-card" data-id="${item.id}" style="margin-bottom: var(--space-2); cursor: pointer;">
          <div style="display: flex; align-items: flex-start; gap: var(--space-2);">
            <span style="font-size: 20px; flex-shrink: 0;">${cat.icon}</span>
            <div style="flex: 1; min-width: 0;">
              <div class="list-item-title" style="font-weight: var(--weight-semibold); margin-bottom: 4px;">${this.escape(item.title || '未命名')}</div>
              <div style="font-size: var(--font-sm); color: var(--text-secondary); line-height: var(--leading-normal); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${this.escape(preview)}</div>
              ${item.tags && item.tags.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: var(--space-1);">
                  ${item.tags.map(t => `<span class="tag">#${this.escape(t)}</span>`).join('')}
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
    // 搜索
    const searchInput = document.getElementById('kbSearch');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      document.getElementById('kbList').innerHTML = this.renderList();
      this.bindListEvents();
    });

    // 分类筛选
    document.querySelectorAll('#kbFilters .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterCategory = chip.getAttribute('data-cat');
        document.querySelectorAll('#kbFilters .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('kbList').innerHTML = this.renderList();
        this.bindListEvents();
      });
    });

    // 添加
    document.getElementById('addKnowledge')?.addEventListener('click', () => {
      this.showModal();
    });

    this.bindListEvents();
  }

  bindListEvents() {
    document.querySelectorAll('#kbList .list-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.getAttribute('data-id'));
        const item = this.allItems.find(i => i.id === id);
        if (item) this.showModal(item);
      });
    });
  }

  showModal(item = null) {
    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑知识' : '添加知识'}</div>
          <button class="modal-close" id="kbClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input" id="kbTitle" placeholder="知识标题" value="${this.escape(item?.title || '')}" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">分类</label>
          <select class="form-select" id="kbCategory">
            ${CATEGORIES.filter(c => c.key !== 'all').map(c => `
              <option value="${c.key}" ${item?.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">标签（逗号分隔）</label>
          <input type="text" class="form-input" id="kbTags" placeholder="如：效率,工具,方法" value="${(item?.tags || []).join(',')}">
        </div>
        <div class="form-group">
          <label class="form-label">内容</label>
          <textarea class="form-textarea" id="kbContent" placeholder="写下你的知识笔记..." style="min-height: 180px;">${this.escape(item?.content || '')}</textarea>
        </div>
        ${isEdit ? `
          <div style="display: flex; gap: var(--space-2);">
            <button class="btn btn-danger btn-block" id="kbDelete" style="flex: 0 0 auto;">删除</button>
            <button class="btn btn-primary btn-block" id="kbSave">保存</button>
          </div>
        ` : `
          <button class="btn btn-primary btn-block" id="kbSave">保存</button>
        `}
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('kbClose')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('kbSave')?.addEventListener('click', async () => {
      const title = document.getElementById('kbTitle').value.trim();
      if (!title) { window.showToast('请输入标题'); return; }
      const category = document.getElementById('kbCategory').value;
      const tagsStr = document.getElementById('kbTags').value.trim();
      const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
      const content = document.getElementById('kbContent').value.trim();

      try {
        if (isEdit) {
          await update('knowledge', item.id, { title, category, tags, content });
          window.showToast('已更新');
        } else {
          await add('knowledge', { title, category, tags, content });
          window.showToast('已添加');
        }
        close();
        await this.render();
      } catch (e) {
        window.showToast('保存失败：' + e.message);
      }
    });

    document.getElementById('kbDelete')?.addEventListener('click', async () => {
      if (!confirm('确定删除这条知识笔记？')) return;
      try {
        await remove('knowledge', item.id);
        window.showToast('已删除');
        close();
        await this.render();
      } catch (e) {
        window.showToast('删除失败：' + e.message);
      }
    });
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  onDestroy() {}
}
