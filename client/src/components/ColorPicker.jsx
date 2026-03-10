import React from 'react';
import { COLOR } from '../../../shared/protocol.js';

const COLORS = [
  { key: COLOR.RED,    label: '빨강', bg: 'bg-card-red' },
  { key: COLOR.GREEN,  label: '초록', bg: 'bg-card-green' },
  { key: COLOR.BLUE,   label: '파랑', bg: 'bg-card-blue' },
  { key: COLOR.YELLOW, label: '노랑', bg: 'bg-card-yellow' },
];

export default function ColorPicker({ onChoose, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-8">
      <div className="bg-bg-panel rounded-2xl p-5 w-full max-w-xs">
        <p className="text-center font-bold mb-4">색상을 선택하세요</p>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => onChoose(c.key)}
              className={`${c.bg} py-4 rounded-xl font-bold text-white text-lg
                          active:scale-95 transition-transform`}
            >
              {c.label}
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
