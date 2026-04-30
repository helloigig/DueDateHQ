import { Component, type ReactNode, type ErrorInfo } from "react";

/**
 * Catches uncaught render errors so the whole app doesn't go unresponsive
 * when a single component crashes (e.g., reading .join() on an undefined
 * array that came back from a malformed BE response).
 *
 * Without this, any uncaught error in any component freezes the entire app
 * (React's behavior when there's no boundary). With it, the user sees a
 * recoverable error screen and can refresh or navigate away.
 *
 * Wrapped at the App.tsx root, INSIDE Router (so the navigate-to-home
 * button works) and OUTSIDE Routes (so the boundary survives navigation).
 */

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("AppErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  hardReload = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
          <div className="max-w-md text-center">
            <div className="text-2xl font-semibold text-ink-900 mb-2">
              Something went wrong
            </div>
            <p className="text-sm text-ink-500 mb-4">
              The app hit an unexpected error and couldn't continue rendering.
              Your data is safe — try refreshing or going back to the
              dashboard.
            </p>
            <details className="text-2xs text-ink-400 mb-4 text-left bg-sunken/40 rounded px-3 py-2">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack?.split("\n").slice(0, 5).join("\n")}
              </pre>
            </details>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.reset}
                className="px-4 py-2 text-sm rounded border border-line text-ink-700 hover:bg-sunken"
              >
                Try again
              </button>
              <button
                onClick={this.hardReload}
                className="px-4 py-2 text-sm rounded bg-accent text-canvas hover:bg-accent-hover"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
