// --- 핸드셰이크 (암호화 키 교환) ---

export interface HandshakeInitMessage {
  type: "handshake:init"
  publicKey: string // base64 ECDH 공개키
}

export interface HandshakeCompleteMessage {
  type: "handshake:complete"
  publicKey: string // base64 서버 ECDH 공개키
}

// --- 암호화된 데이터 래퍼 ---

export interface EncryptedMessage {
  type: "encrypted"
  payload: string // base64 AES-GCM 암호문
  iv: string // base64 IV
}

// --- 클라이언트 → 서버 메시지 ---

export interface ConnectMessage {
  type: "connect"
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  cols?: number
  rows?: number
}

export interface AttachMessage {
  type: "attach"
  sessionId: string
}

export interface ResizeMessage {
  type: "resize"
  cols: number
  rows: number
}

export interface DetachMessage {
  type: "detach"
}

export type ClientMessage = HandshakeInitMessage | ConnectMessage | AttachMessage | ResizeMessage | DetachMessage

// --- 서버 → 클라이언트 메시지 ---

export interface ConnectedMessage {
  type: "connected"
  sessionId: string
}

export interface AttachedMessage {
  type: "attached"
  sessionId: string
}

export interface ErrorMessage {
  type: "error"
  message: string
}

export interface DisconnectedMessage {
  type: "disconnected"
  reason?: string
}

export type ServerMessage =
  | HandshakeCompleteMessage
  | ConnectedMessage
  | AttachedMessage
  | ErrorMessage
  | DisconnectedMessage

// --- 세션 정보 (REST API) ---

export interface SessionInfo {
  sessionId: string
  host: string
  port: number
  username: string
  createdAt: string
  isAttached: boolean
}

// --- 타입가드 ---

export function isControlMessage(data: string): boolean {
  if (!data.startsWith("{")) return false
  try {
    const parsed = JSON.parse(data)
    return typeof parsed.type === "string"
  } catch {
    return false
  }
}

export function parseControlMessage<T = ClientMessage | ServerMessage>(data: string): T | null {
  try {
    const parsed = JSON.parse(data)
    if (typeof parsed.type === "string") return parsed as T
    return null
  } catch {
    return null
  }
}
