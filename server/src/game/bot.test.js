import { describe, test, expect } from "vitest";
import { computeBotMove, chooseBotColor, chooseBotSwapTarget } from "./bot.js";
import { CARD_TYPE, COLOR } from "../../../shared/protocol.js";

const card = (type, color = COLOR.WILD, value = null) => ({ id: id(), type, color, value });
const num  = (color, value) => card(CARD_TYPE.NUMBER, color, value);
let _n = 0; function id() { return ++_n; }

// GameState 형태를 흉내낸 최소 스텁 (bot.js는 canPlay/필드만 사용)
function fakeGame({ hand, topCard, currentColor, pendingDraw = null, others = [] }) {
  const bot = { id: "bot", name: "AI 1", hand, eliminated: false };
  const players = [bot, ...others];
  return {
    topCard, currentColor, pendingDraw,
    playerById: (pid) => players.find(p => p.id === pid),
    get activePlayers() { return players.filter(p => !p.eliminated); },
  };
}

describe("chooseBotColor — 손패에 가장 많은 색", () => {
  test("가장 많은 색을 고른다", () => {
    const hand = [num(COLOR.BLUE, 1), num(COLOR.BLUE, 2), num(COLOR.RED, 3)];
    expect(chooseBotColor(hand)).toBe(COLOR.BLUE);
  });
  test("색 카드가 없으면 RED 기본값", () => {
    expect(chooseBotColor([card(CARD_TYPE.WILD)])).toBe(COLOR.RED);
    expect(chooseBotColor([])).toBe(COLOR.RED);
  });
});

describe("computeBotMove — 일반 턴", () => {
  test("낼 카드가 없으면 draw", () => {
    const g = fakeGame({
      hand: [num(COLOR.BLUE, 9), num(COLOR.GREEN, 8)],
      topCard: num(COLOR.RED, 5), currentColor: COLOR.RED,
    });
    expect(computeBotMove(g, "bot").kind).toBe("draw");
  });

  test("낼 수 있으면 play + 해당 cardId", () => {
    const playable = num(COLOR.RED, 9);
    const g = fakeGame({
      hand: [num(COLOR.BLUE, 8), playable],
      topCard: num(COLOR.RED, 5), currentColor: COLOR.RED,
    });
    const mv = computeBotMove(g, "bot");
    expect(mv.kind).toBe("play");
    expect(mv.cardId).toBe(playable.id);
  });

  test("와일드를 낼 때는 chosenColor를 손패 최다색으로 지정", () => {
    const wild = card(CARD_TYPE.WILD_DRAW_FOUR);
    const g = fakeGame({
      hand: [wild, num(COLOR.GREEN, 1), num(COLOR.GREEN, 2)],
      topCard: num(COLOR.RED, 5), currentColor: COLOR.RED,
    });
    const mv = computeBotMove(g, "bot");
    expect(mv.kind).toBe("play");
    expect(mv.chosenColor).toBe(COLOR.GREEN);
  });

  test("드로우 중첩 대기 중 — 받아넘길 수 있는 최저파워 드로우 카드 선택", () => {
    const d2 = card(CARD_TYPE.DRAW_TWO, COLOR.RED);
    const d6 = card(CARD_TYPE.WILD_DRAW_SIX);
    const g = fakeGame({
      hand: [d6, d2, num(COLOR.RED, 5)],
      topCard: card(CARD_TYPE.DRAW_TWO, COLOR.RED), currentColor: COLOR.RED,
      pendingDraw: { count: 2, sourceType: CARD_TYPE.DRAW_TWO },
    });
    const mv = computeBotMove(g, "bot");
    expect(mv.kind).toBe("play");
    expect(mv.cardId).toBe(d2.id); // +6 대신 +2를 아껴 소모
  });

  test("드로우 중첩 대기 중 받아넘길 카드 없으면 draw(강제 수령)", () => {
    const g = fakeGame({
      hand: [num(COLOR.RED, 5), card(CARD_TYPE.SKIP, COLOR.RED)],
      topCard: card(CARD_TYPE.DRAW_TWO, COLOR.RED), currentColor: COLOR.RED,
      pendingDraw: { count: 2, sourceType: CARD_TYPE.DRAW_TWO },
    });
    expect(computeBotMove(g, "bot").kind).toBe("draw");
  });
});

describe("chooseBotSwapTarget — 손패 가장 적은 상대", () => {
  test("가장 적은 손패를 가진 상대를 고른다", () => {
    const g = fakeGame({
      hand: [num(COLOR.RED, 1)], topCard: num(COLOR.RED, 5), currentColor: COLOR.RED,
      others: [
        { id: "a", hand: [1, 2, 3, 4], eliminated: false },
        { id: "b", hand: [1, 2], eliminated: false },
      ],
    });
    expect(chooseBotSwapTarget(g, "bot")).toBe("b");
  });
});
