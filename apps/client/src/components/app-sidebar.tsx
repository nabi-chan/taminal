import NiceModal from "@ebay/nice-modal-react"
import { useStore } from "@tanstack/react-store"
import { FolderIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, TerminalSquareIcon, Trash2Icon } from "lucide-react"

import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog"
import { EditWorkspaceDialog } from "@/components/edit-workspace-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { removeWorkspace, workspaceStore } from "@/lib/workspace-store"

export function AppSidebar() {
  const workspaces = useStore(workspaceStore, (s) => s.workspaces)
  const { activeId, setActiveId } = useActiveWorkspace()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-linear-to-br from-[#61afef] to-[#528bff]">
                <TerminalSquareIcon className="size-4 text-white" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sidebar-foreground font-semibold tracking-tight">Taminal</span>
                <span className="text-muted-foreground text-xs">SSH Terminal Client</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs tracking-widest uppercase">
            워크스페이스
          </SidebarGroupLabel>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarGroupAction onClick={() => NiceModal.show(CreateWorkspaceDialog, { onCreated: setActiveId })}>
                <PlusIcon />
                <span className="sr-only">워크스페이스 만들기</span>
              </SidebarGroupAction>
            </TooltipTrigger>
            <TooltipContent>워크스페이스 만들기</TooltipContent>
          </Tooltip>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaces.map((ws) => (
                <SidebarMenuItem key={ws.id}>
                  <SidebarMenuButton
                    className="group-has-data-[state=open]/menu-item:bg-sidebar-accent h-fit"
                    isActive={ws.id === activeId}
                    onClick={() => setActiveId(ws.id)}>
                    <FolderIcon className="text-muted-foreground size-4 shrink-0" />
                    <span className="flex flex-1 flex-col space-y-0.5 overflow-hidden">
                      <span className="text-sidebar-foreground truncate text-[13px] font-medium">{ws.name}</span>
                      {ws.description && (
                        <span className="text-muted-foreground truncate text-xs">{ws.description}</span>
                      )}
                    </span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction>
                        <MoreHorizontalIcon />
                        <span className="sr-only">더보기</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        onClick={() =>
                          NiceModal.show(EditWorkspaceDialog, {
                            workspaceId: ws.id,
                            currentName: ws.name,
                            currentDescription: ws.description,
                          })
                        }>
                        <PencilIcon />
                        <span>수정</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          removeWorkspace(ws.id)
                          if (activeId === ws.id) {
                            const remaining = workspaces.filter((w) => w.id !== ws.id)
                            setActiveId(remaining[0]?.id ?? "")
                          }
                        }}>
                        <Trash2Icon />
                        <span>삭제</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
              {workspaces.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
                  <FolderIcon className="text-muted-foreground size-8" />
                  <p className="text-muted-foreground text-xs">워크스페이스가 없습니다</p>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <div className="text-muted-foreground px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
          Cmd+D 분할 · Cmd+T 새 탭
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
