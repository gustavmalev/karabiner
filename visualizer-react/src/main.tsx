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
    <HeroUIProvider
      disableAnimation={false}
      // Keep framer-motion animations active
      skipFramerMotionAnimations={false}
      // Respect user OS settings for reduced motion
      reducedMotion="user"
    >
      <App />
    </HeroUIProvider>
  </StrictMode>,
)
