import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager } from './game/room.js';
import { handleMessage, handleClose } from './ws/handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });

const rooms   = new RoomManager();
const clients = new Map(); // ws → { playerId, roomId }

// ── 정적 파일 서빙 (빌드된 클라이언트) ─────────────────
app.use(express.static(join(__dirname, '../../client/dist')));
app.get('*', (_, res) =>
  res.sendFile(join(__dirname, '../../client/dist/index.html'))
);

// ── WebSocket ───────────────────────────────────────────
wss.on('connection', (ws) => {
  // Ping-Pong (연결 유지 + 연결 체크)
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try { handleMessage(ws, data, rooms, clients); }
    catch (e) { console.error('WS 처리 오류:', e); }
  });

  ws.on('close', () => handleClose(ws, rooms, clients));
  ws.on('error', (e) => console.error('WS 에러:', e));
});

// Heartbeat: 30초마다 끊긴 클라이언트 정리
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));

// ── 시작 ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 UNO 데스매치 서버 실행 중 → http://localhost:${PORT}`);
});
