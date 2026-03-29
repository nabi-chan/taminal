import type { ConnectionInfo } from "./use-terminal"

import { cn } from "@/lib/utils"

import { useTerminal } from "./use-terminal"

interface TerminalProps {
  terminalId: string
  workspaceId: string
  connectionInfo?: ConnectionInfo
  sessionId?: string
  isFocused?: boolean
}

export function Terminal({ terminalId, workspaceId, connectionInfo, sessionId, isFocused }: TerminalProps) {
  const { container } = useTerminal({ terminalId, workspaceId, connectionInfo, sessionId })

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[#282c34] p-4",
        isFocused && "shadow-[inset_0_0_0_1px_rgba(97,175,239,0.15)]",
      )}>
      <div className="absolute top-4 right-2 bottom-4 left-4" ref={container} />
    </div>
  )
}
