// 道树 Service Worker - 离线缓存与PWA支持
const CACHE_NAME = "daoshu-v1";
const CORE_ASSETS = [
  "./daoshu.html",
  "./manifest.json",
  "./",
];

// 安装：预缓存核心资源
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS).catch(function() {
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：网络优先，离线回退缓存
self.addEventListener("fetch", function(event) {
  // 跳过非GET请求和Supabase API请求
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);

  // Supabase API 请求不走缓存
  if (url.hostname.indexOf("supabase") !== -1) return;

  // 本地资源：网络优先，回退缓存
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // 缓存成功的响应
        if (response && response.status === 200 && url.origin === location.origin) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // 离线时从缓存返回
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          // 对于导航请求，返回主页面
          if (event.request.mode === "navigate") {
            return caches.match("./daoshu.html");
          }
          return new Response("离线模式", { status: 503, statusText: "Offline" });
        });
      })
  );
});

// 接收消息：手动更新缓存
self.addEventListener("message", function(event) {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
