/**
 * 首页概览页面
 * 工作与生活双轨设计，去除能量工作台内容
 */

import { getAll, count, getByCategory } from '../db.js';

// 本地日期格式化（避免 toISOString 的 UTC 时区偏移问题）
function localDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Open-Meteo 天气码映射
const WEATHER_MAP = {
  0:  { icon: '☀️', label: '晴' },
  1:  { icon: '🌤️', label: '大部晴' },
  2:  { icon: '⛅', label: '多云' },
  3:  { icon: '☁️', label: '阴' },
  45: { icon: '🌫️', label: '雾' },
  48: { icon: '🌫️', label: '雾凇' },
  51: { icon: '🌧️', label: '小毛毛雨' },
  53: { icon: '🌧️', label: '毛毛雨' },
  55: { icon: '🌧️', label: '大毛毛雨' },
  61: { icon: '🌦️', label: '小雨' },
  63: { icon: '🌧️', label: '中雨' },
  65: { icon: '🌧️', label: '大雨' },
  71: { icon: '🌨️', label: '小雪' },
  73: { icon: '🌨️', label: '中雪' },
  75: { icon: '❄️', label: '大雪' },
  80: { icon: '🌦️', label: '阵雨' },
  81: { icon: '🌧️', label: '中阵雨' },
  82: { icon: '⛈️', label: '大阵雨' },
  95: { icon: '⛈️', label: '雷暴' },
  96: { icon: '⛈️', label: '冰雹雷暴' },
  99: { icon: '⛈️', label: '强雷暴' },
};

// 工作模块配置
const WORK_MODULES = [
  { icon: '📊', label: '项目管理', route: '/work/project', category: 'project', color: '#EF476F' },
  { icon: '📦', label: '采销管理', route: '/work/procurement', category: 'procurement', color: '#F78C6B' },
  { icon: '💰', label: '财务收付', route: '/work/finance', category: 'finance', color: '#FFD166' },
  { icon: '👥', label: '人资社保', route: '/work/hr', category: 'hr', color: '#06D6A0' },
  { icon: '📋', label: '信息台账', route: '/work/info', category: 'info', color: '#118AB2' },
];

// 生活模块配置
const LIFE_MODULES = [
  { icon: '🍽️', label: '美食探店', route: '/life/eat', category: 'eat', color: '#EF476F' },
  { icon: '💪', label: '训练台账', route: '/life/fitness', category: 'fitness', color: '#06D6A0' },
  { icon: '💄', label: '美妆穿搭', route: '/life/beauty', category: 'beauty', color: '#9D4EDD' },
  { icon: '💎', label: '收支记账', route: '/life/finance', category: 'finance', color: '#FFD166' },
  { icon: '✈️', label: '行程游记', route: '/life/travel', category: 'travel', color: '#118AB2' },
  { icon: '🏠', label: '小屋', route: '/life/home', category: 'home', color: '#073B4C' },
  { icon: '🤝', label: '社交', route: '/life/social', category: 'social', color: '#06D6A0' },
];

export default class HomePage {
  constructor({ container, route, navigate }) {
    this.container = container;
    this.route = route;
    this.navigate = navigate;
    this.weather = null;
  }

