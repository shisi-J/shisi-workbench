/**
 * 健身 · 体重管理 + 训练台账（合并减脂模块）
 * 功能：
 *   - 体重管理：日历视图每日录入早晚体重、体脂腰围，目标体重追踪
 *   - 训练打卡：记录力量/有氧训练 + 粘贴B站/抖音/小红书跟练视频做打卡卡片
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

const TRAIN_TYPES = ['力量训练', '有氧运动', 'HIIT', '拉伸瑜伽', '跟练视频'];
const VIDEO_PLATFORMS = {
  bilibili: '📺 B站',
  douyin: '🎵 抖音',
  xhs: '📕 小红书',
  none: '无视频',
};
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export default class FitnessPage {
  constructor({ container, params }) {
    this.container = container;
    this.category = 'fitness';
    this.records = [];
    this.activeTab = 'weight'; // 'weight' | 'train'  体重管理在前
    this.filterType = '';
    this.goalWeight = null;
    this.calendarMonth = new Date(); // 日历当前月份
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.getHTML();
    this.bindEvents();
  }

  async loadData() {
    try {
      // 同时加载 fitness 和 fatloss 记录（兼容旧数据）
      const [fitnessRecords, fatlossRecords] = await Promise.all([
        getByCategory('lifeRecords', 'fitness'),
        getByCategory('lifeRecords', 'fatloss'),
      ]);
      this.records = [...fitnessRecords, ...fatlossRecords];
      this.goalWeight = await getSetting('fatloss_goal', null);
    } catch (e) {
      this.records = [];
    }
  }

  // === 数据分类 ===

  getTrainRecords() {
    return this.records.filter(r => !r.fields?.weight && !r.fields?.morningWeight && !r.fields?.eveningWeight);
  }

  getWeightRecords() {
    return this.records.filter(r => r.fields?.weight || r.fields?.morningWeight || r.fields?.eveningWeight);
  }

  getFilteredTrain() {
    let filtered = this.getTrainRecords();
    if (this.filterType) {
      filtered = filtered.filter(r => r.fields?.trainType === this.filterType);
    }
    return filtered;
  }

  // 获取训练记录的日期（优先 recordDate，回退 createdAt）
  getTrainDate(r) {
    return r.fields?.recordDate || r.createdAt?.slice(0, 10) || '';
  }

  // 今日是否已打卡
  isCheckedInToday() {
    const todayStr = localDateStr(new Date());
    return this.getTrainRecords().some(r => this.getTrainDate(r) === todayStr);
  }

  // 连续打卡天数（从今天往回数）
  getStreak() {
    const records = this.getTrainRecords();
    if (records.length === 0) return 0;
    const dates = new Set(records.map(r => this.getTrainDate(r)).filter(Boolean));
    let streak = 0;
    const check = new Date();
    // 如果今天没打卡但昨天打了，从昨天开始算
    if (!dates.has(localDateStr(check))) {
      check.setDate(check.getDate() - 1);
      if (!dates.has(localDateStr(check))) return 0;
    }
    while (dates.has(localDateStr(check))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return streak;
  }

  // 本周训练次数（周日起算）
  getThisWeekCount() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = localDateStr(weekStart);
    return this.getTrainRecords().filter(r => this.getTrainDate(r) >= weekStartStr).length;
  }

  // 日期 -> 体重数据 映射
  getDayWeightMap() {
    const map = {};
    for (const r of this.getWeightRecords()) {
      const f = r.fields || {};
      const date = f.recordDate || r.createdAt?.slice(0, 10) || '';
      if (!date) continue;
      if (!map[date]) map[date] = { morning: '', evening: '', bodyFat: '', waist: '', remark: '', cheatMeal: '', period: '', raw: r };
      // 兼容旧数据：weight 字段当作早间体重
      if (f.morningWeight) map[date].morning = f.morningWeight;
      else if (f.weight) map[date].morning = f.weight;
      if (f.eveningWeight) map[date].evening = f.eveningWeight;
      if (f.bodyFat) map[date].bodyFat = f.bodyFat;
      if (f.waist) map[date].waist = f.waist;
      if (f.remark) map[date].remark = f.remark;
      if (f.cheatMeal === 'true') map[date].cheatMeal = 'true';
      if (f.period === 'true') map[date].period = 'true';
    }
    return map;
  }

  getSortedWeights() {
    const dayMap = this.getDayWeightMap();
    return Object.entries(dayMap)
      .map(([date, d]) => ({
        date,
        weight: parseFloat(d.evening || d.morning || 0),
        morning: d.morning,
        evening: d.evening,
        bodyFat: d.bodyFat,
        waist: d.waist,
        raw: d.raw,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // === 页面渲染 ===

  getHTML() {
    const trainFiltered = this.getFilteredTrain();
    const weights = this.getSortedWeights();

    return `
      <div class="life-fitness-page" style="padding: var(--space-3);">
        <div class="page-header">
          <div class="page-title">💪 健身 · 训练台账</div>
          <div class="page-subtitle">体重管理 + 训练打卡 · ${weights.length} 天体重 · ${this.getTrainRecords().length} 次训练${this.getStreak() > 0 ? ` · 🔥连续${this.getStreak()}天` : ''}</div>
        </div>

        <!-- Tab 切换：体重管理在前 -->
        <div class="filter-bar" style="margin-bottom: var(--space-3);">
          <div class="filter-chip ${this.activeTab === 'weight' ? 'active' : ''}" data-tab="weight" style="font-weight: var(--weight-semibold);">⚖️ 体重管理</div>
          <div class="filter-chip ${this.activeTab === 'train' ? 'active' : ''}" data-tab="train" style="font-weight: var(--weight-semibold);">🏋️ 训练打卡</div>
        </div>

        ${this.activeTab === 'weight' ? this.renderWeightView(weights) : this.renderTrainView(trainFiltered)}

        <button class="fab" id="addRecordBtn">+</button>
      </div>
    `;
  }

  renderTrainView(filtered) {
    const allTrain = this.getTrainRecords();
    const checkedToday = this.isCheckedInToday();
    const streak = this.getStreak();
    const weekCount = this.getThisWeekCount();

    return `
      <!-- 今日打卡状态卡 -->
      <div style="background: ${checkedToday ? 'linear-gradient(135deg, rgba(6,214,160,0.12), rgba(6,214,160,0.03))' : 'linear-gradient(135deg, rgba(255,184,0,0.1), rgba(255,184,0,0.02))'}; border: 1px solid ${checkedToday ? 'rgba(6,214,160,0.3)' : 'rgba(255,184,0,0.25)'}; border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-bottom: 2px;">今日训练</div>
          <div style="font-size: var(--font-lg); font-weight: var(--weight-bold); color: ${checkedToday ? '#06D6A0' : 'var(--text-primary)'};">
            ${checkedToday ? '✅ 已打卡' : '⏳ 未打卡'}
          </div>
          ${streak > 0 ? `<div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-top: 2px;">🔥 连续 ${streak} 天</div>` : ''}
        </div>
        ${checkedToday
          ? `<div style="font-size: 32px;">💪</div>`
          : `<button id="quickCheckinBtn" style="padding: 8px 18px; background: var(--brand); color: #fff; border: none; border-radius: var(--radius-sm); font-size: var(--font-sm); font-weight: var(--weight-semibold); cursor: pointer; white-space: nowrap;">立即打卡</button>`
        }
      </div>

      ${allTrain.length > 0 ? `
        <div class="stats-grid">
          <div class="stat-card gradient">
            <div class="stat-icon">🏋️</div>
            <div class="stat-label">总训练</div>
            <div class="stat-value">${allTrain.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-label">本周</div>
            <div class="stat-value">${weekCount}</div>
          </div>
          ${streak > 0 ? `
            <div class="stat-card">
              <div class="stat-icon">🔥</div>
              <div class="stat-label">连续天数</div>
              <div class="stat-value">${streak}</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="filter-bar">
        <div class="filter-chip ${!this.filterType ? 'active' : ''}" data-typefilter="">全部</div>
        ${TRAIN_TYPES.map(t => `<div class="filter-chip ${this.filterType === t ? 'active' : ''}" data-typefilter="${t}">${t}</div>`).join('')}
      </div>

      <div id="recordList">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💪</div>
            <div class="empty-text">${allTrain.length === 0 ? '还没有训练记录<br>点击「立即打卡」或 + 记录训练' : '没有匹配的训练记录'}</div>
          </div>
        ` : filtered.map(r => this.renderTrainCard(r)).join('')}
      </div>
    `;
  }

  renderWeightView(weights) {
    const latest = weights[weights.length - 1];
    const first = weights[0];
    const diff = latest && first ? (latest.weight - first.weight).toFixed(1) : 0;
    const goalDiff = (latest && this.goalWeight) ? (latest.weight - parseFloat(this.goalWeight)).toFixed(1) : null;

    return `
      ${weights.length > 0 ? `
        <div class="stats-grid">
          <div class="stat-card gradient">
            <div class="stat-icon">⚖️</div>
            <div class="stat-label">最新体重</div>
            <div class="stat-value">${latest.weight} kg</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📉</div>
            <div class="stat-label">总变化</div>
            <div class="stat-value" style="color: ${diff < 0 ? 'var(--success)' : 'var(--danger)'}">${diff > 0 ? '+' : ''}${diff} kg</div>
          </div>
          ${this.goalWeight ? `
            <div class="stat-card">
              <div class="stat-icon">🎯</div>
              <div class="stat-label">目标 ${this.goalWeight}kg</div>
              <div class="stat-value" style="color: ${goalDiff <= 0 ? 'var(--success)' : 'var(--warning)'}; font-size: var(--font-md);">
                ${goalDiff > 0 ? `还差 ${goalDiff}kg` : '已达成!'}
              </div>
            </div>
          ` : ''}
          ${latest.bodyFat ? `
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-label">体脂率</div>
              <div class="stat-value" style="font-size: var(--font-md);">${latest.bodyFat}%</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 日历视图 -->
      ${this.renderCalendar()}

      <!-- 记录列表 -->
      <div id="recordList">
        ${weights.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">⚖️</div>
            <div class="empty-text">还没有体重记录<br>点击日历日期或 + 录入数据</div>
          </div>
        ` : [...weights].reverse().map(w => this.renderWeightCard(w.raw)).join('')}
      </div>
    `;
  }

  renderCalendar() {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth(); // 0-11
    const todayStr = localDateStr(new Date());
    const dayMap = this.getDayWeightMap();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0=周日

    const monthLabel = `${year}年${month + 1}月`;

    // 统计本月记录天数
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthDays = Object.keys(dayMap).filter(d => d.startsWith(monthPrefix));
    const monthAvg = monthDays.length > 0
      ? (monthDays.reduce((s, d) => s + parseFloat(dayMap[d].evening || dayMap[d].morning || 0), 0) / monthDays.length).toFixed(1)
      : '--';

    // 构建日历单元格
    const cells = [];
    // 前置空白
    for (let i = 0; i < startWeekday; i++) cells.push('<div class="cal-cell empty"></div>');
    // 日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const data = dayMap[dateStr];
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      const morning = data?.morning || '';
      const evening = data?.evening || '';
      const hasRecord = !!data;

      cells.push(`
        <div class="cal-cell ${isToday ? 'today' : ''} ${hasRecord ? 'has-record' : ''} ${isFuture ? 'future' : ''}" data-date="${dateStr}">
          <div class="cal-date">${d}</div>
          ${hasRecord ? `
            <div class="cal-weights">
              ${morning ? `<div class="cal-w-am">早 ${morning}</div>` : ''}
              ${evening ? `<div class="cal-w-pm">晚 ${evening}</div>` : ''}
              ${!morning && !evening ? `<div class="cal-w-am">已记</div>` : ''}
            </div>
          ` : (isFuture ? '' : '<div class="cal-w-empty">·</div>')}
        </div>
      `);
    }

    return `
      <div class="weight-calendar" style="margin-bottom: var(--space-3); padding: var(--space-3); background: var(--bg-card); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
          <button class="cal-nav-btn" id="calPrev" style="background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: var(--space-1);">‹</button>
          <div style="font-size: var(--font-sm); font-weight: var(--weight-semibold); color: var(--text-primary);">${monthLabel} · 均${monthAvg}kg</div>
          <button class="cal-nav-btn" id="calNext" style="background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: var(--space-1);">›</button>
        </div>
        <div class="cal-week-row" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px;">
          ${WEEK_LABELS.map(w => `<div style="text-align: center; font-size: var(--font-xs); color: var(--text-tertiary); padding: 2px 0;">${w}</div>`).join('')}
        </div>
        <div class="cal-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
          ${cells.join('')}
        </div>
        <div style="display: flex; gap: var(--space-3); margin-top: var(--space-2); font-size: var(--font-xs); color: var(--text-tertiary);">
          <span>🔵 早间</span>
          <span>🟣 晚间</span>
          <span>点击日期可录入</span>
        </div>
      </div>
    `;
  }

  renderTrainCard(r) {
    const f = r.fields || {};
    const date = this.getTrainDate(r);
    const todayStr = localDateStr(new Date());
    const isToday = date === todayStr;
    const platformLabel = VIDEO_PLATFORMS[f.videoPlatform] || '';
    const typeTag = f.trainType ? `<span class="tag">${f.trainType}</span>` : '';

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${f.title || f.exercise || '训练记录'}</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm);">
          ${f.trainType ? `<span style="margin-right: var(--space-2);">${typeTag}</span>` : ''}
          ${f.duration ? `<span style="margin-right: var(--space-2);">⏱️ ${f.duration}分钟</span>` : ''}
          ${f.calories ? `<span style="margin-right: var(--space-2);">🔥 ${f.calories}kcal</span>` : ''}
          ${isToday ? '<span style="color: #06D6A0; font-weight: var(--weight-semibold);">今日打卡</span>' : `📅 ${date}`}
        </div>
        ${f.videoUrl ? `
          <div style="margin-top: var(--space-2); padding: var(--space-2); background: var(--bg-inset); border-radius: var(--radius-xs);">
            <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-bottom: 4px;">${platformLabel} 跟练视频</div>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span style="flex: 1; font-size: var(--font-sm); color: var(--brand); word-break: break-all; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">${f.videoUrl}</span>
              <button data-action="open-video" data-url="${f.videoUrl}" style="flex-shrink: 0; padding: 4px 10px; background: var(--brand); color: var(--text-inverse); border: none; border-radius: var(--radius-xs); font-size: var(--font-xs); white-space: nowrap;">▶ 播放</button>
            </div>
          </div>
        ` : ''}
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  renderWeightCard(r) {
    const f = r.fields || {};
    const date = f.recordDate || r.createdAt?.slice(0, 10) || '';
    const statusTags = [];
    if (f.cheatMeal === 'true') statusTags.push('<span class="tag" style="background: rgba(255,209,102,0.2);">🍔 欺骗餐</span>');
    if (f.period === 'true') statusTags.push('<span class="tag" style="background: rgba(239,71,111,0.15); color: #EF476F;">🌸 生理期</span>');

    const morning = f.morningWeight || f.weight || '';
    const evening = f.eveningWeight || '';

    return `
      <div class="card" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title">${date} 体重记录</div>
          <div style="display: flex; gap: var(--space-1);">
            <button data-action="edit" data-id="${r.id}" style="color: var(--text-tertiary);">✏️</button>
            <button data-action="delete" data-id="${r.id}" style="color: var(--text-tertiary);">🗑</button>
          </div>
        </div>
        <div class="card-body" style="font-size: var(--font-sm); display: flex; gap: var(--space-3); flex-wrap: wrap;">
          ${morning ? `<span>🌅 早 ${morning}kg</span>` : ''}
          ${evening ? `<span>🌙 晚 ${evening}kg</span>` : ''}
          ${f.bodyFat ? `<span>📊 ${f.bodyFat}%</span>` : ''}
          ${f.waist ? `<span>📏 腰围 ${f.waist}cm</span>` : ''}
        </div>
        ${statusTags.length > 0 ? `<div style="display: flex; gap: var(--space-1); margin-top: var(--space-1);">${statusTags.join('')}</div>` : ''}
        ${f.remark ? `<div class="card-body" style="font-size: var(--font-sm); color: var(--text-secondary); margin-top: var(--space-1);">📝 ${f.remark}</div>` : ''}
        ${renderAttachmentList(f.attachments, r.id)}
      </div>
    `;
  }

  // === 事件绑定 ===

  bindEvents() {
    // Tab 切换
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.getAttribute('data-tab');
        this.render();
      });
    });

    // 日历月份切换
    document.getElementById('calPrev')?.addEventListener('click', () => {
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
      this.render();
    });
    document.getElementById('calNext')?.addEventListener('click', () => {
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
      this.render();
    });

    // 日历日期点击 -> 录入/编辑该日体重
    document.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.getAttribute('data-date');
        const dayMap = this.getDayWeightMap();
        const existing = dayMap[date]?.raw;
        this.showWeightFormModal(existing, date);
      });
    });

    // 训练类型筛选
    document.querySelectorAll('[data-typefilter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterType = chip.getAttribute('data-typefilter') || '';
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

    // 卡片点击编辑（训练卡片 + 体重卡片，排除日历单元格 .cal-cell）
    document.querySelectorAll('.card[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        // 排除按钮/链接点击
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = parseInt(card.getAttribute('data-id'));
        const record = this.records.find(r => r.id === id);
        if (record) this.showFormModal(record);
      });
      card.style.cursor = 'pointer';
    });

    // 视频链接跳转（PWA 中 target=_blank 不生效，用 window.open 处理）
    document.querySelectorAll('[data-action="open-video"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.getAttribute('data-url');
        if (!url) return;
        // 尝试新窗口打开，PWA 中 fallback 到当前窗口跳转
        const w = window.open(url, '_blank');
        if (!w) window.location.href = url;
      });
    });

    document.getElementById('addRecordBtn')?.addEventListener('click', () => {
      if (this.activeTab === 'train') {
        this.showTrainFormModal();
      } else {
        this.showWeightFormModal();
      }
    });

    // 快速打卡按钮
    document.getElementById('quickCheckinBtn')?.addEventListener('click', () => {
      this.showTrainFormModal();
    });

    bindCardAttachmentClicks(this.records);
  }

  // === 表单弹窗 ===

  showFormModal(record) {
    if (record?.fields?.weight || record?.fields?.morningWeight || record?.fields?.eveningWeight) {
      const date = record.fields?.recordDate || record.createdAt?.slice(0, 10);
      this.showWeightFormModal(record, date);
    } else {
      this.showTrainFormModal(record);
    }
  }

  showTrainFormModal(record = null) {
    const isEdit = !!record;
    const f = record?.fields || {};
    const today = localDateStr(new Date());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑训练' : '🏋️ 训练打卡'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">训练日期</label>
          <input type="date" class="form-input" id="field_recordDate" value="${f.recordDate || today}" max="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">训练标题</label>
          <input type="text" class="form-input" id="field_title" value="${f.title || f.exercise || ''}" placeholder="如：胸肌训练/跑步5公里">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">训练类型</label>
            <select class="form-select" id="field_trainType">
              <option value="">请选择</option>
              ${TRAIN_TYPES.map(o => `<option value="${o}" ${f.trainType === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">时长(分钟)</label>
            <input type="number" class="form-input" id="field_duration" value="${f.duration || ''}" placeholder="30">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">消耗(kcal)</label>
          <input type="number" class="form-input" id="field_calories" value="${f.calories || ''}" placeholder="200">
        </div>
        <div class="form-group">
          <label class="form-label">跟练视频链接（选填）</label>
          <input type="url" class="form-input" id="field_videoUrl" value="${f.videoUrl || ''}" placeholder="粘贴B站/抖音/小红书视频链接">
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="field_remark" placeholder="训练感受、重量组数等">${f.remark || ''}</textarea>
        </div>
        ${renderUploadField(f.attachments || [])}
        <button class="btn btn-primary btn-block" id="saveRecord">${isEdit ? '保存' : '✅ 打卡'}</button>
      </div>
    `;
    document.body.appendChild(modal);
    const getAttachments = initUploadHandlers(modal, f.attachments || []);

    const close = () => modal.remove();
    document.getElementById('modalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('saveRecord').addEventListener('click', async () => {
      const fields = {};
      ['recordDate', 'title', 'trainType', 'duration', 'calories', 'videoUrl', 'remark'].forEach(k => {
        fields[k] = document.getElementById(`field_${k}`).value.trim();
      });
      const url = (fields.videoUrl || '').toLowerCase();
      if (url.includes('bilibili') || url.includes('b23.tv')) fields.videoPlatform = 'bilibili';
      else if (url.includes('douyin')) fields.videoPlatform = 'douyin';
      else if (url.includes('xiaohongshu') || url.includes('xhslink')) fields.videoPlatform = 'xhs';
      else fields.videoPlatform = 'none';

      const title = fields.title || `训练打卡 ${fields.recordDate}`;
      fields.attachments = getAttachments();
      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields });
      } else {
        await add('lifeRecords', { title, fields, category: this.category });
      }
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 打卡成功');
    });
  }

  showWeightFormModal(record = null, presetDate = null) {
    const isEdit = !!record;
    const f = record?.fields || {};
    const today = localDateStr(new Date());
    const dateVal = f.recordDate || presetDate || today;

    // 兼容旧数据：weight -> morningWeight
    const morningVal = f.morningWeight || f.weight || '';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? '编辑体重记录' : '录入体重'}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">记录日期</label>
          <input type="date" class="form-input" id="field_recordDate" value="${dateVal}" max="${today}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">🌅 早晨体重(kg)</label>
            <input type="number" step="0.1" class="form-input" id="field_morningWeight" value="${morningVal}" placeholder="68.5" autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">🌙 晚间体重(kg)</label>
            <input type="number" step="0.1" class="form-input" id="field_eveningWeight" value="${f.eveningWeight || ''}" placeholder="69.2">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">体脂率(%)</label>
            <input type="number" step="0.1" class="form-input" id="field_bodyFat" value="${f.bodyFat || ''}" placeholder="22">
          </div>
          <div class="form-group">
            <label class="form-label">腰围(cm)</label>
            <input type="number" step="0.1" class="form-input" id="field_waist" value="${f.waist || ''}" placeholder="82">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">目标体重(kg)</label>
            <input type="number" step="0.1" class="form-input" id="field_goal" value="${this.goalWeight || ''}" placeholder="设置目标">
          </div>
          <div class="form-group">
            <label class="form-label">今日状态</label>
            <div style="display: flex; gap: var(--space-2); align-items: center; height: 44px;">
              <div class="fit-toggle" data-field="cheatMeal" data-checked="${f.cheatMeal === 'true' ? '1' : '0'}" style="font-size: var(--font-sm); display:flex; align-items:center; gap:4px; cursor:pointer;">
                <span class="fit-box" style="width:18px;height:18px;border:2px solid ${f.cheatMeal === 'true' ? 'var(--brand)' : 'var(--border-color)'};border-radius:4px;background:${f.cheatMeal === 'true' ? 'var(--brand)' : 'transparent'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0;">${f.cheatMeal === 'true' ? '✓' : ''}</span>
                🍔 欺骗餐
              </div>
              <div class="fit-toggle" data-field="period" data-checked="${f.period === 'true' ? '1' : '0'}" style="font-size: var(--font-sm); display:flex; align-items:center; gap:4px; cursor:pointer;">
                <span class="fit-box" style="width:18px;height:18px;border:2px solid ${f.period === 'true' ? 'var(--brand)' : 'var(--border-color)'};border-radius:4px;background:${f.period === 'true' ? 'var(--brand)' : 'transparent'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0;">${f.period === 'true' ? '✓' : ''}</span>
                🌸 生理期
              </div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="field_remark" placeholder="饮食/运动/身体状态等">${f.remark || ''}</textarea>
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

    // 自定义toggle切换（不用原生checkbox）
    modal.querySelectorAll('.fit-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const box = el.querySelector('.fit-box');
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
      fields.recordDate = document.getElementById('field_recordDate').value.trim() || today;
      fields.morningWeight = document.getElementById('field_morningWeight').value.trim();
      fields.eveningWeight = document.getElementById('field_eveningWeight').value.trim();
      fields.bodyFat = document.getElementById('field_bodyFat').value.trim();
      fields.waist = document.getElementById('field_waist').value.trim();
      fields.remark = document.getElementById('field_remark').value.trim();
      fields.cheatMeal = modal.querySelector('[data-field="cheatMeal"]')?.dataset.checked === '1' ? 'true' : 'false';
      fields.period = modal.querySelector('[data-field="period"]')?.dataset.checked === '1' ? 'true' : 'false';

      // 至少要有一个体重值
      if (!fields.morningWeight && !fields.eveningWeight) {
        window.showToast('请至少输入早晨或晚间体重');
        return;
      }

      // 更新目标体重
      const goalInput = document.getElementById('field_goal').value.trim();
      if (goalInput) {
        await setSetting('fatloss_goal', goalInput);
        this.goalWeight = goalInput;
      }

      // 保留兼容字段 weight = morningWeight
      fields.weight = fields.morningWeight || fields.eveningWeight;

      const title = `${fields.recordDate} 体重记录`;
      fields.attachments = getAttachments();
      if (isEdit) {
        await update('lifeRecords', record.id, { title, fields });
      } else {
        await add('lifeRecords', { title, fields, category: this.category });
      }
      // 跳到记录所在月份
      this.calendarMonth = new Date(fields.recordDate + 'T00:00:00');
      close();
      await this.loadData();
      this.render();
      window.showToast(isEdit ? '✅ 已更新' : '✅ 已记录');
    });
  }

  onDestroy() {}
}
