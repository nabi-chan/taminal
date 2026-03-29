import type { ConnectionInfo } from "@/components/terminal/use-terminal"

import { Store } from "@tanstack/store"

import { loadCredential, removeCredential, saveCredential } from "./credential-store"
import { getDb } from "./idb"

// --- 타입 ---

export interface TerminalItem {
  id: string
  name: string
  connectionInfo: ConnectionInfo
  sessionId?: string
}

export interface TerminalPane {
  type: "terminal"
  terminalId: string
}

export interface SplitPane {
  type: "split"
  direction: "horizontal" | "vertical"
  children: [PaneNode, PaneNode]
}

export type PaneNode = TerminalPane | SplitPane

export interface TabItem {
  id: string
  name: string
  layout: PaneNode | null
  focusedTerminalId: string
}

export interface WorkspaceItem {
  id: string
  name: string
  description: string
  terminals: TerminalItem[]
  tabs: TabItem[]
  activeTabId: string
}

interface WorkspaceState {
  workspaces: WorkspaceItem[]
  loaded: boolean
}

export const workspaceStore = new Store<WorkspaceState>({
  workspaces: [],
  loaded: false,
})

// --- Pane 트리 유틸 ---

function collectTerminalIds(node: PaneNode): string[] {
  if (node.type === "terminal") return [node.terminalId]
  return [...collectTerminalIds(node.children[0]), ...collectTerminalIds(node.children[1])]
}

function replacePane(node: PaneNode, targetTerminalId: string, newNode: PaneNode): PaneNode {
  if (node.type === "terminal") {
    return node.terminalId === targetTerminalId ? newNode : node
  }
  return {
    ...node,
    children: [
      replacePane(node.children[0], targetTerminalId, newNode),
      replacePane(node.children[1], targetTerminalId, newNode),
    ],
  }
}

function removePane(node: PaneNode, targetTerminalId: string): PaneNode | null {
  if (node.type === "terminal") {
    return node.terminalId === targetTerminalId ? null : node
  }
  if (node.children[0].type === "terminal" && node.children[0].terminalId === targetTerminalId) return node.children[1]
  if (node.children[1].type === "terminal" && node.children[1].terminalId === targetTerminalId) return node.children[0]
  const left = removePane(node.children[0], targetTerminalId)
  if (left !== node.children[0]) return left ? { ...node, children: [left, node.children[1]] } : node.children[1]
  const right = removePane(node.children[1], targetTerminalId)
  if (right !== node.children[1]) return right ? { ...node, children: [node.children[0], right] } : node.children[0]
  return node
}

// --- 워크스페이스 내부 헬퍼 ---

function getActiveTab(ws: WorkspaceItem): TabItem | undefined {
  return ws.tabs.find((t) => t.id === ws.activeTabId)
}

function updateActiveTab(ws: WorkspaceItem, updater: (tab: TabItem) => TabItem): WorkspaceItem {
  return { ...ws, tabs: ws.tabs.map((t) => (t.id === ws.activeTabId ? updater(t) : t)) }
}

// --- IndexedDB 영속화 ---

const STORE_NAME = "workspaces"

interface StoredTerminal {
  id: string
  name: string
  sessionId?: string
}

interface StoredTab {
  id: string
  name: string
  layout: PaneNode | null
  focusedTerminalId: string
}

interface StoredWorkspace {
  name: string
  description: string
  activeTabId: string
  terminals: StoredTerminal[]
  tabs: StoredTab[]
}

function toStoredWorkspace(ws: WorkspaceItem): StoredWorkspace {
  return {
    name: ws.name,
    description: ws.description,
    activeTabId: ws.activeTabId,
    terminals: ws.terminals.map((t) => ({ id: t.id, name: t.name, sessionId: t.sessionId })),
    tabs: ws.tabs.map((t) => ({ id: t.id, name: t.name, layout: t.layout, focusedTerminalId: t.focusedTerminalId })),
  }
}

