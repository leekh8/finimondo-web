import React, { useState, useRef, useEffect } from 'react';
import { ACTION } from '../../../shared/protocol.js';
import { useGameStore } from '../store/gameStore.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

export default function ChatBox() {
  const [input, setInput]   = useState('');
  const messagesRef         = useRef(null);
  const { emit }            = useWebSocket();
  const chatMessages        = useGameStore(s => s.chatMessages);
  const chatOpen            = useGameStore(s => s.chatOpen);
  const chatUnread          = useGameStore(s => s.chatUnread);
  const openChat            = useGameStore(s => s.openChat);
  const closeChat           = useGameStore(s => s.closeChat);
  const myId                = useGameStore(s => s.myId);

  useEffect(() => {
    if (chatOpen && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  function send() {
    const msg = input.trim();
    if (!msg) return;
    emit(ACTION.CHAT, { message: msg });
    setInput('');
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') closeChat();
  }

  return (
    <>
      {/* 토글 버튼 */}
      {!chatOpen && (
        <button
          onClick={openChat}
          className="fixed bottom-4 right-4 z-40 w-12 h-12 bg-blue-600 rounded-full shadow-xl
                     flex items-center justify-center text-xl hover:bg-blue-500 active:scale-95 transition-all"
        >
          {chatUnread > 0
            ? <span className="relative">
                💬
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold
                                  w-4 h-4 rounded-full flex items-center justify-center">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              </span>
            : '💬'
          }
        </button>
      )}

      {/* 채팅창 */}
      {chatOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-72 flex flex-col rounded-2xl overflow-hidden shadow-2xl
                        border border-white/10 bg-bg-panel animate-slide-up"
             style={{ maxHeight: '50vh' }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-2 bg-bg-card">
            <span className="text-sm font-bold">채팅</span>
            <button onClick={closeChat} className="text-white/50 hover:text-white text-lg">&times;</button>
          </div>

          {/* 메시지 목록 */}
          <div ref={messagesRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-[120px]"
            style={{ scrollbarWidth: 'thin' }}
          >
            {chatMessages.length === 0 && (
              <p className="text-white/30 text-xs text-center mt-4">아직 메시지가 없습니다.</p>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={msg.system ? 'text-center' : ''}>
                {msg.system ? (
                  <span className="text-white/40 text-xs">{msg.message}</span>
                ) : (
                  <div className={['flex gap-2', msg.playerId === myId ? 'flex-row-reverse' : ''].join(' ')}>
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5">
                      {msg.name[0]}
                    </div>
                    <div className={['max-w-[80%]', msg.playerId === myId ? 'items-end' : 'items-start', 'flex flex-col'].join(' ')}>
                      {msg.playerId !== myId && (
                        <span className="text-white/50 text-[10px] mb-0.5">{msg.name}</span>
                      )}
                      <div className={['px-2 py-1 rounded-xl text-sm break-words',
                        msg.playerId === myId ? 'bg-blue-600 rounded-tr-none' : 'bg-white/10 rounded-tl-none'].join(' ')}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 입력창 */}
          <div className="flex gap-2 px-3 py-2 border-t border-white/10">
            <input
              className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none
                         focus:ring-1 focus:ring-blue-400 placeholder:text-white/30"
              placeholder="메시지 입력..."
              maxLength={80}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              autoFocus
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 rounded-lg text-sm font-bold active:scale-95 transition-all"
            >
              &rarr;
            </button>
          </div>
        </div>
      )}
    </>
  );
}