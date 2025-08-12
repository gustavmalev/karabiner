import { Card, CardBody, CardHeader, Chip, Divider } from '../ui'
import { useStore } from '../../state/store'
import { selectConflicts } from '../../state/selectors'

export function ConflictsPanel() {
  const conflicts = useStore(selectConflicts)

  if (!conflicts.length) {
    return (
      <Card fullWidth className="border">
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Conflicts</span>
            <Chip size="sm" variant="flat" color="success">0</Chip>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-default-500">No conflicts detected.</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card fullWidth className="border">
      <CardHeader className="justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">Conflicts</span>
          <Chip size="sm" variant="flat" color="danger">{conflicts.length}</Chip>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-2">
        {conflicts.map((c) => (
          <div key={c.innerKey} className="text-sm">
            <span className="font-mono mr-1">{c.innerKey}</span>
            is used in
            <span className="mx-1 font-mono">{c.outerKeys.join(', ')}</span>
            <span className="text-default-500">(x{c.count})</span>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}
