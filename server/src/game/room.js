import { GameState } from './state.js';
import { GAME_STATUS, CONFIG, ERROR_CODE } from '../../../shared/protocol.js';

/**
 * 난수는 Web Crypto(전역 crypto)를 쓴다 — Node 18+와 Cloudflare Workers 양쪽에서
 * 동일하게 동작한다. node:crypto의 randomBytes는 Workers에서 기본 비활성이라,
 * 같은 게임 로직을 두 런타임에서 공유하려면 이쪽이어야 한다.
 */
function randHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

/** 방 코드 — 사용자가 눈으로 읽고 공유/입력하는 값이라 짧게 유지 (6자, 24bit) */
export function genRoomCode() {
  return randHex(3).toUpperCase();
}

/**
 * 재접속 토큰 — 이 값만 알면 남의 자리로 RECONNECT해서 상대 패까지 볼 수 있으므로
 * 사실상 세션 비밀번호다.
 * 종전 genCode(len)은 len 인자를 받고도 무시한 채 항상 randomBytes(3)만 뽑아,
 * genCode(16)으로 16자를 의도한 호출이 실제로는 6자(24bit)를 반환했다.
 * 방 코드와 같은 강도라 브루트포스가 현실적으로 가능했으므로 128bit로 분리·교체.
 */
export function genToken() {
  return randHex(16);
}

/** 플레이어 id — 같은 방 안에서만 유일하면 되지만 추측 가능할 이유는 없다 */
export function genPlayerId() {
  return randHex(6);
}


/**
 * Room — 방 하나의 전체 상태
 */
export class Room {
  constructor(hostId, hostName, maxPlayers = CONFIG.DEFAULT_PLAYERS) {
    this.id         = genRoomCode();
    this.hostId     = hostId;
    this.maxPlayers = Math.min(Math.max(maxPlayers, CONFIG.MIN_PLAYERS), CONFIG.MAX_PLAYERS);
    this.players    = [{ id: hostId, name: hostName, token: genToken() }];
    this.game       = null;
    this.status     = GAME_STATUS.LOBBY;
    this.createdAt  = Date.now();
  }

  get isFull()     { return this.players.length >= this.maxPlayers; }
  get playerCount(){ return this.players.length; }

  playerById(id) { return this.players.find(p => p.id === id); }

  join(playerId, playerName) {
    if (this.status !== GAME_STATUS.LOBBY)
      return { ok: false, code: ERROR_CODE.GAME_ALREADY_STARTED };
    if (this.isFull)
      return { ok: false, code: ERROR_CODE.ROOM_FULL };

    const token = genToken();
    this.players.push({ id: playerId, name: playerName, token });
    return { ok: true, token };
  }

  /**
   * AI 봇 플레이어 추가 (solo 모드). 봇은 ws 연결이 없으며 isBot:true 로 식별.
   */
  addBot(name) {
    if (this.status !== GAME_STATUS.LOBBY)
      return { ok: false, code: ERROR_CODE.GAME_ALREADY_STARTED };
    if (this.isFull)
      return { ok: false, code: ERROR_CODE.ROOM_FULL };

    const id = `bot_${this.players.length}_${genRoomCode()}`;
    this.players.push({ id, name, isBot: true, token: genToken() });
    return { ok: true, id };
  }

  startGame(requesterId) {
    if (requesterId !== this.hostId)
      return { ok: false, code: ERROR_CODE.NOT_HOST };
    if (this.players.length < CONFIG.MIN_PLAYERS)
      return { ok: false, code: ERROR_CODE.MIN_PLAYERS,
               message: `최소 ${CONFIG.MIN_PLAYERS}명이 필요합니다` };
    if (this.status !== GAME_STATUS.LOBBY)
      return { ok: false, code: ERROR_CODE.GAME_ALREADY_STARTED };

    this.game   = new GameState(this.players);
    this.game.start();
    this.status = GAME_STATUS.PLAYING;
    return { ok: true };
  }

  verifyToken(playerId, token) {
    const p = this.playerById(playerId);
    return p && p.token === token;
  }

  /**
   * 영속화 대상 화이트리스트.
   * Node 서버 쪽 handler가 room에 붙이는 _turnTimer/_botTimer(Timeout 객체)가
   * 실려 들어가지 않도록 명시적으로 골라 담는다.
   */
  toJSON() {
    return {
      id:         this.id,
      hostId:     this.hostId,
      maxPlayers: this.maxPlayers,
      players:    this.players,
      status:     this.status,
      createdAt:  this.createdAt,
      game:       this.game,
    };
  }

  static fromJSON(obj) {
    const room = Object.assign(Object.create(Room.prototype), obj);
    room.game  = obj.game ? GameState.fromJSON(obj.game) : null;
    return room;
  }

  setConnected(playerId, connected) {
    if (this.game) {
      const gp = this.game.playerById(playerId);
      if (gp) gp.connected = connected;
    }
  }
}

/**
 * RoomManager — 전체 방 목록 관리
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId → Room
  }

  create(hostId, hostName, maxPlayers) {
    const room = new Room(hostId, hostName, maxPlayers);
    // 방 코드가 24bit라 방이 수천 개 쌓이면 생일 역설로 충돌한다.
    // 충돌 시 기존 방을 덮어써 남의 방이 통째로 사라지므로 재발급.
    while (this.rooms.has(room.id)) room.id = genRoomCode();
    this.rooms.set(room.id, room);
    // 빈 방 자동 정리 (1시간 후) — unref: 이 타이머 하나 때문에 프로세스가
    // 살아있을 이유는 없다(서버는 소켓이 잡고 있고, 테스트는 그대로 종료돼야 함)
    setTimeout(() => this.rooms.delete(room.id), 60 * 60 * 1000).unref?.();
    return room;
  }

  get(roomId) { return this.rooms.get(roomId); }

  cleanup() {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (now - room.createdAt > 2 * 60 * 60 * 1000) {
        this.rooms.delete(id);
      }
    }
  }
}
