import { Link, useRouter } from '@tanstack/react-router'
import { AuthLayout } from '@/features/auth/auth-layout'
import { LoginForm } from '@/features/auth/login-form'
import { useDocumentTitle } from '@/lib/hooks'
import { homePathForRole, useAuthStore } from '@/stores/auth'

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  useDocumentTitle('Sign in')
  return (
    <AuthLayout title="Sign in" subtitle="Supervise AI agents and approve what they do.">
      <LoginForm
        onSuccess={(session) => {
          setSession(session)
          const home = homePathForRole(session.user.role)
          // only honour a redirect into the user's own area (or shared pages)
          const target =
            redirectTo && (redirectTo.startsWith(home) || redirectTo.startsWith('/messages')) ? redirectTo : home
          router.history.push(target)
        }}
      />
      <p className="mt-6 text-13 text-text-secondary">
        No account?{' '}
        <Link to="/register" className="font-medium text-accent-text hover:underline" data-testid="goto-register">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
