import { describe, it, expect } from 'vitest';
import { Room, RoomManager, genRoomCode, genToken } from './room.js';

describe('토큰 / 방 코드 생성', () => {
  it('재접속 토큰은 128bit(hex 32자)다', () => {
    // 회귀 방지: 종전 genCode(len)은 len을 무시하고 6자(24bit)만 반환해
    // 브루트포스가 가능했다. 방 코드와 같은 강도로 돌아가면 이 테스트가 깨진다.
    expect(genToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('방 코드는 공유용으로 짧게 6자를 유지한다', () => {
    expect(genRoomCode()).toMatch(/^[0-9A-F]{6}$/);
  });

  it('토큰은 매번 달라야 한다', () => {
    const set = new Set(Array.from({ length: 500 }, () => genToken()));
    expect(set.size).toBe(500);
  });

  it('호스트·참가자·봇 모두 강한 토큰을 받는다', () => {
    const room = new Room('host1', '규주', 4);
    const joined = room.join('p2', '손님');
    const bot = room.addBot('AI 1');

    expect(room.playerById('host1').token).toMatch(/^[0-9a-f]{32}$/);
    expect(joined.token).toMatch(/^[0-9a-f]{32}$/);
    expect(room.playerById(bot.id).token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('verifyToken은 틀린 토큰을 거부한다', () => {
    const room = new Room('host1', '규주', 4);
    const real = room.playerById('host1').token;
    expect(room.verifyToken('host1', real)).toBe(true);
    expect(room.verifyToken('host1', genToken())).toBe(false);
    expect(room.verifyToken('host1', '')).toBe(false);
  });
});

describe('RoomManager', () => {
  it('방 코드가 겹쳐 기존 방을 덮어쓰지 않는다', () => {
    const mgr = new RoomManager();
    const rooms = Array.from({ length: 300 }, (_, i) => mgr.create(`h${i}`, `p${i}`, 4));
    expect(mgr.rooms.size).toBe(300);
    // 생성 직후 받은 방이 그대로 조회돼야 한다(덮어쓰기 = 남의 방 소멸)
    for (const r of rooms) expect(mgr.get(r.id)).toBe(r);
  });
});
