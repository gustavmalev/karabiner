import { useEffect } from 'react';
import { Button, Card, CardBody } from '@heroui/react';
import { useNotifications } from '../../hooks/useNotifications';

export function NotificationSystem() {
  const { notices, remove } = useNotifications();

  useEffect(() => {
    // Accessible live region could be added here if needed
  }, []);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[1000] flex w-[min(420px,95vw)] flex-col gap-2">
      {notices.map((n) => (
        <Card key={n.id} className="pointer-events-auto border shadow-lg">
          <CardBody className="!p-3">
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                n.type === 'success' ? 'bg-success-500' : n.type === 'error' ? 'bg-danger-500' : n.type === 'warning' ? 'bg-warning-500' : 'bg-primary-500'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{n.message}</div>
                {n.description ? <div className="mt-0.5 line-clamp-3 text-xs text-default-600">{n.description}</div> : null}
              </div>
              <Button size="sm" variant="light" onPress={() => remove(n.id)}>Dismiss</Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
