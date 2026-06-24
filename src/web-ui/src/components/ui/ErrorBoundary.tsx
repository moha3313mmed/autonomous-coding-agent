import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'app' | 'panel';
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isApp = this.props.level === 'app';

      return (
        <div className={`flex items-center justify-center ${isApp ? 'min-h-screen' : 'min-h-[200px]'} bg-dark-primary`}>
          <div className="text-center p-8 max-w-md">
            {/* Error icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-status-failed/10 border border-status-failed/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-status-failed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <h2 className="text-lg font-semibold text-text-primary mb-2">
              {isApp ? 'Something went wrong' : 'Panel Error'}
            </h2>

            <p className="text-sm text-text-secondary mb-4">
              {isApp
                ? 'An unexpected error occurred. Please try refreshing the page.'
                : 'This panel encountered an error. You can try reloading it.'}
            </p>

            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-dark-tertiary rounded-lg text-xs text-status-failed font-mono overflow-x-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors duration-fast"
            >
              {isApp ? 'Refresh Page' : 'Retry'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
