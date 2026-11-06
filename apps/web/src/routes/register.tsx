import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AuthLayout } from '@/features/auth/auth-layout'
import { RegisterForm } from '@/features/auth/register-form'
import { api } from '@/lib/api'
import { homePathForRole, useAuthStore } from '@/stores/auth'

export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  return (
    <AuthLayout title="Create an account" subtitle="Join your team's AgentOps workspace">
      <RegisterForm
        onSuccess={async (account, password) => {
          toast.success(`Account ${account.username} created`)
          try {
            const session = await api.login({ username: account.username, password })
            setSession(session)
            void navigate({ to: homePathForRole(session.user.role) })
          } catch {
            void navigate({ to: '/login' })
          }
        }}
      />
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
