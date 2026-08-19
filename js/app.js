/**
 * 诗思工作台 - 应用入口
 * 负责初始化所有核心模块
 */

import { initRouter } from './router.js?v=153';
import { initTheme, toggleTheme } from './theme.js?v=153';
import { initSeedData, getAll, add } from './db.js?v=153';
import { parseShareText, isShareText, generateTagsFromParse } from './utils/shareParser.js?v=153';

// === Toast 工具 ===
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// === 侧边栏 & 顶栏控制 ===
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const topbarHome = document.getElementById('topbarHome');
  const settingsBtn = document.getElementById('settingsBtn');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  menuToggle?.addEventListener('click', openSidebar);
  sidebarClose?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // 顶栏"诗思"点击回首页
  topbarHome?.addEventListener('click', () => {
    window.location.hash = '/';
  });
  topbarHome?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.hash = '/';
    }
  });

  // 顶栏设置按钮
  settingsBtn?.addEventListener('click', () => {
    window.location.hash = '/settings';
  });
}

// === 搜索 ===
function initSearch() {
  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  // 快捷入口数据
  const quickLinks = [
    { icon: '🏠', title: '首页概览', route: '/' },
    { icon: '✅', title: '日程待办', route: '/todo' },
    { icon: '🧠', title: '感悟输出', route: '/insight' },
    { icon: '💡', title: '灵感库', route: '/inspiration' },
    { icon: '⚡', title: 'SS能量', route: '/energy' },
    { icon: '📖', title: '学习表达', route: '/learn/expression' },
    { icon: '🤖', title: '学习AI', route: '/learn/ai' },
    { icon: '🔤', title: '学习英语', route: '/learn/english' },
    { icon: '📱', title: '学习新媒体', route: '/learn/media' },
    { icon: '💼', title: 'Office技巧', route: '/learn/office' },
    { icon: '📊', title: '项目管理', route: '/work/project' },
    { icon: '📦', title: '采销管理', route: '/work/procurement' },
    { icon: '💰', title: '财务收付款', route: '/work/finance' },
    { icon: '👥', title: '人资社保', route: '/work/hr' },
    { icon: '📋', title: '信息台账', route: '/work/info' },
    { icon: '🍽️', title: '美食探店', route: '/life/eat' },
    { icon: '💪', title: '训练台账', route: '/life/fitness' },
    { icon: '💄', title: '美妆穿搭', route: '/life/beauty' },
    { icon: '💎', title: '收支记账', route: '/life/finance' },
    { icon: '✈️', title: '行程游记', route: '/life/travel' },
    { icon: '🏠', title: '小屋 · 安家置业', route: '/life/home' },
    { icon: '🤝', title: '社交 · 人情往来', route: '/life/social' },
    { icon: '📁', title: '个人知识库', route: '/knowledge' },
    { icon: '📋', title: '工作流', route: '/workflow' },
    { icon: '⚙️', title: '设置', route: '/settings' },
  ];

  function renderResults(query) {
    const filtered = query
      ? quickLinks.filter(item => item.title.includes(query))
      : quickLinks;

    if (filtered.length === 0) {
      searchResults.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">未找到匹配的功能</div></div>';
      return;
    }

    searchResults.innerHTML = filtered.map(item => `
      <div class="search-result-item" data-route="${item.route}">
        <span style="font-size: 24px;">${item.icon}</span>
        <span>${item.title}</span>
      </div>
    `).join('');

    searchResults.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const route = el.getAttribute('data-route');
        window.location.hash = route;
        searchOverlay.classList.remove('active');
        searchInput.value = '';
      });
    });
  }

  searchBtn?.addEventListener('click', () => {
    searchOverlay.classList.add('active');
    searchInput.focus();
    renderResults('');
  });

  searchClose?.addEventListener('click', () => {
    searchOverlay.classList.remove('active');
    searchInput.value = '';
  });

  searchInput?.addEventListener('input', (e) => {
    renderResults(e.target.value);
  });
}

