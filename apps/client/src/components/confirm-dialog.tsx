import NiceModal, { useModal } from "@ebay/nice-modal-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}

export const ConfirmDialog = NiceModal.create(
  ({ title, description, confirmLabel = "삭제", onConfirm }: ConfirmDialogProps) => {
    const modal = useModal()

    return (
      <AlertDialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => modal.hide()}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onConfirm()
                modal.hide()
              }}>
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  },
)
