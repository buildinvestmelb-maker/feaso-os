import type { ChangeEvent } from 'react';

interface NumericFieldProps {
  id?: string;
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  onNullableChange?: (value: number | null) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  nullable?: boolean;
  testId?: string;
  hint?: string;
}

export function NumericField({
  id,
  label,
  value,
  onChange,
  onNullableChange,
  prefix,
  suffix,
  step = 1,
  min,
  max,
  placeholder,
  disabled = false,
  nullable = false,
  testId,
  hint,
}: NumericFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (nullable && raw.trim() === '') {
      onNullableChange?.(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (nullable && onNullableChange) {
      onNullableChange(next);
    } else {
      onChange(next);
    }
  };

  const displayVal = value === null || value === undefined ? '' : String(value);

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor={id}
          className="text-[11px] font-medium text-[#93a1b2] truncate"
          title={hint || label}
        >
          {label}
        </label>
        {hint && (
          <span className="text-[10px] font-mono-tech text-[#667587] truncate">
            {hint}
          </span>
        )}
      </div>
      <div
        className={`flex items-center rounded-[5px] border bg-[#0d1117] transition-colors ${
          disabled
            ? 'border-[rgba(214,226,240,0.06)] opacity-60'
            : 'border-[rgba(214,226,240,0.12)] hover:border-[rgba(214,226,240,0.22)] focus-within:border-[#3daee9]'
        }`}
      >
        {prefix && (
          <span className="pl-2 pr-1 text-[11px] font-mono-tech text-[#667587] select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          data-testid={testId}
          type="number"
          step={step}
          min={min}
          max={max}
          value={displayVal}
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleChange}
          className="w-full min-w-0 bg-transparent py-1 px-1.5 text-[12px] font-mono-tech text-[#e6edf3] placeholder:text-[#4e5b6b] outline-none"
        />
        {suffix && (
          <span className="pr-2 pl-1 text-[11px] font-mono-tech text-[#667587] select-none shrink-0">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
