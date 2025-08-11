import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './globals.css'
import App from './App.tsx'
import { initializeStore } from './state/store'
import { HeroUIProvider } from '@heroui/react'

// Initialize centralized store (hydrates persisted state and fetches data/apps)
initializeStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <App />
    </HeroUIProvider>
  </StrictMode>,
)
