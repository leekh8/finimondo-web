import React, { useState } from 'react';
import { ACTION } from '../../../shared/protocol.js';
import { useGameStore } from '../store/gameStore.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import RulesModal from './RulesModal.jsx';

export default function LobbyScreen() {
  const [showRules, setShowRules] = useState(false);
  const { emit }       = useWebSocket();
  const roomId         = useGameStore(s => s.roomId);
  const isHost         = useGameStore(s => s.isHost);
  const myId           = useGameStore(s => s.myId);
  const lobbyPlayers   = useGameStore(s => s.lobbyPlayers);
  const maxPlayers     = useGameStore(s => s.maxPlayers);
  const notify         = useGameStore(s => s.notify);

  function copyCode() {
    navigator.clipboard.writeText(roomId)
      .then(() => notify('방 코드를 복사했어요', 'info'))
      .catch(() => notify('복사에 실패했어요', 'error'));
  }

  function copyInviteLink() {
    const base = import.meta.env.BASE_URL || '/';
    const link = `${window.location.origin}${base}?room=${roomId}`;
    navigator.clipboard.writeText(link)
      .then(() => notify('초대 링크를 복사했어요', 'info'))
      .catch(() => notify('복사에 실패했어요', 'error'));
  }

  function startGame() {
    emit(ACTION.START_GAME, {});
  }

  const canStart = isHost && lobbyPlayers.length >= 2;

  return (
    <div className="flex flex-col items-center h-full px-6 py-8 gap-6">
      {/* 방 코드 */}
      <div className="text-center">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-1">방 코드</p>
        <button
          onClick={copyCode}
          className="text-4xl font-black tracking-[0.3em] bg-gradient-to-r from-ember to-sulfur bg-clip-text text-transparent hover:brightness-110 transition-all"
        >
          {roomId}
        </button>
        <p className="text-white/30 text-xs mt-1">탭하면 복사됩니다</p>
        <button
          onClick={copyInviteLink}
          className="mt-3 inline-flex items-center gap-1.5 bg-plasma/15 hover:bg-plasma/30
                     text-plasma text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          🔗 초대 링크 복사
        </button>
      </div>

      {/* 플레이어 목록 */}
      <div className="w-full max-w-sm flex-1">
        <p className="text-white/50 text-xs uppercase mb-3">
          참가자 {lobbyPlayers.length} / {maxPlayers}
        </p>
        <div className="flex flex-col gap-2">
          {lobbyPlayers.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl
                ${p.id === myId ? 'bg-plasma/20 border border-plasma/50' : 'bg-white/5'}`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember to-plasma
                              flex items-center justify-center font-bold text-sm">
                {i + 1}
              </div>
              <span className="font-semibold">{p.name}</span>
              {i === 0 && <span className="ml-auto text-xs bg-sulfur/20 text-sulfur px-2 py-0.5 rounded-full">HOST</span>}
              {p.id === myId && <span className="ml-auto text-xs text-plasma">나</span>}
            </div>
          ))}
          {/* 빈 슬롯 */}
          {Array.from({ length: maxPlayers - lobbyPlayers.length }).map((_, i) => (
            <div key={`empty-${i}`}
              className="p-3 rounded-xl border border-dashed border-white/10 text-white/20 text-sm text-center">
              대기 중...
            </div>
          ))}
        </div>
      </div>

      {/* 시작 버튼 */}
      {isHost ? (
        <button
          className="btn-primary w-full max-w-sm py-4 text-lg"
          onClick={startGame}
          disabled={!canStart}
        >
          {canStart ? '게임 시작!' : `최소 2명 필요 (${lobbyPlayers.length}/2)`}
        </button>
      ) : (
        <div className="text-white/40 text-sm">호스트가 시작할 때까지 대기 중...</div>
      )}

      <button
        onClick={() => setShowRules(true)}
        className="text-white/50 hover:text-white text-sm font-semibold transition-colors"
      >
        ❓ 규칙 · 카드 설명
      </button>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
