import { describe, test, expect } from "vitest";
import { createDeck, getDrawCount, canStackOnDraw, shuffle } from "./cards.js";
import { CARD_TYPE, COLOR } from "../../../shared/protocol.js";

const card = (type) => ({ id: 1, type, color: COLOR.WILD, value: null });

describe("createDeck", () => {
  const deck = createDeck();

  test("총 140장 (주석 상세 구성 기준)", () => {
    // 주석 헤더의 '168'은 오기 — 상세 구성 합계는 140이며 코드와 일치
    expect(deck.length).toBe(140);
  });

  test("숫자 카드 84장 (색당 0×1 + 1~9×2 + 10×2 = 21, ×4색)", () => {
    const numbers = deck.filter((c) => c.type === CARD_TYPE.NUMBER);
    expect(numbers.length).toBe(84);
  });

  test("와일드 계열 장수", () => {
    const count = (t) => deck.filter((c) => c.type === t).length;
    expect(count(CARD_TYPE.WILD)).toBe(4);
    expect(count(CARD_TYPE.WILD_DRAW_FOUR)).toBe(4);
    expect(count(CARD_TYPE.WILD_REVERSE_DRAW_FOUR)).toBe(3);
    expect(count(CARD_TYPE.WILD_DRAW_SIX)).toBe(3);
    expect(count(CARD_TYPE.WILD_DRAW_TEN)).toBe(3);
    expect(count(CARD_TYPE.WILD_COLOR_ROULETTE)).toBe(3);
  });

  test("모든 카드에 고유 id", () => {
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(deck.length);
  });
});

describe("getDrawCount", () => {
  test("드로우 카드별 뽑기 수", () => {
    expect(getDrawCount(card(CARD_TYPE.DRAW_TWO))).toBe(2);
    expect(getDrawCount(card(CARD_TYPE.WILD_DRAW_FOUR))).toBe(4);
    expect(getDrawCount(card(CARD_TYPE.WILD_REVERSE_DRAW_FOUR))).toBe(4);
    expect(getDrawCount(card(CARD_TYPE.WILD_DRAW_SIX))).toBe(6);
    expect(getDrawCount(card(CARD_TYPE.WILD_DRAW_TEN))).toBe(10);
  });
  test("드로우 아닌 카드는 0", () => {
    expect(getDrawCount(card(CARD_TYPE.NUMBER))).toBe(0);
    expect(getDrawCount(card(CARD_TYPE.SKIP))).toBe(0);
  });
});

describe("canStackOnDraw — 중첩 순서 +2 < +4 ≤ ↺+4 < +6 < +10", () => {
  const on = (incoming, stackType) =>
    canStackOnDraw(card(incoming), { type: stackType });

  test("상위/동급은 중첩 가능", () => {
    expect(on(CARD_TYPE.WILD_DRAW_FOUR, CARD_TYPE.DRAW_TWO)).toBe(true); // +4 on +2
    expect(on(CARD_TYPE.WILD_REVERSE_DRAW_FOUR, CARD_TYPE.WILD_DRAW_FOUR)).toBe(true); // ↺+4 on +4 (동급)
    expect(on(CARD_TYPE.WILD_DRAW_SIX, CARD_TYPE.WILD_DRAW_FOUR)).toBe(true); // +6 on +4
    expect(on(CARD_TYPE.WILD_DRAW_TEN, CARD_TYPE.WILD_DRAW_SIX)).toBe(true); // +10 on +6
    expect(on(CARD_TYPE.DRAW_TWO, CARD_TYPE.DRAW_TWO)).toBe(true); // +2 on +2
  });

  test("하위는 중첩 불가", () => {
    expect(on(CARD_TYPE.DRAW_TWO, CARD_TYPE.WILD_DRAW_FOUR)).toBe(false); // +2 on +4
    expect(on(CARD_TYPE.WILD_DRAW_FOUR, CARD_TYPE.WILD_DRAW_SIX)).toBe(false); // +4 on +6
    expect(on(CARD_TYPE.WILD_DRAW_SIX, CARD_TYPE.WILD_DRAW_TEN)).toBe(false); // +6 on +10
  });

  test("드로우 아닌 카드는 중첩 불가", () => {
    expect(on(CARD_TYPE.NUMBER, CARD_TYPE.DRAW_TWO)).toBe(false);
    expect(on(CARD_TYPE.SKIP, CARD_TYPE.DRAW_TWO)).toBe(false);
  });
});

describe("shuffle", () => {
  test("원소 보존(같은 multiset), 원본 불변", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr);
    expect(out.length).toBe(arr.length);
    expect([...out].sort()).toEqual([...arr].sort());
    expect(arr).toEqual([1, 2, 3, 4, 5]); // 원본 불변
  });
});
