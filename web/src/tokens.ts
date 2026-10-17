// The one place colors, type and sizes are defined. applyTokens() writes them to
// CSS variables, index.css maps those into the Tailwind theme, and JS (the map,
// charts) imports the same values. Never type a raw color anywhere else.

// Technical safety: near-black with green-tinted panels and a bright signal green for
// edges and controls. High contrast so the kiosk reads in sun, glare, rain and at night.
export const color = {
  bg: '#040806',
  surface: '#0A140F',
  raised: '#102019',
  border: '#2B6B48',
  text: '#F0FFF6',
  muted: '#8DB8A0',
  signal: '#00FF88', // UI chrome: panel edges, control stripes, pressed state. Never a hazard meaning
  online: '#00FF88',
  offline: '#FFB300',
}

// One color per hazard type, used identically on every screen.
export const hazard = {
  stopwork: '#FF3B30', // lightning and stop work
  heat: '#FFB300',
  flood: '#00D4FF',
  wildlife: '#FF5FD2', // magenta, green is taken by the UI and means "safe"
  unsafe: '#C77DFF', // beacon tilt, e-stop
}

// Full screen takeover backgrounds: saturated but deep enough that white text holds contrast.
export const takeover = {
  stopwork: '#D50000',
  unsafe: '#7B1FA2',
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
export const indexStops = { low: '#00FF88', mid: '#FFD600', high: '#FF3B30' }

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
