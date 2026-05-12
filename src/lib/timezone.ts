// Timezone utility — reads user's configured timezone from localStorage
// Demo mode defaults to America/Los_Angeles (PST/PDT)

import { isDemoMode } from "@/lib/demo/storage";

const STORAGE_KEY = "stride-timezone";
const DEMO_DEFAULT = "America/Los_Angeles";

/** Get the configured app timezone (IANA string) */
export function getAppTimezone(): string {
  if (typeof window === "undefined") return DEMO_DEFAULT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  if (isDemoMode()) return DEMO_DEFAULT;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Format a Date or ISO string using the app timezone */
export function formatInAppTz(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimezone(),
    ...options,
  }).format(d);
}

/** Get today's date string (YYYY-MM-DD) in the app timezone */
export function todayInAppTz(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getAppTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD format
}

/** Common IANA timezones for the settings picker */
export const TIMEZONE_OPTIONS: { label: string; value: string }[] = [
  { label: "(GMT-12:00) Baker Island", value: "Etc/GMT+12" },
  { label: "(GMT-11:00) Pago Pago", value: "Pacific/Pago_Pago" },
  { label: "(GMT-10:00) Honolulu", value: "Pacific/Honolulu" },
  { label: "(GMT-09:00) Anchorage", value: "America/Anchorage" },
  { label: "(GMT-08:00) Los Angeles (PST)", value: "America/Los_Angeles" },
  { label: "(GMT-07:00) Denver (MST)", value: "America/Denver" },
  { label: "(GMT-07:00) Phoenix", value: "America/Phoenix" },
  { label: "(GMT-06:00) Chicago (CST)", value: "America/Chicago" },
  { label: "(GMT-06:00) Mexico City", value: "America/Mexico_City" },
  { label: "(GMT-05:00) New York (EST)", value: "America/New_York" },
  { label: "(GMT-05:00) Bogota", value: "America/Bogota" },
  { label: "(GMT-04:00) Santiago", value: "America/Santiago" },
  { label: "(GMT-04:00) Halifax", value: "America/Halifax" },
  { label: "(GMT-03:00) São Paulo", value: "America/Sao_Paulo" },
  { label: "(GMT-03:00) Buenos Aires", value: "America/Argentina/Buenos_Aires" },
  { label: "(GMT-01:00) Azores", value: "Atlantic/Azores" },
  { label: "(GMT+00:00) London (GMT)", value: "Europe/London" },
  { label: "(GMT+00:00) UTC", value: "UTC" },
  { label: "(GMT+01:00) Paris (CET)", value: "Europe/Paris" },
  { label: "(GMT+01:00) Berlin", value: "Europe/Berlin" },
  { label: "(GMT+02:00) Cairo", value: "Africa/Cairo" },
  { label: "(GMT+02:00) Helsinki", value: "Europe/Helsinki" },
  { label: "(GMT+03:00) Moscow", value: "Europe/Moscow" },
  { label: "(GMT+03:00) Istanbul", value: "Europe/Istanbul" },
  { label: "(GMT+03:30) Tehran", value: "Asia/Tehran" },
  { label: "(GMT+04:00) Dubai", value: "Asia/Dubai" },
  { label: "(GMT+05:00) Karachi", value: "Asia/Karachi" },
  { label: "(GMT+05:30) Kolkata (IST)", value: "Asia/Kolkata" },
  { label: "(GMT+06:00) Dhaka", value: "Asia/Dhaka" },
  { label: "(GMT+07:00) Bangkok", value: "Asia/Bangkok" },
  { label: "(GMT+08:00) Singapore", value: "Asia/Singapore" },
  { label: "(GMT+08:00) Shanghai", value: "Asia/Shanghai" },
  { label: "(GMT+08:00) Hong Kong", value: "Asia/Hong_Kong" },
  { label: "(GMT+09:00) Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "(GMT+09:00) Seoul (KST)", value: "Asia/Seoul" },
  { label: "(GMT+09:30) Adelaide", value: "Australia/Adelaide" },
  { label: "(GMT+10:00) Sydney (AEST)", value: "Australia/Sydney" },
  { label: "(GMT+11:00) Noumea", value: "Pacific/Noumea" },
  { label: "(GMT+12:00) Auckland (NZST)", value: "Pacific/Auckland" },
  { label: "(GMT+13:00) Tongatapu", value: "Pacific/Tongatapu" },
];
