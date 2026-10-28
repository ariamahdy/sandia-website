import { expect, test } from '@playwright/test';
import {
  firstDayOf,
  indonesianMonthName,
  lastDayOf,
  monthLabel,
  previousMonth,
  toIsoMonth,
  yearMonthOf,
} from '@utils/date';

test('yearMonthOf reads the local year and 1-based month', () => {
  expect(yearMonthOf(new Date(2026, 9, 29))).toEqual({ year: 2026, month: 10 });
});

test('previousMonth stays in the same year', () => {
  expect(previousMonth({ year: 2026, month: 10 })).toEqual({ year: 2026, month: 9 });
});

test('previousMonth of January is December of the year before', () => {
  expect(previousMonth({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
});

test('toIsoMonth pads the month', () => {
  expect(toIsoMonth({ year: 2026, month: 2 })).toBe('2026-02');
});

test('firstDayOf and lastDayOf give ISO dates of the month', () => {
  expect(firstDayOf({ year: 2026, month: 9 })).toBe('2026-09-01');
  expect(lastDayOf({ year: 2026, month: 9 })).toBe('2026-09-30');
});

test('lastDayOf handles a leap February', () => {
  expect(lastDayOf({ year: 2028, month: 2 })).toBe('2028-02-29');
  expect(lastDayOf({ year: 2026, month: 2 })).toBe('2026-02-28');
});

test('monthLabel is the three-letter English name', () => {
  expect(monthLabel({ year: 2026, month: 1 })).toBe('Jan');
  expect(monthLabel({ year: 2026, month: 12 })).toBe('Dec');
});

test('indonesianMonthName is the full Indonesian name in uppercase', () => {
  expect(indonesianMonthName({ year: 2026, month: 1 })).toBe('JANUARI');
  expect(indonesianMonthName({ year: 2026, month: 5 })).toBe('MEI');
  expect(indonesianMonthName({ year: 2026, month: 8 })).toBe('AGUSTUS');
  expect(indonesianMonthName({ year: 2026, month: 12 })).toBe('DESEMBER');
});
