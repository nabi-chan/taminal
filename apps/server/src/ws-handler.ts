import type { SshSessionCallbacks } from "./ssh-session"
import type { WSContext } from "hono/ws"

import type { ClientMessage, EncryptedMessage } from "@taminal/protocol"
import { parseControlMessage } from "@taminal/protocol"

import { SessionManager } from "./session-manager"
import { WsCrypto } from "./ws-crypto"

export function createWsHandler(sessionManager: SessionManager) {
  return (ws: WSContext) => {
    let currentSessionId: string | null = null
    const wsCrypto = new WsCrypto()

    /** 암호화된 메시지 전송 (키 교환 완료 시) / 평문 전송 (미완료 시) */
    function secureSend(data: string) {
      if (wsCrypto.isReady) {
        const { payload, iv } = wsCrypto.encrypt(data)
        ws.send(JSON.stringify({ type: "encrypted", payload, iv }))
      } else {
        ws.send(data)
      }
    }

    function createCallbacks(): SshSessionCallbacks {
      return {
        onData: (data) => secureSend(data),
        onReady: () => {
          // 기본 콜백 — connect/attach에서 오버라이드
        },
        onClose: (reason) => {
          secureSend(JSON.stringify({ type: "disconnected", reason }))
          if (currentSessionId) {
            sessionManager.remove(currentSessionId)
            currentSessionId = null
          }
        },
        onError: (message) => {
          secureSend(JSON.stringify({ type: "error", message }))
        },
      }
    }

    /** 복호화된 메시지 처리 */
    function handleDecryptedMessage(data: string) {
      const msg = parseControlMessage<ClientMessage>(data)

      if (!msg) {
        // raw 터미널 입력
        if (currentSessionId) {
          sessionManager.get(currentSessionId)?.write(data)
        }
        return
      }

      switch (msg.type) {
        case "connect": {
          if (currentSessionId) {
            sessionManager.detach(currentSessionId)
          }

          const callbacks = createCallbacks()
          const session = sessionManager.create(
            {
              host: msg.host,
              port: msg.port,
              username: msg.username,
              password: msg.password,
              privateKey: msg.privateKey,
              cols: msg.cols,
              rows: msg.rows,
            },
            {
              ...callbacks,
              onReady: () => {
                secureSend(
                  JSON.stringify({
                    type: "connected",
                    sessionId: session.id,
                  }),
                )
              },
            },
          )
          currentSessionId = session.id
          break
        }

        case "attach": {
          if (currentSessionId) {
            sessionManager.detach(currentSessionId)
          }

          const callbacks = createCallbacks()
          const attached = sessionManager.attach(msg.sessionId, {
            ...callbacks,
            onReady: () => {
              secureSend(
                JSON.stringify({
                  type: "attached",
                  sessionId: msg.sessionId,
                }),
              )
            },
          })

          if (attached) {
            currentSessionId = msg.sessionId
          } else {
            secureSend(
              JSON.stringify({
                type: "error",
                message: `세션을 찾을 수 없음: ${msg.sessionId}`,
              }),
            )
          }
          break
        }

        case "resize": {
          if (currentSessionId) {
            sessionManager.get(currentSessionId)?.resize(msg.cols, msg.rows)
          }
          break
        }

        case "detach": {
          if (currentSessionId) {
            sessionManager.detach(currentSessionId)
            currentSessionId = null
          }
          break
        }
      }
    }

    return {
      onMessage(event: MessageEvent) {
        const raw = typeof event.data === "string" ? event.data : event.data.toString("utf-8")

        // JSON 파싱 시도
        let parsed: Record<string, unknown> | null = null
        try {
          if (raw.startsWith("{")) parsed = JSON.parse(raw)
        } catch {
          // raw 터미널 입력 (암호화된 경우 항상 JSON)
        }

        // 핸드셰이크: 키 교환
        if (parsed?.type === "handshake:init") {
          wsCrypto.deriveKey(parsed.publicKey as string)
          ws.send(
            JSON.stringify({
              type: "handshake:complete",
              publicKey: wsCrypto.getPublicKey(),
            }),
          )
          return
        }

        // 암호화된 메시지: 복호화 후 처리
        if (parsed?.type === "encrypted") {
          const { payload, iv } = parsed as unknown as EncryptedMessage
          const decrypted = wsCrypto.decrypt(payload, iv)
          handleDecryptedMessage(decrypted)
          return
        }

        // 키 교환 전 평문 (handshake:init만 허용하지만, fallback)
        handleDecryptedMessage(raw)
      },

      onClose() {
        if (currentSessionId) {
          sessionManager.detach(currentSessionId)
          currentSessionId = null
        }
      },

      onError() {
        if (currentSessionId) {
          sessionManager.detach(currentSessionId)
          currentSessionId = null
        }
      },
    }
  }
}
