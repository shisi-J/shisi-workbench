/**
 * 能量工作台 - SS能量
 * 日记/完成事可查看可存储 + 信念墙 + 情绪急救 + 每日金句
 */
import { add, getAll, remove } from '../db.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const DEFAULT_QUOTES = [
  { content: '今天懒得动没关系，做一件让未来自己感谢你的小事就行。', source: '微小行动法', tags: ['motivation'] },
  { content: '我正在用每一天的努力，换未来的自由。', source: '每日信念', tags: ['belief'] },
  { content: '赚钱不丢人，没钱才焦虑。搞钱是最实在的安全感。', source: '搞钱信念墙', tags: ['belief'] },
  { content: '行动是治愈焦虑最好的药。', source: '行动法则', tags: ['motivation'] },
  { content: '把情绪写下来，就轻了一半。', source: '情绪管理', tags: ['mood'] },
  { content: '不要等到完美才开始，开始了才会完美。', source: '行动哲学', tags: ['motivation'] },
  { content: '你现在的状态，是过去选择的结果；你未来的状态，是现在选择的开始。', source: '因果法则', tags: ['belief'] },
  { content: '比起做到100分，先做到1分更重要。', source: '微小行动法', tags: ['motivation'] },
  { content: '允许自己偶尔摆烂，但别忘了回来。', source: '自我和解', tags: ['mood'] },
  { content: '攒钱不是为了抠门，是为了有说「不」的底气。', source: '搞钱信念墙', tags: ['belief'] },
];

const FEATURES = [
  { icon: '🌊', title: '情绪急救', desc: '焦虑内耗时点这里，3分钟回血', action: 'mood' },
  { icon: '🌟', title: '换句金句', desc: '随机一句正能量，随时打气', action: 'quote' },
  { icon: '📝', title: '写两句日记', desc: '把情绪写下来，就轻了一半', action: 'diary' },
  { icon: '✅', title: '完成一件事', desc: '行动是治愈焦虑最好的药', action: 'done' },
];

export default class EnergyPage {
  constructor({ container }) {
    this.container = container;
    this.quotes = [];
    this.quoteIndex = 0;
    this.diaries = [];
  }

  async render() {
    await this.loadData();
    this.container.innerHTML = this.html();
    this.bindEvents();
  }

  async loadData() {
    this.quotes = await getAll('quotes');
    if (this.quotes.length === 0) {
      for (const q of DEFAULT_QUOTES) await add('quotes', { ...q, favorite: false });
      this.quotes = await getAll('quotes');
    }
    this.quoteIndex = Math.floor(Math.random() * this.quotes.length);
    this.diaries = await getAll('diaries');
    this.todayDone = this.diaries.filter(d => d.date === this.todayStr()).length;
    this.todayDiaries = this.diaries
      .filter(d => d.date === this.todayStr())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  beliefs() { return this.quotes.filter(q => q.tags?.includes('belief')); }

  getGreeting() {
    const h = new Date().getHours();
    if (h < 6)  return { title: '深夜好', emoji: '🌙', msg: '夜深了，照顾好自己，明天还有很多可能。' };
    if (h < 9)  return { title: '早安', emoji: '☀️', msg: '新的一天，做一件让未来自己感谢你的小事。' };
    if (h < 12) return { title: '早上好', emoji: '🌤', msg: '把最重要的一件事先做完，剩下的都是加分项。' };
    if (h < 14) return { title: '中午好', emoji: '🌞', msg: '午间小憩后，继续用行动治愈焦虑。' };
    if (h < 18) return { title: '下午好', emoji: '🌇', msg: '下午的时光也很珍贵，先完成，再完美。' };
    if (h < 22) return { title: '晚上好', emoji: '🌆', msg: '你今天的每一次努力，都在悄悄改变明天的剧本。' };
    return { title: '晚上好', emoji: '🌙', msg: '夜深了，思绪容易翻涌。但记住——你今天的每一次努力，都在悄悄改变明天的剧本。' };
  }

  todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  todayDisplayStr() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEKDAYS[d.getDay()]}`;
  }

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  html() {
    const g = this.getGreeting();
    const q = this.quotes[this.quoteIndex] || DEFAULT_QUOTES[0];
    const bs = this.beliefs();
    const hb = bs[0]?.content || '我正在用每一天的努力，换未来的自由。';

    return /*html*/`
    <div class="energy-page">
      <div class="energy-header">
        <div class="energy-header-left">
          <div class="energy-header-icon">SS</div>
          <div class="energy-header-info">
            <div class="energy-header-title">SS能量</div>
            <div class="energy-header-date">${this.todayDisplayStr()}</div>
          </div>
        </div>
        <button class="energy-header-add" id="addBelief">+</button>
      </div>

