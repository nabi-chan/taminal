import { serve } from "@hono/node-server"
import { createNodeWebSocket } from "@hono/node-ws"
import { Hono } from "hono"
import { cors } from "hono/cors"

import { SessionManager } from "./session-manager"
import { createWsHandler } from "./ws-handler"

const PORT = Number(process.env.PORT ?? 3001)
const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS ?? 5 * 60 * 1000)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*"

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })
const sessionManager = new SessionManager(SESSION_TIMEOUT_MS)

// CORS
app.use(
  "*",
  cors({
    origin: CORS_ORIGIN,
    allowMethods: ["GET", "DELETE", "OPTIONS"],
  }),
)

// 헬스체크
app.get("/health", (c) => c.json({ status: "ok", sessions: sessionManager.list().length }))

// 활성 세션 목록
app.get("/api/sessions", (c) => c.json(sessionManager.list()))

// 세션 강제 종료
app.delete("/api/sessions/:id", (c) => {
  const id = c.req.param("id")
  const session = sessionManager.get(id)
  if (!session) {
    return c.json({ error: "세션을 찾을 수 없음" }, 404)
  }
  sessionManager.remove(id)
  return c.json({ ok: true })
})

// WebSocket 엔드포인트
app.get(
  "/ws",
  upgradeWebSocket(() => {
    const handler = createWsHandler(sessionManager)
    // upgradeWebSocket은 WSEvents를 반환해야 함
    // handler는 WSContext를 받아 WSEvents를 반환하는 팩토리
    // 하지만 @hono/node-ws의 upgradeWebSocket은 (c) => WSEvents 형태
    // WSContext는 onOpen에서 제공됨
    let wsHandler: ReturnType<typeof handler> | null = null

    return {
      onOpen(_event, ws) {
        wsHandler = handler(ws)
      },
      onMessage(event, ws) {
        if (!wsHandler) wsHandler = handler(ws)
        wsHandler.onMessage(event as MessageEvent)
      },
      onClose() {
        wsHandler?.onClose()
      },
      onError() {
        wsHandler?.onError()
      },
    }
  }),
)

const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Taminal 서버 시작: http://localhost:${PORT}`)
})

injectWebSocket(server)
