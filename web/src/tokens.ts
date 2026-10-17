// The one place colors, type and sizes are defined. applyTokens() writes them to
// CSS variables, index.css maps those into the Tailwind theme, and JS (the map,
// charts) imports the same values. Never type a raw color anywhere else.

// Technical safety: near-black with green-tinted panels and a bright signal green for
// edges and controls. High contrast so the room display and phones read in sun, glare and dim venues.
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
  chrome: '#040806', // MARSH frame bars (top bar, bottom nav)
  chromeText: '#F0FFF6',
  accent: '#00FF88', // active tab and primary action
  accentInk: '#040806', // text on the accent
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
export const indexStops = { low: '#00FF88', mid: '#FFD600', high: '#FF3B30' }

export function indexColor(index: number): string {
  if (index <= 3) return indexStops.low
  if (index <= 6) return indexStops.mid
  return indexStops.high
}

// Type scale in px. Display is for the index number, countdown is the alarm state countdown only.
export const type = {
  countdown: 240,
  display: 120,
  heading: 32,
  body: 20,
  label: 14,
}

export const size = {
  tap: 76, // minimum control height, gloved thumbs on the crew phone page
}

export const motion = { ms: 200, ease: 'cubic-bezier(0.2, 0, 0, 1)' }

// Shape and depth for the current look.
export const shape = { round: 0, glow: true, shadow: 0.7, stripes: true, marsh: false }

// Looks, picked with ?look= (remembered in this browser). tech is the original; field, night and
// hybrid interpret Cam's MARSH Figma screens (web/design/marsh), which are a style example only:
// nothing here is tied to one place or climate. Each look swaps colors and shape only.
type Look = { color: Partial<typeof color>; hazard?: Partial<typeof hazard>; index?: typeof indexStops; shape: Partial<typeof shape> }
const lightHazard = { stopwork: '#C8352B', heat: '#C98A12', flood: '#1F7FA8', wildlife: '#B23C8E', unsafe: '#7A4FC2' }
const fieldColor = {
  bg: '#E8EADF', surface: '#F6F6EF', raised: '#DDE5D3', border: '#C6CDBB', text: '#18221B', muted: '#5E6B60',
  signal: '#2F6B3F', online: '#2F8F4E', offline: '#B7791F', chrome: '#18221B', chromeText: '#EEF0E6', accent: '#F2B94B', accentInk: '#18221B',
}
export const looks: Record<string, Look> = {
  tech: { color: {}, shape: {} },
  field: { color: fieldColor, hazard: lightHazard, index: { low: '#2F8F4E', mid: '#C98A12', high: '#C8352B' }, shape: { round: 8, glow: false, shadow: 0.12, stripes: false, marsh: true } },
  night: {
    color: {
      bg: '#111915', surface: '#18231C', raised: '#213027', border: '#34473A', text: '#EEF0E6', muted: '#9DAA98',
      signal: '#8CC78A', online: '#8CC78A', offline: '#F2B94B', chrome: '#0A0F0C', chromeText: '#EEF0E6', accent: '#F2B94B', accentInk: '#18221B',
    },
    hazard: { stopwork: '#FF5A4E', heat: '#F2B94B', flood: '#4FC3E8', wildlife: '#F07AC8', unsafe: '#B794F6' },
    index: { low: '#8CC78A', mid: '#F2B94B', high: '#FF5A4E' },
    shape: { round: 8, glow: false, shadow: 0.5, stripes: false, marsh: true },
  },
  hybrid: { color: fieldColor, hazard: lightHazard, index: { low: '#2F8F4E', mid: '#C98A12', high: '#C8352B' }, shape: { round: 0, glow: false, shadow: 0.14, stripes: true, marsh: true } },
}

function pickLook() {
  let id = new URLSearchParams(location.search).get('look')
  try {
    if (id && looks[id]) localStorage.setItem('look', id)
    else id = localStorage.getItem('look')
  } catch {
    /* no storage, URL only */
  }
  return id && looks[id] ? id : 'tech'
}
export const lookId = pickLook()

// Applied as this module loads, so every component reads the chosen look's values.
const look = looks[lookId]
Object.assign(color, look.color)
Object.assign(hazard, look.hazard ?? {})
Object.assign(indexStops, look.index ?? {})
Object.assign(shape, look.shape)

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
