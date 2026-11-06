import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CircularLoader } from '@/components/prompt-kit/loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiError, errorMessage } from '@/lib/api'
import type { LoginResponse } from '@/lib/types'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts'
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
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          data-testid="login-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
      </FormField>

      {serverError && (
        <p role="alert" data-testid="login-error" className="text-13 text-danger">
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
              className="pressable flex h-10 items-center justify-between rounded-md border px-3 text-left text-13 hover:bg-bg-muted"
            >
              <span className="font-medium">{a.username}</span>
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
