// The one place colors, type and sizes are defined. applyTokens() writes them to
// CSS variables, index.css maps those into the Tailwind theme, and JS (the map,
// charts) imports the same values. Never type a raw color anywhere else.

export const color = {
  bg: '#0B1220',
  surface: '#131C2E',
  raised: '#1C2840',
  border: '#2A3753',
  text: '#F1F5F9',
  muted: '#8FA0BA',
  online: '#22C55E',
  offline: '#F59E0B',
}

// One color per hazard type, used identically on every screen.
export const hazard = {
  stopwork: '#EF4444', // lightning and stop work
  heat: '#F59E0B',
  flood: '#3B82F6',
  wildlife: '#10B981',
  unsafe: '#A855F7', // beacon tilt, e-stop
}

// Full screen takeover backgrounds: deeper than the hazard color so white text holds contrast.
export const takeover = {
  stopwork: '#B91C1C',
  unsafe: '#6B21A8',
}

export type HazardKey = keyof typeof hazard

export const alertHazard: Record<string, HazardKey> = {
  stopwork: 'stopwork',
  heat_danger: 'heat',
  flood_confirmed: 'flood',
  wildlife: 'wildlife',
  beacon_unsafe: 'unsafe',
  estop: 'unsafe',
}

// Hazard index 0 to 10, green through yellow to red. The only gradient in the app.
export const indexStops = { low: '#22C55E', mid: '#EAB308', high: '#EF4444' }

export function indexColor(index: number): string {
  if (index <= 3) return indexStops.low
  if (index <= 6) return indexStops.mid
  return indexStops.high
}

// Type scale in px. Display is for the index number, countdown is the kiosk countdown only.
export const type = {
  countdown: 240,
  display: 120,
  heading: 32,
  body: 20,
  label: 14,
}

export const kiosk = {
  width: 800,
  height: 480,
  tap: 76, // 20 mm on the 7 inch screen
}

export const motion = { ms: 200, ease: 'cubic-bezier(0.2, 0, 0, 1)' }

export function applyTokens() {
  const s = document.documentElement.style
  for (const [k, v] of Object.entries(color)) s.setProperty(`--t-${k}`, v)
  for (const [k, v] of Object.entries(hazard)) s.setProperty(`--hz-${k}`, v)
  for (const [k, v] of Object.entries(takeover)) s.setProperty(`--takeover-${k}`, v)
  for (const [k, v] of Object.entries(indexStops)) s.setProperty(`--idx-${k}`, v)
  for (const [k, v] of Object.entries(type)) s.setProperty(`--fs-${k}`, `${v}px`)
  s.setProperty('--tap', `${kiosk.tap}px`)
  s.setProperty('--motion-ms', `${motion.ms}ms`)
  s.setProperty('--motion-ease', motion.ease)
}
