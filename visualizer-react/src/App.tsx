import { Layout } from './components/Layout'
import { Card, CardBody } from '@heroui/react'
import { KeyboardGrid } from './components/KeyboardGrid/KeyboardGrid'
import { LayerDetail } from './components/LayerDetail/LayerDetail'

function App() {
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
            <LayerDetail />
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default App
