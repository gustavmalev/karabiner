import { Layout } from './components/Layout'
import { FilterBar } from './components/FilterBar'
import { KeyboardGrid } from './components/KeyboardGrid/KeyboardGrid'
import { LayerDetail } from './components/LayerDetail/LayerDetail'

function App() {
  return (
    <Layout>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <FilterBar />
          <div className="rounded-lg border bg-white/5 p-4">
            <KeyboardGrid />
          </div>
        </div>
        <div className="col-span-4">
          <LayerDetail />
        </div>
      </div>
    </Layout>
  )
}

export default App
