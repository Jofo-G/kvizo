import { cn } from '@/shared/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#9d8a5e] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full rounded border bg-[#080a10] px-4 py-2.5 text-base',
          'text-[#e8d5a0] placeholder-[#6b5e42]',
          'border-[#7a5c1c] outline-none transition-all duration-200',
          'focus:border-[#c8a84b] focus:shadow-[0_0_8px_rgba(200,168,75,0.25)]',
          error && 'border-red-500 focus:border-red-500 focus:shadow-[0_0_8px_rgba(239,68,68,0.25)]',
          className,
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
