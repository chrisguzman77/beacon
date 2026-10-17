import { Auth0Provider } from '@auth0/auth0-react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Web from './pages/Web'
import Crew from './pages/Crew'

const env = import.meta.env

function Auth({ children }: { children: ReactNode }) {
  if (!env.VITE_AUTH0_DOMAIN || !env.VITE_AUTH0_CLIENT_ID) return <>{children}</>
  return (
    <Auth0Provider
      domain={env.VITE_AUTH0_DOMAIN}
      clientId={env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin, audience: env.VITE_AUTH0_AUDIENCE }}
    >
      {children}
    </Auth0Provider>
  )
}

export default function App() {
  return (
    <Auth>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/web" element={<Web />} />
          <Route path="/web/:id" element={<Web />} />
          {/* The site page proper (device card, muster, briefing) replaces this when it is built. */}
          <Route path="/site/:id" element={<Web />} />
          <Route path="/crew" element={<Crew />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </Auth>
  )
}
