import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '카드 데스매치',
        short_name: '데스매치',
        description: '친구들과 즐기는 온라인 카드 데스매치',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
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
