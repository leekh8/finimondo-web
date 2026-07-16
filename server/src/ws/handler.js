import { ACTION, EVENT, CONFIG, ERROR_CODE } from '../../../shared/protocol.js';
import { computeBotMove, chooseBotColor, chooseBotSwapTarget } from '../game/bot.js';

// 봇이 수를 두기 전 딜레이(ms) — "AI가 두는 게 보이게" + 봇 연쇄 턴 텀
const BOT_MIN_DELAY = 800;
const BOT_MAX_DELAY = 1500;
function botDelay() {
  return BOT_MIN_DELAY + Math.floor(Math.random() * (BOT_MAX_DELAY - BOT_MIN_DELAY));
}

export function handleMessage(ws, rawData, rooms, clients) {
  let msg;
  try { msg = JSON.parse(rawData); }
  catch { return send(ws, EVENT.ERROR, { message: '잘못된 JSON' }); }
  const { action, payload = {} } = msg;
  switch (action) {
    case ACTION.CREATE_ROOM:  return onCreateRoom(ws, payload, rooms, clients);
    case ACTION.JOIN_ROOM:    return onJoinRoom(ws, payload, rooms, clients);
    case ACTION.START_GAME:   return onStartGame(ws, payload, rooms, clients);
    case ACTION.PLAY_CARD:    return onPlayCard(ws, payload, rooms, clients);
    case ACTION.DRAW_CARD:    return onDrawCard(ws, payload, rooms, clients);
    case ACTION.CHOOSE_COLOR: return onChooseColor(ws, payload, rooms, clients);
    case ACTION.CHOOSE_SWAP:  return onChooseSwap(ws, payload, rooms, clients);
    case ACTION.RECONNECT:    return onReconnect(ws, payload, rooms, clients);
    case ACTION.CHAT:         return onChat(ws, payload, rooms, clients);
    case ACTION.PING:         return send(ws, EVENT.PONG, {});
    default: send(ws, EVENT.ERROR, { message: `알 수 없는 액션: ${action}` });
  }
}

function onCreateRoom(ws, payload, rooms, clients) {
  const { playerName, maxPlayers = CONFIG.DEFAULT_PLAYERS, solo = false, botCount = 0 } = payload;
  if (!playerName) return send(ws, EVENT.ERROR, { message: 'playerName 필요' });

  // ── 혼자 하기(AI 봇) ─────────────────────────────────────
  if (solo) return onCreateSolo(ws, playerName, botCount, rooms, clients);

  const playerId = genId();
  const room     = rooms.create(playerId, playerName, maxPlayers);
  const player   = room.playerById(playerId);
  clients.set(ws, { playerId, roomId: room.id });
  send(ws, EVENT.ROOM_CREATED, { roomId: room.id, playerId, token: player.token, isHost: true, players: room.players.map(lobbyPlayer), maxPlayers: room.maxPlayers });
}

/**
 * 혼자 하기: 방 생성 → 봇 N명 채움 → 로비 대기 없이 즉시 시작 → GameScreen 진입.
 */
function onCreateSolo(ws, playerName, botCount, rooms, clients) {
  const n     = Math.min(Math.max(Number(botCount) || 1, 1), CONFIG.MAX_PLAYERS - 1);
  const total = n + 1; // 사람 1 + 봇 n
  const playerId = genId();
  const room     = rooms.create(playerId, playerName, total);
  for (let i = 1; i <= n; i++) room.addBot(`AI ${i}`);

  const player = room.playerById(playerId);
  clients.set(ws, { playerId, roomId: room.id });
  send(ws, EVENT.ROOM_CREATED, { roomId: room.id, playerId, token: player.token, isHost: true, players: room.players.map(lobbyPlayer), maxPlayers: room.maxPlayers, solo: true });

  const started = room.startGame(playerId);
  if (!started.ok) return send(ws, EVENT.ERROR, { code: started.code, message: started.message });
  broadcastGameStart(room, clients);
  startTurnTimer(room, clients);
  driveBots(room, clients);
}

function onJoinRoom(ws, payload, rooms, clients) {
  const { roomId, playerName } = payload;
  const room = rooms.get(roomId?.toUpperCase());
  if (!room) return send(ws, EVENT.ERROR, { code: ERROR_CODE.ROOM_NOT_FOUND, message: '방을 찾을 수 없습니다' });
  const playerId = genId();
  const result   = room.join(playerId, playerName);
  if (!result.ok) return send(ws, EVENT.ERROR, { code: result.code });
  clients.set(ws, { playerId, roomId: room.id });
  send(ws, EVENT.ROOM_JOINED, { roomId, playerId, token: result.token, isHost: false, players: room.players.map(lobbyPlayer), maxPlayers: room.maxPlayers });
  broadcastRoom(ws, room, clients, EVENT.ROOM_UPDATED, { players: room.players.map(lobbyPlayer) });
  broadcastRoomAll(room, clients, EVENT.CHAT_MESSAGE, { playerId: 'system', name: '시스템', message: `${playerName}님이 입장했습니다.`, ts: Date.now(), system: true });
}

