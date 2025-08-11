import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { Card, CardBody } from '@heroui/react'
import { KeyboardGrid } from './components/KeyboardGrid/KeyboardGrid'
import { LayerDetail } from './components/LayerDetail/LayerDetail'
import { useStore } from './state/store'

function App() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta) return
      const key = String(e.key || '').toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return (
    <Layout>
      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 xl:col-span-8 2xl:col-span-7">
            <Card fullWidth className="border overflow-visible">
              <CardBody className="overflow-visible !p-2" style={{ overflow: 'visible' }}>
                <KeyboardGrid />
              </CardBody>
            </Card>
          </div>
          <div className="col-span-12 xl:col-span-4 2xl:col-span-5">
            <div className="space-y-3">
              <LayerDetail />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default App
