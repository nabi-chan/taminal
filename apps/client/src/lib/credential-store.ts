import { base64ToBuffer, bufferToBase64 } from "./buffer-utils"
import { getDb } from "./idb"

const STORE_NAME = "credentials"

interface StoredCredential {
  encrypted: string
  iv: string
}

export interface CredentialData {
  serverUrl: string
  host: string
  port: number
  username: string
  password: string
  privateKey?: string
}

// 고정 키 소재 (로컬 난독화 수준 — 진정한 보안을 위해서는 마스터 패스워드 유도 필요)
const KEY_MATERIAL = "taminal-credential-key-v1"

let cachedKey: CryptoKey | null = null

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(KEY_MATERIAL), "PBKDF2", false, [
    "deriveKey",
  ])

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("taminal-salt-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
  return cachedKey
}

export async function saveCredential(terminalId: string, data: CredentialData): Promise<void> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = JSON.stringify(data)

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))

  const stored: StoredCredential = {
    encrypted: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
  }

  const db = await getDb()
  await db.put(STORE_NAME, stored, terminalId)
}

export async function loadCredential(terminalId: string): Promise<CredentialData | null> {
  const db = await getDb()
  const stored = (await db.get(STORE_NAME, terminalId)) as StoredCredential | undefined
  if (!stored) return null

  const key = await getEncryptionKey()
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(stored.iv) },
    key,
    base64ToBuffer(stored.encrypted),
  )

  return JSON.parse(new TextDecoder().decode(plaintext)) as CredentialData
}

export async function removeCredential(terminalId: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, terminalId)
}

export async function clearCredentials(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_NAME)
}
