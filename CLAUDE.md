# Taminal

웹 기반 SSH 터미널 클라이언트. 브라우저에서 원격 SSH 서버에 접속하며, 백엔드가 WebSocket↔SSH 브릿지 역할을 수행한다.

## 아키텍처

```
[Browser - apps/client]  ──WebSocket──→  [Server - apps/server]  ←SSH→  [Remote Host]
     xterm.js                              Hono + ssh2
```

- **apps/client** — TanStack Start (React 19) + xterm.js 기반 터미널 UI
- **apps/server** — Hono + ssh2 기반 WebSocket↔SSH 브릿지, Docker 배포
- **packages/protocol** — 공유 WebSocket 메시지 타입

## 모노레포 구조

```
taminal/
├── apps/
│   ├── client/          # 프론트엔드 (TanStack Start + React)
│   └── server/          # 백엔드 (Hono + ssh2)
├── packages/
│   └── protocol/        # WebSocket 메시지 타입 공유
├── pnpm-workspace.yaml
└── turbo.json
```

## 기술 스택

| 영역                  | 기술                                                       |
| --------------------- | ---------------------------------------------------------- |
| 패키지 매니저         | pnpm 10                                                    |
| 모노레포              | Turborepo                                                  |
| 프론트엔드 프레임워크 | TanStack Start (React 19)                                  |
| 라우팅                | TanStack Router (file-based)                               |
| 상태 관리             | TanStack Store (`workspaceStore`)                          |
| URL 상태              | nuqs (`useQueryState`)                                     |
| 터미널 에뮬레이터     | @xterm/xterm + addon-fit, addon-unicode11, addon-web-links |
| UI 컴포넌트           | shadcn/ui (new-york style)                                 |
| 모달 관리             | @ebay/nice-modal-react                                     |
| 스타일링              | Tailwind CSS v4                                            |
| 테마                  | One Dark Pro                                               |
| 폰트                  | JetBrainsMono Hangul Nerd Font                             |
| 백엔드                | Hono + @hono/node-server + @hono/node-ws                   |
| SSH                   | ssh2                                                       |
| 영속화                | IndexedDB (idb)                                            |
| 암호화                | Web Crypto API (AES-GCM + PBKDF2)                          |
| ESLint                | @cat-hou-se/eslint-config                                  |
| Prettier              | @cat-hou-se/prettier-config                                |

## 주요 명령어

```bash
pnpm dev       # 전체 dev 서버 실행
pnpm build     # 전체 빌드
pnpm lint      # 전체 lint
pnpm format    # prettier 포맷팅
pnpm typecheck # 전체 타입체크
```

## 데이터 구조

### 워크스페이스 → 탭 → 터미널 (split)

```
WorkspaceItem { id, name, description }
  └─ TabItem[] { id, name, layout: PaneNode, focusedTerminalId }
       └─ PaneNode (재귀 트리)
            ├─ TerminalPane { type: "terminal", terminalId }
            └─ SplitPane { type: "split", direction, children: [PaneNode, PaneNode] }
```

- `activeWorkspaceId`는 nuqs로 URL에서 관리 (`?workspace=<id>`)
- 워크스페이스/탭/터미널 상태는 TanStack Store (`workspaceStore`)
- IndexedDB에 자동 저장 (debounce 500ms)

### IndexedDB 스토어

| 스토어        | 키          | 값                                                 |
| ------------- | ----------- | -------------------------------------------------- |
| `workspaces`  | workspaceId | { name, description, tabs, terminals (id/name만) } |
| `credentials` | terminalId  | AES-GCM 암호화된 접속 정보                         |
| `profiles`    | profileId   | { name, connectionInfo }                           |

## 프론트엔드 컴포넌트 구조

```
routes/index.tsx          # SidebarProvider + AppSidebar + Workspace
components/
  app-sidebar.tsx          # 워크스페이스 목록, 생성/수정/삭제
  workspace.tsx            # 탭 바 + SplitPane 렌더링, 키보드 단축키
  terminal/
    terminal.tsx           # xterm 컨테이너 (relative + absolute 구조)
    use-terminal.tsx       # xterm 초기화, WS 연결, 키보드 단축키
    split-pane.tsx         # 재귀 분할 렌더링 (ResizablePanelGroup)
  ssh-dialog.tsx           # SSH 접속 다이얼로그 + 프로필 선택
  create-workspace-dialog.tsx
  edit-workspace-dialog.tsx
  confirm-dialog.tsx       # 삭제 확인 다이얼로그
```

## 키보드 단축키

| 단축키        | 동작                          |
| ------------- | ----------------------------- |
| `Cmd+D`       | 오른쪽으로 split (horizontal) |
| `Cmd+Shift+D` | 아래로 split (vertical)       |
| `Cmd+T`       | 새 탭                         |
| `Cmd+B`       | 사이드바 토글                 |

- 단축키는 `term.attachCustomKeyEventHandler`로 xterm 레벨에서 처리
- `e.key.toLowerCase()` + `e.shiftKey`로 Shift 조합 판별

## 백엔드 (apps/server)

### WebSocket 메시지 프로토콜

```typescript
// Client → Server
{ type: "connect", host, port, username, password?, privateKey?, cols?, rows? }
{ type: "attach", sessionId }
{ type: "resize", cols, rows }
{ type: "detach" }
// raw string → SSH stdin

// Server → Client
{ type: "connected", sessionId }
{ type: "attached", sessionId }
{ type: "error", message }
{ type: "disconnected", reason? }
// raw string ← SSH stdout
```

### SSH 세션 영속성

- SSH 세션은 WebSocket과 독립적 수명
- WS 끊김 시 세션 유지, `SESSION_TIMEOUT_MS` (기본 5분) 후 자동 정리
- 스크롤백 버퍼 보관 (1MB), 재연결 시 재생

### REST API

```
GET  /health              # 서버 상태
GET  /api/sessions        # 활성 세션 목록
DELETE /api/sessions/:id  # 세션 강제 종료
```

## xterm.js 관련 주의사항

- CJS 모듈이므로 SSR 환경에서 `import()` dynamic import 필수
- `allowProposedApi: true` 필요 (Unicode11Addon)
- `term.unicode.activeVersion = "11"`
- DA 응답 (`\x1b[?1;2c`) 필터링 필요 — `onData`에서 `/^\x1b\[\?[\d;]*c$/` 패턴 차단
- `U+FFFD` (replacement character) 필터링 — `writeToTerminal`에서 제거
- FitAddon 무한 루프 방지: container를 `relative` + `absolute inset-0` 2중 div로 감싸고, ResizeObserver는 outer div(parentElement) 관찰
- `connectToServer`는 `requestAnimationFrame` 후 호출하여 레이아웃 안정 후 정확한 cols/rows 전달
- `onData`/`onResize` 콜백에서 `connectedRef.current` 확인 후에만 데이터 전송

## shadcn/ui 컴포넌트 규칙

- `import * as React from "react"` 사용 금지 → named import 사용 (`import type { ComponentProps } from "react"`)
- 새 shadcn 컴포넌트 설치 후 반드시 React import 수정 필요
- 모달은 `@ebay/nice-modal-react`의 `NiceModal.create()` + `NiceModal.show()` 패턴 사용
- `NiceModal.Provider`는 `__root.tsx`에 설정됨

## 코딩 컨벤션

- 주석/커밋 메시지/답변은 한국어
- opacity 기반 색상 (`text-foreground/60`) 대신 시맨틱 토큰 (`text-muted-foreground`) 사용
- WCAG AA 대비 기준 (4.5:1) 준수
- 최소 폰트 크기 12px (`text-xs` 이상)
