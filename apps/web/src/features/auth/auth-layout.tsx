import { Wordmark } from '@/components/shared/logo'
import type { ReactNode } from 'react'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 sm:items-center sm:justify-center sm:pt-10">
      <div className="w-full sm:max-w-[22rem]">
        <Wordmark className="mb-10 flex w-fit sm:mb-8" />
        <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
