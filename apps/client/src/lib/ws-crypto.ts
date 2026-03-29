import { base64ToBuffer, bufferToBase64 } from "./buffer-utils"

const IV_LENGTH = 12

/**
 * 클라이언트 측 ECDH 키 교환 + AES-GCM 암호화/복호화
 */
export class WsCrypto {
  private keyPair: CryptoKeyPair | null = null
  private aesKey: CryptoKey | null = null

  async generateKeyPair() {
    this.keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveKey",
      "deriveBits",
    ])
  }

  async getPublicKey(): Promise<string> {
    if (!this.keyPair) throw new Error("키 쌍이 생성되지 않음")
    const raw = await crypto.subtle.exportKey("raw", this.keyPair.publicKey)
    return bufferToBase64(raw)
  }

  async deriveKey(serverPublicKeyBase64: string) {
    if (!this.keyPair) throw new Error("키 쌍이 생성되지 않음")

    const serverPublicKey = await crypto.subtle.importKey(
      "raw",
      base64ToBuffer(serverPublicKeyBase64),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    )

    const sharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverPublicKey },
      this.keyPair.privateKey,
      256,
    )
    const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"])

    this.aesKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new TextEncoder().encode("taminal-ws-encryption"),
        info: new TextEncoder().encode("aes-256-gcm-key"),
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    )
  }

  get isReady(): boolean {
    return this.aesKey !== null
  }

  async encrypt(plaintext: string): Promise<{ payload: string; iv: string }> {
    if (!this.aesKey) throw new Error("키 교환이 완료되지 않음")
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.aesKey,
      new TextEncoder().encode(plaintext),
    )
    return { payload: bufferToBase64(ciphertext), iv: bufferToBase64(iv) }
  }

  async decrypt(payloadBase64: string, ivBase64: string): Promise<string> {
    if (!this.aesKey) throw new Error("키 교환이 완료되지 않음")
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuffer(ivBase64) },
      this.aesKey,
      base64ToBuffer(payloadBase64),
    )
    return new TextDecoder().decode(plaintext)
  }
}
