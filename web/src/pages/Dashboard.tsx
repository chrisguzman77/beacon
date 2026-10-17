import LoginButton from '@/components/LoginButton'
import MapView from '@/components/MapView'

export default function Dashboard() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
        <h1 className="text-heading font-semibold tracking-tight">PlanIT Beacon</h1>
        <LoginButton />
      </header>
      <main className="flex-1">
        <MapView />
      </main>
    </div>
  )
}
