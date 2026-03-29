import type { ConnectionInfo } from "@/components/terminal/use-terminal"
import type { IDBPDatabase } from "idb"

import { openDB } from "idb"

export interface ConnectionProfile {
  id: string
  name: string
  connectionInfo: ConnectionInfo
}

const DB_NAME = "taminal"
const DB_VERSION = 5
const STORE_NAME = "profiles"

function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("workspaces")) db.createObjectStore("workspaces")
      if (!db.objectStoreNames.contains("credentials")) db.createObjectStore("credentials")
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    },
  })
}

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