      <div class="energy-progress-row">
        <span class="energy-progress-text">今日记录 ${(this.todayDone || 0)}/6</span>
        <span class="energy-progress-pct">${Math.min(100, Math.round((this.todayDone || 0) / 6 * 100))}%</span>
      </div>
      <div class="energy-progress-bar">
        <div class="energy-progress-fill" style="width:${Math.min(100, Math.round((this.todayDone || 0) / 6 * 100))}%"></div>
      </div>

      <div class="energy-quote-card" id="quoteCard">
        <div class="energy-quote-top">
          <span class="energy-quote-star">🌟</span>
          <span class="energy-quote-label">每日金句</span>
        </div>
        <div class="energy-quote-text">${q.content}</div>
        <div class="energy-quote-source">—— ${q.source} · 点击换一句</div>
        <button class="energy-quote-refresh" id="refreshQuote">🔄</button>
      </div>

      <div class="energy-greeting-card">
        <div class="energy-greeting-emoji">${g.emoji}</div>
        <div class="energy-greeting-title">${g.title}</div>
        <div class="energy-greeting-msg">${g.msg}</div>
        <div class="energy-greeting-highlight">${hb}</div>
      </div>

      <div class="energy-feature-grid">
        ${FEATURES.map(f => `
          <div class="energy-feature-card" data-action="${f.action}">
            <span class="energy-feature-emoji">${f.icon}</span>
            <div class="energy-feature-title">${f.title}</div>
            <div class="energy-feature-desc">${f.desc}</div>
          </div>
        `).join('')}
      </div>

