import type { IDBPDatabase } from "idb"

import { openDB } from "idb"

const DB_NAME = "taminal"
const DB_VERSION = 5

/** IndexedDB 연결 (스토어가 없으면 자동 생성) */
export function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("workspaces")) db.createObjectStore("workspaces")
      if (!db.objectStoreNames.contains("credentials")) db.createObjectStore("credentials")
      if (!db.objectStoreNames.contains("profiles")) db.createObjectStore("profiles")
    },
  })
}
