import { Link, useRouter } from '@tanstack/react-router'
import { AuthLayout } from '@/features/auth/auth-layout'
import { LoginForm } from '@/features/auth/login-form'
import { homePathForRole, useAuthStore } from '@/stores/auth'

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to AgentOps Control Center">
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
      <p className="mt-5 text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline" data-testid="goto-register">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
