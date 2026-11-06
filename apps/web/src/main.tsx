import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { bootstrapSession } from './features/auth/session'
import { applyTheme, useUiStore } from './stores/ui'
import './styles/index.css'

applyTheme(useUiStore.getState().theme)

const root = createRoot(document.getElementById('root')!)
// Restore the session from the HttpOnly refresh cookie before routing,
// so a page reload keeps the user signed in.
void bootstrapSession().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
