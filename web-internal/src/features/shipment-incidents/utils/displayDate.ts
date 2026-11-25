export function displayDate(value: string | null) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}
