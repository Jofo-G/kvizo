import { cn } from '@/shared/lib/utils'
import type { ReactNode } from 'react'

interface CardProps {
  className?: string
  children: ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-5 bg-[#10131e] border border-[#c8a84b]',
        'shadow-[0_0_15px_rgba(200,168,75,0.12),inset_0_0_20px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
