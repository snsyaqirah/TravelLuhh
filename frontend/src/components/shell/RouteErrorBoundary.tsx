import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** A lazy chunk that failed to download (offline, or a deploy replaced it) rather than a bug in the page. */
function isChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically/i.test(
    text
  );
}

interface Props {
  children: ReactNode;
  /** Clears the error when it changes (the shell passes the route key, so navigating away recovers). */
  resetKey?: string;
  /** 'content' inside the shell; 'screen' when there is no shell around it. */
  variant?: 'content' | 'screen';
}

interface State {
  error: unknown;
  key?: string;
}

/**
 * Keeps one broken page from blanking the whole app. Reload is the honest fix for both a failed chunk and a
 * render crash; the way home is a plain link so it works even if the router is what broke.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('Unknown error') };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { key: props.resetKey, error: null };
    return null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[route error]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);

    const panel = (
      <div role="alert" className="flex max-w-[480px] flex-col items-start gap-4 py-8">
        <p className="type-overline text-ink-3">{chunk ? "Page didn't load" : 'Something broke'}</p>
        <h1 className="type-display-3 text-ink">
          {chunk ? "This page didn't come through." : 'This page hit a snag.'}
        </h1>
        <p className="type-body text-ink-2">
          {chunk
            ? 'Probably the connection. Your entries are safe. Reload to try again.'
            : 'Your entries are safe. Reload to try again, or head back home.'}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button asChild variant="secondary">
            <a href="/home">Back to Home</a>
          </Button>
        </div>
      </div>
    );

    if (this.props.variant === 'screen') {
      return (
        <div className="min-h-dvh bg-background">
          <div className="mx-auto w-full max-w-[1168px] px-4 py-12 md:px-6">{panel}</div>
        </div>
      );
    }
    return panel;
  }
}
