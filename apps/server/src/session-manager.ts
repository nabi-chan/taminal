import type { SshConnectionConfig, SshSessionCallbacks } from "./ssh-session"

import type { SessionInfo } from "@taminal/protocol"

import { SshSession } from "./ssh-session"

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5분

export class SessionManager {
  private sessions = new Map<string, SshSession>()
  private detachTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private timeoutMs: number

  constructor(timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  create(config: SshConnectionConfig, callbacks: SshSessionCallbacks): SshSession {
    const session = new SshSession(config, callbacks)
    this.sessions.set(session.id, session)
    return session
  }

  get(sessionId: string): SshSession | undefined {
    return this.sessions.get(sessionId)
  }

  /** WS 분리 — 타이머 시작 */
  detach(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.detach()
    this.clearTimer(sessionId)

    const timer = setTimeout(() => {
      this.remove(sessionId)
    }, this.timeoutMs)

    this.detachTimers.set(sessionId, timer)
  }

  /** WS 재연결 — 타이머 취소 */
  attach(sessionId: string, callbacks: SshSessionCallbacks): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    this.clearTimer(sessionId)
    session.attach(callbacks)
    return true
  }

  /** 세션 완전 제거 */
  remove(sessionId: string) {
    this.clearTimer(sessionId)
    const session = this.sessions.get(sessionId)
    if (session) {
      session.destroy()
      this.sessions.delete(sessionId)
    }
  }

  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.id,
      host: s.host,
      port: s.port,
      username: s.username,
      createdAt: s.createdAt.toISOString(),
      isAttached: s.isAttached,
    }))
  }

  private clearTimer(sessionId: string) {
    const timer = this.detachTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.detachTimers.delete(sessionId)
    }
  }
}
