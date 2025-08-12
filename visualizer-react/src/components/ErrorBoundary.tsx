import React from 'react';
import { Button, Card, CardBody } from '@heroui/react';

type Props = {
  children: React.ReactNode;
  onReset?: () => void;
  onReport?: (error: unknown) => void;
};

type State = {
  error: any | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: any): State {
    return { error };
  }

  componentDidCatch(error: any, info: any) {
    // Hook for logging/reporting
    this.props.onReport?.({ error, info });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error);
      return (
        <div className="p-3">
          <Card className="border">
            <CardBody className="!p-3 space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Something went wrong</h2>
                <p className="text-sm text-default-600">The app encountered an error. You can try to recover without losing your work.</p>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-default-100 p-2 text-xs text-danger-500">{message}</pre>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="flat" onPress={() => {
                  navigator.clipboard?.writeText(message).catch(() => {});
                }}>Copy error</Button>
                <Button size="sm" variant="solid" color="default" className="text-black" onPress={this.handleReset}>Try again</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
