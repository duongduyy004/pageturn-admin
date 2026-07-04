import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Dialog({ open, title, onClose, children, wide }: DialogProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(16,35,28,.45)] p-6" onClick={onClose}>
      <div
        className={wide ? "max-h-[calc(100vh-48px)] w-[min(480px,100%)] overflow-auto rounded-[10px] bg-white shadow-[0_24px_70px_rgba(16,35,28,.25)] w-[min(860px,100%)]" : "max-h-[calc(100vh-48px)] w-[min(480px,100%)] overflow-auto rounded-[10px] bg-white shadow-[0_24px_70px_rgba(16,35,28,.25)]"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[#edf0eb] bg-white px-5 py-[18px]">
          <h2 className="m-0 text-lg font-bold leading-tight tracking-normal text-[#17211b]">{title}</h2>
          <button type="button" className="inline-flex rounded-md border-0 bg-transparent p-1 text-[#66746b] hover:bg-[#edf0eb] hover:text-[#17211b]" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3 p-5 [&_form]:grid [&_form]:gap-3">{children}</div>
      </div>
    </div>
  )
}
