import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTokens } from './tokens'
import App from './App'
import Kiosk from './kiosk/Kiosk'

applyTokens()

// Beacon builds (VITE_MODE=beacon, or `vite --mode beacon` in dev) render only the kiosk.
const beacon = import.meta.env.VITE_MODE === 'beacon' || import.meta.env.MODE === 'beacon'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{beacon ? <Kiosk /> : <App />}</StrictMode>,
)