function onStartGame(ws, payload, rooms, clients) {
  const ctx = clients.get(ws);
  if (!ctx) return;
  const room = rooms.get(ctx.roomId);
  if (!room) return;
  const result = room.startGame(ctx.playerId);
  if (!result.ok) return send(ws, EVENT.ERROR, { code: result.code, message: result.message });
  broadcastGameStart(room, clients);
  startTurnTimer(room, clients);
}

function onPlayCard(ws, payload, rooms, clients) {
  const ctx = clients.get(ws);
  if (!ctx) return;
  const room = rooms.get(ctx.roomId);
  if (!room || !room.game) return;
  const result = room.game.playCard(ctx.playerId, payload.cardId, payload.chosenColor);
  if (!result.ok) return send(ws, EVENT.ERROR, result.error);
  afterAction(room, clients, result.events, ctx.playerId);
}

function onDrawCard(ws, payload, rooms, clients) {
  const ctx = clients.get(ws);
  if (!ctx) return;
  const room = rooms.get(ctx.roomId);
  if (!room || !room.game) return;
  const result = room.game.drawCard(ctx.playerId);
  if (!result.ok) return send(ws, EVENT.ERROR, result.error);
  afterAction(room, clients, result.events, ctx.playerId);
}

function onChooseColor(ws, payload, rooms, clients) {
  const ctx = clients.get(ws);
  if (!ctx) return;
  const room = rooms.get(ctx.roomId);
  if (!room || !room.game) return;
  const result = room.game.chooseColor(ctx.playerId, payload.color);
  if (!result.ok) return send(ws, EVENT.ERROR, result.error);
  afterAction(room, clients, result.events, ctx.playerId);
}

function onChooseSwap(ws, payload, rooms, clients) {
  const ctx = clients.get(ws);
  if (!ctx) return;
  const room = rooms.get(ctx.roomId);
  if (!room || !room.game) return;
  const result = room.game.chooseSwap(ctx.playerId, payload.targetId);
  if (!result.ok) return send(ws, EVENT.ERROR, result.error);
  afterAction(room, clients, result.events, ctx.playerId);
}

function onChat(ws, payload, rooms, clients) {
  const ctx = clients.get(ws);
  if (!ctx) return;
  const room = rooms.get(ctx.roomId);
  if (!room) return;
  const rawMsg = String(payload.message ?? '').trim();
  if (!rawMsg) return;
  const message = rawMsg.slice(0, CONFIG.CHAT_MAX_LEN);
  const player  = room.playerById(ctx.playerId);
  broadcastRoomAll(room, clients, EVENT.CHAT_MESSAGE, { playerId: ctx.playerId, name: player?.name ?? '???', message, ts: Date.now(), system: false });
}

function onReconnect(ws, payload, rooms, clients) {
  const { roomId, playerId, token } = payload;
  const room = rooms.get(roomId?.toUpperCase());
  if (!room || !room.verifyToken(playerId, token)) return send(ws, EVENT.ERROR, { message: '재접속 실패' });
  clients.set(ws, { playerId, roomId: room.id });
  room.setConnected(playerId, true);
  if (room.game) {
    send(ws, EVENT.RECONNECTED, { state: room.game.snapshot(playerId) });
  } else {
    send(ws, EVENT.ROOM_JOINED, { roomId: room.id, playerId, isHost: room.hostId === playerId, players: room.players.map(lobbyPlayer), maxPlayers: room.maxPlayers });
  }
}

export function handleClose(ws, rooms, clients) {
  const ctx = clients.get(ws);
  if (ctx) {
    const room = rooms.get(ctx.roomId);
    if (room) {
      room.setConnected(ctx.playerId, false);
      const player = room.playerById(ctx.playerId);
      if (player) broadcastRoomAll(room, clients, EVENT.CHAT_MESSAGE, { playerId: 'system', name: '시스템', message: `${player.name}님의 연결이 끊겼습니다.`, ts: Date.now(), system: true });
    }
  }
  clients.delete(ws);
}

