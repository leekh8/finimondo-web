import { DurableObject } from 'cloudflare:workers';
import { Room, genPlayerId } from '../../server/src/game/room.js';
import { computeBotMove, chooseBotColor, chooseBotSwapTarget } from '../../server/src/game/bot.js';
import {
  ACTION, EVENT, CONFIG, ERROR_CODE, GAME_STATUS, PING_FRAME, PONG_FRAME,
} from '../../shared/protocol.js';

/**
 * GameRoom — 방 하나 = Durable Object 인스턴스 하나.
 *
 * Node 서버(server/src/ws/handler.js)와 게임 규칙은 완전히 같은 모듈을 쓰고,
 * 달라지는 건 "플랫폼 배선" 세 가지뿐이다.
 *
 *  1) 상태   : 프로세스 메모리 Map → ctx.storage (최면 중 메모리는 사라진다)
 *  2) 타이머 : setTimeout        → ctx.storage.setAlarm (최면을 넘어 살아남는다)
 *  3) 연결   : clients Map       → ctx.getWebSockets() + serializeAttachment
 */

const BOT_MIN_DELAY = 800;
const BOT_MAX_DELAY = 1500;
const botDelay = () => BOT_MIN_DELAY + Math.floor(Math.random() * (BOT_MAX_DELAY - BOT_MIN_DELAY));

