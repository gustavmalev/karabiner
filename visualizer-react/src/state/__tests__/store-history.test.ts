import { describe, it, expect, beforeEach } from 'vitest'
import type { Config, KeyCode } from '../../types'
import { useStore } from '../store'

function resetStore() {
  useStore.setState({
    data: null,
    config: null,
    apps: [],
    currentLayerKey: null as KeyCode | null,
    filter: 'all',
    locks: {},
    keyboardLayout: 'ansi',
    aiKey: '',
    isDirty: false,
    history: [],
    future: [],
    historyLimit: 50,
  })
}

describe('store history (undo/redo)', () => {
  beforeEach(() => {
    resetStore()
  })

  it('pushes snapshots only for config changes and supports undo/redo; UI changes do not affect history', () => {
    // 1) Mutate config
    const config1: Config = { layers: {} as Record<string, any> } as Config
    useStore.getState().setConfig(config1)
    expect(useStore.getState().config).toBe(config1)
    expect(useStore.getState().history.length).toBe(1)
    expect(useStore.getState().future.length).toBe(0)
    expect(useStore.getState().isDirty).toBe(true)

    // 2) UI-only changes should NOT push history
    useStore.getState().setFilter('available')
    useStore.getState().setCurrentLayerKey('q' as KeyCode)
    useStore.getState().setAIKey('k')
    expect(useStore.getState().filter).toBe('available')
    expect(useStore.getState().currentLayerKey).toBe('q')
    expect(useStore.getState().aiKey).toBe('k')
    expect(useStore.getState().history.length).toBe(1)

    // 3) Second config mutation clears redo and pushes history
    const config2: Config = { layers: { a: {} as any } as Record<string, any> } as Config
    useStore.getState().setConfig(config2)
    expect(useStore.getState().config).toBe(config2)
    expect(useStore.getState().history.length).toBe(2)
    expect(useStore.getState().future.length).toBe(0)

    // 4) Undo reverts last config
    useStore.getState().undo()
    expect(useStore.getState().config).toBe(config1)
    expect(useStore.getState().history.length).toBe(1)
    expect(useStore.getState().future.length).toBe(1)

    // 5) Undo again reverts to initial snapshot
    useStore.getState().undo()
    expect(useStore.getState().config).toBe(null)
    expect(useStore.getState().history.length).toBe(0)
    expect(useStore.getState().future.length).toBe(2)

    // 6) Redo moves forward to config1
    useStore.getState().redo()
    expect(useStore.getState().config).toBe(config1)
    expect(useStore.getState().history.length).toBe(1)
    expect(useStore.getState().future.length).toBe(1)

    // 7) New config mutation clears redo stack
    const config3: Config = { layers: { b: {} as any } as Record<string, any> } as Config
    useStore.getState().setConfig(config3)
    expect(useStore.getState().config).toBe(config3)
    expect(useStore.getState().future.length).toBe(0)
    expect(useStore.getState().history.length).toBe(2)
  })

  it('navigation (currentLayerKey) does not push history or toggle dirty', () => {
    const prevDirty = useStore.getState().isDirty
    useStore.getState().setCurrentLayerKey('q' as KeyCode)
    expect(useStore.getState().currentLayerKey).toBe('q')
    expect(useStore.getState().history.length).toBe(0)
    expect(useStore.getState().isDirty).toBe(prevDirty)
    // Undo should have no effect
    useStore.getState().undo()
    expect(useStore.getState().currentLayerKey).toBe('q')
  })

  it('bounds history by historyLimit (config-only)', () => {
    useStore.setState({ historyLimit: 5 })
    // Push 10 distinct config changes
    for (let i = 0; i < 10; i++) {
      const cfg: Config = { layers: { ["k" + i]: {} as any } as Record<string, any> } as Config
      useStore.getState().setConfig(cfg)
    }
    expect(useStore.getState().history.length).toBe(5)
    // Undo down to empty
    for (let i = 0; i < 7; i++) {
      const hBefore = useStore.getState().history.length
      useStore.getState().undo()
      const hAfter = useStore.getState().history.length
      if (hBefore === 0) {
        expect(hAfter).toBe(0)
      }
    }
  })
})
