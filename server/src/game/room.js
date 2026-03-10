import { GameState } from './state.js';
import { GAME_STATUS, CONFIG, ERROR_CODE } from '../../../shared/protocol.js';
import { randomBytes } from 'crypto';

function genCode(len = 6) {
  return randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Room — 방 하나의 전체 상태
 */
export class Room {
  constructor(hostId, hostName, maxPlayers = CONFIG.DEFAULT_PLAYERS) {
    this.id         = genCode();
    this.hostId     = hostId;
    this.maxPlayers = Math.min(Math.max(maxPlayers, CONFIG.MIN_PLAYERS), CONFIG.MAX_PLAYERS);
    this.players    = [{ id: hostId, name: hostName, token: genCode(16) }];
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

    const token = genCode(16);
    this.players.push({ id: playerId, name: playerName, token });
    return { ok: true, token };
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
    this.rooms.set(room.id, room);
    // 빈 방 자동 정리 (1시간 후)
    setTimeout(() => this.rooms.delete(room.id), 60 * 60 * 1000);
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
