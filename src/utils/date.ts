export type YearMonth = { readonly year: number; readonly month: number };

const pad = (value: number): string => String(value).padStart(2, '0');

export const yearMonthOf = (date: Date): YearMonth => ({ year: date.getFullYear(), month: date.getMonth() + 1 });

export const previousMonth = ({ year, month }: YearMonth): YearMonth =>
  month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

export const toIsoMonth = ({ year, month }: YearMonth): string => `${String(year)}-${pad(month)}`;

export const firstDayOf = (ym: YearMonth): string => `${toIsoMonth(ym)}-01`;

export const lastDayOf = (ym: YearMonth): string =>
  `${toIsoMonth(ym)}-${pad(new Date(ym.year, ym.month, 0).getDate())}`;

export const monthLabel = ({ year, month }: YearMonth): string =>
  new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });

export const indonesianMonthName = ({ year, month }: YearMonth): string =>
  new Date(year, month - 1, 1).toLocaleString('id-ID', { month: 'long' }).toUpperCase();
