import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Guards redirect targets and hrefs that come from the URL.
 *
 * `startsWith("/")` alone is not enough: `//evil.example` and `/\evil.example`
 * are protocol-relative, so `new URL("//evil.example", request.url)` (and the
 * browser's own resolution of an href or `Location`) leaves the site.
 */
export function safeInternalPath(path: string | null | undefined, fallback = "/") {
  return path && /^\/(?![/\\])/.test(path) ? path : fallback;
}
