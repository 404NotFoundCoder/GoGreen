import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/constants/config";

export function getTodayString(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
}

export function getWeekStartString(d: Date = new Date()): string {
  const z = toZonedTime(d, TIMEZONE);
  const ws = startOfWeek(z, { weekStartsOn: 1 });
  return formatInTimeZone(ws, TIMEZONE, "yyyy-MM-dd");
}

export function getMonthStartString(d: Date = new Date()): string {
  const z = toZonedTime(d, TIMEZONE);
  const ms = startOfMonth(z);
  return formatInTimeZone(ms, TIMEZONE, "yyyy-MM-dd");
}

/** 當地曆法之年初（用於「今年至今」區間起點） */
export function getYearStartString(d: Date = new Date()): string {
  const z = toZonedTime(d, TIMEZONE);
  const ys = startOfYear(z);
  return formatInTimeZone(ys, TIMEZONE, "yyyy-MM-dd");
}

/** 當地曆法之年末（12/31，用於「今年」熱力圖完整 1～12 月欄位） */
export function getYearEndString(d: Date = new Date()): string {
  const z = toZonedTime(d, TIMEZONE);
  const ye = endOfYear(z);
  return formatInTimeZone(ye, TIMEZONE, "yyyy-MM-dd");
}

export function getMonthEndString(d: Date = new Date()): string {
  const z = toZonedTime(d, TIMEZONE);
  const me = endOfMonth(z);
  return formatInTimeZone(me, TIMEZONE, "yyyy-MM-dd");
}

/** 含首尾；以 noon 解析避免 DST 邊界；用於排行榜每日柱狀圖補齊日期 */
export function eachDateStringInRange(start: string, end: string): string[] {
  const zStart = toZonedTime(parseISO(`${start}T12:00:00`), TIMEZONE);
  const zEnd = toZonedTime(parseISO(`${end}T12:00:00`), TIMEZONE);
  if (zStart > zEnd) return [];
  return eachDayOfInterval({ start: zStart, end: zEnd }).map((d) =>
    formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd"),
  );
}

/** 含 rangeStart 的曆週（週一～週日），共 7 個 yyyy-MM-dd */
export function weekCalendarDayStringsContaining(rangeStart: string): string[] {
  const ws = getWeekStartString(parseISO(`${rangeStart}T12:00:00`));
  const z = toZonedTime(parseISO(`${ws}T12:00:00`), TIMEZONE);
  return Array.from({ length: 7 }, (_, i) =>
    formatInTimeZone(addDays(z, i), TIMEZONE, "yyyy-MM-dd"),
  );
}
