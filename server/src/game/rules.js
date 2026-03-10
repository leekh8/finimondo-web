import { COLOR, CARD_TYPE, CONFIG } from '../../../shared/protocol.js';
import { getDrawCount, canStackOnDraw } from './cards.js';

/**
 * 해당 카드를 현재 상태에서 낼 수 있는지 판단
 * @param {object} card       - 내려는 카드
 * @param {object} topCard    - 버린 카드 더미 맨 위
 * @param {string} currentColor - 현재 유효 색상 (와일드 후 지정 색 포함)
 * @param {object} pendingDraw  - { count, minPower } 중첩 대기 중인 드로우 정보
 */
export function canPlay(card, topCard, currentColor, pendingDraw) {
  // ── 드로우 중첩 대기 중 ──────────────────────────────────────
  if (pendingDraw && pendingDraw.count > 0) {
    // 동급 이상 드로우 카드만 낼 수 있음
    return canStackOnDraw(card, { type: pendingDraw.sourceType });
  }

  // ── 와일드 계열은 항상 낼 수 있음 (챌린지 없음) ─────────────
  if (isWild(card)) return true;

  // ── 같은 색 또는 같은 숫자/타입 ────────────────────────────
  if (card.color === currentColor) return true;
  if (card.type === topCard.type) return true;
  if (card.type === CARD_TYPE.NUMBER && topCard.type === CARD_TYPE.NUMBER
      && card.value === topCard.value) return true;

  return false;
}

export function isWild(card) {
  return card.color === COLOR.WILD;
}

export function isDrawCard(card) {
  return getDrawCount(card) > 0;
}

export function needsColorChoice(card) {
  return isWild(card) && card.type !== CARD_TYPE.WILD_COLOR_ROULETTE;
}

/**
 * 카드를 낸 후 게임 상태 변화 계산
 * @returns {object} effects
 *   - nextTurnDelta: 턴 이동 방향/양 (+1 정방향, -1 역방향, 0 그 자리 유지, 2 한 칸 건너뜀)
 *   - directionFlip: boolean  방향 전환 여부
 *   - drawCount: 다음 플레이어가 뽑아야 할 장수 (중첩 누적)
 *   - sourceType: 드로우 카드 타입 (중첩 판단용)
 *   - skipAll: boolean  모두 스킵
 *   - discardAll: boolean  같은 색 전부 버리기
 *   - swapNeeded: boolean  손패 교환 필요 (숫자 7)
 *   - rotateNeeded: boolean  손패 돌리기 (숫자 0)
 *   - extraTurn: boolean  한 번 더 (숫자 10)
 *   - colorRoulette: boolean  공격받는 사람이 색 결정
 *   - colorChoiceNeeded: boolean
 *   - revealHand: boolean  손패 공개 (colorRoulette)
 */
export function computeEffects(card, currentDirection, pendingDraw) {
  const effects = {
    nextTurnDelta:    1,
    directionFlip:    false,
    drawCount:        0,
    sourceType:       null,
    skipAll:          false,
    discardAll:       false,
    swapNeeded:       false,
    rotateNeeded:     false,
    extraTurn:        false,
    colorRoulette:    false,
    colorChoiceNeeded: false,
    revealHand:       false,
    stackedDrawCount: pendingDraw ? pendingDraw.count : 0,
  };

  switch (card.type) {
    case CARD_TYPE.SKIP:
      effects.nextTurnDelta = 2;  // 다음 사람 건너뜀
      break;

    case CARD_TYPE.REVERSE:
      effects.directionFlip = true;
      // 2인이면 리버스가 스킵처럼 동작 (표준 UNO 규칙)
      break;

    case CARD_TYPE.DRAW_TWO:
      effects.drawCount  = 2;
      effects.sourceType = CARD_TYPE.DRAW_TWO;
      effects.stackedDrawCount += 2;
      effects.nextTurnDelta = 2;  // 뽑고 스킵
      break;

    case CARD_TYPE.WILD:
      effects.colorChoiceNeeded = true;
      break;

    case CARD_TYPE.WILD_DRAW_FOUR:
      effects.drawCount  = 4;
      effects.sourceType = CARD_TYPE.WILD_DRAW_FOUR;
      effects.stackedDrawCount += 4;
      effects.colorChoiceNeeded = true;
      effects.nextTurnDelta = 2;
      break;

    case CARD_TYPE.WILD_REVERSE_DRAW_FOUR:
      effects.drawCount  = 4;
      effects.sourceType = CARD_TYPE.WILD_REVERSE_DRAW_FOUR;
      effects.stackedDrawCount += 4;
      effects.directionFlip = true;
      effects.colorChoiceNeeded = true;
      effects.nextTurnDelta = 2;
      break;

    case CARD_TYPE.WILD_DRAW_SIX:
      effects.drawCount  = 6;
      effects.sourceType = CARD_TYPE.WILD_DRAW_SIX;
      effects.stackedDrawCount += 6;
      effects.colorChoiceNeeded = true;
      effects.nextTurnDelta = 2;
      break;

    case CARD_TYPE.WILD_DRAW_TEN:
      effects.drawCount  = 10;
      effects.sourceType = CARD_TYPE.WILD_DRAW_TEN;
      effects.stackedDrawCount += 10;
      effects.colorChoiceNeeded = true;
      effects.nextTurnDelta = 2;
      break;

    case CARD_TYPE.WILD_COLOR_ROULETTE:
      // 공격받는 사람(다음 사람)이 색을 정하고 손패 공개
      effects.colorRoulette    = true;
      effects.revealHand       = true;
      effects.nextTurnDelta    = 2;  // 색 정한 사람이 스킵됨
      break;

    case CARD_TYPE.DISCARD_ALL:
      effects.discardAll = true;
      // 색 고정 (카드 색)
      break;

    case CARD_TYPE.SKIP_ALL:
      effects.skipAll = true;
      // 자신이 한 번 더 — delta=0 (같은 인덱스 유지)
      effects.nextTurnDelta = 0;
      break;

    case CARD_TYPE.NUMBER:
      if (card.value === 0)  effects.rotateNeeded = true;
      if (card.value === 7)  effects.swapNeeded   = true;
      if (card.value === 10) effects.extraTurn    = true;
      break;
  }

  return effects;
}

/**
 * 탈락 여부 판단
 */
export function isEliminated(player) {
  return player.hand.length > CONFIG.MAX_HAND_SIZE;
}

/**
 * 낼 수 있는 카드가 있는지 확인
 */
export function hasPlayableCard(hand, topCard, currentColor, pendingDraw) {
  return hand.some(card => canPlay(card, topCard, currentColor, pendingDraw));
}
