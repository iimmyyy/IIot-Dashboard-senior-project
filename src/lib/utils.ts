import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const TIMEZONE = "Asia/Bangkok";
export function bangkokDate(value: string | number | Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function dateTime(
  value: string | number,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...options,
  }).format(new Date(value));
}
export function timeOnly(value: string | number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function bangkokInput(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}
export function duration(start: string, end: string | number) {
  const hours = Math.max(
    0,
    Math.floor((new Date(end).getTime() - Date.parse(start)) / 3600000),
  );
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
export function age(timestamp: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}
export const positionLabels = {
  top: "Top",
  middle: "Middle",
  bottom: "Bottom",
};
export const sensorColors = {
  top: "#087f8c",
  middle: "#7461c4",
  bottom: "#c58728",
};