async function persistToDb(state: WorkspaceState) {
  const db = await getDb()
  const tx = db.transaction(STORE_NAME, "readwrite")
  const store = tx.objectStore(STORE_NAME)
  await store.clear()
  for (const ws of state.workspaces) {
    await store.put(toStoredWorkspace(ws), ws.id)
  }
  await tx.done
}

export async function loadFromDb() {
  const db = await getDb()
  const keys = await db.getAllKeys(STORE_NAME)
  const values = await db.getAll(STORE_NAME)

  const workspaces: WorkspaceItem[] = await Promise.all(
    keys.map(async (key, i) => {
      const stored = values[i] as StoredWorkspace
      const terminals: TerminalItem[] = await Promise.all(
        (stored.terminals ?? [])
          .filter((t) => t.id)
          .map(async (t) => {
            const cred = await loadCredential(t.id)
            return {
              id: t.id,
              name: t.name,
              connectionInfo: cred ?? { serverUrl: "", host: "", port: 22, username: "", password: "" },
              sessionId: t.sessionId,
            }
          }),
      )
      const tabs: TabItem[] = (stored.tabs ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        layout: t.layout,
        focusedTerminalId: t.focusedTerminalId,
      }))
      return {
        id: key as string,
        name: stored.name,
        description: stored.description,
        terminals,
        tabs:
          tabs.length > 0 ? tabs : [{ id: crypto.randomUUID(), name: "Tab 1", layout: null, focusedTerminalId: "" }],
        activeTabId: stored.activeTabId ?? tabs[0]?.id ?? "",
      }
    }),
  )

  workspaceStore.setState((prev) => ({ ...prev, workspaces, loaded: true }))
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persistToDb(workspaceStore.state), 500)
}

workspaceStore.subscribe(() => {
  if (workspaceStore.state.loaded) scheduleSave()
})

// --- 워크스페이스 ---

export function createWorkspace(name: string, description: string) {
  const id = crypto.randomUUID()
  const tabId = crypto.randomUUID()
  const workspace: WorkspaceItem = {
    id,
    name,
    description,
    terminals: [],
    tabs: [{ id: tabId, name: "Tab 1", layout: null, focusedTerminalId: "" }],
    activeTabId: tabId,
  }
  workspaceStore.setState((prev) => ({ ...prev, workspaces: [...prev.workspaces, workspace] }))
  return id
}

export function updateWorkspace(id: string, updates: { name?: string; description?: string }) {
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => (ws.id === id ? { ...ws, ...updates } : ws)),
  }))
}

export function removeWorkspace(id: string) {
  workspaceStore.setState((prev) => ({ ...prev, workspaces: prev.workspaces.filter((w) => w.id !== id) }))
}

// --- 탭 ---

export function addTab(workspaceId: string) {
  const tabId = crypto.randomUUID()
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const tabNum = ws.tabs.length + 1
      const newTab: TabItem = { id: tabId, name: `Tab ${tabNum}`, layout: null, focusedTerminalId: "" }
      return { ...ws, tabs: [...ws.tabs, newTab], activeTabId: tabId }
    }),
  }))
  return tabId
}

export function removeTab(workspaceId: string, tabId: string) {
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const removedTab = ws.tabs.find((t) => t.id === tabId)
      const removedIds = removedTab?.layout ? collectTerminalIds(removedTab.layout) : []
      removedIds.forEach((tid) => removeCredential(tid))

      const remaining = ws.tabs.filter((t) => t.id !== tabId)
      // 마지막 탭이면 빈 탭 자동 생성
      if (remaining.length === 0) {
        const newTabId = crypto.randomUUID()
        remaining.push({ id: newTabId, name: "Tab 1", layout: null, focusedTerminalId: "" })
      }

      return {
        ...ws,
        tabs: remaining,
        terminals: ws.terminals.filter((t) => !removedIds.includes(t.id)),
        activeTabId: ws.activeTabId === tabId ? remaining[0].id : ws.activeTabId,
      }
    }),
  }))
}

