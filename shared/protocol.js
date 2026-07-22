// ==============================
// 클라이언트 → 서버 Actions
// ==============================
export const ACTION = {
  JOIN_ROOM:    'JOIN_ROOM',    // { roomId, playerName }
  CREATE_ROOM:  'CREATE_ROOM',  // { playerName, maxPlayers }  또는 혼자하기: { playerName, solo:true, botCount }
  START_GAME:   'START_GAME',   // {}  (host only)
  PLAY_CARD:    'PLAY_CARD',    // { cardId, chosenColor? }
  DRAW_CARD:    'DRAW_CARD',    // {}
  PASS_TURN:    'PASS_TURN',    // {} (drawn card 후)
  CHOOSE_COLOR: 'CHOOSE_COLOR', // { color }  와일드 후
  CHOOSE_SWAP:  'CHOOSE_SWAP',  // { targetId }  숫자7 후
  RECONNECT:    'RECONNECT',    // { roomId, playerId, token }
  CHAT:         'CHAT',         // { message }
  PING:         'PING',
};

// ==============================
// 서버 → 클라이언트 Events
// ==============================
export const EVENT = {
  ROOM_CREATED:        'ROOM_CREATED',        // { roomId, playerId, token }
  ROOM_JOINED:         'ROOM_JOINED',         // { roomId, playerId, token, players[] }
  ROOM_UPDATED:        'ROOM_UPDATED',        // { players[] }
  GAME_STARTED:        'GAME_STARTED',        // { state: GameSnapshot }
  STATE_SNAPSHOT:      'STATE_SNAPSHOT',      // { state: GameSnapshot }
  TURN_CHANGED:        'TURN_CHANGED',        // { currentPlayerId, timeLimit }
  CARD_PLAYED:         'CARD_PLAYED',         // { playerId, card, nextColor }
  CARD_DRAWN:          'CARD_DRAWN',          // { playerId, count }
  PLAYER_ELIMINATED:   'PLAYER_ELIMINATED',   // { playerId, name }
  GAME_OVER:           'GAME_OVER',           // { winnerId, winnerName }
  COLOR_CHOOSE_NEEDED: 'COLOR_CHOOSE_NEEDED', // { playerId }
  SWAP_CHOOSE_NEEDED:  'SWAP_CHOOSE_NEEDED',  // { playerId }
  ROTATE_HANDS:        'ROTATE_HANDS',        // { direction }
  CHAT_MESSAGE:        'CHAT_MESSAGE',        // { playerId, name, message, ts }
  ERROR:               'ERROR',              // { code, message }
  RECONNECTED:         'RECONNECTED',         // { state: GameSnapshot }
  PONG:                'PONG',
};

// ==============================
// Keepalive 프레임 (문자열 완전 일치가 필요)
// ==============================
// Cloudflare Durable Objects의 setWebSocketAutoResponse는 들어온 메시지를
// "문자열 그대로" 비교해 자동 응답한다(= DO를 깨우지 않고 과금도 되지 않음).
// 클라이언트가 키 순서·공백이 1바이트라도 다른 JSON을 보내면 자동응답이 빗나가
// DO가 매번 깨어나므로, 양쪽이 반드시 이 상수를 그대로 써야 한다.
export const PING_FRAME = JSON.stringify({ action: ACTION.PING, payload: {} });
export const PONG_FRAME = JSON.stringify({ event: EVENT.PONG, data: {} });

// ==============================
// 카드 색상
// ==============================
export const COLOR = {
  RED:    'red',
  GREEN:  'green',
  BLUE:   'blue',
  YELLOW: 'yellow',
  WILD:   'wild',
};

// ==============================
// 카드 타입
// ==============================
export const CARD_TYPE = {
  NUMBER:                  'number',
  SKIP:                    'skip',
  REVERSE:                 'reverse',
  DRAW_TWO:                'draw_two',
  WILD:                    'wild',
  WILD_DRAW_FOUR:          'wild_draw_four',
  WILD_REVERSE_DRAW_FOUR:  'wild_reverse_draw_four',
  WILD_DRAW_SIX:           'wild_draw_six',
  WILD_DRAW_TEN:           'wild_draw_ten',
  WILD_COLOR_ROULETTE:     'wild_color_roulette',
  DISCARD_ALL:             'discard_all',
  SKIP_ALL:                'skip_all',
};

// ==============================
// 게임 상태
// ==============================
export const GAME_STATUS = {
  LOBBY:   'lobby',
  PLAYING: 'playing',
  ENDED:   'ended',
};

// ==============================
// 에러 코드
// ==============================
export const ERROR_CODE = {
  ROOM_NOT_FOUND:       'ROOM_NOT_FOUND',
  ROOM_FULL:            'ROOM_FULL',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  NOT_YOUR_TURN:        'NOT_YOUR_TURN',
  INVALID_CARD:         'INVALID_CARD',
  NEED_COLOR_CHOICE:    'NEED_COLOR_CHOICE',
  NEED_SWAP_CHOICE:     'NEED_SWAP_CHOICE',
  NOT_HOST:             'NOT_HOST',
  MIN_PLAYERS:          'MIN_PLAYERS',
  INVALID_NAME:         'INVALID_NAME',
  RECONNECT_FAILED:     'RECONNECT_FAILED',
  RATE_LIMITED:         'RATE_LIMITED',
};

// ==============================
// 게임 설정
// ==============================
export const CONFIG = {
  TURN_TIME_LIMIT:   25,   // 초
  WARN_TIME:         10,   // 초 (경고)
  MAX_HAND_SIZE:     25,   // 이 초과 시 탈락
  DEFAULT_PLAYERS:   5,
  MIN_PLAYERS:       2,
  MAX_PLAYERS:       8,
  INITIAL_HAND_SIZE: 7,
  CHAT_MAX_LEN:      80,   // 채팅 최대 글자
  NAME_MAX_LEN:      12,   // 플레이어 이름 최대 글자 (초과분은 잘라서 수용)
};
