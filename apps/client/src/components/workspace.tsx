import type { TabItem } from "@/lib/workspace-store"

import NiceModal from "@ebay/nice-modal-react"
import { PlusIcon, TerminalSquareIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { SshDialog } from "@/components/ssh-dialog"
import { SplitPane } from "@/components/terminal/split-pane"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { cn } from "@/lib/utils"
import {
  addTab,
  addTerminal,
  getActiveTabForWorkspace,
  removeTab,
  renameTab,
  setActiveTab,
  setFocusedTerminal,
} from "@/lib/workspace-store"

function showSshDialog(workspaceId: string) {
  NiceModal.show(SshDialog, {
    onConnect: (info) => addTerminal(workspaceId, `${info.username}@${info.host}`, info),
  })
}

function TabLabel({ tab, workspaceId, isActive }: { tab: TabItem; workspaceId: string; isActive: boolean }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(tab.name)

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== tab.name) {
      renameTab(workspaceId, tab.id, trimmed)
    } else {
      setValue(tab.name)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            setValue(tab.name)
            setEditing(false)
          }
        }}
        className="w-20 bg-transparent text-xs outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      className="truncate"
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (isActive) {
          setValue(tab.name)
          setEditing(true)
        }
      }}>
      {tab.name}
    </span>
  )
}

export function Workspace() {
  const { workspace } = useActiveWorkspace()

  if (!workspace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <TerminalSquareIcon className="text-muted-foreground size-12" />
        <div className="text-center">
          <p className="text-foreground text-sm font-medium">워크스페이스를 선택하세요</p>
          <p className="text-muted-foreground mt-1 text-xs">사이드바에서 워크스페이스를 만들거나 선택합니다</p>
        </div>
      </div>
    )
  }

  const activeTab = getActiveTabForWorkspace(workspace)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* 탭 바 */}
      <div className="bg-card flex h-9 shrink-0 items-center gap-px border-b px-1">
        <SidebarTrigger className="text-muted-foreground mr-1 h-6 w-6" />
        <Separator orientation="vertical" className="mr-1 h-4" />
        {workspace.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "group relative flex h-7 items-center gap-1.5 rounded-md px-3 text-xs transition-colors",
              tab.id === workspace.activeTabId
                ? "bg-background text-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
            onClick={() => setActiveTab(workspace.id, tab.id)}>
            <TabLabel tab={tab} workspaceId={workspace.id} isActive={tab.id === workspace.activeTabId} />
            <span
              className={cn(
                "hover:bg-muted -mr-1 flex h-4 w-4 items-center justify-center rounded-sm transition-opacity",
                tab.id === workspace.activeTabId
                  ? "opacity-40 hover:opacity-100"
                  : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100",
              )}
              onClick={(e) => {
                e.stopPropagation()
                removeTab(workspace.id, tab.id)
              }}>
              <XIcon className="h-3 w-3" />
            </span>
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground ml-0.5 h-6 w-6 hover:text-foreground"
          onClick={() => addTab(workspace.id)}>
          <PlusIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 터미널 영역 */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab?.layout ? (
          <SplitPane
            node={activeTab.layout}
            workspaceId={workspace.id}
            focusedTerminalId={activeTab.focusedTerminalId}
            terminals={workspace.terminals}
            onFocus={(terminalId) => setFocusedTerminal(workspace.id, terminalId)}
            showHeader={activeTab.layout.type === "split"}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <TerminalSquareIcon className="text-muted-foreground size-10" />
            <Button variant="outline" className="border-dashed" onClick={() => showSshDialog(workspace.id)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              SSH 연결 추가
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
