import { cn } from '@/shared/lib/utils'
import { Loader2 } from 'lucide-react'

interface Props {
  className?: string
}

export function LoadingSpinner({ className }: Props) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  )
}
