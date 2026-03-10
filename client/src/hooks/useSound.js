/**
 * useSound — Web Audio API 기반 효과음 (외부 파일 불필요)
 * 모든 사운드는 oscillator + gain 조합으로 합성
 */
import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';

let ctx = null;

function getCtx() {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // 브라우저 자동재생 정책: 사용자 인터랙션 후 resume
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, type, duration, volume = 0.3, startTime = 0) {
  const c   = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startTime);
  gain.gain.setValueAtTime(volume, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);

  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration + 0.05);
}

function noise(duration, volume = 0.15) {
  const c      = getCtx();
  const size   = c.sampleRate * duration;
  const buffer = c.createBuffer(1, size, c.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  source.connect(gain);
  gain.connect(c.destination);
  source.start();
  source.stop(c.currentTime + duration);
}

// ── 효과음 정의 ─────────────────────────────────────────

const SOUNDS = {
  /** 카드 내기 — 짧고 경쾌한 클릭 */
  playCard: () => {
    tone(600, 'sine', 0.07, 0.25);
    tone(900, 'sine', 0.05, 0.15, 0.05);
  },

  /** 카드 뽑기 — 살짝 둔탁한 소리 */
  drawCard: () => {
    tone(250, 'triangle', 0.12, 0.2);
    noise(0.08, 0.1);
  },

  /** 공격 카드 (드로우 계열) — 긴장감 있는 하강 */
  attackCard: () => {
    tone(400, 'sawtooth', 0.05, 0.2);
    tone(300, 'sawtooth', 0.1,  0.2, 0.05);
    tone(200, 'sawtooth', 0.12, 0.2, 0.12);
  },

  /** 손패 교환 (7카드) — 위로 올라가는 느낌 */
  swap: () => {
    tone(400, 'sine', 0.08, 0.2);
    tone(600, 'sine', 0.08, 0.2, 0.08);
    tone(800, 'sine', 0.08, 0.2, 0.16);
  },

  /** 전원 손패 돌리기 (0카드) — 회전 느낌 */
  rotate: () => {
    [1, 0.9, 0.8, 0.7, 0.6].forEach((r, i) => {
      tone(500 * r, 'sine', 0.08, 0.15, i * 0.07);
    });
  },

  /** 스킵 — 짧은 단음 두 번 */
  skip: () => {
    tone(700, 'square', 0.05, 0.12);
    tone(700, 'square', 0.05, 0.12, 0.09);
  },

  /** 색 선택 완료 — 밝고 긍정적 */
  colorChosen: () => {
    tone(523, 'sine', 0.1, 0.2);
    tone(659, 'sine', 0.1, 0.2, 0.1);
  },

  /** 내 차례 — 알림 ping */
  myTurn: () => {
    tone(880, 'sine', 0.15, 0.25);
    tone(1046,'sine', 0.1,  0.2, 0.12);
  },

  /** 타이머 경고 (10초) — 빠른 비프 */
  timerWarn: () => {
    tone(880, 'square', 0.06, 0.15);
    tone(440, 'square', 0.06, 0.15, 0.08);
  },

  /** 탈락 — 짧은 하강 불협화음 */
  eliminated: () => {
    tone(300, 'sawtooth', 0.3, 0.3);
    tone(180, 'sawtooth', 0.3, 0.25, 0.1);
    tone(100, 'sawtooth', 0.3, 0.2, 0.22);
    noise(0.3, 0.08);
  },

  /** 승리 — 짧은 팡파르 */
  win: () => {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => tone(f, 'sine', 0.18, 0.3, i * 0.13));
    tone(1046, 'sine', 0.4, 0.35, notes.length * 0.13);
  },

  /** 패배 — 처지는 음 */
  lose: () => {
    tone(440, 'sawtooth', 0.2, 0.2);
    tone(349, 'sawtooth', 0.2, 0.2, 0.2);
    tone(262, 'sawtooth', 0.3, 0.2, 0.42);
  },

  /** UNO! (손패 1장) — 짧은 경보 */
  uno: () => {
    tone(1200, 'square', 0.08, 0.3);
    tone(1000, 'square', 0.08, 0.3, 0.1);
    tone(1400, 'square', 0.12, 0.35, 0.2);
  },

  /** 채팅 수신 — 부드러운 팝 */
  chat: () => {
    tone(880, 'sine', 0.06, 0.12);
  },
};

export function useSound() {
  const soundEnabled = useGameStore(s => s.soundEnabled);

  const play = useCallback((name) => {
    if (!soundEnabled) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try { fn(); } catch { /* 브라우저 제한 등 무시 */ }
  }, [soundEnabled]);

  return { play };
}
