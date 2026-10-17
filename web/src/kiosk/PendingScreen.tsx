import { ArrowLeft } from 'lucide-react'
import KioskButton from './KioskButton'

// Placeholder for the kiosk screens that land in the next block.
export default function PendingScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col p-4">
      <KioskButton className="h-tap w-52" icon={ArrowLeft} label="Back" onClick={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-heading font-semibold uppercase">{title}</p>
        <p className="text-body text-dim">This screen is still being built.</p>
      </div>
    </div>
  )
}
