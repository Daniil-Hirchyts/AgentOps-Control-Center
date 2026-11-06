import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ShieldCheck, Workflow } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { AccountCreated } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FormField } from './form-field'
import { registerSchema, type RegisterValues } from './schemas'

const ROLE_OPTIONS = [
  {
    value: 'OPERATOR',
    title: 'Operator',
    icon: Workflow,
    text: 'Creates invoice investigations and launches AI analyses.',
  },
  {
    value: 'REVIEWER',
    title: 'Reviewer',
    icon: ShieldCheck,
    text: 'Approves or rejects actions proposed by the AI agent.',
  },
] as const

export function RegisterForm({ onSuccess }: { onSuccess: (account: AccountCreated, password: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', password: '', confirm: '', role: 'OPERATOR' },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit(async ({ username, password, role }) => {
    setServerError(null)
    try {
      const account = await api.register({ username, password, role })
      onSuccess(account, password)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('username', { message: 'This username is already taken' })
      } else {
        setServerError(errorMessage(err))
      }
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="register-form">
      <FormField
        id="username"
        label="Username"
        error={errors.username?.message}
        hint="3–32 characters: letters, digits, _ . -"
      >
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          data-testid="register-username"
          aria-invalid={!!errors.username}
          {...register('username')}
        />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message} hint="At least 8 characters">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          data-testid="register-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
      </FormField>
      <FormField id="confirm" label="Confirm password" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          data-testid="register-confirm"
          aria-invalid={!!errors.confirm}
          {...register('confirm')}
        />
      </FormField>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Role</legend>
        <div className="grid gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const checked = role === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                  checked ? 'border-primary bg-accent/60' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  value={opt.value}
                  className="sr-only"
                  data-testid={`register-role-${opt.value.toLowerCase()}`}
                  {...register('role')}
                />
                <Icon className={cn('mt-0.5 size-4', checked ? 'text-primary' : 'text-muted-foreground')} />
                <span>
                  <span className="block text-sm font-medium">{opt.title}</span>
                  <span className="block text-xs text-muted-foreground">{opt.text}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {serverError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="register-submit">
        {isSubmitting && <Loader2 className="animate-spin" />}
        Create account
      </Button>
    </form>
  )
}
