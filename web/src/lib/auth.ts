import { useAuth0 } from '@auth0/auth0-react'

// Auth0 for people (contracts/api.md: Bearer JWT). Off when VITE_AUTH0_DOMAIN is not set, which is
// fixed per build, so the hook below always takes the same branch.
export const authOn = Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID)

type Auth = { ready: boolean; signedIn: boolean; name?: string; signIn: () => void; token: () => Promise<string | null> }

const off: Auth = { ready: true, signedIn: false, signIn: () => {}, token: async () => null }

export function useAuth(): Auth {
  if (!authOn) return off
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const a = useAuth0()
  return {
    ready: !a.isLoading,
    signedIn: a.isAuthenticated,
    name: a.user?.given_name ?? a.user?.name ?? a.user?.nickname,
    signIn: () => a.loginWithRedirect({ appState: { returnTo: location.pathname + location.search } }),
    token: () => a.getAccessTokenSilently().then((t) => t ?? null, () => null),
  }
}
