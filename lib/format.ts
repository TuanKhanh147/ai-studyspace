export const TZ = 'Asia/Ho_Chi_Minh';
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString('vi-VN', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN', { timeZone: TZ });
export const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};
export const daysUntil = (d: string | Date) => Math.ceil((+new Date(d) - Date.now()) / 86400000);
export const hourVN = () =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date())) % 24;
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
