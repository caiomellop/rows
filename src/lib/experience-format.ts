/** Client-safe helpers that format experience dates and profile choices. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2023-04" → "Apr 2023", "2021" → "2021". */
export function formatYearMonth(value: string | null): string {
  if (!value) return "";
  const [y, m] = value.split("-");
  const month = m ? MONTHS[Number(m) - 1] : undefined;
  return month ? `${month} ${y}` : y;
}

export function formatRange(start: string | null, end: string | null, current: boolean): string {
  const from = formatYearMonth(start);
  const to = current ? "Present" : formatYearMonth(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export const WORK_MODE_LABEL = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Remote or on-site",
} as const;

export const ROLE_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"] as const;
