import { canPlay } from './rules.js';
import { COLOR, CARD_TYPE } from '../../../shared/protocol.js';

/**
 * AI 봇 의사결정 로직 (룰엔진 rules.js 재사용, 규칙 판정은 복제하지 않음)
 *
 * 이 모듈은 상태를 변경하지 않는다 — "어떤 수를 둘지"만 계산해 반환하고,
 * 실제 상태 변경(playCard/drawCard/chooseColor/chooseSwap)은 GameState가 담당.
 */

const WILD_TYPES = new Set([
  CARD_TYPE.WILD,
  CARD_TYPE.WILD_DRAW_FOUR,
  CARD_TYPE.WILD_REVERSE_DRAW_FOUR,
  CARD_TYPE.WILD_DRAW_SIX,
  CARD_TYPE.WILD_DRAW_TEN,
  CARD_TYPE.WILD_COLOR_ROULETTE,
]);

const DRAW_WILDS = new Set([
  CARD_TYPE.WILD_DRAW_FOUR,
  CARD_TYPE.WILD_REVERSE_DRAW_FOUR,
  CARD_TYPE.WILD_DRAW_SIX,
  CARD_TYPE.WILD_DRAW_TEN,
]);

export function isWildType(type) {
  return WILD_TYPES.has(type);
}

/**
 * 와일드 색 지정: 손패에 가장 많은 (와일드 아닌) 색. 색 카드가 없으면 RED.
 */
export function chooseBotColor(hand) {
  const counts = {
    [COLOR.RED]:    0,
    [COLOR.GREEN]:  0,
    [COLOR.BLUE]:   0,
    [COLOR.YELLOW]: 0,
  };
  for (const c of hand) {
    if (c.color && c.color !== COLOR.WILD) counts[c.color]++;
  }
  let best = COLOR.RED;
  let bestN = -1;
  for (const col of [COLOR.RED, COLOR.GREEN, COLOR.BLUE, COLOR.YELLOW]) {
    if (counts[col] > bestN) { bestN = counts[col]; best = col; }
  }
  return best;
}

/**
 * 손패 교환(숫자 7): 활성 상대 중 손패가 가장 적은 사람의 패를 가져온다(내게 유리).
 */
export function chooseBotSwapTarget(game, botId) {
  const targets = game.activePlayers.filter(p => p.id !== botId);
  if (targets.length === 0) return botId; // 이론상 도달 불가(1인이면 이미 승리)
  let best = targets[0];
  for (const p of targets) {
    if (p.hand.length < best.hand.length) best = p;
  }
  return best.id;
}

/** 드로우 카드 파워(중첩 시 낮은 것부터 소모해 큰 카드를 아낌) */
function drawPower(card) {
  switch (card.type) {
    case CARD_TYPE.DRAW_TWO:               return 2;
    case CARD_TYPE.WILD_DRAW_FOUR:         return 4;
    case CARD_TYPE.WILD_REVERSE_DRAW_FOUR: return 4;
    case CARD_TYPE.WILD_DRAW_SIX:          return 6;
    case CARD_TYPE.WILD_DRAW_TEN:          return 10;
    default:                               return 0;
  }
}

/** 낼 카드 우선순위(작을수록 먼저) — 기본 액션 공격적 사용, 와일드/드로우와일드는 아낌 */
function playPriority(card) {
  if (DRAW_WILDS.has(card.type))               return 3; // 드로우 와일드 = 최후에
  if (card.type === CARD_TYPE.WILD_COLOR_ROULETTE) return 2;
  if (card.type === CARD_TYPE.WILD)            return 2; // 일반 와일드도 아낌
  if (card.type === CARD_TYPE.NUMBER)          return 1; // 숫자
  return 0; // skip/reverse/draw_two/discard_all/skip_all → 먼저 소진
}

function playDescriptor(card, hand) {
  const desc = { kind: 'play', cardId: card.id };
  // 색 선택이 필요한 와일드(룰렛 제외 — 룰렛은 공격받는 쪽이 정함)면 색을 미리 지정.
  if (isWildType(card.type) && card.type !== CARD_TYPE.WILD_COLOR_ROULETTE) {
    const rest = hand.filter(c => c.id !== card.id);
    desc.chosenColor = chooseBotColor(rest);
  }
  return desc;
}

/**
 * 봇의 "일반 턴" 수를 계산.
 * @returns {{kind:'play', cardId:number, chosenColor?:string} | {kind:'draw'}}
 *
 * 이 게임 엔진에서 drawCard는 항상 턴을 넘긴다(뽑고 즉시 내는 규칙 없음).
 * 따라서 봇은 매 턴 반드시 '내기' 또는 '뽑기(=턴 종료)' 중 하나 → 교착/무한루프 불가.
 */
export function computeBotMove(game, botId) {
  const bot = game.playerById(botId);
  if (!bot) return { kind: 'draw' };

  const { topCard, currentColor, pendingDraw } = game;
  const playable = bot.hand.filter(c => canPlay(c, topCard, currentColor, pendingDraw));

  // 낼 수 있는 카드가 없으면 뽑기(중첩 대기면 규칙대로 강제 수령 + 턴 종료).
  if (playable.length === 0) {
    return { kind: 'draw' };
  }

  // 드로우 중첩 대기 중: 되도록 낮은 파워로 받아넘겨 큰 드로우 카드를 아낀다.
  if (pendingDraw && pendingDraw.count > 0) {
    const sorted = [...playable].sort((a, b) => drawPower(a) - drawPower(b));
    return playDescriptor(sorted[0], bot.hand);
  }

  const sorted = [...playable].sort((a, b) => playPriority(a) - playPriority(b));
  return playDescriptor(sorted[0], bot.hand);
}
