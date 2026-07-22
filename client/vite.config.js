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
    // 개발 중에도 클라이언트가 "같은 오리진"만 호출하게 만든다.
    // (절대 URL로 8787을 직접 부르면 CORS 프리플라이트를 따로 처리해야 함)
    proxy: {
      '/ws':  { target: 'ws://localhost:8787',   ws: true, changeOrigin: true },
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
