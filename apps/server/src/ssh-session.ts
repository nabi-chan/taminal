import type { ClientChannel } from "ssh2"

import crypto from "node:crypto"

import { Client } from "ssh2"

const MAX_SCROLLBACK_BYTES = 1024 * 1024 // 1MB

export interface SshSessionCallbacks {
  onData: (data: string) => void
  onReady: () => void
  onClose: (reason?: string) => void
  onError: (message: string) => void
}

export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  cols?: number
  rows?: number
}

export class SshSession {
  readonly id: string
  readonly host: string
  readonly port: number
  readonly username: string
  readonly createdAt: Date

  private conn = new Client()
  private stream: ClientChannel | null = null
  private callbacks: SshSessionCallbacks | null = null
  private scrollbackBuffer: string[] = []
  private scrollbackBytes = 0
  private destroyed = false

  constructor(config: SshConnectionConfig, callbacks: SshSessionCallbacks) {
    this.id = crypto.randomUUID()
    this.host = config.host
    this.port = config.port
    this.username = config.username
    this.createdAt = new Date()
    this.callbacks = callbacks

    this.conn.on("ready", () => {
      this.conn.shell(
        {
          term: "xterm-256color",
          cols: config.cols ?? 80,
          rows: config.rows ?? 24,
        },
        (err, stream) => {
          if (err) {
            callbacks.onError(err.message)
            return
          }
          this.stream = stream

          stream.on("data", (data: Buffer) => {
            const text = data.toString("utf-8")
            this.appendScrollback(text)
            this.callbacks?.onData(text)
          })

          stream.stderr.on("data", (data: Buffer) => {
            const text = data.toString("utf-8")
            this.appendScrollback(text)
            this.callbacks?.onData(text)
          })

          stream.on("close", () => {
            this.callbacks?.onClose()
            this.destroy()
          })

          callbacks.onReady()
        },
      )
    })

    this.conn.on("error", (err) => {
      callbacks.onError(err.message)
    })

    this.conn.on("close", () => {
      if (!this.destroyed) {
        this.callbacks?.onClose("SSH 연결 종료")
      }
    })

    this.conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password || undefined,
      privateKey: config.privateKey || undefined,
    })
  }

  write(data: string) {
    this.stream?.write(data)
  }

  resize(cols: number, rows: number) {
    // ssh2의 setWindow는 (rows, cols, height, width) 순서
    this.stream?.setWindow(rows, cols, 0, 0)
  }

  /** WS가 분리될 때 콜백만 해제 (세션은 유지) */
  detach() {
    this.callbacks = null
  }

  /** 새 WS가 연결될 때 콜백 재설정 + 스크롤백 재생 */
  attach(callbacks: SshSessionCallbacks) {
    this.callbacks = callbacks

    // 스크롤백 버퍼 재생
    for (const chunk of this.scrollbackBuffer) {
      callbacks.onData(chunk)
    }

    callbacks.onReady()
  }

  get isAttached(): boolean {
    return this.callbacks !== null
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.callbacks = null
    this.stream?.close()
    this.conn.end()
  }

  private appendScrollback(text: string) {
    this.scrollbackBuffer.push(text)
    this.scrollbackBytes += text.length

    // 버퍼 크기 초과 시 앞부분 제거
    while (this.scrollbackBytes > MAX_SCROLLBACK_BYTES && this.scrollbackBuffer.length > 1) {
      const removed = this.scrollbackBuffer.shift()
      if (removed) this.scrollbackBytes -= removed.length
    }
  }
}
