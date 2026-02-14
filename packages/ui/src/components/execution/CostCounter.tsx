interface CostCounterProps {
  costUsd: number | null | undefined;
}

/**
 * Displays the running cost of an execution in USD.
 * Shows 4 decimal places for precision.
 */
export default function CostCounter({ costUsd }: CostCounterProps) {
  // Format cost with 4 decimal places
  const formattedCost = costUsd != null ? `$${costUsd.toFixed(4)}` : "$0.0000";

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border bg-bg-primary px-3 py-2"
      data-testid="cost-counter"
    >
      <span className="font-body text-xs text-text-secondary">Cost:</span>
      <span className="font-body text-sm font-medium text-text-primary">
        {formattedCost}
      </span>
    </div>
  );
}
