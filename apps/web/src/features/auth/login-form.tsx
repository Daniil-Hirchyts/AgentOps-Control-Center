import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CircularLoader } from '@/components/prompt-kit/loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { LoginResponse } from '@/lib/types'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts'
import { UserAvatar } from '@/components/shared/presence'
import { FormField } from './form-field'
import { loginSchema, type LoginValues } from './schemas'


export function LoginForm({ onSuccess }: { onSuccess: (session: LoginResponse) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const session = await api.login(values)
      onSuccess(session)
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.status === 401 ? 'Invalid username or password' : errorMessage(err),
      )
    }
  })

  const fillDemo = (username: string) => {
    setValue('username', username, { shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldValidate: true })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="login-form">
      <FormField id="username" label="Username" error={errors.username?.message}>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          data-testid="login-username"
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
          {...register('username')}
        />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          data-testid="login-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
      </FormField>

      {serverError && (
        <p role="alert" data-testid="login-error" className="text-13 text-danger-text">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full sm:h-10" disabled={isSubmitting} data-testid="login-submit">
        {isSubmitting && <CircularLoader size="sm" className="text-current" />}
        Sign in
      </Button>

      <div className="border-t pt-5" data-testid="demo-accounts">
        <p className="text-13 text-text-secondary">Demo accounts · synthetic data</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.username}
              type="button"
              onClick={() => fillDemo(a.username)}
              className="pressable flex h-11 items-center gap-2.5 rounded-xl border px-2.5 text-start text-13 transition-colors duration-150 hover:bg-bg-muted"
            >
              <UserAvatar username={a.username} size="sm" />
              <span className="flex-1 font-medium">{a.username}</span>
              <span className="text-text-tertiary">{a.role}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-13 text-text-tertiary">
          Password <code className="font-mono text-text-secondary">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </form>
  )
}
