import { isSafeRegex } from "@/lib/regex-guard";

export interface Schedule {
  from?: string;
  to?: string;
}

export function isWithinSchedule(schedule: Schedule | null | undefined): boolean {
  if (!schedule) return true;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const nowTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  const from = schedule.from;
  const to = schedule.to;

  if (!from || !to) return true;

  if (from > to) {
    // Cross-midnight: e.g., 22:00 - 06:00
    return nowTime >= from || nowTime <= to;
  }
  return nowTime >= from && nowTime <= to;
}

export function matchKeyword(messageText: string, keyword: string): boolean {
  return messageText.toLowerCase().includes(keyword.toLowerCase());
}

export function matchRegex(messageText: string, pattern: string): boolean {
  if (!isSafeRegex(pattern)) {
    return false;
  }
  try {
    const regex = new RegExp(pattern, "i");
    return regex.test(messageText);
  } catch {
    return false;
  }
}