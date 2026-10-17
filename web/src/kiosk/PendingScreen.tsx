import { ArrowLeft } from 'lucide-react'

// Placeholder for the kiosk screens that land in the next block.
export default function PendingScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col p-4">
      <button
        onClick={onBack}
        className="flex h-tap w-48 items-center justify-center gap-3 rounded-xl bg-raised text-body font-semibold active:bg-line"
      >
        <ArrowLeft className="size-7" /> BACK
      </button>
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-heading font-semibold uppercase">{title}</p>
        <p className="text-body text-dim">This screen is still being built.</p>
      </div>
    </div>
  )
}
