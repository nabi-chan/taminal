import { useStore } from "@tanstack/react-store"
import { parseAsString, useQueryState } from "nuqs"

import { SEARCH_PARAMS_KEY } from "@/constants/search-params-key"
import { getWorkspaceById, workspaceStore } from "@/lib/workspace-store"

export function useActiveWorkspace() {
  const [activeId, setActiveId] = useQueryState(
    SEARCH_PARAMS_KEY.WORKSPACE,
    parseAsString.withDefault("").withOptions({ history: "push" }),
  )

  const workspace = useStore(workspaceStore, (s) => getWorkspaceById(s, activeId))

  return { activeId, setActiveId, workspace }
}
