import { GameRoom } from './game-room.js';
import { genRoomCode } from '../../server/src/game/room.js';

export { GameRoom };

/**
 * Worker 진입점 — 하는 일은 세 가지뿐이다.
 *
 *   POST /api/room  방 코드 발급 (DO는 아직 만들지 않는다 → 빈 방이 쌓이지 않음)
 *   GET  /ws?room=  해당 방의 Durable Object로 WebSocket 업그레이드 전달
 *   그 외           빌드된 클라이언트 정적 자산 (요청 수 무제한·무과금)
 *
 * 게임 규칙·상태는 전부 DO 안에 있고, 여기서는 라우팅만 한다.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/room' && request.method === 'POST') {
      return Response.json({ roomId: genRoomCode() });
    }

    if (url.pathname === '/ws') {
      const code = (url.searchParams.get('room') ?? '').toUpperCase();
      // 방 코드를 그대로 DO 이름으로 쓰므로 형식을 여기서 못 박는다.
      // (임의 문자열을 허용하면 아무 이름으로나 DO가 무한 생성된다)
      if (!/^[0-9A-F]{6}$/.test(code)) {
        return new Response('invalid room code', { status: 400 });
      }
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
