# 카드 데스매치 (UNO No Mercy 온라인)

친구들과 즐기는 **UNO No Mercy** PWA 온라인 게임. 앱 스토어 없이 링크만으로 공유 가능.

## Why (만든 이유)

오프라인에서만 즐기던 **UNO No Mercy(데스매치)** 룰을, 멀리 있는 친구들과도 온라인으로 같이 하고 싶어서 시작한 개인 프로젝트.
앱 설치/스토어 심사 없이 **URL 한 줄만 공유하면 바로 플레이**되는 것을 목표로 한다. 모바일에서는 PWA로 홈화면에 추가해 네이티브 앱처럼 쓸 수 있다.

> **UNO No Mercy란?** 일반 UNO에 +6/+10 등 강력한 드로우 카드와 손패 25장 초과 즉시 탈락 룰이 더해진 변형. 손패가 폭발적으로 늘어나고 탈락이 빈번한, 더 공격적인("자비 없는") 버전이다.

## Status

🔵 **프로토타입 — 초기 단계** (마지막 활동: 2026-03-10, 커밋 1개)

핵심 게임 루프(방 생성·참가, 서버 권위 상태머신, 룰 엔진, 클라이언트 UI)가 한 차례 구현된 단계.
아직 실사용 검증·테스트·배포는 이루어지지 않았으며, **앞으로 계속 발전시킬 예정**이다. 동작 안정성은 보장되지 않는다.

### 구현된 것 vs 계획

| 영역 | 상태 |
|------|------|
| 168장 덱 생성 / 룰 엔진(낼 수 있는지 검증, 효과 계산) | 구현됨 (`server/src/game/`) |
| 서버 권위 게임 상태머신 + 방/재접속 토큰 | 구현됨 (`state.js`, `room.js`) |
| WebSocket 실시간 통신 + 메시지 핸들러 | 구현됨 (`ws/handler.js`, `useWebSocket.js`) |
| 클라이언트 화면(홈/대기실/게임/결과) + 카드 UI | 구현됨 (`client/src/components/`) |
| 채팅 · 효과음(Web Audio) · 턴 타이머 · 색상/교환 선택 UI | 구현됨 |
| PWA 설정 (vite-plugin-pwa) | 구현됨 |
| 자동화 테스트 | 없음 (계획) |
| 실서버 배포 / 멀티 디바이스 실사용 검증 | 미완 (계획) |
| 봇/AI 상대, 전적·랭킹 | 미정 (Roadmap) |

> 위 "구현됨"은 코드가 작성되었다는 의미이며, 실전 플레이 검증을 거친 것은 아니다.

## Stack & 구조 (모노레포)

`client` / `server` / `shared` 세 워크스페이스로 구성된 모노레포. `shared/protocol.js`로 클라이언트·서버가 동일한 Action/Event 상수와 카드 타입·설정을 공유한다.

| 영역 | 기술 |
|------|------|
| **서버** | Node.js, Express, `ws` (WebSocket) |
| **클라이언트** | React 18, Vite, Tailwind CSS |
| **상태관리** | Zustand |
| **PWA** | vite-plugin-pwa (Workbox) |
| **사운드** | Web Audio API (외부 파일 없음) |
| **공통** | ES Modules 기반 프로토콜 공유(`shared/`) |

```
uno-deathmatch/
├── package.json                 # 모노레포 루트 (워크스페이스 스크립트)
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

## Run (빠른 시작 — 개발)

```bash
# 의존성 설치 (server + client)
npm run install:all

# 터미널 A — WebSocket 게임 서버
npm run dev:server    # ws://localhost:3001

# 터미널 B — 클라이언트 개발 서버
npm run dev:client    # http://localhost:5173
```

### 배포 (프로덕션)

```bash
# 클라이언트 빌드 후 서버에서 정적 파일 포함 서빙
npm run build
npm start             # http://localhost:3001
```

서버 URL을 친구들에게 공유하면 바로 플레이 가능.
모바일에서 "홈화면에 추가" 하면 네이티브 앱처럼 사용 가능 (PWA).

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | 서버 포트 |
| `VITE_WS_URL` | 자동감지 | WebSocket 서버 URL (개발: `ws://localhost:3001`) |

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

### 카드 종류 (총 168장)

- **숫자 카드** 0–10 (각 색상 2장, 0은 1장)
- **액션 카드**: Skip, Reverse, Draw Two (+2)
- **와일드 카드**: Wild, Wild Draw Four (+4), Wild Draw Six (+6)
- **No Mercy 카드**: Wild Draw Ten (+10), Wild Reverse Draw Four (↺+4), Color Roulette, Discard All, Skip All

## Roadmap (게임 완성을 향한 다음 단계)

1. **실플레이 검증 & 버그 잡기** — 여러 디바이스/브라우저로 한 판 끝까지 돌려 보고 룰 엔진(드로우 중첩·탈락·교환) 엣지 케이스 점검.
2. **룰 엔진 테스트 추가** — `server/src/game/`(rules/state)에 자동화 테스트를 붙여 회귀 방지.
3. **재접속·끊김 처리 강화** — 토큰 재접속을 실네트워크 환경에서 검증하고, 호스트 이탈·전원 이탈 시 방 정리 로직 보강.
4. **실서버 배포** — 친구 공유용으로 실제 호스팅(URL 공유) + HTTPS/WSS 적용.
5. **플레이 경험 개선** — 봇/AI 상대 추가, 전적·간단 랭킹, 관전 모드 등 검토.

---

> 개인 프로젝트입니다. 자유롭게 사용·수정하세요.
