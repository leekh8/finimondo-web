import React, { useState } from 'react';
import { ACTION } from '../../../shared/protocol.js';
import { useGameStore } from '../store/gameStore.js';
import { useWebSocket, requestRoomCode } from '../hooks/useWebSocket.js';
import RulesModal from './RulesModal.jsx';

// 초대 링크(?room=ABC123)로 진입한 경우 방 코드를 읽어 검증한다.
// 유효한 6자리(A-Z0-9)만 통과, 아니면 빈 문자열.
function readRoomFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('room');
    if (!raw) return '';
    const code = raw.trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(code) ? code : '';
  } catch {
    return '';
  }
}

export default function HomeScreen() {
  const [initialRoom]       = useState(readRoomFromUrl);   // 최초 1회만 평가
  const [tab,    setTab]    = useState(initialRoom ? 'join' : 'create');
  const [name,   setName]   = useState('');
  const [roomId, setRoomId] = useState(initialRoom);
  const [maxP,   setMaxP]   = useState(5);
  const [soloTotal, setSoloTotal] = useState(4);   // 사람1 + 봇(soloTotal-1)
  const [showRules, setShowRules] = useState(false);
  const [busy,      setBusy]      = useState(false);

  const { connectAndEmit } = useWebSocket();
  const setMyName  = useGameStore(s => s.setMyName);
  const notify     = useGameStore(s => s.notify);

  // 방마다 서버 인스턴스가 따로 뜨는 구조라, 만들기 전에 방 코드부터 발급받아야 한다.
  async function startNewRoom(n, payload) {
    const room = await requestRoomCode();
    await connectAndEmit(room, ACTION.CREATE_ROOM, { playerName: n, ...payload });
  }

  async function handleSubmit() {
    const n = name.trim();
    if (!n || busy) return;

    setMyName(n);
    setBusy(true);
    try {
      if (tab === 'create') {
        await startNewRoom(n, { maxPlayers: maxP });
      } else if (tab === 'solo') {
        // 사람 1 + 봇(soloTotal-1) — 서버가 봇을 채우고 자동 시작한다
        await startNewRoom(n, { solo: true, botCount: soloTotal - 1 });
      } else {
        const r = roomId.trim().toUpperCase();
        if (!r) return;
        await connectAndEmit(r, ACTION.JOIN_ROOM, { playerName: n, roomId: r });
      }
    } catch (e) {
      notify(e.message || '연결에 실패했습니다', 'error');
    } finally {
      setBusy(false);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      {/* 타이틀 */}
      <div className="text-center select-none">
        <h1 className="text-6xl font-black tracking-tighter drop-shadow-lg">
          <span className="bg-gradient-to-br from-ember via-plasma to-abyss bg-clip-text text-transparent">
            FINIMONDO
          </span>
        </h1>
        <p className="text-white/40 text-sm mt-2 tracking-[0.35em] uppercase">종말의 카드게임</p>
      </div>

      {/* 탭 */}
      <div className="flex bg-white/10 rounded-xl p-1 w-full max-w-sm">
        {[['create','방 만들기'],['solo','혼자 하기'],['join','방 참가']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === t ? 'bg-plasma/80 text-white shadow-neon-plasma' : 'text-white/50 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 폼 */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <input
          className="input"
          placeholder="닉네임 (2~12자)"
          maxLength={12}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />

        {tab === 'create' && (
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
            <label className="text-white/60 text-sm whitespace-nowrap">최대 인원</label>
            <input
              type="range" min={2} max={8} value={maxP}
              onChange={e => setMaxP(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-blue-400 font-black text-lg w-6 text-center">{maxP}</span>
          </div>
        )}

        {tab === 'solo' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <label className="text-white/60 text-sm whitespace-nowrap">AI 포함 인원</label>
              <input
                type="range" min={2} max={8} value={soloTotal}
                onChange={e => setSoloTotal(Number(e.target.value))}
                className="flex-1 accent-plasma"
              />
              <span className="text-plasma font-black text-lg w-6 text-center">{soloTotal}</span>
            </div>
            <p className="text-white/40 text-xs text-center">
              나 1명 + 🤖 AI {soloTotal - 1}명 · 대기 없이 바로 시작
            </p>
          </div>
        )}

        {tab === 'join' && (
          <>
            {initialRoom && (
              <p className="text-green-400/80 text-xs text-center -mb-1">
                초대 링크로 입장 — 닉네임만 입력하면 바로 참가돼요
              </p>
            )}
            <input
              className="input uppercase tracking-[0.4em] text-center text-lg font-bold"
              placeholder="방 코드 6자리"
              maxLength={6}
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              onKeyDown={onKey}
            />
          </>
        )}

        <button
          className="btn-primary w-full py-4 text-lg font-black"
          onClick={handleSubmit}
          disabled={busy || !name.trim() || (tab === 'join' && roomId.trim().length < 6)}
        >
          {busy
            ? '연결 중…'
            : tab === 'create' ? '방 만들기 →' : tab === 'solo' ? '🤖 AI와 시작 →' : '참가하기 →'}
        </button>
      </div>

      <button
        onClick={() => setShowRules(true)}
        className="text-white/50 hover:text-white text-sm font-semibold transition-colors"
      >
        ❓ 규칙 · 카드 설명
      </button>

      <p className="text-white/20 text-xs">
        링크 공유만으로 친구와 바로 플레이
      </p>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
