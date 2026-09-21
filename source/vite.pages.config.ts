import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: 'pages',
  base: './',
  publicDir: '../public',
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  plugins: [react(), {
    name: 'roadbook-offline-cache',
    generateBundle(_options, bundle) {
      const files = ['index.html', 'favicon.svg', 'manifest.webmanifest', 'route-map-clean-v2.png', ...['danxia', 'mogao', 'water-yadan', 'emerald-lake', 'chaka', 'qinghai-lake', 'journal-vignettes'].map(name => `images/${name}.jpg`), ...Object.keys(bundle)];
      const version = Object.keys(bundle).join('-');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'qinggan-pages-v2-' + ${JSON.stringify(version)};
const PREFIX = 'qinggan-pages-';
const urls = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })).then(response => {
      if (!response.ok) throw new Error('Page unavailable');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', self.registration.scope).href))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(hit => hit || fetch(event.request).then(response => { if(response.ok) cache.put(event.request, response.clone()); return response; }).catch(() => event.request.mode === 'navigate' ? cache.match(new URL('index.html', self.registration.scope).href) : Response.error()))));
});
` });
    },
  }],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: '../dist-pages', emptyOutDir: true },
});
