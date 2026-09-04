const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export type DateTimeInput = string | number | Date;

export const getConfiguredTimeZone = (): string => {
  if (typeof document !== 'undefined') {
    const configured = document.documentElement.dataset.timezone?.trim();
    if (configured) return configured;
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

const toDate = (value: DateTimeInput): Date => value instanceof Date ? value : new Date(value);

const DATE_PART_KEYS = ['weekday', 'year', 'month', 'day'] as const;
const TIME_PART_KEYS = ['dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits'] as const;
const hasAny = (options: Intl.DateTimeFormatOptions, keys: readonly string[]) => keys.some((key) => key in options);

export const formatDateTime = (value: DateTimeInput, options: Intl.DateTimeFormatOptions = {}): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  const presets = hasAny(options, [...DATE_PART_KEYS, ...TIME_PART_KEYS]) ? {} : { dateStyle: 'medium' as const, timeStyle: 'short' as const };
  return new Intl.DateTimeFormat(undefined, { ...presets, timeZone: getConfiguredTimeZone(), ...options }).format(date);
};

export const formatDate = (value: DateTimeInput, options: Intl.DateTimeFormatOptions = {}): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  const preset = hasAny(options, DATE_PART_KEYS) ? {} : { dateStyle: 'medium' as const };
  return new Intl.DateTimeFormat(undefined, { ...preset, timeZone: getConfiguredTimeZone(), ...options }).format(date);
};

export const formatTime = (value: DateTimeInput, options: Intl.DateTimeFormatOptions = {}): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  const preset = hasAny(options, TIME_PART_KEYS) ? {} : { timeStyle: 'short' as const };
  return new Intl.DateTimeFormat(undefined, { ...preset, timeZone: getConfiguredTimeZone(), ...options }).format(date);
};
