type StatusType = 'running' | 'completed' | 'failed' | 'warning' | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const statusConfig: Record<StatusType, { color: string; bgColor: string; borderColor: string; label: string }> = {
  running: {
    color: 'text-status-running',
    bgColor: 'bg-status-running/10',
    borderColor: 'border-status-running/30',
    label: 'Running',
  },
  completed: {
    color: 'text-status-completed',
    bgColor: 'bg-status-completed/10',
    borderColor: 'border-status-completed/30',
    label: 'Completed',
  },
  failed: {
    color: 'text-status-failed',
    bgColor: 'bg-status-failed/10',
    borderColor: 'border-status-failed/30',
    label: 'Failed',
  },
  warning: {
    color: 'text-status-warning',
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning/30',
    label: 'Warning',
  },
  pending: {
    color: 'text-status-pending',
    bgColor: 'bg-status-pending/10',
    borderColor: 'border-status-pending/30',
    label: 'Pending',
  },
};

const sizeConfig: Record<string, { container: string; dot: string; text: string }> = {
  sm: { container: 'px-1.5 py-0.5', dot: 'w-1.5 h-1.5', text: 'text-[10px]' },
  md: { container: 'px-2.5 py-1', dot: 'w-2 h-2', text: 'text-xs' },
  lg: { container: 'px-3 py-1.5', dot: 'w-2.5 h-2.5', text: 'text-sm' },
};

export function StatusBadge({ status, label, size = 'md', pulse = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const displayLabel = label ?? config.label;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border
        ${config.bgColor} ${config.borderColor} ${sizes.container}
        transition-colors duration-fast
      `}
    >
      <span
        className={`
          ${sizes.dot} rounded-full
          ${config.color.replace('text-', 'bg-')}
          ${pulse ? 'animate-pulse' : ''}
        `}
      />
      <span className={`font-medium ${config.color} ${sizes.text}`}>
        {displayLabel}
      </span>
    </span>
  );
}
