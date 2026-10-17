// The one place colors, type and sizes are defined. applyTokens() writes them to
// CSS variables, index.css maps those into the Tailwind theme, and JS (the map,
// charts) imports the same values. Never type a raw color anywhere else.

// The MARSH design (Cam's Figma, web/design/marsh), colors sampled from the screens. MARSH is a
// style example only; nothing here is tied to one place or climate.
export const color = {
  bg: '#E8EADF', // page
  surface: '#F8F9F2', // cards
  raised: '#DCE4D3', // sage tiles, table headers
  border: '#D7DCD1',
  text: '#1D2822', // ink
  muted: '#5F6B62',
  signal: '#3F7D4E', // OK and checks. Never a hazard meaning
  online: '#3F7D4E',
  offline: '#B7791F',
  chrome: '#17221D', // top bar and dark panels
  chromeSoft: '#27322B', // bottom bar and dark tabs
  chromeText: '#F5F7ED',
  accent: '#F4BD4F', // amber: active tab, primary action, urgent banner
  accentPale: '#FAE7B6', // warning banners and callouts
  accentInk: '#1D2822',
  forest: '#465E3B',
}

// One color per hazard type, used identically on every screen. Deep enough to read on paper.
export const hazard = {
  stopwork: '#C8352B', // lightning and stop work
  heat: '#C98A12',
  flood: '#1F7FA8',
  wildlife: '#B23C8E',
  unsafe: '#7A4FC2', // beacon tilt, e-stop
}

// Full screen takeover backgrounds: saturated but deep enough that white text holds contrast.
export const takeover = {
  stopwork: '#D50000',
  unsafe: '#7B1FA2',
}

// Replica of the beacon's own displays on the device card: LCD1602 backlight and the LED digits.
export const device = { lcdBg: '#1E3FA8', lcdInk: '#E8F0FF', digit: '#FF2A1A', digitOff: '#2A0A08' }

export type HazardKey = keyof typeof hazard

export const alertHazard: Record<string, HazardKey> = {
  stopwork: 'stopwork',
  heat_danger: 'heat',
  heat_warning: 'heat',
  flood_confirmed: 'flood',
  flood_warning: 'flood',
  wildlife: 'wildlife',
  beacon_unsafe: 'unsafe',
  estop: 'unsafe',
}

export const hazardLabel: Record<HazardKey, string> = {
  stopwork: 'Stop work',
  heat: 'Heat',
  flood: 'Flood',
  wildlife: 'Wildlife',
  unsafe: 'Beacon unsafe',
}

// Hazard index 0 to 10, green through yellow to red. The only gradient in the app.
export const indexStops = { low: '#3F7D4E', mid: '#C98A12', high: '#C8352B' }

export function indexColor(index: number): string {
  if (index <= 3) return indexStops.low
  if (index <= 6) return indexStops.mid
  return indexStops.high
}

// Type scale in px. Display is for the index number, countdown is the alarm state countdown only.
export const type = {
  countdown: 240,
  display: 120,
  heading: 34,
  body: 16,
  label: 13,
}

export const size = {
  tap: 76, // minimum control height, gloved thumbs on the crew phone page
}

export const motion = { ms: 200, ease: 'cubic-bezier(0.2, 0, 0, 1)' }

// Corners and depth: soft 6 px rounding, light shadows, no glow (the MARSH cards).
export const shape = { round: 6, shadow: 0.08 }

export function applyTokens() {
  const s = document.documentElement.style
  for (const [k, v] of Object.entries(color)) s.setProperty(`--t-${k}`, v)
  for (const [k, v] of Object.entries(hazard)) s.setProperty(`--hz-${k}`, v)
  for (const [k, v] of Object.entries(takeover)) s.setProperty(`--takeover-${k}`, v)
  for (const [k, v] of Object.entries(indexStops)) s.setProperty(`--idx-${k}`, v)
  for (const [k, v] of Object.entries(type)) s.setProperty(`--fs-${k}`, `${v}px`)
  s.setProperty('--tap', `${size.tap}px`)
  s.setProperty('--motion-ms', `${motion.ms}ms`)
  s.setProperty('--motion-ease', motion.ease)
}
