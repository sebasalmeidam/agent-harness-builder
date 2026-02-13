interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorCard({ message, onRetry, className = "" }: ErrorCardProps) {
  return (
    <div
      className={`rounded-md border border-error bg-error-light px-4 py-3 ${className}`.trim()}
      role="alert"
    >
      <p className="font-body text-sm text-error">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 font-body text-sm font-medium text-error underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
