import { useEffect, useCallback, useRef } from 'react';
import { ACTION, EVENT, PING_FRAME } from '../../../shared/protocol.js';
import { useGameStore } from '../store/gameStore.js';

/**
 * 연결 모델
 * ----------
 * 방 하나 = Durable Object 하나이므로, 접속 시점에 이미 방 코드를 알아야 한다.
 * (예전 Node 단일 서버는 아무 데나 붙은 뒤 CREATE/JOIN을 보내면 됐다)
 *
 *   방 만들기 / 혼자 하기 : POST /api/room 으로 코드를 발급받고 → 그 방에 연결
 *   방 참가              : 사용자가 입력한 코드로 바로 연결
 *
 * 그래서 연결은 마운트 시점이 아니라 "홈 화면에서 버튼을 누른 시점"에 시작한다.
 */

let wsInstance     = null;
let currentRoom    = null;
let listeners      = new Set();
let reconnectTimer = null;
let retryCount     = 0;
let storeRef       = { current: null };

// 기본은 항상 같은 오리진(''), 개발에서는 Vite 프록시가 /api·/ws를
// wrangler dev(8787)로 넘긴다 → CORS를 다룰 일이 없다.
// 클라이언트만 따로 호스팅하는 경우에만 VITE_API_URL로 덮어쓴다.
function apiBase() {
  return import.meta.env.VITE_API_URL ?? '';
}

function wsUrl(room) {
  const base = apiBase();
  if (base) return `${base.replace(/^http/, 'ws')}/ws?room=${room}`;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws?room=${room}`;
}

/** 새 방 코드 발급 — DO는 첫 연결 때 만들어지므로 여기선 코드만 받는다 */
export async function requestRoomCode() {
  const res = await fetch(`${apiBase()}/api/room`, { method: 'POST' });
  if (!res.ok) throw new Error(`방 코드 발급 실패 (${res.status})`);
  const { roomId } = await res.json();
  return roomId;
}

function openSocket(room) {
  return new Promise((resolve, reject) => {
    if (wsInstance && wsInstance.readyState === 1 && currentRoom === room) return resolve(wsInstance);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    // 이전 소켓을 닫기 전에 핸들러를 떼어낸다.
    // 떼지 않으면 뒤늦게 도착한 onclose가 방금 만든 새 소켓 참조를 지우고
    // 재연결 타이머까지 걸어버린다(방을 옮길 때 연결이 죽는 원인).
    if (wsInstance) {
      const old = wsInstance;
      old.onopen = old.onmessage = old.onclose = old.onerror = null;
      try { old.close(); } catch { /* 무시 */ }
    }

    const ws = new WebSocket(wsUrl(room));
    wsInstance  = ws;
    currentRoom = room;

    ws.onopen = () => {
      retryCount = 0;
      // 끊겼다 붙은 경우에만 자리 복구 (최초 연결은 CREATE/JOIN이 뒤따른다)
      const { myId, myToken, roomId } = storeRef.current ?? {};
      if (myId && myToken && roomId === room) {
        ws.send(JSON.stringify({ action: ACTION.RECONNECT, payload: { roomId, playerId: myId, token: myToken } }));
      }
      resolve(ws);
    };

    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        dispatch(event, data, storeRef.current);
        listeners.forEach(fn => fn(event, data));
      } catch (err) { console.error('[WS] 파싱 오류', err); }
    };

    ws.onclose = () => {
      if (wsInstance !== ws) return;      // 이미 다른 소켓으로 교체된 뒤라면 무시
      wsInstance = null;
      if (!currentRoom) return;
      // 지수 백오프 — 서버가 죽어 있을 때 3초마다 무한 재시도하면 브라우저·서버 양쪽에 부담
      const delay = Math.min(1000 * 2 ** retryCount++, 15_000);
      reconnectTimer = setTimeout(() => openSocket(currentRoom).catch(() => {}), delay);
    };

    ws.onerror = () => reject(new Error('서버에 연결하지 못했습니다'));
  });
}

export function useWebSocket() {
  const store = useGameStore();
  const ref   = useRef(store);
  ref.current = store;
  storeRef    = ref;

  useEffect(() => {
    // keepalive. 이 문자열은 서버(DO)의 자동응답과 바이트 단위로 일치해야
    // Durable Object를 깨우지 않고(=과금 없이) 응답된다.
    const ping = setInterval(() => {
      if (wsInstance?.readyState === 1) wsInstance.send(PING_FRAME);
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

  /** 홈 화면 전용 — 방에 연결한 뒤 첫 액션까지 보낸다 */
  const connectAndEmit = useCallback(async (room, action, payload = {}) => {
    try {
      const ws = await openSocket(room);
      ws.send(JSON.stringify({ action, payload }));
    } catch (e) {
      currentRoom = null;   // 실패한 방으로 재시도 루프에 빠지지 않게
      useGameStore.getState().notify(e.message || '연결 실패', 'error');
    }
  }, []);

  return { emit, on, connectAndEmit };
}

// ── 서버 이벤트 → 스토어 업데이트 ──────────────────────
function dispatch(event, data, store) {
  if (!store) return;
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
