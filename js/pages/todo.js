/**
 * 日程待办页面 - 统一提醒中心
 * 三种浏览模式：日历视图 / 待办看板 / 列表视图
 * 双向溯源：工作/学习/生活全模块到期推送
 */

import { add, update, remove, getAll, query } from '../db.js';

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 来源模块颜色映射
const SOURCE_COLORS = {
  work: { color: '#EF476F', label: '工作', dot: '🔴' },
  learn: { color: '#4ECDC4', label: '学习', dot: '🟢' },
  life: { color: '#4361EE', label: '生活', dot: '🔵' },
  general: { color: '#9B8BAD', label: '通用', dot: '⚫' },
};

// 看板列配置
const KANBAN_COLUMNS = [
  { key: 'pending', label: '待开始', color: 'var(--text-tertiary)' },
  { key: 'doing', label: '进行中', color: 'var(--info)' },
  { key: 'today', label: '今日到期', color: 'var(--warning)' },
  { key: 'done', label: '已完成', color: 'var(--success)' },
  { key: 'overdue', label: '已延期', color: 'var(--danger)' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default class TodoPage {
  constructor({ container, route, navigate }) {
    this.container = container;
    this.route = route;
    this.navigate = navigate;
    this.todos = [];
    this.events = [];
    this.templates = [];
    this.viewMode = 'calendar'; // calendar | kanban | list
    this.calendarMode = 'month'; // month | week | day
    this.filterSource = 'all'; // all | work | learn | life | general
    this.filterPriority = 'all'; // all | high | medium | low
    this.filterStatus = 'all'; // all | pending | done
    this.searchKeyword = '';
    this.currentDate = new Date();
    this.selectedDate = localDateStr(new Date());
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.todos = await getAll('todos');
      this.events = await getAll('events');
      this.templates = await getAll('repeatTemplates');
    } catch (e) {
      console.error('日程待办数据加载:', e);
      this.todos = [];
      this.events = [];
      this.templates = [];
    }
  }

  // === 数据过滤与计算 ===

  getFilteredItems() {
    let items = [];

    // 合并待办和日程
    this.todos.forEach(t => {
      items.push({
        ...t,
        itemType: 'todo',
        dateStr: t.date,
        timeStr: '',
        sourceLabel: t.sourceModule ? SOURCE_COLORS[t.sourceModule]?.label : (t.category || '通用'),
        sourceKey: t.sourceModule || 'general',
      });
    });
    this.events.forEach(e => {
      items.push({
        ...e,
        itemType: 'event',
        dateStr: e.startDate,
        timeStr: e.startTime ? `${e.startTime}${e.endTime ? '-' + e.endTime : ''}` : '',
        sourceLabel: e.sourceModule ? SOURCE_COLORS[e.sourceModule]?.label : '通用',
        sourceKey: e.sourceModule || 'general',
      });
    });

    // 搜索过滤
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      items = items.filter(i => (i.title || '').toLowerCase().includes(kw) || (i.note || '').toLowerCase().includes(kw));
    }

    // 来源过滤
    if (this.filterSource !== 'all') {
      items = items.filter(i => i.sourceKey === this.filterSource);
    }

    // 优先级过滤
    if (this.filterPriority !== 'all') {
      items = items.filter(i => i.priority === this.filterPriority);
    }

    // 状态过滤（列表视图）
    if (this.filterStatus === 'pending') {
      items = items.filter(i => !i.done);
    } else if (this.filterStatus === 'done') {
      items = items.filter(i => i.done);
    }

    return items.sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''));
  }

  // 获取看板分类
  getKanbanStatus(item) {
    if (item.done) return 'done';
    const today = localDateStr(new Date());
    if (item.dateStr < today) return 'overdue';
    if (item.dateStr === today) return 'today';
    if (item.status === 'doing') return 'doing';
    return 'pending';
  }

  // === HTML 渲染 ===

  getHTML() {
    return `
      <div class="todo-page">
        ${this.renderToolbar()}
        <div id="todoContent">
          ${this.renderContent()}
        </div>
      </div>
    `;
  }

  renderToolbar() {
    return `
      <!-- 顶部快捷按钮 -->
      <div class="todo-toolbar">
        <button class="todo-tool-btn" id="btnNew" title="新建">
          <span>➕</span><span>新建</span>
        </button>
        <button class="todo-tool-btn ${this.viewMode === 'calendar' ? 'active' : ''}" data-view="calendar" title="日历视图">
          <span>📅</span><span>日历</span>
        </button>
        <button class="todo-tool-btn ${this.viewMode === 'kanban' ? 'active' : ''}" data-view="kanban" title="待办看板">
          <span>📋</span><span>看板</span>
        </button>
        <button class="todo-tool-btn ${this.viewMode === 'list' ? 'active' : ''}" data-view="list" title="列表视图">
          <span>📝</span><span>列表</span>
        </button>
        <button class="todo-tool-btn" id="btnFilter" title="检索筛选">
          <span>🔍</span><span>筛选</span>
        </button>
        <button class="todo-tool-btn" id="btnTemplate" title="重复模板库">
          <span>🔁</span><span>模板</span>
        </button>
      </div>
    `;
  }

  renderContent() {
    if (this.viewMode === 'calendar') return this.renderCalendarView();
    if (this.viewMode === 'kanban') return this.renderKanbanView();
    return this.renderListView();
  }

  // === 日历视图 ===

  renderCalendarView() {
    if (this.calendarMode === 'week') return this.renderWeekView();
    if (this.calendarMode === 'day') return this.renderDayView();
    return this.renderMonthView();
  }

  renderMonthView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = localDateStr(new Date());

    // 构建日历格子
    const cells = [];
    // 上月填充
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, date: localDateStr(new Date(year, month - 1, prevMonthDays - i)), otherMonth: true });
    }
    // 本月
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = localDateStr(new Date(year, month, d));
      cells.push({ day: d, date: dateStr, otherMonth: false });
    }
    // 下月填充
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, date: localDateStr(new Date(year, month + 1, d)), otherMonth: true });
    }

    // 选中日期的待办
    const selectedItems = this.getItemsForDate(this.selectedDate);
    const selectedTodos = selectedItems.filter(i => i.itemType === 'todo');
    const selectedEvents = selectedItems.filter(i => i.itemType === 'event');
    const doneCount = selectedTodos.filter(t => t.done).length;
    const totalCount = selectedTodos.length + selectedEvents.length;

    return `
      <div class="calendar-view">
        <!-- 日历卡片 -->
        <div class="cal-card">
          <div class="cal-card-header">
            <div class="cal-card-title">
              <button class="cal-nav-btn" id="calPrev">‹</button>
              <span>${year}年${month + 1}月</span>
              <button class="cal-nav-btn" id="calNext">›</button>
            </div>
            <div class="cal-card-actions">
              <button class="btn btn-sm btn-outline" id="calToday">今天</button>
              <div class="cal-mode-switch">
                <button class="cal-mode-btn active" data-cal-mode="month">月</button>
                <button class="cal-mode-btn" data-cal-mode="week">周</button>
                <button class="cal-mode-btn" data-cal-mode="day">日</button>
              </div>
            </div>
          </div>
          <div class="calendar-weekdays">
            ${WEEKDAYS.map(w => `<div class="cal-weekday">${w}</div>`).join('')}
          </div>
          <div class="calendar-grid">
            ${cells.map(cell => {
              const dayItems = this.getItemsForDate(cell.date);
              const isToday = cell.date === today;
              const isSelected = cell.date === this.selectedDate;
              const hasItems = dayItems.length > 0;
              return `
                <div class="cal-cell ${cell.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${cell.date}">
                  <div class="cal-day-num">${cell.day}</div>
                  ${hasItems ? `<div class="cal-dots">${this.getSourceDots(dayItems)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 待办卡片 -->
        <div class="todo-card">
          <div class="todo-card-header">
            <div class="todo-card-title">
              <span class="todo-card-date">${this.formatDate(this.selectedDate)}</span>
              <span class="todo-card-count">${doneCount}/${totalCount}</span>
            </div>
            <button class="todo-card-add" id="quickAddTodo" title="添加待办">+</button>
          </div>
          <div class="todo-card-body">
            ${selectedItems.length === 0 ? `
              <div class="todo-card-empty">
                <div class="todo-card-empty-icon">📋</div>
                <div class="todo-card-empty-text">当天暂无安排<br>点击 + 添加待办</div>
              </div>
            ` : `
              ${selectedEvents.length > 0 ? `
                <div class="todo-section-label">🕐 日程事件</div>
                ${selectedEvents.map(item => this.renderTodoCardItem(item)).join('')}
              ` : ''}
              ${selectedTodos.length > 0 ? `
                <div class="todo-section-label">✅ 待办任务</div>
                ${selectedTodos.map(item => this.renderTodoCardItem(item)).join('')}
              ` : ''}
            `}
          </div>
          <div class="todo-card-input-row">
            <input type="text" class="todo-card-input" id="quickTodoInput" placeholder="添加待办，回车确认">
            <button class="todo-card-input-btn" id="quickTodoAdd">添加</button>
          </div>
        </div>
      </div>
    `;
  }

  renderTodoCardItem(item) {
    const sourceColor = SOURCE_COLORS[item.sourceKey]?.color || 'var(--text-tertiary)';
    const isTodo = item.itemType === 'todo';
    return `
      <div class="todo-card-item" data-id="${item.id}" data-type="${item.itemType}">
        <div class="todo-card-item-check" style="border-color: ${sourceColor};">
          ${isTodo ? `
            <div class="checkbox-mini ${item.done ? 'checked' : ''}" data-action="toggle" data-id="${item.id}" data-type="${item.itemType}"></div>
          ` : '<span class="todo-card-item-type">🕐</span>'}
        </div>
        <div class="todo-card-item-content">
          <div class="todo-card-item-title ${item.done ? 'done' : ''}">${item.title || '未命名'}</div>
          <div class="todo-card-item-meta">
            <span class="todo-card-item-source" style="color: ${sourceColor};">${item.sourceLabel}</span>
            ${item.timeStr ? `<span class="todo-card-item-time">🕐 ${item.timeStr}</span>` : ''}
            ${item.priority ? this.getPriorityBadge(item.priority) : ''}
          </div>
        </div>
        <div class="todo-card-item-actions">
          <button class="todo-card-item-btn" data-action="edit" data-id="${item.id}" data-type="${item.itemType}">✏️</button>
          <button class="todo-card-item-btn" data-action="delete" data-id="${item.id}" data-type="${item.itemType}">🗑</button>
        </div>
      </div>
    `;
  }

  renderWeekView() {
    const today = localDateStr(new Date());
    const weekStart = this.getStartOfWeek(this.currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push({
        date: localDateStr(d),
        day: d.getDate(),
        weekday: WEEKDAYS[d.getDay()],
        isToday: localDateStr(d) === today,
        items: this.getItemsForDate(localDateStr(d)),
      });
    }

    return `
      <div class="calendar-view">
        <div class="calendar-header">
          <button class="cal-nav-btn" id="calPrev">‹</button>
          <div class="cal-title">${days[0].date.slice(5)} - ${days[6].date.slice(5)}</div>
          <button class="cal-nav-btn" id="calNext">›</button>
          <button class="btn btn-sm btn-outline" id="calToday">今天</button>
          <div class="cal-mode-switch">
            <button class="cal-mode-btn" data-cal-mode="month">月</button>
            <button class="cal-mode-btn active" data-cal-mode="week">周</button>
            <button class="cal-mode-btn" data-cal-mode="day">日</button>
          </div>
        </div>
        <div class="week-view">
          ${days.map(day => `
            <div class="week-day-col ${day.isToday ? 'today' : ''}" data-date="${day.date}">
              <div class="week-day-header">
                <span class="week-day-label">${day.weekday}</span>
                <span class="week-day-num">${day.day}</span>
              </div>
              <div class="week-day-body">
                ${day.items.length === 0 ? '<div class="week-empty">-</div>' : day.items.map(item => `
                  <div class="week-item source-${item.sourceKey}" data-id="${item.id}" data-type="${item.itemType}">
                    ${item.itemType === 'event' ? '<span class="week-item-time">' + (item.timeStr || '') + '</span>' : ''}
                    <span class="week-item-title">${item.title || '未命名'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderDayView() {
    const items = this.getItemsForDate(this.selectedDate);
    const today = localDateStr(new Date());

    return `
      <div class="calendar-view">
        <div class="calendar-header">
          <button class="cal-nav-btn" id="calPrev">‹</button>
          <div class="cal-title">${this.formatDate(this.selectedDate)}</div>
          <button class="cal-nav-btn" id="calNext">›</button>
          <button class="btn btn-sm btn-outline" id="calToday">今天</button>
          <div class="cal-mode-switch">
            <button class="cal-mode-btn" data-cal-mode="month">月</button>
            <button class="cal-mode-btn" data-cal-mode="week">周</button>
            <button class="cal-mode-btn active" data-cal-mode="day">日</button>
          </div>
        </div>
        <div class="day-view">
          ${items.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📅</div>
              <div class="empty-text">当天暂无日程或待办</div>
            </div>
          ` : items.map(item => this.renderItemCard(item)).join('')}
        </div>
      </div>
    `;
  }

  renderDayDetail(date) {
    const items = this.getItemsForDate(date);
    const events = items.filter(i => i.itemType === 'event');
    const todos = items.filter(i => i.itemType === 'todo');

    return `
      <div class="cal-day-detail">
        <div class="cal-day-detail-header">
          <span>${this.formatDate(date)}</span>
          <span class="cal-day-detail-count">${items.length} 项</span>
        </div>
        ${items.length === 0 ? '<div class="cal-day-empty">当天暂无安排</div>' : `
          ${events.length > 0 ? `
            <div class="cal-section-label">🕐 日程事件</div>
            ${events.map(item => this.renderItemCard(item)).join('')}
          ` : ''}
          ${todos.length > 0 ? `
            <div class="cal-section-label">✅ 待办任务</div>
            ${todos.map(item => this.renderItemCard(item)).join('')}
          ` : ''}
        `}
      </div>
    `;
  }

  getItemsForDate(date) {
    const items = [];
    this.todos.forEach(t => {
      if (t.date === date) items.push({ ...t, itemType: 'todo', dateStr: t.date, timeStr: '', sourceLabel: t.sourceModule ? SOURCE_COLORS[t.sourceModule]?.label : '通用', sourceKey: t.sourceModule || 'general' });
    });
    this.events.forEach(e => {
      if (e.startDate === date) items.push({ ...e, itemType: 'event', dateStr: e.startDate, timeStr: e.startTime ? `${e.startTime}${e.endTime ? '-' + e.endTime : ''}` : '', sourceLabel: e.sourceModule ? SOURCE_COLORS[e.sourceModule]?.label : '通用', sourceKey: e.sourceModule || 'general' });
    });
    return items;
  }

  getSourceDots(items) {
    const sources = [...new Set(items.map(i => i.sourceKey))];
    return sources.map(s => `<span class="cal-dot source-dot-${s}"></span>`).join('');
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // === 看板视图 ===

  renderKanbanView() {
    const items = this.getFilteredItems();

    return `
      <div class="kanban-view">
        <div class="kanban-board">
          ${KANBAN_COLUMNS.map(col => {
            const colItems = items.filter(i => this.getKanbanStatus(i) === col.key);
            return `
              <div class="kanban-col" data-status="${col.key}">
                <div class="kanban-col-header" style="border-top-color: ${col.color};">
                  <span>${col.label}</span>
                  <span class="kanban-col-count">${colItems.length}</span>
                </div>
                <div class="kanban-col-body">
                  ${colItems.length === 0 ? '<div class="kanban-empty">拖拽任务到此处</div>' : colItems.map(item => this.renderKanbanCard(item)).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderKanbanCard(item) {
    const sourceColor = SOURCE_COLORS[item.sourceKey]?.color || 'var(--text-tertiary)';
    return `
      <div class="kanban-card" data-id="${item.id}" data-type="${item.itemType}" draggable="true">
        <div class="kanban-card-source" style="background: ${sourceColor};"></div>
        <div class="kanban-card-body">
          <div class="kanban-card-title">${item.title || '未命名'}</div>
          <div class="kanban-card-meta">
            <span class="kanban-source-tag" style="color: ${sourceColor};">${item.sourceLabel}</span>
            ${item.priority ? this.getPriorityBadge(item.priority) : ''}
            ${item.dateStr ? `<span class="kanban-due">${this.formatShortDate(item.dateStr)}</span>` : ''}
          </div>
          ${item.sourceModule ? `
            <button class="kanban-trace-btn" data-trace="${item.id}" data-type="${item.itemType}">🔗 溯源</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // === 列表视图 ===

  renderListView() {
    const items = this.getFilteredItems();

    return `
      <div class="list-view">
        <!-- 筛选栏 -->
        <div class="filter-bar">
          <div class="filter-chip ${this.filterSource === 'all' ? 'active' : ''}" data-src="all">全部来源</div>
          ${Object.entries(SOURCE_COLORS).map(([key, val]) => `
            <div class="filter-chip ${this.filterSource === key ? 'active' : ''}" data-src="${key}">${val.dot} ${val.label}</div>
          `).join('')}
        </div>
        <div class="filter-bar">
          <div class="filter-chip ${this.filterPriority === 'all' ? 'active' : ''}" data-pri="all">全部优先级</div>
          <div class="filter-chip ${this.filterPriority === 'high' ? 'active' : ''}" data-pri="high">🔴 高</div>
          <div class="filter-chip ${this.filterPriority === 'medium' ? 'active' : ''}" data-pri="medium">🟡 中</div>
          <div class="filter-chip ${this.filterPriority === 'low' ? 'active' : ''}" data-pri="low">🟢 低</div>
        </div>
        <div class="filter-bar">
          <div class="filter-chip ${this.filterStatus === 'all' ? 'active' : ''}" data-stat="all">全部状态</div>
          <div class="filter-chip ${this.filterStatus === 'pending' ? 'active' : ''}" data-stat="pending">⬜ 未完成</div>
          <div class="filter-chip ${this.filterStatus === 'done' ? 'active' : ''}" data-stat="done">✅ 已完成</div>
        </div>

        <!-- 列表 -->
        <div id="todoListContent">
          ${items.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📝</div>
              <div class="empty-text">暂无待办事项<br>点击「新建」添加任务</div>
            </div>
          ` : items.map(item => this.renderItemCard(item)).join('')}
        </div>
      </div>
    `;
  }

  renderItemCard(item) {
    const sourceColor = SOURCE_COLORS[item.sourceKey]?.color || 'var(--text-tertiary)';
    return `
      <div class="todo-item-card" data-id="${item.id}" data-type="${item.itemType}">
        <div class="todo-item-bar" style="background: ${sourceColor};"></div>
        <div class="todo-item-main">
          <div class="todo-item-header">
            ${item.itemType === 'todo' ? `
              <div class="checkbox ${item.done ? 'checked' : ''}" data-action="toggle" data-id="${item.id}" data-type="${item.itemType}"></div>
            ` : '<span class="todo-item-type">🕐</span>'}
            <div class="todo-item-title ${item.done ? 'done' : ''}">${item.title || '未命名'}</div>
          </div>
          <div class="todo-item-meta">
            <span class="todo-source-tag" style="color: ${sourceColor};">${item.sourceLabel}</span>
            ${item.priority ? this.getPriorityBadge(item.priority) : ''}
            ${item.timeStr ? `<span class="todo-time">🕐 ${item.timeStr}</span>` : ''}
            <span class="todo-date">📅 ${this.formatShortDate(item.dateStr)}</span>
            ${item.repeatRule ? `<span class="todo-repeat">🔁 ${this.getRepeatLabel(item.repeatRule)}</span>` : ''}
          </div>
          ${item.note ? `<div class="todo-item-note">${item.note}</div>` : ''}
          <div class="todo-item-footer">
            ${item.sourceModule ? `
              <button class="btn btn-sm btn-outline" data-trace="${item.id}" data-type="${item.itemType}">🔗 溯源</button>
            ` : ''}
            <button class="btn btn-sm btn-outline" data-action="edit" data-id="${item.id}" data-type="${item.itemType}">✏️</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}" data-type="${item.itemType}">🗑</button>
          </div>
        </div>
      </div>
    `;
  }

  // === 辅助方法 ===

  getPriorityBadge(priority) {
    const map = {
      high: '<span class="tag tag-danger">🔴 高</span>',
      medium: '<span class="tag tag-warning">🟡 中</span>',
      low: '<span class="tag tag-success">🟢 低</span>',
    };
    return map[priority] || '';
  }

  getRepeatLabel(rule) {
    const map = { daily: '每日', weekly: '每周', monthly: '每月', yearly: '每年' };
    return map[rule] || rule || '';
  }

  formatDate(dateStr) {
    const d = new Date(dateStr);
    const today = localDateStr(new Date());
    const tomorrow = localDateStr(new Date(Date.now() + 86400000));
    let label = '';
    if (dateStr === today) label = '今天 · ';
    else if (dateStr === tomorrow) label = '明天 · ';
    return `${label}${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAYS_FULL[d.getDay()]}`;
  }

  formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = localDateStr(new Date());
    if (dateStr === today) return '今天';
    const tomorrow = localDateStr(new Date(Date.now() + 86400000));
    if (dateStr === tomorrow) return '明天';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // === 事件绑定 ===

  bindEvents() {
    // 视图切换
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.viewMode = btn.getAttribute('data-view');
        this.render();
      });
    });

    // 新建
    document.getElementById('btnNew')?.addEventListener('click', () => {
      this.showNewModal();
    });

    // 筛选
    document.getElementById('btnFilter')?.addEventListener('click', () => {
      this.viewMode = 'list';
      this.render();
      setTimeout(() => {
        const firstChip = document.querySelector('[data-src]');
        firstChip?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // 模板库
    document.getElementById('btnTemplate')?.addEventListener('click', () => {
      this.showTemplateModal();
    });

    // 日历视图事件
    this.bindCalendarEvents();
    // 看板拖拽
    this.bindKanbanEvents();
    // 列表筛选
    this.bindListFilterEvents();
    // 卡片操作
    this.bindCardEvents();
  }

  bindCalendarEvents() {
    // 日期导航
    document.getElementById('calPrev')?.addEventListener('click', () => {
      if (this.calendarMode === 'month') {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      } else if (this.calendarMode === 'week') {
        this.currentDate.setDate(this.currentDate.getDate() - 7);
      } else {
        const d = new Date(this.selectedDate);
        d.setDate(d.getDate() - 1);
        this.selectedDate = localDateStr(d);
        this.currentDate = new Date(this.selectedDate);
      }
      this.render();
    });

    document.getElementById('calNext')?.addEventListener('click', () => {
      if (this.calendarMode === 'month') {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      } else if (this.calendarMode === 'week') {
        this.currentDate.setDate(this.currentDate.getDate() + 7);
      } else {
        const d = new Date(this.selectedDate);
        d.setDate(d.getDate() + 1);
        this.selectedDate = localDateStr(d);
        this.currentDate = new Date(this.selectedDate);
      }
      this.render();
    });

    document.getElementById('calToday')?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.selectedDate = localDateStr(new Date());
      this.render();
    });

    // 日历模式切换
    document.querySelectorAll('[data-cal-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.calendarMode = btn.getAttribute('data-cal-mode');
        this.render();
      });
    });

    // 日期格子点击
    document.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        this.selectedDate = cell.getAttribute('data-date');
        this.render();
      });
    });

    // 周视图点击
    document.querySelectorAll('.week-day-col[data-date]').forEach(col => {
      col.addEventListener('click', () => {
        this.selectedDate = col.getAttribute('data-date');
        this.calendarMode = 'day';
        this.render();
      });
    });

    // 快速添加待办（按钮）
    document.getElementById('quickAddTodo')?.addEventListener('click', () => {
      this.showNewModal();
    });

    // 快速添加待办（输入框回车）
    const quickInput = document.getElementById('quickTodoInput');
    quickInput?.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const title = quickInput.value.trim();
        if (!title) return;
        await add('todos', {
          title,
          date: this.selectedDate,
          priority: '',
          sourceModule: '',
          repeatRule: '',
          tags: [],
          note: '',
          done: false,
          status: 'pending',
        });
        quickInput.value = '';
        await this.loadData();
        this.render();
        window.showToast('✅ 已添加');
      }
    });

    // 快速添加按钮
    document.getElementById('quickTodoAdd')?.addEventListener('click', async () => {
      const input = document.getElementById('quickTodoInput');
      const title = input?.value.trim();
      if (!title) { window.showToast('请输入待办标题'); return; }
      await add('todos', {
        title,
        date: this.selectedDate,
        priority: '',
        sourceModule: '',
        repeatRule: '',
        tags: [],
        note: '',
        done: false,
        status: 'pending',
      });
      input.value = '';
      await this.loadData();
      this.render();
      window.showToast('✅ 已添加');
    });

    // 待办卡片项操作已在 bindEvents 中统一绑定
  }

  bindKanbanEvents() {
    // 拖拽
    let draggedItem = null;

    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedItem = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });

    document.querySelectorAll('.kanban-col').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        if (!draggedItem) return;

        const id = parseInt(draggedItem.getAttribute('data-id'));
        const type = draggedItem.getAttribute('data-type');
        const newStatus = col.getAttribute('data-status');

        if (type === 'todo') {
          const updateData = {};
          if (newStatus === 'done') updateData.done = true;
          else if (newStatus === 'pending') { updateData.done = false; updateData.status = 'pending'; }
          else if (newStatus === 'doing') { updateData.done = false; updateData.status = 'doing'; }
          else if (newStatus === 'today') { updateData.done = false; updateData.date = localDateStr(new Date()); }
          else if (newStatus === 'overdue') { updateData.done = false; }
          await update('todos', id, updateData);
        }

        await this.loadData();
        this.render();
        window.showToast('状态已更新');
      });
    });
  }

  bindListFilterEvents() {
    document.querySelectorAll('[data-src]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterSource = chip.getAttribute('data-src');
        this.render();
      });
    });
    document.querySelectorAll('[data-pri]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterPriority = chip.getAttribute('data-pri');
        this.render();
      });
    });
    document.querySelectorAll('[data-stat]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterStatus = chip.getAttribute('data-stat');
        this.render();
      });
    });
  }

  bindCardEvents() {
    // 完成/取消
    document.querySelectorAll('[data-action="toggle"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const type = el.getAttribute('data-type');
        if (type === 'todo') {
          const todo = this.todos.find(t => t.id === id);
          if (todo) {
            await update('todos', id, { done: !todo.done });
            await this.loadData();
            this.render();
            window.showToast(todo.done ? '已取消完成' : '✅ 已完成');
          }
        }
      });
    });

    // 编辑
    document.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const type = el.getAttribute('data-type');
        const item = type === 'todo' ? this.todos.find(t => t.id === id) : this.events.find(ev => ev.id === id);
        if (item) this.showNewModal({ ...item, itemType: type });
      });
    });

    // 删除
    document.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-id'));
        const type = el.getAttribute('data-type');
        await remove(type === 'todo' ? 'todos' : 'events', id);
        await this.loadData();
        this.render();
        window.showToast('已删除');
      });
    });

    // 卡片点击编辑（日历卡片、列表卡片、看板卡片）
    document.querySelectorAll('.todo-card-item[data-id], .todo-item-card[data-id], .kanban-card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.checkbox') || e.target.closest('.checkbox-mini')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const type = card.getAttribute('data-type');
        const item = type === 'todo' ? this.todos.find(t => t.id === id) : this.events.find(ev => ev.id === id);
        if (item) this.showNewModal({ ...item, itemType: type });
      });
      card.style.cursor = 'pointer';
    });

    // 溯源跳转
    document.querySelectorAll('[data-trace]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.getAttribute('data-trace'));
        const type = el.getAttribute('data-type');
        const item = type === 'todo' ? this.todos.find(t => t.id === id) : this.events.find(ev => ev.id === id);
        if (item && item.sourceModule && item.sourceId) {
          this.traceToSource(item.sourceModule, item.sourceId);
        }
      });
    });
  }

  // 溯源跳转
  traceToSource(module, id) {
    const routeMap = {
      work: { project: '/work/project', procurement: '/work/procurement', finance: '/work/finance', hr: '/work/hr', info: '/work/info' },
      learn: { expression: '/learn/expression', ai: '/learn/ai', english: '/learn/english', media: '/learn/media', office: '/learn/office' },
      life: { eat: '/life/eat', fitness: '/life/fitness', beauty: '/life/beauty', finance: '/life/finance', travel: '/life/travel' },
    };
    // 通用跳转逻辑
    if (module === 'work') window.location.hash = '/work/project';
    else if (module === 'learn') window.location.hash = '/learn/expression';
    else if (module === 'life') window.location.hash = '/life/eat';
    else window.showToast('🔗 跳转到来源模块');
  }

  // === 新建/编辑模态框 ===

  showNewModal(item = null, forceType = null) {
    const isEdit = !!item && !!item.id;
    const type = forceType || item?.itemType || 'todo';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑' : '新建'}${type === 'event' ? '日程' : '待办'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>

        <!-- 类型切换 -->
        ${!isEdit ? `
          <div class="form-group">
            <div class="type-switch">
              <button class="type-switch-btn ${type === 'todo' ? 'active' : ''}" data-type="todo">✅ 待办任务</button>
              <button class="type-switch-btn ${type === 'event' ? 'active' : ''}" data-type="event">🕐 日程事件</button>
            </div>
          </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input type="text" class="form-input" id="itemTitle" placeholder="输入标题..." value="${item?.title || ''}" autofocus>
        </div>

        ${type === 'event' ? `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">开始时间</label>
              <input type="date" class="form-input" id="eventStartDate" value="${item?.startDate || this.selectedDate}">
            </div>
            <div class="form-group">
              <label class="form-label">结束时间</label>
              <input type="date" class="form-input" id="eventEndDate" value="${item?.endDate || this.selectedDate}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">开始时段</label>
              <input type="time" class="form-input" id="eventStartTime" value="${item?.startTime || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">结束时段</label>
              <input type="time" class="form-input" id="eventEndTime" value="${item?.endTime || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">地点</label>
            <input type="text" class="form-input" id="eventLocation" placeholder="输入地点..." value="${item?.location || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">参与人</label>
            <input type="text" class="form-input" id="eventParticipants" placeholder="多人用逗号分隔" value="${item?.participants || ''}">
          </div>
        ` : `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">截止日期</label>
              <input type="date" class="form-input" id="todoDate" value="${item?.date || this.selectedDate}">
            </div>
            <div class="form-group">
              <label class="form-label">优先级</label>
              <select class="form-select" id="todoPriority">
                <option value="" ${!item?.priority ? 'selected' : ''}>无</option>
                <option value="high" ${item?.priority === 'high' ? 'selected' : ''}>🔴 高</option>
                <option value="medium" ${item?.priority === 'medium' ? 'selected' : ''}>🟡 中</option>
                <option value="low" ${item?.priority === 'low' ? 'selected' : ''}>🟢 低</option>
              </select>
            </div>
          </div>
        `}

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">来源模块</label>
            <select class="form-select" id="itemSource">
              <option value="" ${!item?.sourceModule ? 'selected' : ''}>通用</option>
              <option value="work" ${item?.sourceModule === 'work' ? 'selected' : ''}>🔴 工作</option>
              <option value="learn" ${item?.sourceModule === 'learn' ? 'selected' : ''}>🟢 学习</option>
              <option value="life" ${item?.sourceModule === 'life' ? 'selected' : ''}>🔵 生活</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">重复规则</label>
            <select class="form-select" id="itemRepeat">
              <option value="" ${!item?.repeatRule ? 'selected' : ''}>不重复</option>
              <option value="daily" ${item?.repeatRule === 'daily' ? 'selected' : ''}>每日</option>
              <option value="weekly" ${item?.repeatRule === 'weekly' ? 'selected' : ''}>每周</option>
              <option value="monthly" ${item?.repeatRule === 'monthly' ? 'selected' : ''}>每月</option>
              <option value="yearly" ${item?.repeatRule === 'yearly' ? 'selected' : ''}>每年</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">标签</label>
          <input type="text" class="form-input" id="itemTags" placeholder="多个标签用逗号分隔" value="${(item?.tags || []).join(',')}">
        </div>

        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="itemNote" placeholder="添加备注...">${item?.note || item?.remark || ''}</textarea>
        </div>

        <button class="btn btn-primary btn-block" id="saveItem">${isEdit ? '更新' : '保存'}</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // 类型切换
    let currentType = type;
    modal.querySelectorAll('.type-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentType = btn.getAttribute('data-type');
        modal.remove();
        this.showNewModal(null, currentType);
      });
    });

    // 保存
    document.getElementById('saveItem').addEventListener('click', async () => {
      const title = document.getElementById('itemTitle').value.trim();
      if (!title) { window.showToast('请输入标题'); return; }

      const sourceModule = document.getElementById('itemSource').value;
      const repeatRule = document.getElementById('itemRepeat').value;
      const tagsStr = document.getElementById('itemTags').value.trim();
      const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
      const note = document.getElementById('itemNote').value.trim();

      if (currentType === 'event') {
        const data = {
          title,
          startDate: document.getElementById('eventStartDate').value,
          endDate: document.getElementById('eventEndDate').value,
          startTime: document.getElementById('eventStartTime').value,
          endTime: document.getElementById('eventEndTime').value,
          location: document.getElementById('eventLocation').value.trim(),
          participants: document.getElementById('eventParticipants').value.trim(),
          sourceModule,
          repeatRule,
          tags,
          remark: note,
        };
        if (isEdit && item && item.itemType === 'event') {
          await update('events', item.id, data);
        } else {
          await add('events', data);
        }
      } else {
        const data = {
          title,
          date: document.getElementById('todoDate').value,
          priority: document.getElementById('todoPriority').value,
          sourceModule,
          repeatRule,
          tags,
          note,
          done: item?.done || false,
          status: item?.status || 'pending',
        };
        if (isEdit && item && item.itemType === 'todo') {
          await update('todos', item.id, data);
        } else {
          await add('todos', data);
        }
      }

      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已添加');
    });
  }

  // === 模板库模态框 ===

  showTemplateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 80vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">🔁 重复模板库</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div id="templateList">
          ${this.templates.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🔁</div>
              <div class="empty-text">暂无模板<br>点击下方按钮添加</div>
            </div>
          ` : this.templates.map(t => `
            <div class="template-item" data-id="${t.id}">
              <div class="template-item-header">
                <span class="template-item-title">${t.title}</span>
                <span class="tag tag-brand">${this.getRepeatLabel(t.repeatRule)}</span>
              </div>
              <div class="template-item-meta">
                <span class="tag">${t.category}</span>
                ${t.priority ? this.getPriorityBadge(t.priority) : ''}
                <span class="tag">${t.type === 'event' ? '日程' : '待办'}</span>
              </div>
              ${t.content ? `<div class="template-item-content">${t.content}</div>` : ''}
              <div class="template-item-actions">
                <button class="btn btn-sm btn-primary" data-use="${t.id}">使用</button>
                <button class="btn btn-sm btn-danger" data-del-tpl="${t.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-outline btn-block" id="addTemplate" style="margin-top: var(--space-3);">+ 添加模板</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // 使用模板
    modal.querySelectorAll('[data-use]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-use'));
        const tpl = this.templates.find(t => t.id === id);
        if (tpl) {
          close();
          this.showNewModal({
            itemType: tpl.type,
            title: tpl.title,
            priority: tpl.priority,
            sourceModule: tpl.category === '工作' ? 'work' : tpl.category === '学习' ? 'learn' : tpl.category === '生活' ? 'life' : '',
            repeatRule: tpl.repeatRule,
            note: tpl.content,
          });
        }
      });
    });

    // 删除模板
    modal.querySelectorAll('[data-del-tpl]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-del-tpl'));
        await remove('repeatTemplates', id);
        await this.loadData();
        close();
        this.showTemplateModal();
        window.showToast('已删除模板');
      });
    });

    // 添加模板
    document.getElementById('addTemplate')?.addEventListener('click', () => {
      close();
      this.showAddTemplateModal();
    });
  }

  showAddTemplateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">添加模板</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">模板名称 *</label>
          <input type="text" class="form-input" id="tplTitle" placeholder="如：每日背单词" autofocus>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">类型</label>
            <select class="form-select" id="tplType">
              <option value="todo">待办任务</option>
              <option value="event">日程事件</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">重复规则</label>
            <select class="form-select" id="tplRepeat">
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">分类</label>
            <select class="form-select" id="tplCategory">
              <option value="通用">通用</option>
              <option value="工作">工作</option>
              <option value="学习">学习</option>
              <option value="生活">生活</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">优先级</label>
            <select class="form-select" id="tplPriority">
              <option value="">无</option>
              <option value="high">🔴 高</option>
              <option value="medium">🟡 中</option>
              <option value="low">🟢 低</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">内容描述</label>
          <textarea class="form-textarea" id="tplContent" placeholder="模板内容..."></textarea>
        </div>
        <button class="btn btn-primary btn-block" id="saveTpl">保存模板</button>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveTpl').addEventListener('click', async () => {
      const title = document.getElementById('tplTitle').value.trim();
      if (!title) { window.showToast('请输入模板名称'); return; }
      await add('repeatTemplates', {
        title,
        type: document.getElementById('tplType').value,
        repeatRule: document.getElementById('tplRepeat').value,
        category: document.getElementById('tplCategory').value,
        priority: document.getElementById('tplPriority').value,
        content: document.getElementById('tplContent').value.trim(),
      });
      close();
      await this.loadData();
      this.showTemplateModal();
      window.showToast('✅ 模板已添加');
    });
  }

  onDestroy() {}
}
