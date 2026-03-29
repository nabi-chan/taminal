import type { ConnectionInfo } from "@/components/terminal/use-terminal"

import { getDb } from "./idb"

export interface ConnectionProfile {
  id: string
  name: string
  connectionInfo: ConnectionInfo
}

const STORE_NAME = "profiles"

export async function listProfiles(): Promise<ConnectionProfile[]> {
  const db = await getDb()
  const keys = await db.getAllKeys(STORE_NAME)
  const values = await db.getAll(STORE_NAME)
  return keys.map((key, i) => ({ ...(values[i] as Omit<ConnectionProfile, "id">), id: key as string }))
}

export async function saveProfile(name: string, connectionInfo: ConnectionInfo): Promise<string> {
  const id = crypto.randomUUID()
  const db = await getDb()
  await db.put(STORE_NAME, { name, connectionInfo }, id)
  return id
}

export async function removeProfile(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}
