/**
 * 诗思工作台 - Service Worker
 * 缓存优先策略：有缓存立即返回（秒开），后台静默更新
 * 解决国内 GitHub Pages 访问慢导致白屏问题
 */

const CACHE_VERSION = 'shisi-v1.8.4';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;

// 静态资源列表（安装时预缓存）
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './share.html',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/router.js',
  './js/theme.js',
  './js/crypto.js',
  './js/db.js',
  './js/utils/attachments.js',
  './js/utils/shareParser.js',
  './js/pages/home.js',
  './js/pages/todo.js',
  './js/pages/insight.js',
  './js/pages/energy.js',
  './js/pages/learn.js',
  './js/pages/work.js',
  './js/pages/life.js',
  './js/pages/life/fitness.js',
  './js/pages/life/finance.js',
  './js/pages/life/travel.js',
  './js/pages/life/beauty.js',
  './js/pages/life/eat.js',
  './js/pages/life/home.js',
  './js/pages/life/social.js',
  './js/pages/knowledge.js',
  './js/pages/workflow.js',
  './js/pages/inspiration.js',
  './js/pages/podcast.js',
  './js/pages/settings.js',
  './assets/icon.svg',
];

// CDN 资源（允许缓存但不预缓存）
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
];

// 网络超时时间（毫秒）：超过此时间回退缓存
const NETWORK_TIMEOUT = 3000;

// === 安装：预缓存静态资源 ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        return Promise.allSettled(
          STATIC_ASSETS.map((url) => cache.add(url))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// === 激活：清理旧缓存 + 立即接管 ===
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// === 请求拦截 ===
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 跳过非 http 协议
  if (!url.protocol.startsWith('http')) return;

  // AI API 请求：直接放行，不拦截
  if (url.pathname.includes('/chat/completions')) {
    return;
  }

  // 天气/地理 API：直接放行
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('nominatim.openstreetmap.org')) {
    return;
  }

  // CDN 资源：stale-while-revalidate
  if (CDN_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 同源资源：缓存优先 + 后台更新（核心策略）
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithUpdate(request));
    return;
  }

  // 其他跨域请求：stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// === 缓存策略 ===

/**
 * 缓存优先 + 后台更新
 * 有缓存立即返回（秒开），无缓存时带超时的网络请求
 * 后台静默更新缓存，下次刷新生效新版本
 */
async function cacheFirstWithUpdate(request) {
  const cached = await caches.match(request);

  if (cached) {
    // 有缓存：立即返回，后台静默更新
    fetchWithTimeout(request, NETWORK_TIMEOUT)
      .then((response) => {
        if (response && response.ok) {
          const cache = caches.open(CACHE_RUNTIME);
          cache.then(c => c.put(request, response.clone()));
        }
      })
      .catch(() => {});
    return cached;
  }

  // 无缓存（首次加载）：网络请求 + 超时保护
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 网络失败且无缓存：导航请求返回预缓存的 index.html
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * 带超时的 fetch
 * 超过 timeout 毫秒后中断请求
 */
function fetchWithTimeout(request, timeout) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeout);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Stale-while-revalidate：先返回缓存，同时更新
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(request);

  const fetchPromise = fetchWithTimeout(request, NETWORK_TIMEOUT)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// === 消息通信 ===
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      Promise.all(keys.map((key) => caches.delete(key)));
    });
  }
});
