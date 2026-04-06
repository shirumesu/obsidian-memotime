function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateKeyFromTimestampSeconds(timestampSeconds: number): string {
  return formatLocalDateKey(new Date(timestampSeconds * 1000));
}

export function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function shiftLocalDateKey(dateKey: string, days: number): string {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatLocalDateKey(date);
}

export function formatLocalTimeKey(date: Date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
