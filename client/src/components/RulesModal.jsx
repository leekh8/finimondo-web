import React from 'react';
import { CARD_TYPE } from '../../../shared/protocol.js';
import Card from './Card.jsx';

// 특수 카드 안내 — 효과는 server/src/game/rules.js(computeEffects)·cards.js 로직과 1:1 일치.
// 테마명(Italian)은 종말 플레이버, 실제 효과는 코드 기준.
const SPECIALS = [
  { sample: { type: CARD_TYPE.SKIP,    color: 'red',    value: null }, name: 'Salto',        en: 'Skip',        eff: '다음 사람 한 명을 건너뜁니다.' },
  { sample: { type: CARD_TYPE.REVERSE, color: 'blue',   value: null }, name: 'Inverti',      en: 'Reverse',     eff: '진행 방향을 반전합니다. (2인 플레이 시 스킵처럼 동작)' },
  { sample: { type: CARD_TYPE.DRAW_TWO,color: 'green',  value: null }, name: 'Pesca 2',      en: 'Draw Two',    eff: '다음 사람이 2장을 뽑습니다.' },
  { sample: { type: CARD_TYPE.NUMBER,  color: 'yellow', value: 0    }, name: 'Rotazione',    en: 'Number 0',    eff: '전원이 손패를 진행 방향으로 한 칸씩 넘깁니다.' },
  { sample: { type: CARD_TYPE.NUMBER,  color: 'red',    value: 7    }, name: 'Scambio',      en: 'Number 7',    eff: '원하는 상대와 손패를 통째로 교환합니다.' },
  { sample: { type: CARD_TYPE.NUMBER,  color: 'blue',   value: 10   }, name: 'Ancora',       en: 'Number 10',   eff: '본인이 한 번 더 진행합니다.' },
  { sample: { type: CARD_TYPE.WILD,              color: 'wild', value: null }, name: 'Caos',          en: 'Wild',            eff: '원하는 색으로 바꿉니다.' },
  { sample: { type: CARD_TYPE.WILD_DRAW_FOUR,    color: 'wild', value: null }, name: 'Cataclisma 4',  en: 'Wild Draw 4',     eff: '색을 바꾸고, 다음 사람이 4장을 뽑습니다.' },
  { sample: { type: CARD_TYPE.WILD_REVERSE_DRAW_FOUR, color: 'wild', value: null }, name: 'Inverti Caos', en: 'Wild Reverse +4', eff: '색을 바꾸고, 방향을 반전하며, 다음 사람이 4장을 뽑습니다.' },
  { sample: { type: CARD_TYPE.WILD_DRAW_SIX,     color: 'wild', value: null }, name: 'Cataclisma 6',  en: 'Wild Draw 6',     eff: '색을 바꾸고, 다음 사람이 6장을 뽑습니다.' },
  { sample: { type: CARD_TYPE.WILD_DRAW_TEN,     color: 'wild', value: null }, name: 'Cataclisma 10', en: 'Wild Draw 10',    eff: '색을 바꾸고, 다음 사람이 10장을 뽑습니다.' },
  { sample: { type: CARD_TYPE.WILD_COLOR_ROULETTE, color: 'wild', value: null }, name: 'Roulette',    en: 'Color Roulette',  eff: '다음 사람이 색을 정하고 손패를 공개하며, 그 사람은 스킵됩니다.' },
  { sample: { type: CARD_TYPE.DISCARD_ALL, color: 'green',  value: null }, name: 'Purga',         en: 'Discard All', eff: '손에서 이 카드와 같은 색 카드를 전부 버립니다.' },
  { sample: { type: CARD_TYPE.SKIP_ALL,    color: 'yellow', value: null }, name: 'Apocalisse',    en: 'Skip All',    eff: '본인을 제외한 전원을 스킵하고, 본인이 한 번 더 진행합니다.' },
];

function Section({ title, accent, children }) {
  return (
    <section className="mb-5">
      <h3 className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: accent }}>{title}</h3>
      {children}
    </section>
  );
}

export default function RulesModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-bg-panel shadow-2xl animate-bounce-in"
        style={{ scrollbarWidth: 'thin' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 (sticky) */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-bg-panel/95 backdrop-blur border-b border-white/10">
          <h2 className="text-lg font-black">
            <span className="bg-gradient-to-r from-ember via-plasma to-abyss bg-clip-text text-transparent">Finimondo</span>
            <span className="text-white/50 text-sm font-semibold ml-2">규칙 안내</span>
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-4">
          {/* 목표 */}
          <Section title="목표" accent="#FF4A26">
            <p className="text-sm text-white/80 leading-relaxed">
              손패를 가장 먼저 <b className="text-white">0장</b>으로 비우면 <b className="text-ember">승리</b>합니다.
              손패가 <b className="text-white">25장</b>을 초과하면 즉시 <b className="text-ember">탈락</b>. 최후의 생존자도 승리합니다.
            </p>
          </Section>

          {/* 진행 */}
          <Section title="턴 진행" accent="#B24BFF">
            <ul className="text-sm text-white/80 leading-relaxed space-y-1.5 list-disc pl-5">
              <li>버린 더미 맨 위 카드와 <b className="text-white">같은 색</b> 또는 <b className="text-white">같은 숫자·기호</b>의 카드를 냅니다.</li>
              <li>낼 카드가 없으면 <b className="text-white">덱</b>에서 1장을 뽑습니다.</li>
              <li><b className="text-plasma">와일드</b> 카드는 언제든 낼 수 있고, 낸 뒤 색을 지정합니다.</li>
              <li>제한 시간 <b className="text-white">25초</b> (10초 남으면 경고).</li>
            </ul>
          </Section>

          {/* 조작 */}
          <Section title="조작법" accent="#23D3C0">
            <ul className="text-sm text-white/80 leading-relaxed space-y-1.5 list-disc pl-5">
              <li>손패 카드를 <b className="text-white">탭</b> → 선택(위로 올라옴), <b className="text-white">다시 탭</b> → 내기.</li>
              <li>가운데 <b className="text-white">덱을 탭</b> → 카드 뽑기.</li>
              <li>와일드를 내면 <b className="text-white">색 선택</b> 창이 뜹니다.</li>
              <li>숫자 7은 교환 상대를, 룰렛은 색을 고르는 창이 뜹니다.</li>
            </ul>
          </Section>

          {/* 드로우 중첩 */}
          <Section title="드로우 중첩" accent="#CBF24B">
            <p className="text-sm text-white/80 leading-relaxed">
              드로우 카드를 받으면 <b className="text-white">동급 이상</b>의 드로우 카드로 받아넘길 수 있습니다.
              넘길 카드가 없으면 누적된 장수를 모두 뽑습니다.
            </p>
            <p className="text-xs text-white/50 mt-1.5 font-mono">순서:  +2 &lt; +4 ≤ ↺+4 &lt; +6 &lt; +10</p>
          </Section>

          {/* 특수 카드 */}
          <Section title="특수 카드" accent="#FF4A26">
            <div className="flex flex-col gap-2">
              {SPECIALS.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="flex-shrink-0">
                    <Card card={{ id: `rule-${i}`, ...s.sample }} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight">
                      {s.name} <span className="text-white/40 font-normal text-xs">· {s.en}</span>
                    </p>
                    <p className="text-xs text-white/70 leading-snug mt-0.5">{s.eff}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <button onClick={onClose} className="btn-primary w-full py-3 mt-1">닫기</button>
        </div>
      </div>
    </div>
  );
}
