import React from 'react';
import { CARD_TYPE, COLOR } from '../../../shared/protocol.js';

const PALETTE = {
  red:    { bg: '#c0392b', light: '#e74c3c', dark: '#922b21', text: '#fff', border: '#ff6b6b' },
  green:  { bg: '#1e8449', light: '#27ae60', dark: '#145a32', text: '#fff', border: '#58d68d' },
  blue:   { bg: '#1a5276', light: '#2980b9', dark: '#154360', text: '#fff', border: '#5dade2' },
  yellow: { bg: '#d4ac0d', light: '#f1c40f', dark: '#b7950b', text: '#1a1a1a', border: '#f7dc6f' },
  wild:   { bg: '#6c3483', light: '#8e44ad', dark: '#4a235a', text: '#fff', border: '#bb8fce' },
};

const SIZE = {
  sm: { w: 40,  h: 58,  font: 13, badge: 9  },
  md: { w: 56,  h: 80,  font: 18, badge: 11 },
  lg: { w: 72,  h: 104, font: 24, badge: 13 },
};

function cardInfo(card) {
  switch (card.type) {
    case CARD_TYPE.NUMBER:                 return { label: String(card.value), sub: subForNum(card.value) };
    case CARD_TYPE.SKIP:                   return { label: '⊞', sub: 'SKIP' };
    case CARD_TYPE.REVERSE:                return { label: '⇄', sub: 'REV' };
    case CARD_TYPE.DRAW_TWO:               return { label: '+2', sub: 'DRAW' };
    case CARD_TYPE.WILD:                   return { label: '★', sub: 'WILD' };
    case CARD_TYPE.WILD_DRAW_FOUR:         return { label: '+4', sub: 'WILD' };
    case CARD_TYPE.WILD_REVERSE_DRAW_FOUR: return { label: '↺+4', sub: 'WILD' };
    case CARD_TYPE.WILD_DRAW_SIX:          return { label: '+6', sub: 'WILD' };
    case CARD_TYPE.WILD_DRAW_TEN:          return { label: '+10', sub: 'WILD' };
    case CARD_TYPE.WILD_COLOR_ROULETTE:    return { label: '🎰', sub: 'RLT' };
    case CARD_TYPE.DISCARD_ALL:            return { label: '🗑', sub: 'ALL' };
    case CARD_TYPE.SKIP_ALL:               return { label: '⏭', sub: 'ALL' };
    default:                               return { label: '?', sub: '' };
  }
}

function subForNum(v) {
  if (v === 0) return 'ROTATE';
  if (v === 7) return 'SWAP';
  if (v === 10) return 'AGAIN';
  return '';
}

export function cardDescription(card) {
  switch (card.type) {
    case CARD_TYPE.SKIP:                   return '다음 사람 스킵';
    case CARD_TYPE.REVERSE:                return '순서 반전';
    case CARD_TYPE.DRAW_TWO:               return '다음 사람 +2장';
    case CARD_TYPE.WILD:                   return '색 변경';
    case CARD_TYPE.WILD_DRAW_FOUR:         return '색 변경 + +4장';
    case CARD_TYPE.WILD_REVERSE_DRAW_FOUR: return '순서반전 + +4장';
    case CARD_TYPE.WILD_DRAW_SIX:          return '색 변경 + +6장';
    case CARD_TYPE.WILD_DRAW_TEN:          return '색 변경 + +10장';
    case CARD_TYPE.WILD_COLOR_ROULETTE:    return '다음 사람이 색 선택 후 손패 공개';
    case CARD_TYPE.DISCARD_ALL:            return '같은 색 카드 전부 버리기';
    case CARD_TYPE.SKIP_ALL:               return '전원 스킵, 본인 한 번 더';
    case CARD_TYPE.NUMBER:
      if (card.value === 0) return '전원 손패 돌리기';
      if (card.value === 7) return '원하는 사람과 손패 교환';
      if (card.value === 10) return '본인 한 번 더 진행';
      return String(card.value);
    default: return '';
  }
}

function isDrawAttack(card) {
  return [CARD_TYPE.DRAW_TWO, CARD_TYPE.WILD_DRAW_FOUR, CARD_TYPE.WILD_REVERSE_DRAW_FOUR,
          CARD_TYPE.WILD_DRAW_SIX, CARD_TYPE.WILD_DRAW_TEN].includes(card.type);
}
export default function Card({ card, size = 'md', interactive = false, lifted = false, animPlay = false, animDraw = false }) {
  const p   = PALETTE[card.color] ?? PALETTE.wild;
  const s   = SIZE[size] ?? SIZE.md;
  const inf = cardInfo(card);
  const attack = isDrawAttack(card);
  const animClass = animPlay ? 'animate-card-play' : animDraw ? 'animate-card-draw' : '';

  return (
    <div
      className={[
        'relative rounded-xl select-none overflow-hidden flex-shrink-0 transition-transform duration-150',
        interactive ? 'cursor-pointer hover:brightness-110 active:scale-95' : '',
        lifted ? 'animate-card-lift shadow-2xl' : 'shadow-lg',
        animClass,
        attack ? 'ring-2 ring-red-400/60' : '',
      ].join(' ')}
      style={{ width: s.w, height: s.h, background: `linear-gradient(145deg, ${p.light}, ${p.bg})`, border: `2px solid ${p.border}40` }}
      title={cardDescription(card)}
    >
      <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
        <div className="absolute rounded-full opacity-20"
          style={{ width: s.w * 1.1, height: s.h * 0.7, background: p.dark, transform: 'rotate(-30deg)', top: '15%', left: '-5%' }} />
      </div>

      {card.color === COLOR.WILD && (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-30">
          <div style={{ background: '#e74c3c' }} className="rounded-tl-xl" />
          <div style={{ background: '#2980b9' }} className="rounded-tr-xl" />
          <div style={{ background: '#27ae60' }} className="rounded-bl-xl" />
          <div style={{ background: '#f1c40f' }} className="rounded-br-xl" />
        </div>
      )}

      {attack && <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: 'inset 0 0 8px rgba(239,68,68,0.5)' }} />}

      <div className="absolute top-1 left-1 font-black leading-none" style={{ fontSize: s.badge, color: p.text, opacity: 0.9 }}>{inf.label}</div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black leading-none" style={{ fontSize: s.font, color: p.text, textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>{inf.label}</span>
      </div>

      <div className="absolute bottom-1 right-1 font-black leading-none rotate-180" style={{ fontSize: s.badge, color: p.text, opacity: 0.9 }}>{inf.label}</div>

      {inf.sub && (
        <div className="absolute bottom-3 left-0 right-0 text-center font-bold"
          style={{ fontSize: Math.max(s.badge - 2, 7), color: p.text, opacity: 0.55 }}>{inf.sub}</div>
      )}

      <div className="absolute inset-0 rounded-xl pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
    </div>
  );
}

export function CardBack({ size = 'sm' }) {
  const s = SIZE[size] ?? SIZE.sm;
  return (
    <div className="relative rounded-xl shadow-md flex-shrink-0 overflow-hidden"
      style={{ width: s.w, height: s.h, background: 'linear-gradient(145deg,#1a237e,#283593)', border: '2px solid rgba(255,255,255,0.15)' }}>
      <div className="absolute inset-1 rounded-lg opacity-25"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '6px 6px' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: s.font * 0.65, opacity: 0.45 }}>&#x1F0A0;</span>
      </div>
    </div>
  );
}