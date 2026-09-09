import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * Compares two semantic version strings (e.g. "1.0.0", "1.2.3-rc1").
 * Returns:
 *   < 0 if v1 < v2
 *     0 if v1 === v2
 *   > 0 if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string): number[] => {
    // Strip leading 'v' if present, and drop build metadata/prerelease tags for numeric evaluation
    const cleaned = v.trim().replace(/^v/, "").split(/[-+]/)[0];
    const parts = cleaned.split(".").map((p) => {
      const num = parseInt(p, 10);
      return Number.isNaN(num) ? 0 : num;
    });
    while (parts.length < 3) {
      parts.push(0);
    }
    return parts.slice(0, 3);
  };

  const [maj1, min1, pat1] = parse(v1);
  const [maj2, min2, pat2] = parse(v2);

  if (maj1 !== maj2) return maj1 - maj2;
  if (min1 !== min2) return min1 - min2;
  return pat1 - pat2;
}

/**
 * Validates if the client version meets or exceeds the required minimum.
 */
export function isAppVersionSupported(
  clientVersion: string | undefined | null,
  minVersion: string,
): boolean {
  if (
    !clientVersion ||
    typeof clientVersion !== "string" ||
    !clientVersion.trim()
  ) {
    return false;
  }
  return compareSemver(clientVersion, minVersion) >= 0;
}

/**
 * Route prefixes specifically excluded from mobile app version enforcement.
 * Excludes health probes, web administrative portals, web SSO flows, webhooks, and SSE.
 */
export const EXCLUDED_PATH_PREFIXES = [
  "/health",
  "/ready",
  "/v1/admin",
  "/v1/dashboard",
  "/auth/google",
  "/auth/callback",
  "/auth/refresh",
  "/auth/logout",
];

export function isExcludedRoute(path: string): boolean {
  if (path === "/health" || path === "/ready") return true;

  // Real-time server-sent events
  if (
    path.match(/^\/v1\/events\/[^\/]+\/live$/) ||
    path === "/v1/notifications/live"
  ) {
    return true;
  }

  // System & third-party webhooks
  if (path.startsWith("/webhooks") || path.startsWith("/v1/webhooks")) {
    return true;
  }

  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Checks if the request originated from the web dashboard / browser client,
 * which is continuously deployed and not subject to mobile app store version gating.
 *
 * Primary signal: Explicit `X-Client-Platform: web` header sent by `apps/dashboard/lib/api.ts`
 * on both client-side and server-side (SSR) calls.
 * Fallback heuristics: Origin, Referer, and Sec-Fetch-Mode headers for direct browser requests.
 */
export function isWebDashboardClient(req: Request): boolean {
  // Primary detection signal: explicit client platform header
  if (req.headers["x-client-platform"] === "web") {
    return true;
  }

  const origin = (req.headers["origin"] as string | undefined)?.toLowerCase();
  const referer = (req.headers["referer"] as string | undefined)?.toLowerCase();
  const allowedOrigins = env.ALLOWED_ORIGINS.toLowerCase()
    .split(",")
    .map((o) => o.trim());

  if (
    origin &&
    (allowedOrigins.some(
      (allowed) => origin === allowed || origin.startsWith(allowed),
    ) ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:"))
  ) {
    return true;
  }

  if (
    referer &&
    (allowedOrigins.some((allowed) => referer.startsWith(allowed)) ||
      referer.startsWith("http://localhost:") ||
      referer.startsWith("http://127.0.0.1:"))
  ) {
    return true;
  }

  // Standard modern browser requests attach Sec-Fetch-Mode
  if (req.headers["sec-fetch-mode"] && !req.headers["x-app-version"]) {
    return true;
  }

  return false;
}

/**
 * Middleware enforcing the minimum mobile app version requirement.
 * Rejects legacy or outdated clients with HTTP 426 Upgrade Required.
 */
export function appVersionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Always skip infrastructure and web-exclusive routes
  if (isExcludedRoute(req.path)) {
    return next();
  }

  const rawVersionHeader = req.headers["x-app-version"];
  const clientVersion = Array.isArray(rawVersionHeader)
    ? rawVersionHeader[0]
    : rawVersionHeader;

  // If X-App-Version is provided, strictly evaluate it
  if (clientVersion !== undefined && clientVersion !== "") {
    if (!isAppVersionSupported(clientVersion, env.MIN_APP_VERSION)) {
      res.status(426).json({
        error: "APP_VERSION_UNSUPPORTED",
        message:
          "Please update to the latest version of NST Events to continue.",
        minVersion: env.MIN_APP_VERSION,
      });
      return;
    }
    return next();
  }

  // If X-App-Version is NOT provided:
  // Allow web dashboard clients
  if (isWebDashboardClient(req)) {
    return next();
  }

  // Treat missing X-App-Version on user-facing app routes as below minimum (legacy mobile install)
  res.status(426).json({
    error: "APP_VERSION_UNSUPPORTED",
    message: "Please update to the latest version of NST Events to continue.",
    minVersion: env.MIN_APP_VERSION,
  });
}