// === AI 对话 & 收藏链接 ===
function initAI() {
  const aiBtn = document.getElementById('aiBtn');
  const aiPanel = document.getElementById('aiPanel');
  const aiClose = document.getElementById('aiClose');
  const aiInput = document.getElementById('aiInput');
  const aiSend = document.getElementById('aiSend');
  const aiMessages = document.getElementById('aiMessages');

  function toggleAI() {
    aiPanel.classList.toggle('active');
    // 打开时加载最近收藏列表
    if (aiPanel.classList.contains('active')) {
      loadRecentCollections();
    }
  }

  aiBtn?.addEventListener('click', toggleAI);
  aiClose?.addEventListener('click', toggleAI);

  // === AI 浮动按钮：可拖拽 + 点击打开 ===
  const aiFab = document.getElementById('aiFab');
  if (aiFab) {
    // 恢复上次位置
    const savedPos = localStorage.getItem('shisi-ai-fab-pos');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        aiFab.style.left = pos.x + 'px';
        aiFab.style.top = pos.y + 'px';
        aiFab.style.bottom = 'auto';
        aiFab.style.right = 'auto';
      } catch (e) {}
    }

    let isDragging = false;
    let startX = 0, startY = 0;
    let fabX = 0, fabY = 0;
    let hasMoved = false;
    const MOVE_THRESHOLD = 6;

    function onDragStart(clientX, clientY) {
      const rect = aiFab.getBoundingClientRect();
      fabX = rect.left;
      fabY = rect.top;
      startX = clientX;
      startY = clientY;
      hasMoved = false;
      isDragging = true;
    }

    function onDragMove(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        if (!hasMoved) {
          hasMoved = true;
          aiFab.classList.add('dragging');
        }
        let newX = fabX + dx;
        let newY = fabY + dy;
        // 边界约束
        const fabW = aiFab.offsetWidth;
        const fabH = aiFab.offsetHeight;
        newX = Math.max(4, Math.min(window.innerWidth - fabW - 4, newX));
        newY = Math.max(4, Math.min(window.innerHeight - fabH - 4, newY));
        aiFab.style.left = newX + 'px';
        aiFab.style.top = newY + 'px';
        aiFab.style.bottom = 'auto';
        aiFab.style.right = 'auto';
      }
    }

    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      aiFab.classList.remove('dragging');
      if (hasMoved) {
        // 保存位置
        const rect = aiFab.getBoundingClientRect();
        localStorage.setItem('shisi-ai-fab-pos', JSON.stringify({
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        }));
      } else {
        // 未移动 → 视为点击
        toggleAI();
      }
    }

    // 触摸事件
    aiFab.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onDragStart(t.clientX, t.clientY);
    }, { passive: true });

    aiFab.addEventListener('touchmove', (e) => {
      if (isDragging && hasMoved) e.preventDefault();
      const t = e.touches[0];
      onDragMove(t.clientX, t.clientY);
    }, { passive: false });

    aiFab.addEventListener('touchend', onDragEnd);

    // 鼠标事件
    aiFab.addEventListener('mousedown', (e) => {
      onDragStart(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      onDragMove(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', onDragEnd);
  }

  // === Tab 切换 ===
  document.querySelectorAll('.ai-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-aitab');
      document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('aiChatContent').style.display = target === 'chat' ? '' : 'none';
      document.getElementById('aiCollectContent').style.display = target === 'collect' ? '' : 'none';
      if (target === 'collect') {
        loadRecentCollections();
      }
    });
  });

  // === AI 对话功能 ===
  async function callAI(message) {
    const apiKey = localStorage.getItem('shisi-ai-key') || '';
    const apiUrl = localStorage.getItem('shisi-ai-url') || 'https://api.chatanywhere.tech/v1/chat/completions';
    const model = localStorage.getItem('shisi-ai-model') || 'gpt-3.5-turbo';

    if (!apiKey) {
      return '请在「设置」中配置 AI API Key 后使用此功能。\n\n推荐免费 API：\n1. ChatAnywhere（免费 GPT 代理）\n2. SiliconFlow（硅基流动，免费额度）\n3. 其他兼容 OpenAI 格式的 API';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是诗思AI助手，帮助用户管理工作、学习和生活。请用简洁友好的中文回答。' },
          { role: 'user', content: message },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg user';
    userMsg.textContent = text;
    aiMessages.appendChild(userMsg);

    aiInput.value = '';
    aiSend.disabled = true;

    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'ai-msg bot';
    loadingMsg.textContent = '思考中...';
    aiMessages.appendChild(loadingMsg);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    try {
      const response = await callAI(text);
      loadingMsg.textContent = response;
    } catch (err) {
      loadingMsg.textContent = `抱歉，AI 服务暂时不可用：${err.message}`;
    }

    aiSend.disabled = false;
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  aiSend?.addEventListener('click', sendMessage);
  aiInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // === 收藏链接功能 ===
  let currentParsedResult = null;

  // 实时解析预览
  let collectTimer = null;
  document.getElementById('collectInput')?.addEventListener('input', (e) => {
    clearTimeout(collectTimer);
    const text = e.target.value.trim();
    const resultDiv = document.getElementById('collectParseResult');
    const actionsDiv = document.getElementById('collectActions');

    if (!text) {
      resultDiv.innerHTML = '';
      actionsDiv.style.display = 'none';
      currentParsedResult = null;
      return;
    }

    collectTimer = setTimeout(() => {
      const parsed = parseShareText(text);
      if (parsed && parsed.isShareText) {
        currentParsedResult = parsed;
        renderCollectPreview(parsed);
        actionsDiv.style.display = '';
      } else if (parsed && parsed.url) {
        // 纯链接也支持
        currentParsedResult = parsed;
        renderCollectPreview(parsed);
        actionsDiv.style.display = '';
      } else {
        resultDiv.innerHTML = '';
        actionsDiv.style.display = 'none';
        currentParsedResult = null;
      }
    }, 300);
  });

  // 读取剪贴板
  document.getElementById('collectPasteBtn')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        document.getElementById('collectInput').value = text.trim();
        // 触发input事件进行解析
        document.getElementById('collectInput').dispatchEvent(new Event('input'));
      } else {
        showToast('剪贴板为空');
      }
    } catch (e) {
      showToast('请手动粘贴');
    }
  });

  // 渲染解析预览
  function renderCollectPreview(parsed) {
    const resultDiv = document.getElementById('collectParseResult');
    resultDiv.innerHTML = `
      <div class="share-parse-card">
        <div class="share-parse-header">
          <span class="share-parse-platform">${parsed.platformIcon} ${parsed.platformName}</span>
          <span class="share-parse-badge">✅ 已识别</span>
        </div>
        ${parsed.author ? `<div class="share-parse-row"><span class="share-parse-label">👤 作者</span><span class="share-parse-value">${parsed.author}</span></div>` : ''}
        ${parsed.title ? `<div class="share-parse-row"><span class="share-parse-label">📌 标题</span><span class="share-parse-value">${parsed.title}</span></div>` : ''}
        ${parsed.summary ? `<div class="share-parse-row"><span class="share-parse-label">📝 摘要</span><span class="share-parse-value">${parsed.summary}</span></div>` : ''}
        ${parsed.url ? `<div class="share-parse-row"><span class="share-parse-label">🔗 链接</span><span class="share-parse-value share-parse-url">${parsed.url}</span></div>` : ''}
      </div>
    `;
  }

  // 收藏到灵感库
  document.getElementById('collectSaveBtn')?.addEventListener('click', async () => {
    if (!currentParsedResult) {
      showToast('请先粘贴分享内容');
      return;
    }

    const parsed = currentParsedResult;
    const aiTags = generateTagsFromParse(parsed);

    try {
      await add('inspirations', {
        url: parsed.url || parsed.rawText,
        title: parsed.title || (parsed.author ? `${parsed.platformName} - ${parsed.author}` : '分享收藏'),
        platform: parsed.platform !== 'webpage' ? parsed.platform : 'webpage',
        author: parsed.author || '',
        cover: '',
        summary: parsed.summary || '',
        tags: aiTags,
        notes: '',
        favorite: false,
        createdAt: new Date().toISOString(),
      });

      showToast(`✅ 已收藏到灵感库`);
      // 清空输入
      document.getElementById('collectInput').value = '';
      document.getElementById('collectParseResult').innerHTML = '';
      document.getElementById('collectActions').style.display = 'none';
      currentParsedResult = null;
      // 刷新最近收藏
      loadRecentCollections();
    } catch (e) {
      showToast('收藏失败：' + e.message);
    }
  });

  // 加载最近收藏列表
  async function loadRecentCollections() {
    const listDiv = document.getElementById('collectRecentList');
    if (!listDiv) return;

    try {
      const all = await getAll('inspirations');
      // 按时间倒序，取最近5条
      const recent = all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);

      if (recent.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; color:var(--text-tertiary); font-size:var(--font-sm); padding:var(--space-3);">暂无收藏记录</div>';
        return;
      }

      const platformIcons = {
        douyin: '🎵', xhs: '📕', bilibili: '📺', weibo: '🐦', zhihu: '💭', webpage: '🔗',
      };

      listDiv.innerHTML = recent.map(item => {
        const icon = platformIcons[item.platform] || '🔗';
        const safeUrl = (item.url || '').replace(/"/g, '&quot;');
        return `
          <div class="ai-collect-item" data-url="${safeUrl}" data-id="${item.id}">
            <span class="ai-collect-item-icon">${icon}</span>
            <div class="ai-collect-item-body">
              <div class="ai-collect-item-title">${item.title || '未命名'}</div>
              ${item.author ? `<div class="ai-collect-item-author">${item.author}</div>` : ''}
            </div>
            <span class="ai-collect-item-arrow">→</span>
          </div>
        `;
      }).join('');

      // 点击跳转
      listDiv.querySelectorAll('.ai-collect-item').forEach(el => {
        el.addEventListener('click', () => {
          const url = el.getAttribute('data-url') || '';
          if (url) {
            const fullUrl = url.startsWith('http') ? url : 'https://' + url;
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
          } else {
            showToast('该收藏无链接');
          }
        });
      });
    } catch (e) {
      listDiv.innerHTML = '<div style="text-align:center; color:var(--text-tertiary); font-size:var(--font-sm); padding:var(--space-3);">加载失败</div>';
    }
  }
}

