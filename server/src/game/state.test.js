import { describe, it, expect } from 'vitest';
import { Room } from './room.js';
import { computeBotMove, chooseBotColor, chooseBotSwapTarget } from './bot.js';

/** 판 위의 카드 총량 — 어떤 수를 두든 절대 변하지 않아야 한다 */
function totalCards(game) {
  return game.players.reduce((n, p) => n + p.hand.length, 0)
       + game.deck.length + game.discardPile.length;
}

function pendingActorId(game) {
  if (game.waitingFor === 'roulette_color') return game.rouletteTargetId;
  return game.currentPlayer?.id ?? null;
}

function botStep(game, actorId) {
  const actor = game.playerById(actorId);
  if (game.waitingFor === 'swap') return game.chooseSwap(actorId, chooseBotSwapTarget(game, actorId));
  if (game.waitingFor?.includes('color')) return game.chooseColor(actorId, chooseBotColor(actor.hand));
  const move = computeBotMove(game, actorId);
  return move.kind === 'play'
    ? game.playCard(actorId, move.cardId, move.chosenColor ?? null)
    : game.drawCard(actorId);
}

function newAutoGame() {
  const room = new Room('p1', '규주', 4);
  room.addBot('AI 1'); room.addBot('AI 2'); room.addBot('AI 3');
  room.startGame('p1');
  room.game.players.forEach(p => { p.isBot = true; });
  return room.game;
}

describe('덱 보충', () => {
  it('덱에 남아 있던 카드를 버리지 않는다', () => {
    // 회귀 방지: _replenishDeck이 shuffle(discardPile)을 "대입"하던 시절,
    // 보충 시점에 덱에 남아 있던 카드(최대 4장)가 매번 조용히 사라졌다.
    const game = newAutoGame();
    const before = totalCards(game);

    // 덱을 고갈 직전까지 밀어넣어 보충을 강제한다
    game.discardPile.push(...game.deck.splice(0, game.deck.length - 4));
    expect(game.deck.length).toBe(4);

    game._replenishDeck();
    expect(totalCards(game)).toBe(before);
    expect(game.deck.length).toBeGreaterThan(4);
  });
});

describe('게임 전체 진행', () => {
  it('완주할 때까지 카드 총량이 보존된다 (20판)', () => {
    for (let i = 0; i < 20; i++) {
      const game = newAutoGame();
      const base = totalCards(game);
      let moves = 0;

      while (game.status === 'playing' && moves < 3000) {
        const actorId = pendingActorId(game);
        let r = botStep(game, actorId);
        if (!r?.ok && !game.waitingFor) r = game.drawCard(actorId);
        expect(r?.ok, `${moves}수째 진행 불가`).toBe(true);
        expect(totalCards(game), `${moves}수째 카드 총량 변화`).toBe(base);
        moves++;
      }

      expect(game.status).toBe('ended');
      expect(game.winnerId).toBeTruthy();
    }
  });
});

describe('직렬화 (Durable Object 최면 대비)', () => {
  it('JSON 왕복 후에도 게임이 그대로 이어진다', () => {
    const room = new Room('p1', '규주', 4);
    room.addBot('AI 1');
    room.startGame('p1');
    room.game.players.forEach(p => { p.isBot = true; });

    const before = totalCards(room.game);
    const restored = Room.fromJSON(JSON.parse(JSON.stringify(room)));

    expect(totalCards(restored.game)).toBe(before);
    expect(restored.playerById('p1').token).toHaveLength(32);
    expect(restored.game.currentPlayer.id).toBe(room.game.currentPlayer.id);
    // 프로토타입이 복원돼 메서드가 살아 있어야 한다
    expect(typeof restored.game.playCard).toBe('function');
    expect(restored.game.snapshot('p1').players).toHaveLength(2);
  });
});
