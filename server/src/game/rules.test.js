import { describe, test, expect } from "vitest";
import {
  canPlay,
  computeEffects,
  isEliminated,
  hasPlayableCard,
  isWild,
  isDrawCard,
  needsColorChoice,
} from "./rules.js";
import { CARD_TYPE, COLOR, CONFIG } from "../../../shared/protocol.js";

const card = (type, color = COLOR.WILD, value = null) => ({ id: 1, type, color, value });
const num = (color, value) => card(CARD_TYPE.NUMBER, color, value);

describe("canPlay — 일반 상황(중첩 없음)", () => {
  const top = num(COLOR.RED, 5);

  test("같은 색이면 낼 수 있음", () => {
    expect(canPlay(num(COLOR.RED, 9), top, COLOR.RED, null)).toBe(true);
  });
  test("같은 숫자면 낼 수 있음(색 달라도)", () => {
    expect(canPlay(num(COLOR.BLUE, 5), top, COLOR.RED, null)).toBe(true);
  });
  test("같은 타입이면 낼 수 있음(스킵 위 스킵)", () => {
    const topSkip = card(CARD_TYPE.SKIP, COLOR.RED);
    expect(canPlay(card(CARD_TYPE.SKIP, COLOR.BLUE), topSkip, COLOR.RED, null)).toBe(true);
  });
  test("색·숫자·타입 모두 다르면 못 냄", () => {
    expect(canPlay(num(COLOR.BLUE, 9), top, COLOR.RED, null)).toBe(false);
  });
  test("와일드는 언제나 낼 수 있음(챌린지 없음)", () => {
    expect(canPlay(card(CARD_TYPE.WILD), top, COLOR.RED, null)).toBe(true);
    expect(canPlay(card(CARD_TYPE.WILD_DRAW_FOUR), top, COLOR.RED, null)).toBe(true);
  });
  test("현재 색은 와일드로 지정된 색을 따름", () => {
    // top은 숫자5(red)이지만 와일드로 blue 지정된 상태
    expect(canPlay(num(COLOR.BLUE, 2), top, COLOR.BLUE, null)).toBe(true);
    expect(canPlay(num(COLOR.RED, 2), top, COLOR.BLUE, null)).toBe(false);
  });
});

describe("canPlay — 드로우 중첩 대기 중", () => {
  const top = card(CARD_TYPE.DRAW_TWO, COLOR.RED);
  const pending = { count: 2, sourceType: CARD_TYPE.DRAW_TWO };

  test("동급 이상 드로우만 받아넘길 수 있음", () => {
    expect(canPlay(card(CARD_TYPE.DRAW_TWO, COLOR.BLUE), top, COLOR.RED, pending)).toBe(true);
    expect(canPlay(card(CARD_TYPE.WILD_DRAW_FOUR), top, COLOR.RED, pending)).toBe(true);
  });
  test("일반 카드는 중첩 대기 중 못 냄", () => {
    expect(canPlay(num(COLOR.RED, 5), top, COLOR.RED, pending)).toBe(false);
    expect(canPlay(card(CARD_TYPE.WILD), top, COLOR.RED, pending)).toBe(false);
  });
});

