import type { EncryptedMessage } from "@taminal/protocol"
import { isControlMessage, parseControlMessage } from "@taminal/protocol"
import { useCallback, useEffect, useRef } from "react"

import { addTab, setTerminalSessionId, splitTerminal } from "@/lib/workspace-store"
import { WsCrypto } from "@/lib/ws-crypto"

export interface ConnectionInfo {
  serverUrl: string
  host: string
  port: number
  username: string
  password: string
  privateKey?: string
}

interface UseTerminalOptions {
  terminalId: string
  workspaceId: string
  connectionInfo?: ConnectionInfo
  sessionId?: string
}

// xterm은 CJS 모듈이므로 dynamic import로 클라이언트에서만 로드
async function loadXterm() {
  const [{ Terminal }, { FitAddon }, { Unicode11Addon }, { WebLinksAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-unicode11"),
    import("@xterm/addon-web-links"),
  ])
  await import("@xterm/xterm/css/xterm.css")
  return { Terminal, FitAddon, Unicode11Addon, WebLinksAddon }
}

export function useTerminal(options: UseTerminalOptions) {
  const terminalRef = useRef<InstanceType<Awaited<ReturnType<typeof loadXterm>>["Terminal"]> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fitAddonRef = useRef<InstanceType<Awaited<ReturnType<typeof loadXterm>>["FitAddon"]> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const cryptoRef = useRef<WsCrypto | null>(null)
  const connectedRef = useRef(false)
  const readyRef = useRef(false)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  })

  const writeToTerminal = useCallback((data: string) => {
    if (terminalRef.current && readyRef.current) {
      // replacement character(U+FFFD) 제거
      const filtered = data.replaceAll("\uFFFD", "")
      if (filtered) terminalRef.current.write(filtered)
    }
  }, [])

  const secureSend = useCallback(async (data: string) => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    if (cryptoRef.current?.isReady) {
      const { payload, iv } = await cryptoRef.current.encrypt(data)
      socket.send(JSON.stringify({ type: "encrypted", payload, iv }))
    } else {
      socket.send(data)
    }
  }, [])

  const handleMessage = useCallback(
    async (data: string) => {
      let decrypted = data
      if (data.startsWith("{")) {
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === "handshake:complete") {
            await cryptoRef.current?.deriveKey(parsed.publicKey)
            return
          }
          if (parsed.type === "encrypted" && cryptoRef.current) {
            const msg = parsed as EncryptedMessage
            decrypted = await cryptoRef.current.decrypt(msg.payload, msg.iv)
          }
        } catch {
          // 평문으로 처리
        }
      }

      if (isControlMessage(decrypted)) {
        const msg = parseControlMessage(decrypted)
        if (!msg) return
        switch (msg.type) {
          case "connected":
          case "attached": {
            connectedRef.current = true
            const sid = (msg as { sessionId: string }).sessionId
            if (sid) {
              setTerminalSessionId(optionsRef.current.workspaceId, optionsRef.current.terminalId, sid)
            }
            break
          }
          case "error":
            writeToTerminal(`\r\n\x1b[31m오류: ${(msg as { message: string }).message}\x1b[0m\r\n`)
            break
          case "disconnected":
            connectedRef.current = false
            writeToTerminal(`\r\n\x1b[33m연결 종료\x1b[0m\r\n`)
            break
        }
      } else {
        writeToTerminal(decrypted)
      }
    },
    [writeToTerminal],
  )

  const connectToServer = useCallback(
    async (info: ConnectionInfo, existingSessionId?: string, cols?: number, rows?: number) => {
      wsRef.current?.close()
      connectedRef.current = false

      const wsUrl = info.serverUrl.replace(/\/$/, "") + "/ws"
      const socket = new WebSocket(wsUrl)
      wsRef.current = socket

      const wsCrypto = new WsCrypto()
      cryptoRef.current = wsCrypto
      await wsCrypto.generateKeyPair()

      socket.onopen = async () => {
        const publicKey = await wsCrypto.getPublicKey()
        socket.send(JSON.stringify({ type: "handshake:init", publicKey }))
      }

      socket.onmessage = async (event) => {
        const msgData = event.data as string

        if (!wsCrypto.isReady) {
          try {
            const parsed = JSON.parse(msgData)
            if (parsed.type === "handshake:complete") {
              await wsCrypto.deriveKey(parsed.publicKey)

              const request = existingSessionId
                ? JSON.stringify({ type: "attach", sessionId: existingSessionId })
                : JSON.stringify({
                    type: "connect",
                    host: info.host,
                    port: info.port,
                    username: info.username,
                    password: info.password,
                    privateKey: info.privateKey,
                    cols,
                    rows,
                  })

              const { payload, iv } = await wsCrypto.encrypt(request)
              socket.send(JSON.stringify({ type: "encrypted", payload, iv }))

              socket.onmessage = (e) => handleMessage(e.data as string)
              return
            }
          } catch {
            // 무시
          }
          return
        }

        await handleMessage(msgData)
      }

      socket.onclose = () => {
        connectedRef.current = false
      }
    },
    [handleMessage],
  )

  // 터미널 초기화 + WS 연결
  useEffect(() => {
    let disposed = false
    if (!containerRef.current) return

    const container = containerRef.current

    loadXterm().then(({ Terminal, FitAddon, Unicode11Addon, WebLinksAddon }) => {
      if (disposed || !container) return

      const term = new Terminal({
        fontFamily: "'JetBrainsMono Hangul Nerd Font', 'JetBrains Mono', monospace",
        fontSize: 14,
        cursorBlink: true,
        allowTransparency: true,
        allowProposedApi: true,
        theme: {
          background: "#282c34",
          foreground: "#abb2bf",
          cursor: "#528bff",
          selectionBackground: "#3e4451",
          black: "#3f4451",
          red: "#e06c75",
          green: "#98c379",
          yellow: "#e5c07b",
          blue: "#61afef",
          magenta: "#c678dd",
          cyan: "#56b6c2",
          white: "#d7dae0",
          brightBlack: "#4f5666",
          brightRed: "#be5046",
          brightGreen: "#98c379",
          brightYellow: "#d19a66",
          brightBlue: "#61afef",
          brightMagenta: "#c678dd",
          brightCyan: "#56b6c2",
          brightWhite: "#e6e6e6",
        },
      })

      const fitAddon = new FitAddon()
      const unicode11Addon = new Unicode11Addon()
      const webLinksAddon = new WebLinksAddon()

      term.loadAddon(fitAddon)
      term.loadAddon(unicode11Addon)
      term.loadAddon(webLinksAddon)
      term.open(container)

      term.unicode.activeVersion = "11"
      fitAddon.fit()

      terminalRef.current = term
      fitAddonRef.current = fitAddon
      readyRef.current = true

      // 키보드 단축키
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.type !== "keydown") return true
        const meta = e.metaKey || e.ctrlKey

        if (meta && e.key.toLowerCase() === "d" && !e.shiftKey) {
          e.preventDefault()
          const opts = optionsRef.current
          if (opts.connectionInfo) splitTerminal(opts.workspaceId, "horizontal", opts.connectionInfo)
          return false
        }

        if (meta && e.key.toLowerCase() === "d" && e.shiftKey) {
          e.preventDefault()
          const opts = optionsRef.current
          if (opts.connectionInfo) splitTerminal(opts.workspaceId, "vertical", opts.connectionInfo)
          return false
        }

        if (meta && e.key.toLowerCase() === "t") {
          e.preventDefault()
          addTab(optionsRef.current.workspaceId)
          return false
        }

        return true
      })

      term.onData((data: string) => {
        if (!connectedRef.current) return
        // DA 응답 (e.g. \x1b[?1;2c, \x1b[?6c) 필터링
        // eslint-disable-next-line no-control-regex
        if (/^\x1b\[\?[\d;]*c$/.test(data)) return
        secureSend(data)
      })
      term.onResize((event: { cols: number; rows: number }) => {
        if (connectedRef.current) secureSend(JSON.stringify({ type: "resize", cols: event.cols, rows: event.rows }))
      })

      // 리사이즈 감지 — xterm이 아닌 부모 컨테이너를 관찰
      const observeTarget = container.parentElement ?? container
      let resizeRaf = 0
      const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeRaf)
        resizeRaf = requestAnimationFrame(() => fitAddon.fit())
      })
      resizeObserver.observe(observeTarget)

      // 연결 — 레이아웃 안정 후 fit + 연결
      requestAnimationFrame(() => {
        fitAddon.fit()
        const opts = optionsRef.current
        if (opts.connectionInfo && !connectedRef.current) {
          if (opts.sessionId) term.clear()
          connectToServer(opts.connectionInfo, opts.sessionId, term.cols, term.rows)
        }
      })

      cleanupFn = () => {
        cancelAnimationFrame(resizeRaf)
        resizeObserver.disconnect()
        term.dispose()
      }
    })

    let cleanupFn: (() => void) | undefined

    return () => {
      disposed = true
      cleanupFn?.()
      wsRef.current?.close()
      wsRef.current = null
      terminalRef.current = null
      fitAddonRef.current = null
      readyRef.current = false
      connectedRef.current = false
    }
  }, [secureSend, connectToServer])

  return { container: containerRef, terminal: terminalRef }
}
