import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTokens } from './tokens'
import App from './App'

applyTokens()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