describe("computeEffects", () => {
  test("Skip → 다음 사람 건너뜀(delta 2)", () => {
    expect(computeEffects(card(CARD_TYPE.SKIP, COLOR.RED), 1, null).nextTurnDelta).toBe(2);
  });
  test("Reverse → 방향 전환", () => {
    expect(computeEffects(card(CARD_TYPE.REVERSE, COLOR.RED), 1, null).directionFlip).toBe(true);
  });
  test("Draw Two → drawCount 2 + sourceType", () => {
    const e = computeEffects(card(CARD_TYPE.DRAW_TWO, COLOR.RED), 1, null);
    expect(e.drawCount).toBe(2);
    expect(e.sourceType).toBe(CARD_TYPE.DRAW_TWO);
  });
  test("Wild Draw Four → 4 + 색선택 필요", () => {
    const e = computeEffects(card(CARD_TYPE.WILD_DRAW_FOUR), 1, null);
    expect(e.drawCount).toBe(4);
    expect(e.colorChoiceNeeded).toBe(true);
  });
  test("Wild Reverse Draw Four → 4 + 방향전환 + 색선택", () => {
    const e = computeEffects(card(CARD_TYPE.WILD_REVERSE_DRAW_FOUR), 1, null);
    expect(e.drawCount).toBe(4);
    expect(e.directionFlip).toBe(true);
    expect(e.colorChoiceNeeded).toBe(true);
  });
  test("Wild Draw Six / Ten", () => {
    expect(computeEffects(card(CARD_TYPE.WILD_DRAW_SIX), 1, null).drawCount).toBe(6);
    expect(computeEffects(card(CARD_TYPE.WILD_DRAW_TEN), 1, null).drawCount).toBe(10);
  });
  test("Color Roulette → 룰렛+손패공개, 색 정한 사람 스킵(delta 2)", () => {
    const e = computeEffects(card(CARD_TYPE.WILD_COLOR_ROULETTE), 1, null);
    expect(e.colorRoulette).toBe(true);
    expect(e.revealHand).toBe(true);
    expect(e.nextTurnDelta).toBe(2);
  });
  test("Skip All → 자신 한 번 더(delta 0)", () => {
    const e = computeEffects(card(CARD_TYPE.SKIP_ALL, COLOR.RED), 1, null);
    expect(e.skipAll).toBe(true);
    expect(e.nextTurnDelta).toBe(0);
  });
  test("Discard All", () => {
    expect(computeEffects(card(CARD_TYPE.DISCARD_ALL, COLOR.RED), 1, null).discardAll).toBe(true);
  });
  test("숫자 0/7/10 특수효과", () => {
    expect(computeEffects(num(COLOR.RED, 0), 1, null).rotateNeeded).toBe(true);
    expect(computeEffects(num(COLOR.RED, 7), 1, null).swapNeeded).toBe(true);
    expect(computeEffects(num(COLOR.RED, 10), 1, null).extraTurn).toBe(true);
  });
  test("일반 숫자(5)는 특수효과 없음", () => {
    const e = computeEffects(num(COLOR.RED, 5), 1, null);
    expect(e.rotateNeeded).toBe(false);
    expect(e.swapNeeded).toBe(false);
    expect(e.extraTurn).toBe(false);
  });
  test("드로우 중첩 누적: 대기 +2에 +2 → stackedDrawCount 4", () => {
    const e = computeEffects(card(CARD_TYPE.DRAW_TWO, COLOR.RED), 1, { count: 2 });
    expect(e.stackedDrawCount).toBe(4);
  });
});

describe("isEliminated — 손패 25장 초과 시 탈락", () => {
  const player = (n) => ({ hand: Array.from({ length: n }, (_, i) => num(COLOR.RED, i % 10)) });
  test(`${CONFIG.MAX_HAND_SIZE}장은 생존`, () => {
    expect(isEliminated(player(CONFIG.MAX_HAND_SIZE))).toBe(false);
  });
  test(`${CONFIG.MAX_HAND_SIZE + 1}장은 탈락`, () => {
    expect(isEliminated(player(CONFIG.MAX_HAND_SIZE + 1))).toBe(true);
  });
});

describe("보조 판별 함수", () => {
  test("isWild", () => {
    expect(isWild(card(CARD_TYPE.WILD))).toBe(true);
    expect(isWild(num(COLOR.RED, 5))).toBe(false);
  });
  test("isDrawCard", () => {
    expect(isDrawCard(card(CARD_TYPE.WILD_DRAW_SIX))).toBe(true);
    expect(isDrawCard(num(COLOR.RED, 5))).toBe(false);
  });
  test("needsColorChoice — 룰렛은 제외(공격받는 쪽이 정함)", () => {
    expect(needsColorChoice(card(CARD_TYPE.WILD))).toBe(true);
    expect(needsColorChoice(card(CARD_TYPE.WILD_COLOR_ROULETTE))).toBe(false);
  });
  test("hasPlayableCard", () => {
    const top = num(COLOR.RED, 5);
    const hand = [num(COLOR.BLUE, 9), num(COLOR.BLUE, 5)]; // 두번째가 같은 숫자
    expect(hasPlayableCard(hand, top, COLOR.RED, null)).toBe(true);
    const noMatch = [num(COLOR.BLUE, 9), num(COLOR.GREEN, 8)];
    expect(hasPlayableCard(noMatch, top, COLOR.RED, null)).toBe(false);
  });
});
