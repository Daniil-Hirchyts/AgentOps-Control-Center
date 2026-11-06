import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/lib/hooks'

export function NotFoundPage() {
  useDocumentTitle('Not found')
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-sm flex-col justify-center gap-2 p-6">
      <p className="text-13 text-text-tertiary tabular-nums">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-text-secondary">The page you are looking for does not exist or was moved.</p>
      <Button asChild className="mt-3 w-fit">
        <Link to="/">Go to start</Link>
      </Button>
    </div>
  )
}