      ${this.todayDiaries.length > 0 ? `
        <div class="energy-diary-section">
          <div class="energy-diary-header">
            <span>📋 今日记录</span>
            <button class="energy-diary-more" id="viewAllDiary">查看全部 ›</button>
          </div>
          <div class="energy-diary-list">
            ${this.todayDiaries.map(d => `
              <div class="energy-diary-item">
                <span class="energy-diary-type">${d.type === 'diary' ? '📝' : '✅'}</span>
                <span class="energy-diary-content">${(d.content || '').replace(/</g, '&lt;')}</span>
                <span class="energy-diary-time">${this.formatTime(d.createdAt)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="energy-belief-section">
        <div class="energy-belief-header">🔥 搞钱信念墙</div>
        ${bs.length === 0 ? '<div class="energy-belief-empty">还没有信念<br>点击右上角 + 添加</div>' : bs.map(b => `
          <div class="energy-belief-row">
            <span class="energy-belief-icon">✊</span>
            <span class="energy-belief-text">${b.content}</span>
            <button class="energy-belief-btn" data-del="${b.id}">🗑</button>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  bindEvents() {
    const refresh = () => { this.quoteIndex = (this.quoteIndex + 1) % this.quotes.length; this.render(); };
    document.getElementById('refreshQuote')?.addEventListener('click', e => { e.stopPropagation(); refresh(); });
    document.getElementById('quoteCard')?.addEventListener('click', refresh);

    document.querySelectorAll('.energy-feature-card').forEach(el => {
      el.addEventListener('click', () => {
        const a = el.dataset.action;
        if (a === 'mood') this.showMoodPopup();
        if (a === 'quote') { this.quoteIndex = (this.quoteIndex + 1) % this.quotes.length; this.render(); window.showToast('✨ 换一句金句'); }
        if (a === 'diary') this.showPopup('📝 写两句日记', '今天的感受', '把情绪写下来，就轻了一半...', 'diary');
        if (a === 'done') this.showPopup('✅ 完成一件事', '完成了什么？', '哪怕是很小的事...', 'done');
      });
    });

    document.getElementById('addBelief')?.addEventListener('click', () => this.showBeliefPopup());

    document.getElementById('viewAllDiary')?.addEventListener('click', () => this.showDiaryHistory());

    document.querySelectorAll('[data-del]').forEach(el => {
      el.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          await remove('quotes', parseInt(el.dataset.del));
          await this.loadData();
          this.render();
          window.showToast('已删除');
        } catch(e) { window.showToast('❌ 删除失败，请重试'); }
      });
    });
  }

  showMoodPopup() {
    const div = document.createElement('div');
    div.className = 'modal-overlay active';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">🌊 情绪急救 · 3分钟回血</div><button class="modal-close">✕</button></div>
        ${[
          ['🌬️','深呼吸','吸气4秒，屏气7秒，呼气8秒，重复3次'],
          ['👁️','5-4-3-2-1法则','说出5个看到的、4个摸到的、3个听到的、2个闻到的、1个尝到的'],
          ['💧','冷水洗脸','用冷水洗脸或洗手，激活副交感神经'],
          ['🧘','身体扫描','从脚到头，感受每个部位的存在，不评判'],
          ['🚶','起身走动','离开当前位置，走2分钟，换个环境'],
        ].map(([ico,tt,ds]) => `
          <div class="energy-aid-row"><span class="energy-aid-ico">${ico}</span><div class="energy-aid-body"><div class="energy-aid-tt">${tt}</div><div class="energy-aid-ds">${ds}</div></div></div>
        `).join('')}
      </div>`;
    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('.modal-close').onclick = close;
    div.addEventListener('click', e => { if (e.target === div) close(); });
  }

  showPopup(title, label, placeholder, type) {
    const div = document.createElement('div');
    div.className = 'modal-overlay active';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">${title}</div><button class="modal-close">✕</button></div>
        <div class="form-group"><label class="form-label">${label}</label>
          ${type === 'diary' ? `<textarea class="form-textarea" id="popupInput" placeholder="${placeholder}" style="min-height:100px" autofocus></textarea>` : `<input class="form-input" id="popupInput" placeholder="${placeholder}" autofocus>`}
        </div>
        <button class="btn btn-primary btn-block" id="popupSave">记录</button>
      </div>`;
    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('.modal-close').onclick = close;
    div.addEventListener('click', e => { if (e.target === div) close(); });
    div.querySelector('#popupSave').onclick = async () => {
      const v = div.querySelector('#popupInput').value.trim();
      if (!v) { window.showToast('写点什么吧'); return; }
      try {
        await add('diaries', { content: v, type, date: this.todayStr(), createdAt: new Date().toISOString() });
      } catch(e) { window.showToast('❌ 保存失败，请重试'); return; }
      await this.loadData();
      close();
      this.render();
      window.showToast(type === 'diary' ? '✅ 已记录' : '✅ 很棒！行动是治愈焦虑最好的药');
    };
  }

  showDiaryHistory() {
    const all = [...this.diaries].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const groups = {};
    all.forEach(d => {
      const key = d.date || '未知日期';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    const div = document.createElement('div');
    div.className = 'modal-overlay active';
    div.innerHTML = `
      <div class="modal" style="max-height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-header"><div class="modal-title">📋 记录历史</div><button class="modal-close">✕</button></div>
        <div style="overflow-y: auto; flex: 1; padding: 0 var(--space-3) var(--space-3);">
          ${all.length === 0 ? `
            <div style="text-align: center; padding: var(--space-5) 0; color: var(--text-tertiary);">还没有记录<br>去写一条日记或完成一件事吧</div>
          ` : Object.entries(groups).map(([date, items]) => `
            <div style="margin-bottom: var(--space-3);">
              <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin: var(--space-2) 0 var(--space-1); font-weight: var(--weight-semibold);">${date}</div>
              ${items.map(d => `
                <div class="energy-diary-item" style="margin-bottom: 6px;">
                  <span class="energy-diary-type">${d.type === 'diary' ? '📝' : '✅'}</span>
                  <span class="energy-diary-content">${(d.content || '').replace(/</g, '&lt;')}</span>
                  <span class="energy-diary-time">${this.formatTime(d.createdAt)}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>`;
    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('.modal-close').onclick = close;
    div.addEventListener('click', e => { if (e.target === div) close(); });
  }

  showBeliefPopup() {
    const div = document.createElement('div');
    div.className = 'modal-overlay active';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header"><div class="modal-title">🔥 添加搞钱信念</div><button class="modal-close">✕</button></div>
        <div class="form-group"><label class="form-label">信念内容</label><textarea class="form-textarea" id="beliefInput" placeholder="写下你的搞钱信念..." autofocus></textarea></div>
        <button class="btn btn-primary btn-block" id="beliefSave">保存</button>
      </div>`;
    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('.modal-close').onclick = close;
    div.addEventListener('click', e => { if (e.target === div) close(); });
    div.querySelector('#beliefSave').onclick = async () => {
      const v = div.querySelector('#beliefInput').value.trim();
      if (!v) { window.showToast('请输入信念内容'); return; }
      try {
        await add('quotes', { content: v, source: '搞钱信念墙', tags: ['belief'], favorite: true });
      } catch(e) { window.showToast('❌ 保存失败，请重试'); return; }
      close();
      await this.loadData();
      this.render();
      window.showToast('✅ 信念已添加');
    };
  }

  onDestroy() {}
}