function afterAction(room, clients, events = [], actorId) {
  if (!room.game) return;
  const isOver     = events.some(e => e.type === 'gameOver');
  const eliminated = events.find(e => e.type === 'eliminated');
  if (eliminated) {
    const ep = room.game.playerById(eliminated.playerId);
    broadcastRoomAll(room, clients, EVENT.PLAYER_ELIMINATED, { playerId: eliminated.playerId, name: ep?.name ?? '' });
    broadcastRoomAll(room, clients, EVENT.CHAT_MESSAGE, { playerId: 'system', name: '시스템', message: `💀 ${ep?.name}님이 탈락했습니다!`, ts: Date.now(), system: true });
  }
  for (const [ws, ctx] of clients) {
    if (ctx.roomId !== room.id) continue;
    send(ws, EVENT.STATE_SNAPSHOT, { state: room.game.snapshot(ctx.playerId), lastAction: { actorId, topCard: room.game.topCard, events } });
  }
  if (isOver) {
    if (room._botTimer) { clearTimeout(room._botTimer); room._botTimer = null; }
    const winner = room.game.playerById(room.game.winnerId);
    broadcastRoomAll(room, clients, EVENT.GAME_OVER, { winnerId: room.game.winnerId, winnerName: winner?.name });
    broadcastRoomAll(room, clients, EVENT.CHAT_MESSAGE, { playerId: 'system', name: '시스템', message: `🏆 ${winner?.name}님이 승리했습니다!`, ts: Date.now(), system: true });
    room.status = 'ended';
  } else {
    startTurnTimer(room, clients);
    driveBots(room, clients);
  }
}

// ─────────────────────────────────────────────────────────
//  AI 봇 자동 턴 처리
// ─────────────────────────────────────────────────────────

/** 다음에 행동해야 할(봇일 수도 있는) 플레이어 id */
function pendingActorId(game) {
  if (!game) return null;
  // 룰렛은 공격받는 대상(다음 사람)이 색을 정한다
  if (game.waitingFor === 'roulette_color') return game.rouletteTargetId;
  return game.currentPlayer?.id ?? null;
}

/** 현재 행동 차례가 봇이면 딜레이 후 자동으로 수를 두도록 예약 */
function driveBots(room, clients) {
  const game = room.game;
  if (!game || game.status !== 'playing') return;
  const actorId = pendingActorId(game);
  if (!actorId) return;
  const actor = game.playerById(actorId);
  if (!actor || !actor.isBot || actor.eliminated) return;

  if (room._botTimer) clearTimeout(room._botTimer);
  room._botTimer = setTimeout(() => {
    room._botTimer = null;
    performBotAction(room, clients);
  }, botDelay());
}

/** 봇의 실제 수를 기존 GameState 함수로 실행하고 결과를 방송 */
function performBotAction(room, clients) {
  const game = room.game;
  if (!game || game.status !== 'playing') return;
  const actorId = pendingActorId(game);
  if (!actorId) return;
  const actor = game.playerById(actorId);
  if (!actor || !actor.isBot || actor.eliminated) return;

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

  // 안전장치: 봇 수가 어떤 이유로 막히면 강제로 드로우해 턴을 넘겨 교착을 막는다.
  if (!result || !result.ok) {
    if (game.waitingFor) return; // 대기 상태에서 실패는 이론상 불가(유효 입력 보장)
    result = game.drawCard(actorId);
    if (!result || !result.ok) return;
  }
  afterAction(room, clients, result.events ?? [], actorId);
}

function broadcastGameStart(room, clients) {
  for (const [ws, ctx] of clients) {
    if (ctx.roomId !== room.id) continue;
    send(ws, EVENT.GAME_STARTED, { state: room.game.snapshot(ctx.playerId) });
  }
}

function broadcastRoom(senderWs, room, clients, event, data) {
  for (const [ws, ctx] of clients) {
    if (ctx.roomId === room.id && ws !== senderWs) send(ws, event, data);
  }
}

function broadcastRoomAll(room, clients, event, data) {
  for (const [ws, ctx] of clients) {
    if (ctx.roomId === room.id) send(ws, event, data);
  }
}

function startTurnTimer(room, clients) {
  if (room._turnTimer) clearTimeout(room._turnTimer);
  if (!room.game || room.game.status !== 'playing') return;
  const currentId = room.game.currentPlayer?.id;
  room._turnTimer = setTimeout(() => {
    if (!room.game || room.game.currentPlayer?.id !== currentId) return;
    const result = room.game.autoPass(currentId);
    if (result) afterAction(room, clients, result.events ?? [], currentId);
    if (room.game?.status === 'playing') startTurnTimer(room, clients);
  }, CONFIG.TURN_TIME_LIMIT * 1000);
}

function send(ws, event, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ event, data }));
}

function lobbyPlayer(p) { return { id: p.id, name: p.name }; }
function genId() { return Math.random().toString(36).slice(2, 10); }
