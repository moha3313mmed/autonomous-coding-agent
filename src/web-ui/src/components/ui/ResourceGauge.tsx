interface ResourceGaugeProps {
  value: number; // 0-100
  label: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getGaugeColor(value: number): { bar: string; text: string; glow: string } {
  if (value < 60) {
    return {
      bar: 'bg-gauge-low',
      text: 'text-gauge-low',
      glow: 'shadow-[0_0_8px_rgba(34,197,94,0.3)]',
    };
  }
  if (value <= 85) {
    return {
      bar: 'bg-gauge-medium',
      text: 'text-gauge-medium',
      glow: 'shadow-[0_0_8px_rgba(234,179,8,0.3)]',
    };
  }
  return {
    bar: 'bg-gauge-high',
    text: 'text-gauge-high',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]',
  };
}

const sizeConfig = {
  sm: { height: 'h-1.5', labelSize: 'text-[10px]', valueSize: 'text-xs' },
  md: { height: 'h-2', labelSize: 'text-xs', valueSize: 'text-sm' },
  lg: { height: 'h-3', labelSize: 'text-sm', valueSize: 'text-base' },
};

export function ResourceGauge({ value, label, showPercentage = true, size = 'md' }: ResourceGaugeProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const color = getGaugeColor(clampedValue);
  const sizes = sizeConfig[size];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className={`${sizes.labelSize} text-text-secondary font-medium`}>{label}</span>
        {showPercentage && (
          <span className={`${sizes.valueSize} font-mono font-semibold ${color.text}`}>
            {clampedValue}%
          </span>
        )}
      </div>
      <div className={`w-full ${sizes.height} bg-dark-tertiary rounded-full overflow-hidden`}>
        <div
          className={`
            ${sizes.height} rounded-full ${color.bar} ${color.glow}
            transition-all duration-normal ease-smooth
          `}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
