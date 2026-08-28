import { cn } from '@/shared/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-200 select-none cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' && [
          'bg-gradient-to-b from-[#d4a843] to-[#7a5c1c]',
          'text-[#1a0e00]',
          'border border-[#f0c040]',
          'shadow-[0_1px_0_rgba(255,220,80,0.3)_inset,0_0_10px_rgba(200,168,75,0.3)]',
          'hover:from-[#e8c060] hover:to-[#9a7820]',
          'hover:shadow-[0_0_18px_rgba(200,168,75,0.5)]',
          'active:from-[#9a7820] active:to-[#5a3e0e]',
        ],
        variant === 'secondary' && [
          'bg-[#10131e] text-[#c8a84b]',
          'border border-[#c8a84b]',
          'shadow-[0_0_6px_rgba(200,168,75,0.1)]',
          'hover:bg-[#161a28] hover:text-[#f0c040] hover:border-[#f0c040]',
          'hover:shadow-[0_0_12px_rgba(200,168,75,0.25)]',
        ],
        variant === 'danger' && [
          'bg-gradient-to-b from-[#c0392b] to-[#7f1d1d]',
          'text-white border border-[#ef4444]',
          'shadow-[0_0_8px_rgba(239,68,68,0.2)]',
          'hover:from-[#e74c3c] hover:to-[#991b1b]',
          'hover:shadow-[0_0_14px_rgba(239,68,68,0.4)]',
        ],
        variant === 'ghost' && [
          'bg-transparent text-[#9d8a5e] border border-transparent',
          'hover:text-[#c8a84b] hover:bg-[#c8a84b]/10 hover:border-[#c8a84b]/20',
        ],
        size === 'sm' && 'px-3 py-1.5 text-xs rounded',
        size === 'md' && 'px-5 py-2.5 text-sm rounded-md',
        size === 'lg' && 'px-7 py-3 text-base rounded-md uppercase tracking-wider',
        className,
      )}
      {...props}
    />
  )
}
