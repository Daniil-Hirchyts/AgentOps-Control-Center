import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { CircularLoader } from '@/components/prompt-kit/loader'
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
    text: 'Opens cases and runs the agent.',
  },
  {
    value: 'REVIEWER',
    title: 'Reviewer',
    text: 'Approves or rejects what the agent proposes.',
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
          aria-describedby={errors.username ? 'username-error' : 'username-hint'}
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
          aria-describedby={errors.password ? 'password-error' : 'password-hint'}
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
          aria-describedby={errors.confirm ? 'confirm-error' : undefined}
          {...register('confirm')}
        />
      </FormField>

      <fieldset>
        <legend className="mb-1.5 text-13 font-medium">Role</legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const checked = role === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                  checked ? 'border-accent-solid bg-accent-subtle' : 'hover:bg-bg-muted',
                )}
              >
                <input
                  type="radio"
                  value={opt.value}
                  className="sr-only"
                  data-testid={`register-role-${opt.value.toLowerCase()}`}
                  {...register('role')}
                />
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 size-4 shrink-0 rounded-full border',
                    checked ? 'border-[5px] border-accent-solid' : 'border-border-strong',
                  )}
                />
                <span>
                  <span className="block text-sm font-medium">{opt.title}</span>
                  <span className="block text-13 text-text-secondary">{opt.text}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {serverError && (
        <p role="alert" className="text-13 text-danger-text">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full sm:h-10" disabled={isSubmitting} data-testid="register-submit">
        {isSubmitting && <CircularLoader size="sm" className="text-current" />}
        Create account
      </Button>
    </form>
  )
}
