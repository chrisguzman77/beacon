import { Auth0Provider } from '@auth0/auth0-react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Hub from './pages/Hub'
import FieldView from './sweet-treats/field-view/FieldView'
import Crew from './pages/Crew'
import ErrorBoundary from './components/ErrorBoundary'

const env = import.meta.env

function Auth({ children }: { children: ReactNode }) {
  if (!env.VITE_AUTH0_DOMAIN || !env.VITE_AUTH0_CLIENT_ID) return <>{children}</>
  return (
    <Auth0Provider
      domain={env.VITE_AUTH0_DOMAIN}
      clientId={env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin, audience: env.VITE_AUTH0_AUDIENCE }}
      // Back to the page the person signed in from (the crew page), not the root.
      onRedirectCallback={(state) => {
        history.replaceState(null, '', state?.returnTo ?? '/')
        dispatchEvent(new PopStateEvent('popstate'))
      }}
    >
      {children}
    </Auth0Provider>
  )
}

export default function App() {
  return (
    <Auth>
      <BrowserRouter>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/hub" element={<Hub />} />
          <Route path="/hub/:id" element={<Hub />} />
          {/* HUB is the site page; the dashboard links here. */}
          <Route path="/site/:id" element={<Hub />} />
          {/* Field View: the stored WEB version (sweet treats), reachable but not in the tabs. */}
          <Route path="/field-view" element={<FieldView />} />
          <Route path="/field-view/:id" element={<FieldView />} />
          <Route path="/web/*" element={<Navigate to="/hub" replace />} />
          <Route path="/crew" element={<Crew />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </Auth>
  )
}
