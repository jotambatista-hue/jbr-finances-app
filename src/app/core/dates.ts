/** Date helpers. Dates are 'YYYY-MM-DD' strings; months are 'YYYY-MM'. */

const DAY_MS = 86_400_000;

/** Whole days from one date to another (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Last day of a month, e.g. '2026-02' -> '2026-02-28'. */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

/** Month keys ('YYYY-MM') from `from` through the month of `asOf`. */
export function monthKeys(asOf: string, from: string): string[] {
  const keys: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ey, em] = asOf.slice(0, 7).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}

