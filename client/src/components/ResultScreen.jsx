import React from 'react';
import { useGameStore } from '../store/gameStore.js';
import { ACTION } from '../../../shared/protocol.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

export default function ResultScreen() {
  const game   = useGameStore(s => s.game);
  const myId   = useGameStore(s => s.myId);
  const reset  = useGameStore(s => s.reset);
  const roomId = useGameStore(s => s.roomId);
  const { emit } = useWebSocket();

  const winner = game?.players?.find(p => p.id === game.winnerId);
  const isWinner = game?.winnerId === myId;

  // 순위 정렬 (탈락 순서는 없으므로 생존자 → 탈락자 순)
  const ranked = game?.players ? [...game.players].sort((a, b) => {
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    return 0;
  }) : [];

  function goHome() {
    reset();
  }

  function playAgain() {
    // 같은 방으로 로비로 복귀 (서버에서 방을 재사용)
    // 현재 구현에서는 홈으로 가서 새 방 생성
    reset();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
      {/* 결과 헤더 */}
      <div className="text-center">
        <div className="text-6xl mb-2">{isWinner ? '🏆' : '💀'}</div>
        <h1 className="text-3xl font-black tracking-tight">
          {isWinner
            ? <span className="bg-gradient-to-r from-ember via-sulfur to-abyss bg-clip-text text-transparent">최후의 생존</span>
            : <span className="text-white/70">종말...</span>}
        </h1>
        {winner && (
          <p className="text-white/60 mt-1">
            {isWinner ? '축하합니다!' : `${winner.name}가 승리했습니다`}
          </p>
        )}
      </div>

      {/* 순위표 */}
      <div className="w-full max-w-sm bg-white/5 rounded-2xl overflow-hidden">
        <div className="px-4 py-2 text-xs text-white/40 uppercase">최종 순위</div>
        {ranked.map((p, i) => (
          <div key={p.id}
            className={`flex items-center gap-3 px-4 py-3 border-t border-white/10
              ${p.id === myId ? 'bg-plasma/15' : ''}`}
          >
            <span className="text-lg font-black w-6 text-center">
              {p.id === game?.winnerId ? '🥇' : p.eliminated ? '💀' : `${i + 1}`}
            </span>
            <span className="flex-1 font-semibold">{p.name}</span>
            <span className="text-white/40 text-sm">{p.handCount}장</span>
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div className="flex gap-3 w-full max-w-sm">
        <button className="btn-ghost flex-1 py-3" onClick={goHome}>
          홈으로
        </button>
        <button className="btn-primary flex-1 py-3" onClick={playAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
