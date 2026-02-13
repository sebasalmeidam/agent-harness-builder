import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-bg-secondary">
          <div className="rounded-lg border border-border bg-bg-primary px-8 py-6 text-center shadow-sm">
            <h1 className="mb-2 font-heading text-xl font-semibold text-black">
              Something went wrong
            </h1>
            <p className="mb-4 font-body text-sm text-text-secondary">
              An unexpected error occurred. Please try again.
            </p>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false })}
              className="font-body text-sm font-medium text-primary hover:underline"
            >
              Go back to Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
