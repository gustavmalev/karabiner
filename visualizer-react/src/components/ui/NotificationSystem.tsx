import { useEffect, useState } from 'react';
import { Button, Card, CardBody } from './index';
import { useNotifications } from '../../hooks/useNotifications';
import type { NoticeType } from '../../hooks/useNotifications';

export function NotificationSystem() {
  const { notices, remove } = useNotifications();

  useEffect(() => {
    // Accessible live region could be added here if needed
  }, []);

  function NoticeItem({ id, type, message, description, index }: { id: string; type: NoticeType; message: string; description?: string | undefined; index: number }) {
    const [entered, setEntered] = useState(false);
    useEffect(() => {
      const t = window.setTimeout(() => setEntered(true), 10);
      return () => window.clearTimeout(t);
    }, []);
    const dotClass = type === 'success'
      ? 'bg-success-500'
      : type === 'error'
      ? 'bg-danger-500'
      : type === 'warning'
      ? 'bg-warning-500'
      : 'bg-primary-500';
    return (
      <div
        className={`transition-all duration-300 ease-out ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
        style={{ transitionDelay: `${Math.min(index * 40, 200)}ms` }}
      >
        <Card key={id} className="pointer-events-auto border border-default-200/60 bg-background/80 backdrop-blur-sm shadow-xl rounded-large">
          <CardBody className="!p-2.5">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{message}</div>
                {description ? <div className="mt-0.5 line-clamp-3 text-xs text-default-600">{description}</div> : null}
              </div>
              <Button size="sm" variant="light" onPress={() => remove(id)} aria-label="Dismiss" className="min-w-0 px-2 py-1">
                ×
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[1000] flex w-[min(420px,95vw)] flex-col gap-2">
      {notices.map((n, i) => (
        <NoticeItem key={n.id} id={n.id} type={n.type} message={n.message} description={n.description} index={i} />
      ))}
    </div>
  );
}
