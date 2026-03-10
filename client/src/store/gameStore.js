import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // ── 씬 ──────────────────────────────────────────────────
  scene: 'home',  // 'home' | 'lobby' | 'game' | 'result'

  // ── 내 정보 ─────────────────────────────────────────────
  myId:    null,
  myToken: null,
  myName:  '',
  isHost:  false,

  // ── 방 ──────────────────────────────────────────────────
  roomId:       null,
  maxPlayers:   5,
  lobbyPlayers: [],

  // ── 게임 상태 ────────────────────────────────────────────
  game:       null,
  lastAction: null,   // { actorId, topCard, events } — 애니메이션 트리거

  // ── 채팅 ─────────────────────────────────────────────────
  chatMessages: [],   // [{ playerId, name, message, ts, system }]
  chatUnread:   0,
  chatOpen:     false,

  // ── UI ───────────────────────────────────────────────────
  selectedCardId: null,
  notification:   null,   // { msg, type }
  soundEnabled:   true,

  // ── Actions ──────────────────────────────────────────────

  setScene: (scene) => set({ scene }),

  // 이름을 별도로 먼저 저장 (서버 응답 전에 필요)
  setMyName: (name) => set({ myName: name }),

  setMyInfo: (id, name, token, isHost) =>
    set({ myId: id, myName: name, myToken: token, isHost }),

  setRoom: (roomId, maxPlayers, players) =>
    set({ roomId, maxPlayers, lobbyPlayers: players }),

  updateLobbyPlayers: (players) => set({ lobbyPlayers: players }),

  applySnapshot: (state, lastAction = null) =>
    set({ game: state, lastAction }),

  selectCard:   (id) => set({ selectedCardId: id }),
  deselectCard: ()   => set({ selectedCardId: null }),

  addChatMessage: (msg) =>
    set(s => ({
      chatMessages: [...s.chatMessages.slice(-99), msg],
      chatUnread:   s.chatOpen ? 0 : s.chatUnread + (msg.system ? 0 : 1),
    })),

  openChat:  () => set({ chatOpen: true,  chatUnread: 0 }),
  closeChat: () => set({ chatOpen: false }),

  toggleSound: () => set(s => ({ soundEnabled: !s.soundEnabled })),

  notify: (msg, type = 'info') => {
    set({ notification: { msg, type } });
    setTimeout(() => set({ notification: null }), 3000);
  },

  reset: () => set({
    scene: 'home', myId: null, myToken: null, myName: '',
    isHost: false, roomId: null, lobbyPlayers: [],
    game: null, lastAction: null, selectedCardId: null,
    notification: null, chatMessages: [], chatUnread: 0, chatOpen: false,
  }),
}));