// === 主题切换 ===
function initThemeToggle() {
  const themeBtn = document.getElementById('themeBtn');
  themeBtn?.addEventListener('click', () => {
    const next = toggleTheme();
    const labels = { light: '浅色', dark: '深色', auto: '跟随系统' };
    showToast(`主题：${labels[next] || next}`);
  });
}

// === Service Worker 注册 ===
function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(registration => {
      let pendingUpdate = false;

      // 检测到新版本已下载
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本已下载，但不要立即激活
            // 标记为待更新，等用户空闲时再应用
            pendingUpdate = true;
            tryApplyUpdate();
          }
        });
      });

      // 尝试应用更新：仅在用户没有正在编辑时执行
      function tryApplyUpdate() {
        if (!pendingUpdate) return;
        const hasModal = document.querySelector('.modal-overlay.active');
        if (hasModal) {
          // 用户正在编辑，等待弹窗关闭后再试
          window.showToast('📲 新版本已就绪，编辑完成后自动更新', 3000);
          // 监听弹窗关闭
          const observer = new MutationObserver(() => {
            if (!document.querySelector('.modal-overlay.active')) {
              observer.disconnect();
              setTimeout(applyNow, 1000);
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          applyNow();
        }
      }

      function applyNow() {
        if (!pendingUpdate) return;
        pendingUpdate = false;
        // 通知 SW 激活新版本
        registration.waiting?.postMessage('SKIP_WAITING');
      }

      // 每 60 分钟检查一次更新
      setInterval(() => registration.update(), 3600000);
    }).catch(err => {
      console.log('SW 注册失败（不影响使用）:', err);
    });

    // SW 控制权变化：延迟刷新让新缓存就绪
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      setTimeout(() => window.location.reload(), 800);
    });
  });
}

// === 阻止双击缩放 ===
function preventZoom() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

// === 初始化 ===
async function init() {
  initTheme();
  await initSeedData();
  initRouter();
  initSidebar();
  initSearch();
  initAI();
  initThemeToggle();
  registerSW();
  preventZoom();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 全局工具
window.showToast = showToast;
