/**
 * 诗思工作台 - Service Worker
 * 离线缓存策略：同源资源 network-first，确保刷新即见最新版本
 */

const CACHE_VERSION = 'shisi-v1.6.1';
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

// === 安装：预缓存静态资源 ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        // 逐个缓存，避免单个失败导致全部失败
        return Promise.allSettled(
          STATIC_ASSETS.map((url) => cache.add(url))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// === 激活：清理旧缓存 ===
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

  // 跳过 chrome-extension 和其他特殊协议
  if (!url.protocol.startsWith('http')) return;

  // AI API 请求：network-only，不缓存
  if (url.pathname.includes('/chat/completions')) {
    return;
  }

  // 天气/地理 API：network-only，不缓存
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('nominatim.openstreetmap.org')) {
    return;
  }

  // CDN 资源：stale-while-revalidate
  if (CDN_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 同源资源：network-first（确保刷新即见最新版本）
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他请求：network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// === 缓存策略 ===

// Cache-first：先查缓存，没有再请求网络
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 离线且无缓存：返回首页作为 fallback
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    throw err;
  }
}

// Stale-while-revalidate：先返回缓存，同时更新
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Network-first：先请求网络，失败再用缓存
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    throw err;
  }
}

// === 消息通信：手动更新缓存 ===
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
