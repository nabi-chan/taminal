import type { FormEvent } from "react"

import NiceModal, { useModal } from "@ebay/nice-modal-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateWorkspace } from "@/lib/workspace-store"

interface EditWorkspaceDialogProps {
  workspaceId: string
  currentName: string
  currentDescription: string
}

export const EditWorkspaceDialog = NiceModal.create(
  ({ workspaceId, currentName, currentDescription }: EditWorkspaceDialogProps) => {
    const modal = useModal()
    const [name, setName] = useState(currentName)
    const [description, setDescription] = useState(currentDescription)

    const handleSubmit = (e: FormEvent) => {
      e.preventDefault()
      if (!name.trim()) return
      updateWorkspace(workspaceId, { name: name.trim(), description: description.trim() })
      modal.hide()
    }

    return (
      <Dialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>워크스페이스 수정</DialogTitle>
            <DialogDescription>워크스페이스 이름과 설명을 수정하세요</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-ws-name">이름</Label>
              <Input id="edit-ws-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-ws-desc">설명</Label>
              <Input id="edit-ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">
              저장
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    )
  },
)
