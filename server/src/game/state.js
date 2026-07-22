import { createDeck, shuffle } from './cards.js';
import { canPlay, computeEffects, isEliminated, needsColorChoice } from './rules.js';
import { COLOR, CARD_TYPE, CONFIG, GAME_STATUS, ERROR_CODE } from '../../../shared/protocol.js';

/**
 * GameState — 서버 권위(authoritative) 게임 상태머신
 */
export class GameState {
  constructor(players) {
    this.status    = GAME_STATUS.LOBBY;
    this.players   = players.map((p, i) => ({
      id:        p.id,
      name:      p.name,
      hand:      [],
      connected: true,
      order:     i,
      eliminated: false,
      isBot:     p.isBot ?? false,
    }));
    this.deck         = [];
    this.discardPile  = [];
    this.direction    = 1;       // 1: 순방향, -1: 역방향
    this.turnIndex    = 0;       // activePlayers 기준 인덱스
    this.pendingDraw  = null;    // { count, sourceType }  드로우 중첩 대기
    this.waitingFor   = null;    // 'color' | 'swap' | 'roulette_color'
    this.rouletteTargetId = null;
    this.currentColor = null;    // 와일드 후 지정 색
    this.winnerId     = null;
    this.log          = [];
    this.turnStartedAt = null;
  }

  // ─────────────────────────────────────────────
  //  헬퍼
  // ─────────────────────────────────────────────
  get activePlayers() {
    return this.players.filter(p => !p.eliminated);
  }

  get currentPlayer() {
    return this.activePlayers[this.turnIndex % this.activePlayers.length];
  }

  get topCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  playerById(id) {
    return this.players.find(p => p.id === id);
  }

  _nextIndex(delta = 1) {
    const n = this.activePlayers.length;
    return ((this.turnIndex + this.direction * delta) % n + n) % n;
  }

  _advanceTurn(delta = 1) {
    this.turnIndex = this._nextIndex(delta);
    this.turnStartedAt = Date.now();
  }

  _replenishDeck() {
    if (this.deck.length < 5 && this.discardPile.length > 1) {
      const top = this.discardPile.pop();
      // 남아 있던 덱을 버린 더미와 "합쳐서" 섞는다.
      // 종전에는 this.deck = shuffle(this.discardPile) 로 대입해버려,
      // 보충 시점에 덱에 남아 있던 카드(최대 4장)가 매번 조용히 소멸했다.
      // 긴 판에서 카드가 계속 줄어 덱이 마르고, _drawCards의 break 때문에
      // 뽑기가 실패해도 아무 신호 없이 넘어가던 원인.
      this.deck = shuffle([...this.discardPile, ...this.deck]);
      this.discardPile = [top];
    }
  }

