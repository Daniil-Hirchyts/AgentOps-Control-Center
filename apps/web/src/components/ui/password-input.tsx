import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from './input'

/** A password field with a button that shows or hides what was typed. */
function PasswordInput({ className, id, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input id={id} type={visible ? 'text' : 'password'} className={cn('pe-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center rounded-e-md text-text-tertiary transition-colors duration-150 hover:text-text focus-visible:-outline-offset-2 [&_svg]:size-4"
      >
        {visible ? <EyeOff aria-hidden strokeWidth={1.75} /> : <Eye aria-hidden strokeWidth={1.75} />}
      </button>
    </div>
  )
}

export { PasswordInput }