  async render() {
    const today = localDateStr(new Date());
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 · 星期${weekdays[now.getDay()]}`;

    // 并行获取所有数据
    const [
      todos, workCounts, lifeCounts,
      learnings, inspirations, podcasts, insights,
    ] = await Promise.all([
      this._safeGetAll('todos'),
      this._getCategoryCounts('workRecords', WORK_MODULES),
      this._getCategoryCounts('lifeRecords', LIFE_MODULES),
      this._safeGetAll('learnings'),
      this._safeGetAll('inspirations'),
      this._safeGetAll('podcasts'),
      this._safeGetAll('insights'),
    ]);

    // 今日待办统计
    const todayTodos = todos.filter(t => t.date === today);
    const todoDone = todayTodos.filter(t => t.done).length;
    const todoCount = todayTodos.length;
    const todoPercent = todoCount > 0 ? Math.round(todoDone / todoCount * 100) : 0;

    // 工作待办（sourceModule 含 work 或 category 为 工作）
    const workTodos = todayTodos.filter(t => this._isWorkTodo(t));
    const lifeTodos = todayTodos.filter(t => this._isLifeTodo(t));

    // 学习统计
    const learnChecked = learnings.filter(l => l.checked).length;
    const learnTotal = learnings.length;
    const learnPercent = learnTotal > 0 ? Math.round(learnChecked / learnTotal * 100) : 0;

    // 灵感/播客/感悟统计
    const inspirationCount = inspirations.length;
    const podcastChecked = podcasts.filter(p => p.checked).length;
    const podcastTotal = podcasts.length;
    const insightCount = insights.length;

    // 工作台账总记录数
    const workTotal = Object.values(workCounts).reduce((a, b) => a + b, 0);
    const lifeTotal = Object.values(lifeCounts).reduce((a, b) => a + b, 0);

    this.container.innerHTML = `
      <!-- 顶部头部卡片 -->
      <div class="home-hero">
        <div class="home-hero-content">
          <div class="home-hero-left">
            <div class="home-hero-date">
              ${dateStr}<span id="weatherSlot"> <span style="opacity:0.6">⏳</span></span>
            </div>
            <div class="home-hero-greeting">${this.getGreeting()}</div>
          </div>
          <div class="home-hero-right">
            <div class="home-hero-progress-ring" style="--pct: ${todoPercent}">
              <div class="home-hero-progress-num">${todoPercent}<span>%</span></div>
              <div class="home-hero-progress-label">今日完成</div>
            </div>
          </div>
        </div>
        <div class="home-hero-todo-bar">
          <span class="home-hero-todo-text">📋 ${todoDone}/${todoCount} 待办</span>
          <span class="home-hero-todo-divider">·</span>
          <span class="home-hero-todo-text">🔴 工作 ${workTodos.length}</span>
          <span class="home-hero-todo-divider">·</span>
          <span class="home-hero-todo-text">🔵 生活 ${lifeTodos.length}</span>
        </div>
      </div>

      <!-- 今日待办预览 -->
      ${todayTodos.length > 0 ? `
        <div class="card home-todo-card">
          <div class="card-header">
            <div class="card-title">📋 今日待办</div>
            <button class="btn btn-sm btn-outline" onclick="location.hash='#/todo'">全部</button>
          </div>
          <div class="home-todo-list">
            ${todayTodos.slice(0, 5).map(todo => `
              <div class="home-todo-item">
                <div class="home-todo-check ${todo.done ? 'checked' : ''}"></div>
                <div class="home-todo-body">
                  <div class="home-todo-title ${todo.done ? 'done' : ''}">${todo.title || '未命名'}</div>
                  <div class="home-todo-meta">
                    ${this._getSourceTag(todo)}
                    ${todo.priority ? `<span class="home-todo-pri pri-${todo.priority}">${this.getPriorityText(todo.priority)}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="card home-empty-todo" onclick="location.hash='#/todo'">
          <span style="font-size: 28px;">📝</span>
          <span>今日暂无待办，点击添加任务</span>
        </div>
      `}

      <!-- 工作板块 -->
      <div class="home-section">
        <div class="home-section-header" onclick="location.hash='#/work/project'">
          <div class="home-section-title">
            <span class="home-section-icon" style="background: rgba(239, 71, 111, 0.12); color: #EF476F;">💼</span>
            <span>工作台</span>
          </div>
          <div class="home-section-info">
            <span class="home-section-count">${workTotal} 条记录</span>
            <span class="home-section-arrow">›</span>
          </div>
        </div>
        <div class="home-module-grid">
          ${WORK_MODULES.map(m => `
            <div class="home-module-card" onclick="location.hash='#${m.route}'">
              <div class="home-module-icon" style="background: ${m.color}20; color: ${m.color};">${m.icon}</div>
              <div class="home-module-label">${m.label}</div>
              <div class="home-module-count">${workCounts[m.category] || 0}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 生活板块 -->
      <div class="home-section">
        <div class="home-section-header" onclick="location.hash='#/life/eat'">
          <div class="home-section-title">
            <span class="home-section-icon" style="background: rgba(6, 214, 160, 0.12); color: #06D6A0;">🌿</span>
            <span>生活志</span>
          </div>
          <div class="home-section-info">
            <span class="home-section-count">${lifeTotal} 条记录</span>
            <span class="home-section-arrow">›</span>
          </div>
        </div>
        <div class="home-module-grid">
          ${LIFE_MODULES.map(m => `
            <div class="home-module-card" onclick="location.hash='#${m.route}'">
              <div class="home-module-icon" style="background: ${m.color}20; color: ${m.color};">${m.icon}</div>
              <div class="home-module-label">${m.label}</div>
              <div class="home-module-count">${lifeCounts[m.category] || 0}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 学习与成长 -->
      <div class="home-section">
        <div class="home-section-header" onclick="location.hash='#/learn/expression'">
          <div class="home-section-title">
            <span class="home-section-icon" style="background: rgba(157, 78, 221, 0.12); color: #9D4EDD;">📚</span>
            <span>学习成长</span>
          </div>
          <div class="home-section-info">
            <span class="home-section-count">${learnChecked}/${learnTotal} 已打卡 · ${learnPercent}%</span>
            <span class="home-section-arrow">›</span>
          </div>
        </div>
        <div class="home-learn-bar" onclick="location.hash='#/learn/expression'">
          <div class="home-learn-progress">
            <div class="home-learn-fill" style="width: ${learnPercent}%"></div>
          </div>
          <div class="home-learn-cats">
            <span class="home-learn-cat" onclick="event.stopPropagation(); location.hash='#/learn/expression'">📖 表达</span>
            <span class="home-learn-cat" onclick="event.stopPropagation(); location.hash='#/learn/ai'">🤖 AI</span>
            <span class="home-learn-cat" onclick="event.stopPropagation(); location.hash='#/learn/english'">🔤 英语</span>
            <span class="home-learn-cat" onclick="event.stopPropagation(); location.hash='#/learn/media'">📱 新媒体</span>
            <span class="home-learn-cat" onclick="event.stopPropagation(); location.hash='#/learn/office'">💼 Office</span>
          </div>
        </div>
      </div>

      <!-- 灵感与收获 -->
      <div class="home-section">
        <div class="home-section-header">
          <div class="home-section-title">
            <span class="home-section-icon" style="background: rgba(255, 209, 102, 0.15); color: #FFD166;">💡</span>
            <span>灵感与收获</span>
          </div>
        </div>
        <div class="home-tool-grid">
          <div class="home-tool-card" onclick="location.hash='#/inspiration'">
            <div class="home-tool-icon">💡</div>
            <div class="home-tool-body">
              <div class="home-tool-title">灵感库</div>
              <div class="home-tool-desc">${inspirationCount} 条收藏</div>
            </div>
            <div class="home-tool-arrow">›</div>
          </div>
          <div class="home-tool-card" onclick="location.hash='#/podcast'">
            <div class="home-tool-icon">🎙️</div>
            <div class="home-tool-body">
              <div class="home-tool-title">每日播客</div>
              <div class="home-tool-desc">${podcastChecked}/${podcastTotal} 已听</div>
            </div>
            <div class="home-tool-arrow">›</div>
          </div>
          <div class="home-tool-card" onclick="location.hash='#/insight'">
            <div class="home-tool-icon">🧠</div>
            <div class="home-tool-body">
              <div class="home-tool-title">感悟输出</div>
              <div class="home-tool-desc">${insightCount} 篇感悟</div>
            </div>
            <div class="home-tool-arrow">›</div>
          </div>
          <div class="home-tool-card" onclick="location.hash='#/knowledge'">
            <div class="home-tool-icon">📁</div>
            <div class="home-tool-body">
              <div class="home-tool-title">知识库</div>
              <div class="home-tool-desc">个人知识管理</div>
            </div>
            <div class="home-tool-arrow">›</div>
          </div>
        </div>
      </div>
    `;

    // 异步获取天气
    this.fetchWeather().then(() => {
      const el = document.getElementById('weatherSlot');
      if (el) {
        el.innerHTML = this.weather ? this.renderWeather() : '';
      }
    });
  }

  // 安全获取全部数据
  async _safeGetAll(table) {
    try {
      return await getAll(table);
    } catch (e) {
      return [];
    }
  }

  // 获取分类计数
  async _getCategoryCounts(table, modules) {
    const counts = {};
    try {
      const all = await getAll(table);
      for (const m of modules) {
        counts[m.category] = all.filter(r => r.category === m.category).length;
      }
    } catch (e) {}
    return counts;
  }

  // 判断是否工作待办
  _isWorkTodo(todo) {
    const sm = (todo.sourceModule || '').toLowerCase();
    if (sm.includes('work') || sm.includes('project') || sm.includes('finance') || sm.includes('hr')) return true;
    if (todo.category === '工作') return true;
    return false;
  }

  // 判断是否生活待办
  _isLifeTodo(todo) {
    const sm = (todo.sourceModule || '').toLowerCase();
    if (sm.includes('life') || sm.includes('eat') || sm.includes('fitness') || sm.includes('beauty')) return true;
    if (todo.category === '生活') return true;
    return false;
  }

  // 获取来源标签
  _getSourceTag(todo) {
    if (this._isWorkTodo(todo)) return '<span class="home-todo-src src-work">🔴 工作</span>';
    if (this._isLifeTodo(todo)) return '<span class="home-todo-src src-life">🔵 生活</span>';
    if (todo.category === '学习') return '<span class="home-todo-src src-learn">🟢 学习</span>';
    return '<span class="home-todo-src src-general">⚫ 通用</span>';
  }

  renderWeather() {
    const w = this.weather;
    if (!w) return '';
    const wm = WEATHER_MAP[w.code] || { icon: '🌤️', label: '多云' };
    const cityText = w.city ? `${w.city} ` : '';
    return ` · ${cityText}${wm.icon} ${w.temp}° <span style="opacity:0.7">${w.low}°/${w.high}°</span>`;
  }

  getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了，注意休息';
    if (h < 9) return '早上好，新的一天';
    if (h < 12) return '上午好，保持专注';
    if (h < 14) return '中午好，休息一下';
    if (h < 18) return '下午好，继续加油';
    if (h < 22) return '晚上好，复盘今天';
    return '夜深了，注意休息';
  }

  getPriorityText(priority) {
    const map = { high: '高', medium: '中', low: '低' };
    return map[priority] || '';
  }

  async fetchWeather() {
    // 1. 本地缓存（30 分钟内有效）
    try {
      const cached = localStorage.getItem('shisi-weather-cache');
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - (data.ts || 0) < 1800000 && data.weather?.city) {
          this.weather = data.weather;
          return;
        }
      }
    } catch (e) {}

    // 2. 真并行：GPS + ipinfo.io + pconline 同时发起
    let lat = null, lon = null, cityName = '';

    // GPS 包装为不 reject 的 Promise（超时/拒绝都 resolve null）
    const gpsPromise = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 600000 }
      );
    });

    const [gpsRes, ipinfoRes, pconlineRes] = await Promise.allSettled([
      gpsPromise,
      this._fetchWithTimeout('https://ipinfo.io/json', 4000),
      this._fetchWithTimeout('https://whois.pconline.com.cn/ipJson.jsp?json=true', 3000),
    ]);

    // GPS 坐标
    if (gpsRes.status === 'fulfilled' && gpsRes.value) {
      lat = gpsRes.value.lat;
      lon = gpsRes.value.lon;
    }

    // pconline → 中文城市名（需 GBK 解码，iOS Safari 不支持则自动跳过）
    if (pconlineRes.status === 'fulfilled' && pconlineRes.value && pconlineRes.value.ok) {
      try {
        const buf = await pconlineRes.value.arrayBuffer();
        let text = '';
        try {
          text = new TextDecoder('gbk').decode(buf);
        } catch (e) {
          // iOS 不支持 gbk 编码，跳过 pconline
        }
        if (text) {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const loc = JSON.parse(m[0]);
            cityName = (loc.city || '').replace('市', '') || (loc.pro || '').replace('省', '');
          }
        }
      } catch (e) {}
    }

    // ipinfo.io → 坐标（GPS 没拿到时用）+ 英文城市名
    let enCity = '';
    if (ipinfoRes.status === 'fulfilled' && ipinfoRes.value && ipinfoRes.value.ok) {
      try {
        const d = await ipinfoRes.value.json();
        if (d.loc && lat === null) {
          const parts = d.loc.split(',');
          lat = parseFloat(parts[0]);
          lon = parseFloat(parts[1]);
        }
        enCity = d.city || d.region || '';
      } catch (e) {}
    }

    // 英文城市名 → 中文（通过 Open-Meteo 地理编码，全程 UTF-8，iOS 友好）
    if (!cityName && enCity) {
      try {
        const r = await this._fetchWithTimeout(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(enCity)}&count=1&language=zh&format=json`,
          3000
        );
        if (r && r.ok) {
          const g = await r.json();
          if (g.results && g.results[0]) {
            cityName = g.results[0].name;
          }
        }
      } catch (e) {}
      if (!cityName) cityName = enCity; // 退回英文也比空白好
    }

    // 有城市名但没坐标 → 通过城市名查坐标
    if (lat === null && cityName) {
      try {
        const r = await this._fetchWithTimeout(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&format=json`,
          3000
        );
        if (r && r.ok) {
          const g = await r.json();
          if (g.results && g.results[0]) {
            lat = g.results[0].latitude;
            lon = g.results[0].longitude;
          }
        }
      } catch (e) {}
    }

    // 兜底：上海
    if (lat === null) { lat = 31.23; lon = 121.47; }
    if (!cityName) cityName = '上海';

    // 3. 获取天气
    await this._fetchWeatherByCoords(lat, lon, cityName);
    if (this.weather) this._cacheWeather();
  }

  // 带超时的 fetch
  async _fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // 缓存天气到 localStorage
  _cacheWeather() {
    if (!this.weather) return;
    try {
      localStorage.setItem('shisi-weather-cache', JSON.stringify({
        weather: this.weather,
        ts: Date.now(),
      }));
    } catch (e) {}
  }

  async _fetchWeatherByCoords(latitude, longitude, cityName = '') {
    const weatherRes = await this._fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Shanghai&forecast_days=1`,
      5000
    );
    if (!weatherRes || !weatherRes.ok) return;

    const data = await weatherRes.json();
    if (data && data.current) {
      const c = data.current;
      const d = data.daily;
      this.weather = {
        temp: Math.round(c.temperature_2m),
        code: c.weather_code,
        humidity: c.relative_humidity_2m,
        wind: Math.round(c.wind_speed_10m),
        high: d ? Math.round(d.temperature_2m_max[0]) : '--',
        low: d ? Math.round(d.temperature_2m_min[0]) : '--',
        city: cityName,
      };
    }
  }

  onDestroy() {}
}
