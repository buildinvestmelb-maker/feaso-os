const audWhole = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

const intFormat = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 0,
});

export function formatAud(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  return audWhole.format(Math.round(value));
}

export function formatAudCompact(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${value.toFixed(digits)}%`;
}

export function formatNum(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return intFormat.format(Math.round(value));
}
