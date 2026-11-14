const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** True for a "YYYY-MM" string, the value of `<input type="month">`. */
export function isMonth(value: string) {
  return MONTH_RE.test(value);
}

/** "2024-03" → "Mar 2024". */
export function formatMonth(value: string) {
  const m = MONTH_RE.exec(value);
  if (!m) return value;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function formatRange(start: string, end: string | null) {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "Present"}`;
}
