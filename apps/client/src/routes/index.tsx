import { createFileRoute } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-store"
import { useEffect } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Workspace } from "@/components/workspace"
import { loadFromDb, workspaceStore } from "@/lib/workspace-store"

export const Route = createFileRoute("/")({
  component: IndexPage,
})

function IndexPage() {
  const loaded = useStore(workspaceStore, (s) => s.loaded)

  useEffect(() => {
    loadFromDb()
  }, [])

  if (!loaded) return null

  return (
    <SidebarProvider className="h-screen w-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1">
        <Workspace />
      </div>
    </SidebarProvider>
  )
}
