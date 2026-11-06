import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
        <div
          role="alert"
          data-testid="login-error"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="login-submit">
        {isSubmitting && <Loader2 className="animate-spin" />}
        Sign in
      </Button>

      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground" data-testid="demo-accounts">
        <p className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
          <Info className="size-3.5" /> Demo accounts (synthetic test data)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.username}
              type="button"
              onClick={() => fillDemo(a.username)}
              className="rounded border bg-card px-2 py-1 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {a.username} <span className="text-muted-foreground">· {a.role}</span>
            </button>
          ))}
        </div>
        <p className="mt-2">
          Password: <code className="font-mono">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </form>
  )
}
