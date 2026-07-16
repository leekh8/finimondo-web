import React from 'react';
import { CARD_TYPE, COLOR } from '../../../shared/protocol.js';

// 종말 네온 팔레트 — enum(red/green/blue/yellow)은 유지, 렌더 색만 매핑
//   RED→Ember(불) · BLUE→Plasma(번개) · GREEN→Abyss(해일) · YELLOW→Sulfur(독)
const PALETTE = {
  red:    { bg: '#B32E13', light: '#FF4A26', dark: '#7A1E0A', text: '#fff',     border: '#FF7A5C', glow: 'rgba(255,74,38,0.55)'  }, // Ember
  green:  { bg: '#128F84', light: '#23D3C0', dark: '#0B5A53', text: '#04211F',   border: '#6FEDE0', glow: 'rgba(35,211,192,0.5)' }, // Abyss
  blue:   { bg: '#7A28C7', light: '#B24BFF', dark: '#4E1785', text: '#fff',     border: '#CB86FF', glow: 'rgba(178,75,255,0.5)' }, // Plasma
  yellow: { bg: '#93B816', light: '#CBF24B', dark: '#5E7A0A', text: '#1A1A0A',   border: '#DFF77E', glow: 'rgba(203,242,75,0.5)' }, // Sulfur
  wild:   { bg: '#241F30', light: '#3A2F4A', dark: '#141019', text: '#fff',     border: '#B24BFF', glow: 'rgba(178,75,255,0.55)' }, // 다색
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
        attack ? 'ring-2 ring-ember/70' : '',
      ].join(' ')}
      style={{
        width: s.w, height: s.h,
        background: `linear-gradient(145deg, ${p.light}, ${p.bg})`,
        border: `2px solid ${p.border}80`,
        boxShadow: `0 4px 14px -4px rgba(0,0,0,0.6), 0 0 16px -6px ${p.glow}`,
      }}
      title={cardDescription(card)}
    >
      <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
        <div className="absolute rounded-full opacity-20"
          style={{ width: s.w * 1.1, height: s.h * 0.7, background: p.dark, transform: 'rotate(-30deg)', top: '15%', left: '-5%' }} />
      </div>

      {card.color === COLOR.WILD && (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-40">
          <div style={{ background: '#FF4A26' }} className="rounded-tl-xl" /> {/* Ember */}
          <div style={{ background: '#B24BFF' }} className="rounded-tr-xl" /> {/* Plasma */}
          <div style={{ background: '#23D3C0' }} className="rounded-bl-xl" /> {/* Abyss */}
          <div style={{ background: '#CBF24B' }} className="rounded-br-xl" /> {/* Sulfur */}
        </div>
      )}

      {attack && <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: 'inset 0 0 10px rgba(255,74,38,0.6)' }} />}

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
    <div className="relative rounded-xl flex-shrink-0 overflow-hidden"
      style={{
        width: s.w, height: s.h,
        background: 'linear-gradient(145deg,#241F30,#0B0A0F)',
        border: '2px solid rgba(178,75,255,0.35)',
        boxShadow: '0 3px 10px -3px rgba(0,0,0,0.6), 0 0 14px -8px rgba(178,75,255,0.6)',
      }}>
      <div className="absolute inset-1 rounded-lg opacity-20"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg,#B24BFF 0,#B24BFF 1px,transparent 0,transparent 50%)', backgroundSize: '6px 6px' }} />
      <div className="absolute inset-0 flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,74,38,0.18), transparent 65%)' }}>
        <span style={{ fontSize: s.font * 0.65, opacity: 0.5 }}>&#x1F0A0;</span>
      </div>
    </div>
  );
}