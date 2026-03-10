import React from 'react';

export default function SwapPicker({ players, onChoose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-8">
      <div className="bg-bg-panel rounded-2xl p-5 w-full max-w-xs">
        <p className="text-center font-bold mb-1">🔄 손패 교환</p>
        <p className="text-center text-white/50 text-sm mb-4">교환할 플레이어를 선택하세요</p>
        <div className="flex flex-col gap-2">
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => onChoose(p.id)}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20
                         active:scale-95 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">
                {p.name[0]}
              </div>
              <span className="font-semibold">{p.name}</span>
              <span className="ml-auto text-white/50 text-sm">{p.handCount}장</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
