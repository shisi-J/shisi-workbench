/**
 * 诗思工作台 - Hash 路由系统
 * 基于 hashchange 事件，稳定可靠，适配 GitHub Pages
 */

// 路由配置表
const routes = {
  '/': { title: '诗思', module: 'home' },
  '/todo': { title: '日程待办', module: 'todo' },
  '/insight': { title: '感悟输出', module: 'insight' },
  '/inspiration': { title: '灵感库', module: 'inspiration' },
  '/podcast': { title: '每日播客', module: 'podcast' },
  '/energy': { title: 'SS能量', module: 'energy' },
  '/knowledge': { title: '个人知识库', module: 'knowledge' },
  '/workflow': { title: '工作流', module: 'workflow' },
  '/settings': { title: '设置', module: 'settings' },

  // 学习组
  '/learn/expression': { title: '学习表达', module: 'learn', category: 'expression' },
  '/learn/ai': { title: '学习AI', module: 'learn', category: 'ai' },
  '/learn/english': { title: '学习英语', module: 'learn', category: 'english' },
  '/learn/media': { title: '学习新媒体', module: 'learn', category: 'media' },
  '/learn/office': { title: 'Office技巧', module: 'learn', category: 'office' },

  // 工作随笔记
  '/work/project': { title: '项目管理', module: 'work', category: 'project' },
  '/work/procurement': { title: '采销管理', module: 'work', category: 'procurement' },
  '/work/finance': { title: '财务收付款', module: 'work', category: 'finance' },
  '/work/hr': { title: '人资社保', module: 'work', category: 'hr' },
  '/work/info': { title: '信息台账', module: 'work', category: 'info' },

  // 日常生活（独立子模块）
  '/life/eat': { title: '美食探店', module: 'lifeEat', category: 'eat' },
  '/life/fitness': { title: '训练台账', module: 'lifeFitness', category: 'fitness' },
  '/life/beauty': { title: '美妆穿搭', module: 'lifeBeauty', category: 'beauty' },
  '/life/finance': { title: '收支记账', module: 'lifeFinance', category: 'finance' },
  '/life/travel': { title: '行程游记', module: 'lifeTravel', category: 'travel' },
  '/life/home': { title: '小屋', module: 'lifeHome', category: 'home' },
  '/life/social': { title: '社交', module: 'lifeSocial', category: 'social' },
};

// 页面模块加载器（动态导入）
const pageLoaders = {
  home: () => import('./pages/home.js'),
  todo: () => import('./pages/todo.js'),
  insight: () => import('./pages/insight.js'),
  inspiration: () => import('./pages/inspiration.js'),
  podcast: () => import('./pages/podcast.js'),
  energy: () => import('./pages/energy.js'),
  knowledge: () => import('./pages/knowledge.js'),
  workflow: () => import('./pages/workflow.js'),
  settings: () => import('./pages/settings.js'),
  learn: () => import('./pages/learn.js'),
  work: () => import('./pages/work.js'),
  life: () => import('./pages/life.js'),
  lifeEat: () => import('./pages/life/eat.js'),
  lifeFitness: () => import('./pages/life/fitness.js'),
  lifeBeauty: () => import('./pages/life/beauty.js'),
  lifeFinance: () => import('./pages/life/finance.js'),
  lifeTravel: () => import('./pages/life/travel.js'),
  lifeHome: () => import('./pages/life/home.js'),
  lifeSocial: () => import('./pages/life/social.js'),
};

// 获取当前 hash 路径
function getHashPath() {
  const hash = window.location.hash || '#/';
  return hash.replace(/^#/, '') || '/';
}

// 解析路由
function resolveRoute(path) {
  // 精确匹配
  if (routes[path]) {
    return routes[path];
  }
  // 模糊匹配（处理尾部斜杠等）
  const normalized = path.replace(/\/+$/, '') || '/';
  if (routes[normalized]) {
    return routes[normalized];
  }
  // 默认 404
  return { title: '页面不存在', module: 'notfound' };
}

// 全局状态
let currentPath = null;
let currentPage = null;
let pageCache = new Map(); // 模块缓存

// 路由跳转
function navigate(path) {
  if (path === currentPath) return;
  window.location.hash = path;
}

// 渲染页面
async function renderPage(path) {
  const route = resolveRoute(path);
  const container = document.getElementById('pageContainer');

  if (!container) return;

  // 更新标题
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) {
    titleEl.textContent = route.title || '诗思';
  }

  // 更新导航高亮
  updateNavActive(path);

  // 404 处理
  if (route.module === 'notfound') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">页面不存在<br>请从侧边栏导航选择功能</div>
      </div>
    `;
    return;
  }

  // 显示加载状态
  container.innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  `;

  try {
    // 动态加载页面模块
    const loader = pageLoaders[route.module];
    if (!loader) {
      throw new Error(`Unknown module: ${route.module}`);
    }

    const pageModule = await loader();
    const PageClass = pageModule.default;

    // 如果当前页面有清理方法，先执行
    if (currentPage && currentPage.onDestroy) {
      currentPage.onDestroy();
    }

    // 创建新页面实例
    currentPage = new PageClass({
      container,
      route,
      path,
      params: { category: route.category },
      navigate,
    });

    // 渲染页面
    await currentPage.render();

    // 添加过渡动画
    container.firstElementChild?.classList.add('page-enter');

  } catch (err) {
    console.error('页面加载失败:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">页面加载失败<br>${err.message}</div>
      </div>
    `;
  }
}

// 更新导航激活状态
function updateNavActive(path) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const route = item.getAttribute('data-route');
    if (route === path) {
      item.classList.add('active');
      // 展开父分组
      const group = item.closest('.nav-group');
      if (group) {
        group.classList.remove('collapsed');
      }
    } else {
      item.classList.remove('active');
    }
  });
}

// 初始化路由
function initRouter() {
  // 监听 hash 变化
  window.addEventListener('hashchange', () => {
    const path = getHashPath();
    currentPath = path;
    renderPage(path);

    // 移动端关闭侧边栏
    if (window.innerWidth < 768) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      sidebar?.classList.remove('open');
      overlay?.classList.remove('active');
    }
  });

  // 初始加载
  const path = getHashPath();
  currentPath = path;
  renderPage(path);
}

// 导出
export { initRouter, navigate, getHashPath, currentPath };
