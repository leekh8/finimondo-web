import { ACTION, EVENT, CONFIG, ERROR_CODE } from '../../../shared/protocol.js';

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
  const { playerName, maxPlayers = CONFIG.DEFAULT_PLAYERS } = payload;
  if (!playerName) return send(ws, EVENT.ERROR, { message: 'playerName 필요' });
  const playerId = genId();
  const room     = rooms.create(playerId, playerName, maxPlayers);
  const player   = room.playerById(playerId);
  clients.set(ws, { playerId, roomId: room.id });
  send(ws, EVENT.ROOM_CREATED, { roomId: room.id, playerId, token: player.token, isHost: true, players: room.players.map(lobbyPlayer), maxPlayers: room.maxPlayers });
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
    const winner = room.game.playerById(room.game.winnerId);
    broadcastRoomAll(room, clients, EVENT.GAME_OVER, { winnerId: room.game.winnerId, winnerName: winner?.name });
    broadcastRoomAll(room, clients, EVENT.CHAT_MESSAGE, { playerId: 'system', name: '시스템', message: `🏆 ${winner?.name}님이 승리했습니다!`, ts: Date.now(), system: true });
    room.status = 'ended';
  } else {
    startTurnTimer(room, clients);
  }
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
