import { COLORS } from './theme';

export function formatValue(value: number | null | undefined, format: string): string {
  if (value == null || isNaN(value)) return '--';
  switch (format) {
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'currency':
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    case 'ratio':
      return `${value.toFixed(2)}x`;
    default:
      return value.toLocaleString();
  }
}

export function getChartColor(index: number): string {
  return COLORS.chart[index % COLORS.chart.length];
}

export function parseToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  if (!Array.isArray(r.content)) return null;
  const textContent = (r.content as Array<Record<string, unknown>>).find(
    (c) => c.type === 'text'
  );
  if (!textContent || typeof textContent.text !== 'string') return null;
  try {
    return JSON.parse(textContent.text);
  } catch {
    return textContent.text;
  }
}

export function formatPeriodLabel(period: string): string {
  if (!period) return '';
  const d = new Date(period);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year} Q${quarter}`;
}

export function getPercentileColor(percentile: number, lowerBetter = false): string {
  const adjusted = lowerBetter ? 100 - percentile : percentile;
  if (adjusted >= 75) return COLORS.success;
  if (adjusted >= 50) return COLORS.warning;
  return COLORS.danger;
}
