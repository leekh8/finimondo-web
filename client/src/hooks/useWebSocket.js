import { useEffect, useRef, useCallback } from 'react';
import { ACTION, EVENT } from '../../../shared/protocol.js';
import { useGameStore } from '../store/gameStore.js';

/**
 * 개발: Vite가 5173에서 /ws 경로를 3001로 프록시
 * 프로덕션: 같은 호스트 루트로 연결 (서버가 클라이언트도 서빙)
 */
function getWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (import.meta.env.DEV) return 'ws://localhost:3001';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

const WS_URL = getWsUrl();

let wsInstance  = null;
let listeners   = new Set();
let reconnectTimer = null;

function connect(storeRef) {
  if (wsInstance && wsInstance.readyState <= 1) return; // 이미 연결 중
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  console.log('[WS] 연결 시도:', WS_URL);
  const ws = new WebSocket(WS_URL);
  wsInstance = ws;

  ws.onopen = () => {
    console.log('[WS] 연결 성공');
    // 게임 중 새로고침/재접속 처리
    const { myId, myToken, roomId } = storeRef.current;
    if (myId && myToken && roomId) {
      ws.send(JSON.stringify({ action: ACTION.RECONNECT, payload: { roomId, playerId: myId, token: myToken } }));
    }
  };

  ws.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data);
      dispatch(event, data, storeRef.current);
      listeners.forEach(fn => fn(event, data));
    } catch (err) { console.error('[WS] 파싱 오류', err); }
  };

  ws.onclose = (ev) => {
    console.warn('[WS] 연결 끊김 (code:', ev.code, ')— 3초 후 재시도');
    wsInstance = null;
    reconnectTimer = setTimeout(() => connect(storeRef), 3000);
  };

  ws.onerror = () => {
    // onclose가 이어서 호출됨 → 거기서 재연결
    wsInstance = null;
  };
}

export function useWebSocket() {
  const store    = useGameStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    connect(storeRef);

    // Ping — 연결 유지
    const ping = setInterval(() => {
      if (wsInstance?.readyState === 1) {
        wsInstance.send(JSON.stringify({ action: ACTION.PING }));
      }
    }, 25_000);

    return () => clearInterval(ping);
  }, []);

  const on = useCallback((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const emit = useCallback((action, payload = {}) => {
    if (wsInstance?.readyState === 1) {
      wsInstance.send(JSON.stringify({ action, payload }));
    } else {
      console.warn('[WS] 미연결 — 액션 무시:', action);
      useGameStore.getState().notify('서버에 연결 중입니다. 잠시 후 다시 시도해주세요.', 'warn');
    }
  }, []);

  return { emit, on };
}

// ── 서버 이벤트 → 스토어 업데이트 ──────────────────────
function dispatch(event, data, store) {
  switch (event) {
    case EVENT.ROOM_CREATED:
      store.setMyInfo(data.playerId, store.myName, data.token, true);
      store.setRoom(data.roomId, data.maxPlayers, data.players);
      store.setScene('lobby');
      break;

    case EVENT.ROOM_JOINED:
      store.setMyInfo(data.playerId, store.myName, data.token, data.isHost);
      store.setRoom(data.roomId, data.maxPlayers, data.players);
      store.setScene('lobby');
      break;

    case EVENT.ROOM_UPDATED:
      store.updateLobbyPlayers(data.players);
      break;

    case EVENT.GAME_STARTED:
      store.applySnapshot(data.state, null);
      store.setScene('game');
      break;

    case EVENT.STATE_SNAPSHOT:
      store.applySnapshot(data.state, data.lastAction ?? null);
      if (store.scene !== 'game') store.setScene('game');
      break;

    case EVENT.RECONNECTED:
      store.applySnapshot(data.state, null);
      store.setScene(data.state.status === 'playing' ? 'game' : 'lobby');
      break;

    case EVENT.GAME_OVER:
      store.applySnapshot({ ...store.game, winnerId: data.winnerId }, null);
      store.setScene('result');
      break;

    case EVENT.CHAT_MESSAGE:
      store.addChatMessage(data);
      break;

    case EVENT.PLAYER_ELIMINATED:
      store.notify(`💀 ${data.name} 탈락!`, 'warn');
      break;

    case EVENT.ERROR:
      store.notify(data.message || data.code, 'error');
      break;

    case EVENT.PONG:
      break;

    default:
      break;
  }
}
