import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { Card, CardBody } from '@heroui/react'
import { KeyboardGrid } from './components/KeyboardGrid/KeyboardGrid'
import { LayerDetail } from './components/LayerDetail/LayerDetail'
import { useStore } from './state/store'
 

function App() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const isDirty = useStore((s) => s.isDirty)
  const revertToSaved = useStore((s) => s.revertToSaved)
  const openImportDialog = useStore((s) => s.openImportDialog)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      const key = String(e.key || '').toLowerCase()
      // Undo/Redo
      if (isMeta && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (isMeta && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      // Import dialog
      if (isMeta && e.shiftKey && key === 'i') {
        e.preventDefault()
        openImportDialog()
        return
      }
      // Note: ESC no longer globally reverts; avoid surprising cancellations while editing
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, openImportDialog, isDirty, revertToSaved])

  // Removed beforeunload warning: local edits are persisted; no disruptive browser prompt

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
