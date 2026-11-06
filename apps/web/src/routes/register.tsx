import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AuthLayout } from '@/features/auth/auth-layout'
import { RegisterForm } from '@/features/auth/register-form'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { homePathForRole, useAuthStore } from '@/stores/auth'

export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  useDocumentTitle('Create account')
  return (
    <AuthLayout title="Create an account">
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
      <p className="mt-6 text-13 text-text-secondary">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-accent-text hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
