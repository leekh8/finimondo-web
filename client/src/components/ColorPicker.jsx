import React from 'react';
import { COLOR } from '../../../shared/protocol.js';

// 표시 색(네온 팔레트)과 일치하는 라벨 — 내부 enum은 RED/GREEN/BLUE/YELLOW 유지
const COLORS = [
  { key: COLOR.RED,    label: '엠버',   sub: '불',   bg: 'bg-card-red',    text: 'text-white' },
  { key: COLOR.GREEN,  label: '심연',   sub: '해일', bg: 'bg-card-green',  text: 'text-black' },
  { key: COLOR.BLUE,   label: '플라즈마', sub: '번개', bg: 'bg-card-blue',   text: 'text-white' },
  { key: COLOR.YELLOW, label: '유황',   sub: '독',   bg: 'bg-card-yellow', text: 'text-black' },
];

export default function ColorPicker({ onChoose, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-8">
      <div className="bg-bg-panel rounded-2xl p-5 w-full max-w-xs border border-white/10">
        <p className="text-center font-bold mb-4">색을 선택하세요</p>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => onChoose(c.key)}
              className={`${c.bg} ${c.text} py-4 rounded-xl font-black text-lg
                          active:scale-95 hover:brightness-110 transition-all`}
            >
              {c.label}
              <span className="block text-[11px] font-semibold opacity-70">{c.sub}</span>
            </button>
          ))}
        </div>
        {onCancel && (
          <button onClick={onCancel}
            className="w-full mt-3 text-white/40 text-sm py-2">
            취소
          </button>
        )}
      </div>
    </div>
  );
}
