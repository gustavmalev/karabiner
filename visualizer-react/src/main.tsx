import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './globals.css'
import App from './App.tsx'
import { initializeStore } from './state/store'
import { ThemeProvider, injectCSSVariables } from './theme'

// Initialize centralized store (hydrates persisted state and fetches data/apps)
initializeStore();
// Inject CSS variables for design tokens before rendering
injectCSSVariables();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
