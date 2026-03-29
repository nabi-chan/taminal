import crypto from "node:crypto"

const AES_ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * 서버 측 ECDH 키 교환 + AES-GCM 암호화/복호화
 * 각 WS 세션마다 독립된 인스턴스 생성
 */
export class WsCrypto {
  private ecdh = crypto.createECDH("prime256v1")
  private sharedKey: Buffer | null = null

  constructor() {
    this.ecdh.generateKeys()
  }

  /** 서버의 ECDH 공개키 (base64) */
  getPublicKey(): string {
    return this.ecdh.getPublicKey("base64")
  }

  /** 클라이언트 공개키로 공유 비밀 유도 → AES 키 생성 */
  deriveKey(clientPublicKeyBase64: string) {
    const clientPublicKey = Buffer.from(clientPublicKeyBase64, "base64")
    const sharedSecret = this.ecdh.computeSecret(clientPublicKey)

    // HKDF로 AES-256 키 유도
    this.sharedKey = crypto.hkdfSync(
      "sha256",
      sharedSecret,
      Buffer.from("taminal-ws-encryption"),
      Buffer.from("aes-256-gcm-key"),
      32,
    ) as unknown as Buffer

    // hkdfSync는 ArrayBuffer를 반환하므로 Buffer로 변환
    if (!(this.sharedKey instanceof Buffer)) {
      this.sharedKey = Buffer.from(this.sharedKey)
    }
  }

  get isReady(): boolean {
    return this.sharedKey !== null
  }

  /** 데이터 암호화 → { payload, iv } (base64) */
  encrypt(plaintext: string): { payload: string; iv: string } {
    if (!this.sharedKey) throw new Error("키 교환이 완료되지 않음")

    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(AES_ALGORITHM, this.sharedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final(), cipher.getAuthTag()])

    return {
      payload: encrypted.toString("base64"),
      iv: iv.toString("base64"),
    }
  }

  /** 암호문 복호화 */
  decrypt(payloadBase64: string, ivBase64: string): string {
    if (!this.sharedKey) throw new Error("키 교환이 완료되지 않음")

    const encrypted = Buffer.from(payloadBase64, "base64")
    const iv = Buffer.from(ivBase64, "base64")

    const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH)
    const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(AES_ALGORITHM, this.sharedKey, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)

    return decipher.update(ciphertext) + decipher.final("utf-8")
  }
}
