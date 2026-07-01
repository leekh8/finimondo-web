import React, { useState, useEffect, useRef } from 'react';
import { ACTION, COLOR, CARD_TYPE } from '../../../shared/protocol.js';
import { useGameStore } from '../store/gameStore.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useSound } from '../hooks/useSound.js';
import Card, { CardBack } from './Card.jsx';
import TurnTimer from './TurnTimer.jsx';
import ColorPicker from './ColorPicker.jsx';
import SwapPicker from './SwapPicker.jsx';
import ChatBox from './ChatBox.jsx';

const COLOR_DOT = {
  red: 'bg-red-500', green: 'bg-green-500',
  blue: 'bg-blue-500', yellow: 'bg-yellow-400', wild: 'bg-purple-500',
};

export default function GameScreen() {
  const { emit }        = useWebSocket();
  const { play }        = useSound();
  const game            = useGameStore(s => s.game);
  const lastAction      = useGameStore(s => s.lastAction);
  const myId            = useGameStore(s => s.myId);
  const soundEnabled    = useGameStore(s => s.soundEnabled);
  const toggleSound     = useGameStore(s => s.toggleSound);
  const selectedCardId  = useGameStore(s => s.selectedCardId);
  const selectCard      = useGameStore(s => s.selectCard);
  const deselectCard    = useGameStore(s => s.deselectCard);
  const chatUnread      = useGameStore(s => s.chatUnread);
  const openChat        = useGameStore(s => s.openChat);

  const [showColorPicker,  setShowColorPicker]  = useState(false);
  const [pendingCardId,    setPendingCardId]     = useState(null);
  const [playingCardId,    setPlayingCardId]     = useState(null);
  const [drawAnim,         setDrawAnim]          = useState(false);

  const prevTurnId = useRef(null);
  const prevHandLen = useRef(null);

  if (!game) return (
    <div className="flex items-center justify-center h-full text-white/40">
      게임 로딩 중...
    </div>
  );

  const me       = game.players.find(p => p.id === myId);
  const myHand   = me?.hand ?? [];
  const isMyTurn = game.currentPlayerId === myId;
  const alive    = game.players.filter(p => !p.eliminated);
  const others   = alive.filter(p => p.id !== myId);

  // 내 차례 사운드
  useEffect(() => {
    if (isMyTurn && prevTurnId.current !== game.currentPlayerId) {
      play('myTurn');
    }
    prevTurnId.current = game.currentPlayerId;
  }, [game.currentPlayerId]);

  // 카드 뇽기 사운드 + 애니
  useEffect(() => {
    if (!me) return;
    if (prevHandLen.current !== null && me.hand.length > prevHandLen.current) {
      play('drawCard');
      setDrawAnim(true);
      setTimeout(() => setDrawAnim(false), 400);
    }
    prevHandLen.current = me.hand.length;
  }, [myHand.length]);

  // 카드 내기 / 공격 사운드
  useEffect(() => {
    if (!lastAction?.topCard) return;
    const card = lastAction.topCard;
    const isAttack = [
      CARD_TYPE.DRAW_TWO, CARD_TYPE.WILD_DRAW_FOUR,
      CARD_TYPE.WILD_REVERSE_DRAW_FOUR, CARD_TYPE.WILD_DRAW_SIX, CARD_TYPE.WILD_DRAW_TEN,
    ].includes(card.type);

    if (lastAction.actorId === myId) return;
    if (isAttack) play('attackCard');
    else if (card.type === CARD_TYPE.SKIP || card.type === CARD_TYPE.SKIP_ALL) play('skip');
    else if (card.type === CARD_TYPE.REVERSE || card.type === CARD_TYPE.WILD_REVERSE_DRAW_FOUR) play('rotate');
    else play('playCard');
  }, [lastAction]);

  // UNO 경고 (손패 1장)
  useEffect(() => {
    if (myHand.length === 1) play('uno');
  }, [myHand.length]);

  function handleCardClick(card) {
    if (!isMyTurn || game.waitingFor) return;
    if (selectedCardId === card.id) {
      playSelectedCard(card);
    } else {
      selectCard(card.id);
    }
  }

  function playSelectedCard(card) {
    const needsColor = card.color === COLOR.WILD && card.type !== CARD_TYPE.WILD_COLOR_ROULETTE;
    if (needsColor) {
      setPendingCardId(card.id);
      setShowColorPicker(true);
      deselectCard();
      return;
    }
    submitPlayCard(card.id, null);
  }

  function submitPlayCard(cardId, chosenColor) {
    play('playCard');
    setPlayingCardId(cardId);
    setTimeout(() => setPlayingCardId(null), 400);
    emit(ACTION.PLAY_CARD, { cardId, chosenColor });
    deselectCard();
  }

  function onColorChosen(color) {
    submitPlayCard(pendingCardId, color);
    play('colorChosen');
    setShowColorPicker(false);
    setPendingCardId(null);
  }

  function handleDraw() {
    if (!isMyTurn || game.waitingFor) return;
    emit(ACTION.DRAW_CARD, {});
  }

  const dangerLevel = me ? (me.handCount >= 20 ? 'critical' : me.handCount >= 15 ? 'warn' : 'ok') : 'ok';
  return (
    <div className="flex flex-col h-full select-none overflow-hidden">

      {/*  상단: 상대방 패 */}
      <div className="flex justify-around items-start px-2 pt-2 gap-1 flex-wrap">
        {others.map(p => {
          const isCurrent = p.id === game.currentPlayerId;
          return (
            <div key={p.id}
              className={[
                'flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all',
                isCurrent ? 'bg-yellow-400/20 ring-1 ring-yellow-400' : '',
                p.eliminated ? 'opacity-40' : '',
              ].join(' ')}
            >
              <div className={['w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                p.eliminated ? 'bg-white/10' : isCurrent ? 'bg-yellow-500' : 'bg-purple-600'].join(' ')}>
                {p.eliminated ? '💀' : p.name[0]}
              </div>
              <span className={['text-xs max-w-[56px] truncate', p.eliminated ? 'line-through text-white/30' : 'text-white/80'].join(' ')}>
                {p.name}
              </span>
              <div className="flex flex-wrap justify-center gap-0.5 max-w-[72px]">
                {Array.from({ length: Math.min(p.handCount, 7) }).map((_, i) => (
                  <CardBack key={i} size="sm" />
                ))}
                {p.handCount > 7 && <span className="text-white/40 text-[10px] self-center">+{p.handCount - 7}</span>}
              </div>
              <span className={['text-xs font-bold',
                p.handCount >= 20 ? 'text-red-400 animate-pulse' : p.handCount <= 1 ? 'text-yellow-400' : 'text-white/50'].join(' ')}>
                {p.handCount}장
                {p.handCount === 1 && ' UNO!'}
              </span>
            </div>
          );
        })}
      </div>

      {/* 중앙: 덱 + 버린 카드 */}
      <div className="flex-1 flex items-center justify-center gap-6 relative">
        <div className={['absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white/30 shadow-md',
          COLOR_DOT[game.currentColor] ?? 'bg-white/20'].join(' ')} />

        <div className="absolute top-1 right-3 text-white/40 text-xs">
          {game.direction === 1 ? '→ 순방향' : '← 역방향'}
        </div>

        <button
          onClick={handleDraw}
          disabled={!isMyTurn || !!game.waitingFor}
          className={[
            'relative transition-transform duration-150 active:scale-95 disabled:opacity-40',
            isMyTurn && !game.waitingFor ? 'hover:scale-105 cursor-pointer' : 'cursor-default',
          ].join(' ')}
        >
          <CardBack size="lg" />
          {game.pendingDraw && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce-in whitespace-nowrap">
              +{game.pendingDraw.count}장!
            </div>
          )}
        </button>

        <div className="relative">
          {game.topCard && (
            <Card
              card={game.topCard}
              size="lg"
              animPlay={!!lastAction?.topCard}
            />
          )}
        </div>
      </div>

      {isMyTurn && !game.waitingFor && (
        <TurnTimer startedAt={game.turnStartedAt} limit={25} onWarn={() => play('timerWarn')} />
      )}

      <div className="px-3 py-1 text-center text-xs min-h-[18px]">
        {isMyTurn && !game.waitingFor && (
          <span className="text-yellow-400 font-bold animate-fade-in">
            내 차례 — 카드 탭 후 다시 탭해서 냕니다
          </span>
        )}
        {isMyTurn && game.waitingFor === 'swap' && (
          <span className="text-orange-400 font-bold">교환할 플레이어를 선택하세요</span>
        )}
        {isMyTurn && game.waitingFor === 'color' && (
          <span className="text-purple-400 font-bold">색을 선택하세요</span>
        )}
        {!isMyTurn && (
          <span className="text-white/40">
            {game.players.find(p => p.id === game.currentPlayerId)?.name ?? ''}의 차례...
          </span>
        )}
      </div>

      <div>
        {dangerLevel !== 'ok' && me && (
          <div className={['text-center text-xs font-bold py-0.5 animate-pulse',
            dangerLevel === 'critical' ? 'text-red-400' : 'text-yellow-400'].join(' ')}>
          {dangerLevel === 'critical'
            ? `⚠️ ${me.handCount}장 — ${25 - me.handCount}장 더 받으면 탈락!`
            : `${me.handCount}장 — 주의 필요!`}
          </div>
        )}
        {myHand.length === 1 && (
          <div className="text-center text-yellow-400 font-black text-sm animate-bounce">
            UNO!
          </div>
        )}
        <div className="flex overflow-x-auto gap-1.5 px-2 pb-4 pt-1" style={{ scrollbarWidth: 'none' }}>
          {myHand.map((card, idx) => {
            const isSelected = selectedCardId === card.id;
            const isPlaying  = playingCardId  === card.id;
            const isNew      = drawAnim && idx === myHand.length - 1;
            return (
              <div
                key={card.id}
                className={['flex-shrink-0 transition-transform duration-150',
                  isSelected ? '-translate-y-4' : '',
                ].join(' ')}
                onClick={() => handleCardClick(card)}
              >
                <Card
                  card={card}
                  size="md"
                  interactive={isMyTurn && !game.waitingFor}
                  lifted={isSelected}
                  animPlay={isPlaying}
                  animDraw={isNew}
                />
              </div>
            );
          })}
          {myHand.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm py-6">
              손패 없음
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <button onClick={toggleSound}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-all"
          title={soundEnabled ? '소리 끌기' : '소리 켜기'}>
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {showColorPicker && (
        <ColorPicker onChoose={onColorChosen} onCancel={() => { setShowColorPicker(false); setPendingCardId(null); }} />
      )}

      {isMyTurn && game.waitingFor === 'swap' && (
        <SwapPicker
          players={game.players.filter(p => p.id !== myId && !p.eliminated)}
          onChoose={id => { play('swap'); emit(ACTION.CHOOSE_SWAP, { targetId: id }); }}
        />
      )}

      {game.waitingFor === 'roulette_color' && game.rouletteTargetId === myId && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-bg-panel rounded-2xl p-6 w-full max-w-xs text-center animate-bounce-in">
            <p className="text-2xl mb-1">🎰</p>
            <p className="font-bold mb-1">콜러 룰렛!</p>
            <p className="text-white/60 text-sm mb-4">
              {game.players.find(p => p.id === game.currentPlayerId)?.name}의 공격.<br/>
              당신이 색을 선택합니다.
            </p>
            <ColorPicker onChoose={color => { play('colorChosen'); emit(ACTION.CHOOSE_COLOR, { color }); }} />
          </div>
        </div>
      )}

      <ChatBox />
    </div>
  );
}
