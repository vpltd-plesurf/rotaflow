import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfWeek, addDays, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns the Monday of the week containing the given date */
export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** Returns array of 7 dates Mon-Sun for the week */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Format date as "YYYY-MM-DD" for DB storage */
export function toDbDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Parse "YYYY-MM-DD" from DB to Date */
export function fromDbDate(dateStr: string): Date {
  return parseISO(dateStr);
}

/** Calculate shift duration in hours */
export function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60; // overnight
  return (endMins - startMins) / 60;
}

/** Format currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Calculate indicative cost for a shift */
export function shiftCost(startTime: string, endTime: string, hourlyRate: number): number {
  return shiftHours(startTime, endTime) * hourlyRate;
}
