import { COLOR, CARD_TYPE } from '../../../shared/protocol.js';

let _idCounter = 0;
function id() { return ++_idCounter; }

/**
 * UNO No Mercy (데스매치) 전체 카드 덱 생성
 * 총 168장
 *
 * 색상 카드 (4색 × 각 구성):
 *   0        × 1장씩  → 4장
 *   1~9      × 2장씩  → 72장  (근데 10은 특수)
 *   10       × 2장씩  → 8장   (한 번 더 턴)
 *   Skip     × 2장씩  → 8장
 *   Reverse  × 2장씩  → 8장
 *   Draw Two × 2장씩  → 8장
 *   Discard All × 2장씩 → 8장  (모두 버리기)
 *   Skip All    × 1장씩 → 4장  (모두 스킵)
 *
 * 와일드 카드:
 *   Wild              × 4장
 *   Wild Draw 4       × 4장
 *   Wild Reverse+4    × 3장
 *   Wild Draw 6       × 3장
 *   Wild Draw 10      × 3장
 *   Wild Color Roulette × 3장
 */
export function createDeck() {
  const cards = [];
  const colors = [COLOR.RED, COLOR.GREEN, COLOR.BLUE, COLOR.YELLOW];

  for (const color of colors) {
    // 0 (1장)
    cards.push(makeCard(CARD_TYPE.NUMBER, color, 0));

    // 1~9 (2장씩)
    for (let n = 1; n <= 9; n++) {
      cards.push(makeCard(CARD_TYPE.NUMBER, color, n));
      cards.push(makeCard(CARD_TYPE.NUMBER, color, n));
    }

    // 10 (2장) — 자신이 한 번 더 턴 진행
    cards.push(makeCard(CARD_TYPE.NUMBER, color, 10));
    cards.push(makeCard(CARD_TYPE.NUMBER, color, 10));

    // Skip (2장)
    cards.push(makeCard(CARD_TYPE.SKIP, color));
    cards.push(makeCard(CARD_TYPE.SKIP, color));

    // Reverse (2장)
    cards.push(makeCard(CARD_TYPE.REVERSE, color));
    cards.push(makeCard(CARD_TYPE.REVERSE, color));

    // Draw Two (2장)
    cards.push(makeCard(CARD_TYPE.DRAW_TWO, color));
    cards.push(makeCard(CARD_TYPE.DRAW_TWO, color));

    // Discard All — 모두 버리기 (2장)
    cards.push(makeCard(CARD_TYPE.DISCARD_ALL, color));
    cards.push(makeCard(CARD_TYPE.DISCARD_ALL, color));

    // Skip All — 모두 스킵 (1장)
    cards.push(makeCard(CARD_TYPE.SKIP_ALL, color));
  }

  // Wild (4장)
  for (let i = 0; i < 4; i++) cards.push(makeCard(CARD_TYPE.WILD, COLOR.WILD));

  // Wild Draw 4 (4장)
  for (let i = 0; i < 4; i++) cards.push(makeCard(CARD_TYPE.WILD_DRAW_FOUR, COLOR.WILD));

  // Wild Reverse+4 (3장)
  for (let i = 0; i < 3; i++) cards.push(makeCard(CARD_TYPE.WILD_REVERSE_DRAW_FOUR, COLOR.WILD));

  // Wild Draw 6 (3장)
  for (let i = 0; i < 3; i++) cards.push(makeCard(CARD_TYPE.WILD_DRAW_SIX, COLOR.WILD));

  // Wild Draw 10 (3장)
  for (let i = 0; i < 3; i++) cards.push(makeCard(CARD_TYPE.WILD_DRAW_TEN, COLOR.WILD));

  // Wild Color Roulette (3장)
  for (let i = 0; i < 3; i++) cards.push(makeCard(CARD_TYPE.WILD_COLOR_ROULETTE, COLOR.WILD));

  return shuffle(cards);
}

function makeCard(type, color, value = null) {
  return { id: id(), type, color, value };
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 드로우 카드의 뽑기 수 반환 (중첩 비교용) */
export function getDrawCount(card) {
  switch (card.type) {
    case CARD_TYPE.DRAW_TWO:               return 2;
    case CARD_TYPE.WILD_DRAW_FOUR:         return 4;
    case CARD_TYPE.WILD_REVERSE_DRAW_FOUR: return 4;
    case CARD_TYPE.WILD_DRAW_SIX:          return 6;
    case CARD_TYPE.WILD_DRAW_TEN:          return 10;
    default:                               return 0;
  }
}

/** 드로우 카드 강도 순서 (중첩 가능 여부 판단) */
const DRAW_POWER = {
  [CARD_TYPE.DRAW_TWO]:               1,
  [CARD_TYPE.WILD_DRAW_FOUR]:         2,
  [CARD_TYPE.WILD_REVERSE_DRAW_FOUR]: 2,  // 동급
  [CARD_TYPE.WILD_DRAW_SIX]:          3,
  [CARD_TYPE.WILD_DRAW_TEN]:          4,
};

export function canStackOnDraw(incoming, stackCard) {
  const inPow = DRAW_POWER[incoming.type] ?? 0;
  const stPow = DRAW_POWER[stackCard.type] ?? 0;
  return inPow >= stPow && inPow > 0;
}
