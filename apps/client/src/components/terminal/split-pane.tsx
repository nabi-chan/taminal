import type { PaneNode, TerminalItem } from "@/lib/workspace-store"

import { CircleIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { removeTerminal } from "@/lib/workspace-store"

import { Terminal } from "./terminal"

interface SplitPaneProps {
  node: PaneNode
  workspaceId: string
  focusedTerminalId: string
  terminals: TerminalItem[]
  onFocus: (terminalId: string) => void
  showHeader?: boolean
}

export function SplitPane({
  node,
  workspaceId,
  focusedTerminalId,
  terminals,
  onFocus,
  showHeader = true,
}: SplitPaneProps) {
  if (node.type === "terminal") {
    const term = terminals.find((t) => t.id === node.terminalId)
    if (!term) return null

    const isFocused = term.id === focusedTerminalId

    return (
      <div className="flex h-full w-full flex-col" onClick={() => onFocus(term.id)}>
        {showHeader && (
          <div
            className={cn(
              "flex h-7 shrink-0 items-center gap-2 border-b px-2 transition-colors",
              isFocused ? "border-primary/20 bg-primary/5" : "bg-card border-border",
            )}>
            <CircleIcon
              className={cn(
                "size-2 shrink-0 transition-colors",
                isFocused ? "fill-[#98c379] text-[#98c379]" : "fill-muted-foreground text-muted-foreground",
              )}
            />
            <span className="text-muted-foreground flex-1 truncate text-xs">{term.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-4 w-4 rounded-sm hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                removeTerminal(workspaceId, term.id)
              }}>
              <XIcon className="h-2.5 w-2.5" />
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <Terminal
            key={term.id}
            terminalId={term.id}
            workspaceId={workspaceId}
            connectionInfo={term.connectionInfo}
            sessionId={term.sessionId}
            isFocused={isFocused}
          />
        </div>
      </div>
    )
  }

  return (
    <ResizablePanelGroup orientation={node.direction}>
      <ResizablePanel defaultSize={50} minSize={10}>
        <SplitPane
          node={node.children[0]}
          workspaceId={workspaceId}
          focusedTerminalId={focusedTerminalId}
          terminals={terminals}
          onFocus={onFocus}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50} minSize={10}>
        <SplitPane
          node={node.children[1]}
          workspaceId={workspaceId}
          focusedTerminalId={focusedTerminalId}
          terminals={terminals}
          onFocus={onFocus}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
