import { describe, it, expect } from 'vitest';
import { handleMessage } from './handler.js';
import { RoomManager } from '../game/room.js';
import { ACTION, EVENT, ERROR_CODE, CONFIG } from '../../../shared/protocol.js';

/** ws 스텁 — 실제 소켓 없이 handler만 검증 */
function mkWs() {
  return {
    readyState: 1,
    sent: [],
    closed: null,
    send(raw) { this.sent.push(JSON.parse(raw)); },
    close(code, reason) { this.closed = { code, reason }; this.readyState = 3; },
    lastEvent() { return this.sent[this.sent.length - 1]; },
    eventsOf(name) { return this.sent.filter(m => m.event === name); },
  };
}

function send(ws, rooms, clients, action, payload = {}) {
  handleMessage(ws, JSON.stringify({ action, payload }), rooms, clients);
}

describe('rate limit', () => {
  it('버스트를 넘는 요청은 RATE_LIMITED로 거절된다', () => {
    const rooms = new RoomManager(), clients = new Map(), ws = mkWs();
    for (let i = 0; i < 200; i++) send(ws, rooms, clients, ACTION.PING);

    const limited = ws.sent.filter(m => m.data?.code === ERROR_CODE.RATE_LIMITED);
    expect(limited.length).toBeGreaterThan(0);
    // 초반 정상 요청은 통과해야 한다(과잉 차단 방지)
    expect(ws.eventsOf(EVENT.PONG).length).toBeGreaterThanOrEqual(40);
  });
});

describe('재접속 토큰 추측 차단', () => {
  it('틀린 토큰을 반복하면 연결을 끊는다', () => {
    const rooms = new RoomManager(), clients = new Map();
    const host = mkWs();
    send(host, rooms, clients, ACTION.CREATE_ROOM, { playerName: '규주' });
    const created = host.eventsOf(EVENT.ROOM_CREATED)[0].data;

    const attacker = mkWs();
    for (let i = 0; i < 5; i++) {
      send(attacker, rooms, clients, ACTION.RECONNECT, {
        roomId: created.roomId, playerId: created.playerId, token: 'deadbeef',
      });
    }

    expect(attacker.eventsOf(EVENT.ERROR).length).toBe(5);
    expect(attacker.closed).not.toBeNull();
    expect(clients.has(attacker)).toBe(false); // 남의 자리를 차지하지 못함
  });

  it('올바른 토큰이면 정상 재접속된다', () => {
    const rooms = new RoomManager(), clients = new Map();
    const host = mkWs();
    send(host, rooms, clients, ACTION.CREATE_ROOM, { playerName: '규주' });
    const created = host.eventsOf(EVENT.ROOM_CREATED)[0].data;

    const again = mkWs();
    send(again, rooms, clients, ACTION.RECONNECT, {
      roomId: created.roomId, playerId: created.playerId, token: created.token,
    });

    expect(again.closed).toBeNull();
    expect(clients.get(again)).toEqual({ playerId: created.playerId, roomId: created.roomId });
  });
});

describe('플레이어 이름 검증', () => {
  it('긴 이름은 잘라서 수용한다', () => {
    const rooms = new RoomManager(), clients = new Map(), ws = mkWs();
    send(ws, rooms, clients, ACTION.CREATE_ROOM, { playerName: '가'.repeat(300) });

    const created = ws.eventsOf(EVENT.ROOM_CREATED)[0].data;
    expect(created.players[0].name.length).toBe(CONFIG.NAME_MAX_LEN);
  });

  it('공백뿐인 이름은 거절한다', () => {
    const rooms = new RoomManager(), clients = new Map(), ws = mkWs();
    send(ws, rooms, clients, ACTION.CREATE_ROOM, { playerName: '   ' });

    expect(ws.lastEvent().data.code).toBe(ERROR_CODE.INVALID_NAME);
    expect(ws.eventsOf(EVENT.ROOM_CREATED).length).toBe(0);
  });
});
