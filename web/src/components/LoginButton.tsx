import { useAuth0 } from '@auth0/auth0-react'
import { Button } from '@/components/ui/button'
import { authOn } from '@/lib/auth'

function Auth0Login() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0()
  if (isLoading) return <Button variant="secondary" disabled>Signing in…</Button>
  if (isAuthenticated)
    return (
      <Button variant="secondary" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
        Sign out {user?.name}
      </Button>
    )
  return <Button onClick={() => loginWithRedirect()}>Log in</Button>
}

export default function LoginButton() {
  // Auth0 is on only with both the domain and the client id (App.tsx mounts the provider on the same rule).
  if (!authOn) return <Button disabled title="Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in web/.env">Log in</Button>
  return <Auth0Login />
}
