import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Finimondo',
        short_name: 'Finimondo',
        description: '종말의 카드게임 — 링크 하나로 친구와 온라인 플레이',
        theme_color: '#0B0A0F',
        background_color: '#0B0A0F',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // WebSocket: /ws 경로로 프록시 (개발 시)
      '/ws': { target: 'ws://localhost:3001', ws: true, changeOrigin: true },
    },
  },
});