// 연결 단위 rate limit — Node판과 동일 수치
const MSG_PER_SEC        = 20;
const MSG_BURST          = 40;
const RECONNECT_FAIL_MAX = 5;

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.room = undefined;      // undefined = 아직 storage에서 안 읽음, null = 방 없음
    this.alarmMeta = null;
    this.rl = new Map();        // ws → { tokens, at } (최면 시 사라져도 무해)

    // keepalive를 런타임이 대신 응답한다. DO를 깨우지 않으므로 과금도 되지 않는다.
    // 클라이언트는 반드시 PING_FRAME 문자열 그대로 보내야 매칭된다.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING_FRAME, PONG_FRAME));
  }

  // ── 상태 로드/저장 ───────────────────────────────────────
  async load() {
    if (this.room !== undefined) return this.room;
    const raw      = await this.ctx.storage.get('room');
    this.room      = raw ? Room.fromJSON(raw) : null;
    this.alarmMeta = raw?._alarm ?? null;
    return this.room;
  }

  /** 방 상태와 alarm 메타를 한 키에 함께 저장 — 액션당 storage write 1회로 억제 */
  async save() {
    if (!this.room) return;
    await this.ctx.storage.put('room', { ...this.room.toJSON(), _alarm: this.alarmMeta });
  }

  // ── WebSocket 수락 ───────────────────────────────────────
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });

    // 방 코드는 Worker가 라우팅하며 쿼리로 실어 보낸다(= 이 DO의 이름).
    // 별도 RPC 호출을 만들지 않으려는 것 — RPC는 요청 1건을 더 쓴다.
    const code = new URL(request.url).searchParams.get('room') ?? '';

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);   // 최면 지원 방식으로 수락
    server.serializeAttachment({ playerId: null, fails: 0, code });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (!this.allow(ws))
      return this.send(ws, EVENT.ERROR, { code: ERROR_CODE.RATE_LIMITED, message: '요청이 너무 많습니다' });

    let msg;
    try { msg = JSON.parse(raw); }
    catch { return this.send(ws, EVENT.ERROR, { message: '잘못된 JSON' }); }

    const { action, payload = {} } = msg;
    await this.load();

    switch (action) {
      case ACTION.CREATE_ROOM:  return this.onCreate(ws, payload);
      case ACTION.JOIN_ROOM:    return this.onJoin(ws, payload);
      case ACTION.START_GAME:   return this.onStart(ws);
      case ACTION.RECONNECT:    return this.onReconnect(ws, payload);
      case ACTION.CHAT:         return this.onChat(ws, payload);
      case ACTION.PLAY_CARD:    return this.onMove(ws, g => g.playCard(this.pid(ws), payload.cardId, payload.chosenColor));
      case ACTION.DRAW_CARD:    return this.onMove(ws, g => g.drawCard(this.pid(ws)));
      case ACTION.CHOOSE_COLOR: return this.onMove(ws, g => g.chooseColor(this.pid(ws), payload.color));
      case ACTION.CHOOSE_SWAP:  return this.onMove(ws, g => g.chooseSwap(this.pid(ws), payload.targetId));
      case ACTION.PING:         return this.sendRaw(ws, PONG_FRAME);  // 자동응답이 빗나간 경우 대비
      default: return this.send(ws, EVENT.ERROR, { message: `알 수 없는 액션: ${action}` });
    }
  }

  async webSocketClose(ws) {
    this.rl.delete(ws);
    const playerId = this.pid(ws);
    if (!playerId) return;
    await this.load();
    if (!this.room) return;

    this.room.setConnected(playerId, false);
    const player = this.room.playerById(playerId);
    if (player) this.system(`${player.name}님의 연결이 끊겼습니다.`);
    await this.save();
  }

  // ── 액션 핸들러 ──────────────────────────────────────────
  async onCreate(ws, payload) {
    if (this.room)
      return this.send(ws, EVENT.ERROR, { code: ERROR_CODE.GAME_ALREADY_STARTED, message: '이미 사용 중인 방 코드입니다' });

    const playerName = cleanName(payload.playerName);
    if (!playerName)
      return this.send(ws, EVENT.ERROR, { code: ERROR_CODE.INVALID_NAME, message: '이름을 입력해주세요' });

    const solo     = !!payload.solo;
    const botCount = solo ? Math.min(Math.max(Number(payload.botCount) || 1, 1), CONFIG.MAX_PLAYERS - 1) : 0;
    const maxP     = solo ? botCount + 1 : (payload.maxPlayers ?? CONFIG.DEFAULT_PLAYERS);

    const playerId = genPlayerId();
    // 방 코드는 Worker가 발급해 DO 이름으로 쓴다 → DO는 자기 이름을 그대로 방 id로 갖는다
    this.room    = new Room(playerId, playerName, maxP);
    this.room.id = ws.deserializeAttachment()?.code || this.room.id;
    this.bind(ws, playerId);

    if (solo) for (let i = 1; i <= botCount; i++) this.room.addBot(`AI ${i}`);

    const player = this.room.playerById(playerId);
    this.send(ws, EVENT.ROOM_CREATED, {
      roomId: this.room.id, playerId, token: player.token, isHost: true,
      players: this.lobby(), maxPlayers: this.room.maxPlayers, solo,
    });

    if (solo) {
      const started = this.room.startGame(playerId);
      if (!started.ok) return this.send(ws, EVENT.ERROR, { code: started.code, message: started.message });
      this.broadcastStart();
      await this.schedule();
    }
    await this.save();
  }

  async onJoin(ws, payload) {
    const playerName = cleanName(payload.playerName);
    if (!playerName)
      return this.send(ws, EVENT.ERROR, { code: ERROR_CODE.INVALID_NAME, message: '이름을 입력해주세요' });
    if (!this.room)
      return this.send(ws, EVENT.ERROR, { code: ERROR_CODE.ROOM_NOT_FOUND, message: '방을 찾을 수 없습니다' });

    const playerId = genPlayerId();
    const result   = this.room.join(playerId, playerName);
    if (!result.ok) return this.send(ws, EVENT.ERROR, { code: result.code });

    this.bind(ws, playerId);
    this.send(ws, EVENT.ROOM_JOINED, {
      roomId: this.room.id, playerId, token: result.token, isHost: false,
      players: this.lobby(), maxPlayers: this.room.maxPlayers,
    });
    this.broadcast(EVENT.ROOM_UPDATED, { players: this.lobby() }, ws);
    this.system(`${playerName}님이 입장했습니다.`);
    await this.save();
  }

  async onStart(ws) {
    if (!this.room) return;
    const result = this.room.startGame(this.pid(ws));
    if (!result.ok) return this.send(ws, EVENT.ERROR, { code: result.code, message: result.message });
    this.broadcastStart();
    await this.schedule();
    await this.save();
  }

  async onReconnect(ws, payload) {
    const { playerId, token } = payload;
    if (!this.room || !this.room.verifyToken(playerId, token)) {
      // 토큰 추측 차단 — 같은 연결에서 반복 실패하면 끊는다
      const att = ws.deserializeAttachment() ?? {};
      const fails = (att.fails ?? 0) + 1;
      ws.serializeAttachment({ ...att, fails });
      this.send(ws, EVENT.ERROR, { code: ERROR_CODE.RECONNECT_FAILED, message: '재접속 실패' });
      if (fails >= RECONNECT_FAIL_MAX) ws.close(4003, 'too many reconnect attempts');
      return;
    }

    this.bind(ws, playerId);
    this.room.setConnected(playerId, true);
    if (this.room.game) {
      this.send(ws, EVENT.RECONNECTED, { state: this.room.game.snapshot(playerId) });
    } else {
      this.send(ws, EVENT.ROOM_JOINED, {
        roomId: this.room.id, playerId, isHost: this.room.hostId === playerId,
        players: this.lobby(), maxPlayers: this.room.maxPlayers,
      });
    }
    await this.save();
  }

  onChat(ws, payload) {
    if (!this.room) return;
    const text = String(payload.message ?? '').trim().slice(0, CONFIG.CHAT_MAX_LEN);
    if (!text) return;
    const playerId = this.pid(ws);
    const player   = this.room.playerById(playerId);
    this.broadcast(EVENT.CHAT_MESSAGE, {
      playerId, name: player?.name ?? '???', message: text, ts: Date.now(), system: false,
    });
  }

  /** 카드 내기/뽑기/색·교환 선택 — 규칙 판정은 전부 GameState가 한다 */
  async onMove(ws, apply) {
    if (!this.room?.game) return;
    const result = apply(this.room.game);
    if (!result?.ok) return this.send(ws, EVENT.ERROR, result?.error ?? { message: '처리 실패' });
    await this.after(result.events, this.pid(ws));
  }

  // ── 액션 후 공통 처리 ────────────────────────────────────
  async after(events = [], actorId) {
    const game = this.room?.game;
    if (!game) return;

    const eliminated = events.find(e => e.type === 'eliminated');
    if (eliminated) {
      const ep = game.playerById(eliminated.playerId);
      this.broadcast(EVENT.PLAYER_ELIMINATED, { playerId: eliminated.playerId, name: ep?.name ?? '' });
      this.system(`💀 ${ep?.name}님이 탈락했습니다!`);
    }

    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.pid(ws);
      if (!pid) continue;
      this.send(ws, EVENT.STATE_SNAPSHOT, {
        state: game.snapshot(pid),
        lastAction: { actorId, topCard: game.topCard, events },
      });
    }

    if (events.some(e => e.type === 'gameOver')) {
      const winner = game.playerById(game.winnerId);
      this.broadcast(EVENT.GAME_OVER, { winnerId: game.winnerId, winnerName: winner?.name });
      this.system(`🏆 ${winner?.name}님이 승리했습니다!`);
      this.room.status = GAME_STATUS.ENDED;
      this.alarmMeta = null;
      await this.ctx.storage.deleteAlarm();
    } else {
      await this.schedule();
    }
    await this.save();
  }

  // ── 타이머 = alarm ───────────────────────────────────────
  /**
   * 다음에 행동할 주체가 봇이면 "봇이 두는 시각", 사람이면 "턴 마감 시각"에 alarm을 건다.
   * 둘은 동시에 존재할 수 없으므로(행동 주체는 한 명) alarm 하나로 충분하다.
   */
  async schedule() {
    const game = this.room?.game;
    if (!game || game.status !== GAME_STATUS.PLAYING) {
      this.alarmMeta = null;
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const actorId = pendingActorId(game);
    const actor   = actorId ? game.playerById(actorId) : null;
    if (!actor || actor.eliminated) { this.alarmMeta = null; return; }

    const isBot = !!actor.isBot;
    this.alarmMeta = { kind: isBot ? 'bot' : 'turn', actorId };
    await this.ctx.storage.setAlarm(Date.now() + (isBot ? botDelay() : CONFIG.TURN_TIME_LIMIT * 1000));
  }

  async alarm() {
    await this.load();
    const game = this.room?.game;
    const meta = this.alarmMeta;
    if (!game || game.status !== GAME_STATUS.PLAYING || !meta) return;

    // 알람이 걸린 뒤 상황이 바뀌었으면(이미 다른 사람 차례) 다시 예약만 하고 끝낸다.
    // 재예약은 alarmMeta를 바꾸므로 반드시 save까지 해야 최면 뒤에도 살아남는다.
    if (pendingActorId(game) !== meta.actorId) return await this.reschedule();

    if (meta.kind === 'turn') {
      const result = game.autoPass(meta.actorId);
      if (result) await this.after(result.events ?? [], meta.actorId);
      else await this.reschedule();
      return;
    }
    await this.botMove(meta.actorId);
  }

  /** 진행 없이 알람만 다시 잡을 때 — 예약 상태를 반드시 함께 저장한다 */
  async reschedule() {
    await this.schedule();
    await this.save();
  }

  async botMove(actorId) {
    const game  = this.room.game;
    const actor = game.playerById(actorId);
    // 봇이 아니거나 이미 탈락했다면 진행하지 않되, 알람이 비어 게임이 멈추지 않도록 재예약
    if (!actor?.isBot || actor.eliminated) return await this.reschedule();

    let result;
    if (game.waitingFor === 'swap') {
      result = game.chooseSwap(actorId, chooseBotSwapTarget(game, actorId));
    } else if (game.waitingFor === 'color' || game.waitingFor === 'roulette_color') {
      result = game.chooseColor(actorId, chooseBotColor(actor.hand));
    } else {
      const move = computeBotMove(game, actorId);
      result = move.kind === 'play'
        ? game.playCard(actorId, move.cardId, move.chosenColor ?? null)
        : game.drawCard(actorId);
    }

    // 안전장치: 봇 수가 막히면 강제 드로우로 교착을 푼다 (Node판과 동일)
    if (!result?.ok) {
      if (game.waitingFor) return;
      result = game.drawCard(actorId);
      if (!result?.ok) return;
    }
    await this.after(result.events ?? [], actorId);
  }

  // ── 배선 헬퍼 ────────────────────────────────────────────
  bind(ws, playerId) {
    const att = ws.deserializeAttachment() ?? {};
    ws.serializeAttachment({ ...att, playerId, fails: 0 });
  }

  pid(ws) { return ws.deserializeAttachment()?.playerId ?? null; }

  lobby() { return this.room.players.map(p => ({ id: p.id, name: p.name })); }

  broadcastStart() {
    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.pid(ws);
      if (pid) this.send(ws, EVENT.GAME_STARTED, { state: this.room.game.snapshot(pid) });
    }
  }

  broadcast(event, data, except = null) {
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) this.send(ws, event, data);
  }

  system(message) {
    this.broadcast(EVENT.CHAT_MESSAGE, {
      playerId: 'system', name: '시스템', message, ts: Date.now(), system: true,
    });
  }

  send(ws, event, data) { this.sendRaw(ws, JSON.stringify({ event, data })); }

  sendRaw(ws, raw) {
    try { ws.send(raw); } catch { /* 이미 닫힌 소켓 */ }
  }

  allow(ws) {
    const now = Date.now();
    const st  = this.rl.get(ws) ?? { tokens: MSG_BURST, at: now };
    st.tokens = Math.min(MSG_BURST, st.tokens + ((now - st.at) / 1000) * MSG_PER_SEC);
    st.at     = now;
    if (st.tokens < 1) { this.rl.set(ws, st); return false; }
    st.tokens -= 1;
    this.rl.set(ws, st);
    return true;
  }
}

/** 다음에 행동해야 할(봇일 수도 있는) 플레이어 id — 룰렛은 공격받는 쪽이 색을 정한다 */
function pendingActorId(game) {
  if (!game) return null;
  if (game.waitingFor === 'roulette_color') return game.rouletteTargetId;
  return game.currentPlayer?.id ?? null;
}

function cleanName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.NAME_MAX_LEN);
}
