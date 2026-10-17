import { useAuth0 } from '@auth0/auth0-react'
import { Button } from '@/components/ui/button'

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
  if (!import.meta.env.VITE_AUTH0_DOMAIN) return <Button disabled title="Set VITE_AUTH0_DOMAIN in web/.env">Log in</Button>
  return <Auth0Login />
}
