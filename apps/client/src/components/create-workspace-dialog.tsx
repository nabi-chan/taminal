import type { FormEvent } from "react"

import NiceModal, { useModal } from "@ebay/nice-modal-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspace } from "@/lib/workspace-store"

interface CreateWorkspaceDialogProps {
  onCreated?: (id: string) => void
}

export const CreateWorkspaceDialog = NiceModal.create(({ onCreated }: CreateWorkspaceDialogProps) => {
  const modal = useModal()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const id = createWorkspace(name.trim(), description.trim())
    onCreated?.(id)
    modal.hide()
  }

  return (
    <Dialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>워크스페이스 만들기</DialogTitle>
          <DialogDescription>새로운 워크스페이스를 만들어 터미널 세션을 관리하세요</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ws-name">이름</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="프로덕션 서버"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ws-desc">설명</Label>
            <Input
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="프로덕션 환경 관리용"
            />
          </div>
          <Button type="submit" className="w-full">
            만들기
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
})