export function setActiveTab(workspaceId: string, tabId: string) {
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => (ws.id === workspaceId ? { ...ws, activeTabId: tabId } : ws)),
  }))
}

export function renameTab(workspaceId: string, tabId: string, name: string) {
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) =>
      ws.id === workspaceId ? { ...ws, tabs: ws.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)) } : ws,
    ),
  }))
}

// --- 터미널 (활성 탭에 추가) ---

export function addTerminal(workspaceId: string, name: string, connectionInfo: ConnectionInfo) {
  const terminalId = crypto.randomUUID()
  const terminal: TerminalItem = { id: terminalId, name, connectionInfo }
  const newPane: TerminalPane = { type: "terminal", terminalId }

  saveCredential(terminalId, connectionInfo)

  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return updateActiveTab({ ...ws, terminals: [...ws.terminals, terminal] }, (tab) => ({
        ...tab,
        layout: tab.layout ?? newPane,
        focusedTerminalId: terminalId,
      }))
    }),
  }))
  return terminalId
}

export function removeTerminal(workspaceId: string, terminalId: string) {
  removeCredential(terminalId)

  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const nextTerminals = ws.terminals.filter((t) => t.id !== terminalId)
      return {
        ...ws,
        terminals: nextTerminals,
        tabs: ws.tabs.map((tab) => {
          if (!tab.layout) return tab
          const nextLayout = removePane(tab.layout, terminalId)
          const remainingIds = nextLayout ? collectTerminalIds(nextLayout) : []
          return {
            ...tab,
            layout: nextLayout,
            focusedTerminalId: tab.focusedTerminalId === terminalId ? (remainingIds[0] ?? "") : tab.focusedTerminalId,
          }
        }),
      }
    }),
  }))
}

export function setFocusedTerminal(workspaceId: string, terminalId: string) {
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      return updateActiveTab(ws, (tab) => ({ ...tab, focusedTerminalId: terminalId }))
    }),
  }))
}

export function setTerminalSessionId(workspaceId: string, terminalId: string, sessionId: string) {
  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) =>
      ws.id === workspaceId
        ? { ...ws, terminals: ws.terminals.map((t) => (t.id === terminalId ? { ...t, sessionId } : t)) }
        : ws,
    ),
  }))
}

/** 포커스된 터미널을 split */
export function splitTerminal(
  workspaceId: string,
  direction: "horizontal" | "vertical",
  connectionInfo: ConnectionInfo,
) {
  const terminalId = crypto.randomUUID()
  const terminal: TerminalItem = {
    id: terminalId,
    name: `${connectionInfo.username}@${connectionInfo.host}`,
    connectionInfo,
  }
  const newPane: TerminalPane = { type: "terminal", terminalId }

  saveCredential(terminalId, connectionInfo)

  workspaceStore.setState((prev) => ({
    ...prev,
    workspaces: prev.workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws
      const tab = getActiveTab(ws)
      if (!tab?.layout || !tab.focusedTerminalId) return ws

      const splitNode: SplitPane = {
        type: "split",
        direction,
        children: [{ type: "terminal", terminalId: tab.focusedTerminalId }, newPane],
      }
      const newLayout = replacePane(tab.layout, tab.focusedTerminalId, splitNode)

      return updateActiveTab({ ...ws, terminals: [...ws.terminals, terminal] }, (t) => ({
        ...t,
        layout: newLayout,
        focusedTerminalId: terminalId,
      }))
    }),
  }))
  return terminalId
}

// --- 셀렉터 ---

export function getWorkspaceById(state: WorkspaceState, id: string): WorkspaceItem | undefined {
  return state.workspaces.find((w) => w.id === id)
}

export function getActiveTabForWorkspace(ws: WorkspaceItem): TabItem | undefined {
  return ws.tabs.find((t) => t.id === ws.activeTabId)
}
