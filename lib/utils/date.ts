import { endOfMonth, startOfMonth, startOfWeek } from "date-fns";
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

export function getMonthEndString(d: Date = new Date()): string {
  const z = toZonedTime(d, TIMEZONE);
  const me = endOfMonth(z);
  return formatInTimeZone(me, TIMEZONE, "yyyy-MM-dd");
}
