# 카드 데스매치 (UNO No Mercy 온라인)

친구들과 즐기는 UNO No Mercy PWA 온라인 게임. 앱 스토어 없이 링크만으로 공유 가능.

## 빠른 시작 (개발)

```bash
# 의존성 설치
npm run install:all

# 터미널 A — WebSocket 게임 서버
npm run dev:server    # ws://localhost:3001

# 터미널 B — 클라이언트 개발 서버
npm run dev:client    # http://localhost:5173
```

## 배포 (프로덕션)

```bash
# 클라이언트 빌드 후 서버에서 정적 파일 포함 서빙
npm run build
npm start             # http://localhost:3001
```

서버 URL을 친구들에게 공유하면 바로 플레이 가능.
모바일에서 "홈화면에 추가" 하면 네이티브 앱처럼 사용 가능 (PWA).

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 멀티플레이** | WebSocket 기반, 서버 권위 방식 |
| **방 초대 코드** | 6자리 코드로 친구 초대 |
| **재접속 지원** | 토큰 기반으로 끊겨도 복귀 가능 |
| **인게임 채팅** | 실시간 채팅 + 시스템 메시지 |
| **카드 애니메이션** | 카드 낼 때/드로우 시 애니메이션 |
| **효과음** | Web Audio API 합성음 (외부 파일 없음) |
| **턴 타이머** | 25초, 10초 남으면 경고음 |
| **PWA 설치** | iOS/Android 홈화면 추가 지원 |

## 게임 룰 (UNO No Mercy 공식)

| 규칙 | 내용 |
|------|------|
| **탈락** | 손패 25장 초과 시 즉시 탈락 |
| **승리** | 손패 0장 또는 최후 생존자 |
| **드로우 중첩** | 동급↑ 카드로 받아넘기기 가능 |
| **중첩 순서** | +2 < +4 ≤ ↺+4 < +6 < +10 |
| **챌린지** | 없음 (와일드 언제든 가능) |
| **0카드** | 전원 손패 순방향으로 돌리기 |
| **7카드** | 원하는 사람과 손패 교환 |
| **10카드** | 본인 한 번 더 진행 |
| **턴 타임** | 25초 (10초 남으면 경고, 0초 → 자동 드로우) |

## 카드 종류 (총 168장)

- **숫자 카드** 0–10 (각 색상 2장, 0은 1장)
- **액션 카드**: Skip, Reverse, Draw Two (+2)
- **와일드 카드**: Wild, Wild Draw Four (+4), Wild Draw Six (+6)
- **No Mercy 카드**: Wild Draw Ten (+10), Wild Reverse Draw Four (↺+4), Color Roulette, Discard All, Skip All

## 프로젝트 구조

```
uno-deathmatch/
├── shared/
│   └── protocol.js              # Action/Event 상수, 카드 타입, 설정 공유
├── server/
│   └── src/
│       ├── game/
│       │   ├── cards.js         # 덱 생성 (168장)
│       │   ├── rules.js         # 룰 엔진 (낼 수 있는지 검증, 효과 계산)
│       │   ├── state.js         # 게임 상태머신 (서버 권위)
│       │   └── room.js          # 방 생성/참가/관리 + 토큰 재접속
│       ├── ws/
│       │   └── handler.js       # WebSocket 메시지 핸들러
│       └── index.js             # 서버 진입점 (Express + WS)
└── client/
    └── src/
        ├── store/
        │   └── gameStore.js          # Zustand 전역 상태
        ├── hooks/
        │   ├── useWebSocket.js       # WS 연결 + 이벤트 디스패치 + 자동 재접속
        │   └── useSound.js           # Web Audio API 합성 효과음 (15종)
        └── components/
            ├── HomeScreen.jsx        # 방 만들기 / 초대코드로 참가
            ├── LobbyScreen.jsx       # 대기실 (플레이어 목록, 시작 버튼)
            ├── GameScreen.jsx        # 게임 메인 화면
            ├── Card.jsx              # 카드 컴포넌트 (그라디언트 디자인)
            ├── ChatBox.jsx           # 인게임 채팅 (플로팅 패널)
            ├── TurnTimer.jsx         # 25초 카운트다운
            ├── ColorPicker.jsx       # 와일드 색상 선택
            ├── SwapPicker.jsx        # 7카드 교환 대상 선택
            ├── ResultScreen.jsx      # 게임 결과 화면
            └── Notification.jsx      # 토스트 알림
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | 서버 포트 |
| `VITE_WS_URL` | 자동감지 | WebSocket 서버 URL (개발: `ws://localhost:3001`) |

## 기술 스택

| 영역 | 기술 |
|------|------|
| **서버** | Node.js, Express, `ws` (WebSocket) |
| **클라이언트** | React 18, Vite, Tailwind CSS |
| **상태관리** | Zustand |
| **PWA** | vite-plugin-pwa (Workbox) |
| **사운드** | Web Audio API (외부 파일 없음) |