  _drawCards(player, count) {
    this._replenishDeck();
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) break;
      drawn.push(this.deck.pop());
    }
    player.hand.push(...drawn);
    return drawn;
  }

  _checkElimination(player) {
    if (!player.eliminated && isEliminated(player)) {
      player.eliminated = true;
      this._log(`💀 ${player.name} 탈락! (${player.hand.length}장)`);
      return true;
    }
    return false;
  }

  _checkWin() {
    const alive = this.activePlayers;
    if (alive.length === 1) {
      this.winnerId = alive[0].id;
      this.status   = GAME_STATUS.ENDED;
      return true;
    }
    // 손패 소진으로 승리
    const winner = this.players.find(p => !p.eliminated && p.hand.length === 0);
    if (winner) {
      this.winnerId = winner.id;
      this.status   = GAME_STATUS.ENDED;
      return true;
    }
    return false;
  }

  _log(msg) {
    this.log.push({ ts: Date.now(), msg });
    if (this.log.length > 100) this.log.shift();
  }

  // ─────────────────────────────────────────────
  //  게임 시작
  // ─────────────────────────────────────────────
  start() {
    this.deck   = createDeck();
    this.status = GAME_STATUS.PLAYING;

    // 각 플레이어에게 7장씩 배분
    for (const p of this.players) {
      this._drawCards(p, CONFIG.INITIAL_HAND_SIZE);
    }

    // 첫 버린 카드 (숫자 카드가 나올 때까지)
    let startCard;
    do {
      startCard = this.deck.pop();
      if (startCard.color === COLOR.WILD) {
        this.deck.unshift(startCard); // 맨 아래로
      }
    } while (startCard.color === COLOR.WILD);

    this.discardPile = [startCard];
    this.currentColor = startCard.color;
    this.turnIndex    = 0;
    this.turnStartedAt = Date.now();

    this._log('🎮 게임 시작!');
  }

  // ─────────────────────────────────────────────
  //  카드 내기
  // ─────────────────────────────────────────────
  playCard(playerId, cardId, chosenColor = null) {
    if (this.status !== GAME_STATUS.PLAYING) return err('게임 중이 아닙니다');
    if (this.waitingFor)                      return err('선택 대기 중입니다');

    const player = this.playerById(playerId);
    if (!player || player.eliminated)         return err('플레이어 없음');
    if (this.currentPlayer.id !== playerId)   return errCode(ERROR_CODE.NOT_YOUR_TURN);

    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1)                       return errCode(ERROR_CODE.INVALID_CARD);

    const card = player.hand[cardIdx];

    if (!canPlay(card, this.topCard, this.currentColor, this.pendingDraw))
      return errCode(ERROR_CODE.INVALID_CARD, '낼 수 없는 카드입니다');

    // 손패에서 제거
    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);

    const fx = computeEffects(card, this.direction, this.pendingDraw);

    // 방향 전환
    if (fx.directionFlip) this.direction *= -1;

    // 현재 색 업데이트
    if (!needsColorChoice(card)) {
      this.currentColor = card.color === COLOR.WILD ? this.currentColor : card.color;
    }

    // 드로우 중첩 초기화 후 새 중첩 설정
    if (fx.drawCount > 0) {
      this.pendingDraw = {
        count:      fx.stackedDrawCount,
        sourceType: fx.sourceType,
      };
    } else {
      this.pendingDraw = null;
    }

    this._log(`${player.name}: ${card.type}(${card.color}) 사용`);

    // ── 특수 효과 처리 ─────────────────────────
    let events = [];

    // 0: 전원 손패 돌리기
    if (fx.rotateNeeded) {
      this._rotateHands();
      events.push({ type: 'rotateHands' });
      this._advanceTurn(1);
      return ok(events);
    }

    // 7: 손패 교환 선택
    if (fx.swapNeeded) {
      this.waitingFor = 'swap';
      events.push({ type: 'swapChoiceNeeded' });
      return ok(events);
    }

    // 모두 버리기
    if (fx.discardAll) {
      const color = card.color;
      const discarded = player.hand.filter(c => c.color === color);
      player.hand = player.hand.filter(c => c.color !== color);
      discarded.forEach(c => this.discardPile.push(c));
      this.currentColor = color;
      events.push({ type: 'discardAll', color, count: discarded.length });
      this._advanceTurn(1);
      if (this._checkWin()) events.push({ type: 'gameOver' });
      return ok(events);
    }

    // 모두 스킵 (본인 한 번 더)
    if (fx.skipAll) {
      events.push({ type: 'skipAll' });
      // turnIndex 유지 = extraTurn 처럼
      this.turnStartedAt = Date.now();
      return ok(events);
    }

    // 10: 한 번 더
    if (fx.extraTurn) {
      events.push({ type: 'extraTurn' });
      this.turnStartedAt = Date.now();
      return ok(events);
    }

    // 색 선택 대기 (와일드)
    if (fx.colorChoiceNeeded) {
      if (chosenColor && Object.values(COLOR).includes(chosenColor) && chosenColor !== COLOR.WILD) {
        this.currentColor = chosenColor;
      } else {
        this.waitingFor = 'color';
        events.push({ type: 'colorChoiceNeeded' });
        return ok(events);
      }
    }

    // 컬러 룰렛
    if (fx.colorRoulette) {
      const targetIdx = this._nextIndex(1);
      const target = this.activePlayers[targetIdx];
      this.rouletteTargetId = target.id;
      this.waitingFor = 'roulette_color';
      events.push({ type: 'colorRoulette', targetId: target.id, hand: target.hand });
      return ok(events);
    }

    // 다음 사람에게 드로우 강제 (중첩이 해소되지 않은 경우)
    if (fx.drawCount > 0) {
      // 다음 사람이 받아넘기지 못하면 나중에 drawCard 에서 처리
      events.push({ type: 'drawPending', count: this.pendingDraw.count });
    }

    this._advanceTurn(fx.nextTurnDelta);

    if (this._checkWin()) events.push({ type: 'gameOver' });
    else if (this._checkElimination(player)) {
      events.push({ type: 'eliminated', playerId: player.id });
      // 탈락 후 턴 재조정
      if (this.activePlayers.length > 0) {
        this.turnIndex = this.turnIndex % this.activePlayers.length;
      }
      this._checkWin() && events.push({ type: 'gameOver' });
    }

    return ok(events);
  }

  // ─────────────────────────────────────────────
  //  색 선택 (와일드 후)
  // ─────────────────────────────────────────────
  chooseColor(playerId, color) {
    if (!this.waitingFor?.includes('color')) return err('색 선택이 필요하지 않습니다');

    const isRoulette = this.waitingFor === 'roulette_color';
    // 룰렛은 공격받는 대상(다음 사람)이, 일반 와일드는 현재 플레이어가 색을 정한다
    const chooserId = isRoulette ? this.rouletteTargetId : this.currentPlayer.id;
    if (chooserId !== playerId) return errCode(ERROR_CODE.NOT_YOUR_TURN);
    if (!Object.values(COLOR).includes(color) || color === COLOR.WILD)
      return err('유효하지 않은 색');

    this.currentColor = color;
    this.waitingFor   = null;

    const events = [{ type: 'colorChosen', color }];

    if (isRoulette) {
      // 룰렛: 색 정한 사람(다음 사람) 손패 공개 후 스킵
      const target = this.playerById(this.rouletteTargetId);
      events.push({ type: 'revealHand', targetId: target.id, hand: target.hand });
      this.rouletteTargetId = null;
      this._advanceTurn(2);  // 색 정한 사람(다음 사람)을 건너뛴다
    } else {
      // 일반 와일드: 바로 다음 사람이 currentPlayer가 됨.
      // 드로우 카드였다면 그 사람이 pendingDraw를 받는다(건너뛰지 않음).
      this._advanceTurn(1);
    }

    this._checkWin() && events.push({ type: 'gameOver' });
    return ok(events);
  }

  // ─────────────────────────────────────────────
  //  손패 교환 (숫자 7)
  // ─────────────────────────────────────────────
  chooseSwap(playerId, targetId) {
    if (this.currentPlayer.id !== playerId) return errCode(ERROR_CODE.NOT_YOUR_TURN);
    if (this.waitingFor !== 'swap')          return err('교환 선택이 필요하지 않습니다');

    const player = this.playerById(playerId);
    const target = this.playerById(targetId);
    if (!target || target.eliminated)        return err('대상 플레이어가 없습니다');

    [player.hand, target.hand] = [target.hand, player.hand];
    this.waitingFor = null;
    this._log(`🔄 ${player.name} ↔ ${target.name} 손패 교환`);

    this._advanceTurn(1);
    return ok([{ type: 'swapDone', fromId: playerId, toId: targetId }]);
  }

  // ─────────────────────────────────────────────
  //  카드 뽑기
  // ─────────────────────────────────────────────
  drawCard(playerId) {
    if (this.status !== GAME_STATUS.PLAYING) return err('게임 중이 아닙니다');
    if (this.waitingFor)                      return err('선택 대기 중입니다');
    if (this.currentPlayer.id !== playerId)   return errCode(ERROR_CODE.NOT_YOUR_TURN);

    const player = this.playerById(playerId);
    let events = [];

    if (this.pendingDraw && this.pendingDraw.count > 0) {
      // 중첩 뽑기 강제 적용
      const count = this.pendingDraw.count;
      this._drawCards(player, count);
      this.pendingDraw = null;
      events.push({ type: 'drewPending', count });
    } else {
      // 일반 뽑기 1장
      const drawn = this._drawCards(player, 1);
      events.push({ type: 'drew', count: 1, cards: drawn });
    }

    // 탈락 체크
    if (this._checkElimination(player)) {
      events.push({ type: 'eliminated', playerId: player.id });
      if (this.activePlayers.length > 0) {
        this.turnIndex = this.turnIndex % this.activePlayers.length;
      }
    }

    if (this._checkWin()) {
      events.push({ type: 'gameOver' });
    } else {
      this._advanceTurn(1);
    }

    return ok(events);
  }

  // ─────────────────────────────────────────────
  //  자동 패스 (타임아웃)
  // ─────────────────────────────────────────────
  autoPass(playerId) {
    if (this.currentPlayer?.id !== playerId) return;
    this._log(`⏱ ${this.currentPlayer.name} 타임아웃 자동 처리`);
    // 드로우 중첩이 있으면 강제 뽑기, 없으면 1장 뽑고 패스
    return this.drawCard(playerId);
  }

  // ─────────────────────────────────────────────
  //  손패 돌리기 (숫자 0)
  // ─────────────────────────────────────────────
  _rotateHands() {
    const alive = this.activePlayers;
    if (this.direction === 1) {
      // 순방향
      const last = alive[alive.length - 1].hand;
      for (let i = alive.length - 1; i > 0; i--) {
        alive[i].hand = alive[i - 1].hand;
      }
      alive[0].hand = last;
    } else {
      // 역방향
      const first = alive[0].hand;
      for (let i = 0; i < alive.length - 1; i++) {
        alive[i].hand = alive[i + 1].hand;
      }
      alive[alive.length - 1].hand = first;
    }
  }

  // ─────────────────────────────────────────────
  //  재접속용 스냅샷 (본인 손패만 포함)
  // ─────────────────────────────────────────────
  snapshot(forPlayerId) {
    return {
      status:        this.status,
      direction:     this.direction,
      currentColor:  this.currentColor,
      topCard:       this.topCard,
      pendingDraw:   this.pendingDraw,
      waitingFor:    this.waitingFor,
      currentPlayerId: this.currentPlayer?.id,
      rouletteTargetId: this.rouletteTargetId,
      turnStartedAt: this.turnStartedAt,
      winnerId:      this.winnerId,
      players: this.players.map(p => ({
        id:         p.id,
        name:       p.name,
        handCount:  p.hand.length,
        eliminated: p.eliminated,
        connected:  p.connected,
        isBot:      p.isBot ?? false,
        // 본인 손패만 전체 공개
        hand:       p.id === forPlayerId ? p.hand : undefined,
      })),
    };
  }
}

// ─── helpers ───
function ok(events = [])       { return { ok: true, events }; }
function err(message)          { return { ok: false, error: { message } }; }
function errCode(code, message = code) { return { ok: false, error: { code, message } }; }
