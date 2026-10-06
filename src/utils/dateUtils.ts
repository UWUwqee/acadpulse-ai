export function normalizeDueDate(value?: string | null): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString();
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatDateOnly(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function getCountdown(isoString: string): {
  label: string;
  isOverdue: boolean;
  isUrgent: boolean;
} {
  if (!isoString) return { label: 'No date', isOverdue: false, isUrgent: false };
  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs < 0) {
    const overdueHours = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));
    if (overdueHours < 24) {
      return { label: `Overdue by ${overdueHours}h`, isOverdue: true, isUrgent: false };
    }
    const overdueDays = Math.round(overdueHours / 24);
    return { label: `Overdue by ${overdueDays}d`, isOverdue: true, isUrgent: false };
  }

  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return {
      label: `${diffHours === 0 ? '< 1h' : `${diffHours}h`} left`,
      isOverdue: false,
      isUrgent: true,
    };
  }

  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  return {
    label: diffDays <= 2 ? `${diffDays}d ${remHours}h left` : `${diffDays} days left`,
    isOverdue: false,
    isUrgent: diffDays <= 2,
  };
}
