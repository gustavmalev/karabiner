import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './globals.css'
import App from './App.tsx'
import { AppStateProvider } from './state/appState'
import { HeroUIProvider } from '@heroui/react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </HeroUIProvider>
  </StrictMode>,
)
