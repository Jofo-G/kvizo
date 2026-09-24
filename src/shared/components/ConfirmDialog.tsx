import { useEffect, useState } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !confirming) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, confirming, onCancel])

  if (!open) return null

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
      <div
        className="w-full max-w-md rounded-lg border border-[#c8a84b] bg-[#10131e] p-5 shadow-[0_0_25px_rgba(200,168,75,0.25)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-[#e8d5a0]">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="md" className="min-w-28" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="md" className="min-w-28" onClick={handleConfirm} disabled={confirming}>
            {confirming ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
