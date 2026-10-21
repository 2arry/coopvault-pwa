import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        id: '/',
        name: 'CoopVault',
        short_name: 'CoopVault',
        description: 'Savings, contributions and loans for your cooperative',
        theme_color: '#1d4ed8',
        background_color: '#f5f7fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Save', short_name: 'Save', url: '/save', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Borrow', short_name: 'Borrow', url: '/loans/new', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Only precache the Latin font subsets (latin-ext carries the ₦ sign); others load on demand
        globIgnores: ['**/*-{vietnamese,cyrillic,cyrillic-ext,greek,greek-ext}-*.woff2', '**/*-full-*.woff2', '**/*-italic*.woff2'],
        navigateFallback: '/index.html',
        // Push notifications (shows them and opens the right screen when tapped)
        importScripts: ['push-sw.js'],
        // Never cache API responses: balances must always be live
        runtimeCaching: [],
      },
    }),
  ],
})
