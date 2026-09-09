import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import express, { Request, Response } from "express";
import {
  compareSemver,
  isAppVersionSupported,
  isExcludedRoute,
  isWebDashboardClient,
  appVersionMiddleware,
} from "../../src/middleware/version-check";
import { env } from "../../src/config/env";

describe("Unit: Minimum App Version Enforcement Mechanism", () => {
  describe("1. Semver Comparison Logic", () => {
    it("compares versions accurately across major, minor, and patch", () => {
      assert.ok(
        compareSemver("0.9.0", "1.0.0") < 0,
        "0.9.0 should be less than 1.0.0",
      );
      assert.ok(
        compareSemver("1.0.0", "1.0.0") === 0,
        "1.0.0 should equal 1.0.0",
      );
      assert.ok(
        compareSemver("1.0.1", "1.0.0") > 0,
        "1.0.1 should be greater than 1.0.0",
      );
      assert.ok(
        compareSemver("1.1.0", "1.0.0") > 0,
        "1.1.0 should be greater than 1.0.0",
      );
      assert.ok(
        compareSemver("2.0.0", "1.9.9") > 0,
        "2.0.0 should be greater than 1.9.9",
      );
    });

    it('handles "v" prefix, pre-release suffixes, and short strings safely', () => {
      assert.strictEqual(compareSemver("v1.0.0", "1.0.0"), 0);
      assert.strictEqual(compareSemver("1.0", "1.0.0"), 0);
      assert.ok(compareSemver("v1.2.0-rc1", "1.0.0") > 0);
      assert.ok(compareSemver("invalid", "1.0.0") < 0);
    });

    it("validates whether client version satisfies minimum threshold", () => {
      assert.strictEqual(isAppVersionSupported(undefined, "1.0.0"), false);
      assert.strictEqual(isAppVersionSupported("", "1.0.0"), false);
      assert.strictEqual(isAppVersionSupported("   ", "1.0.0"), false);
      assert.strictEqual(isAppVersionSupported("0.9.9", "1.0.0"), false);
      assert.strictEqual(isAppVersionSupported("1.0.0", "1.0.0"), true);
      assert.strictEqual(isAppVersionSupported("1.0.1", "1.0.0"), true);
      assert.strictEqual(isAppVersionSupported("2.1.0", "1.0.0"), true);
    });
  });

  describe("2. Route Scoping & Client Origin Differentiation", () => {
    it("identifies excluded infrastructure and web administration routes", () => {
      assert.strictEqual(isExcludedRoute("/health"), true);
      assert.strictEqual(isExcludedRoute("/ready"), true);
      assert.strictEqual(isExcludedRoute("/v1/admin/users"), true);
      assert.strictEqual(isExcludedRoute("/v1/admin/audit-logs"), true);
      assert.strictEqual(isExcludedRoute("/v1/dashboard/metrics"), true);
      assert.strictEqual(isExcludedRoute("/auth/google"), true);
      assert.strictEqual(isExcludedRoute("/auth/callback"), true);
      assert.strictEqual(isExcludedRoute("/auth/refresh"), true);
      assert.strictEqual(isExcludedRoute("/auth/logout"), true);
      assert.strictEqual(isExcludedRoute("/v1/events/123/live"), true);
      assert.strictEqual(isExcludedRoute("/v1/notifications/live"), true);
      assert.strictEqual(isExcludedRoute("/webhooks/payment"), true);
    });

    it("identifies user-facing mobile routes as NOT excluded", () => {
      assert.strictEqual(isExcludedRoute("/auth/mobile/login-id-token"), false);
      assert.strictEqual(isExcludedRoute("/auth/mobile/exchange"), false);
      assert.strictEqual(isExcludedRoute("/v1/events"), false);
      assert.strictEqual(isExcludedRoute("/v1/teams"), false);
      assert.strictEqual(isExcludedRoute("/v1/attendance/mark"), false);
      assert.strictEqual(isExcludedRoute("/users/me"), false);
      assert.strictEqual(isExcludedRoute("/clubs"), false);
    });

    it("detects web dashboard client from origin, platform header, or browser fetch headers", () => {
      const webReq = {
        headers: { origin: "http://localhost:3000" },
      } as unknown as Request;
      assert.strictEqual(isWebDashboardClient(webReq), true);

      const platformReq = {
        headers: { "x-client-platform": "web" },
      } as unknown as Request;
      assert.strictEqual(isWebDashboardClient(platformReq), true);

      const browserReq = {
        headers: { "sec-fetch-mode": "cors" },
      } as unknown as Request;
      assert.strictEqual(isWebDashboardClient(browserReq), true);

      const mobileReq = {
        headers: {},
      } as unknown as Request;
      assert.strictEqual(isWebDashboardClient(mobileReq), false);
    });
  });

  describe("3. Middleware HTTP Verification", () => {
    const testApp = express();
    (testApp as any)._skipDefaultPlatformHeader = true;
    testApp.use(appVersionMiddleware);

    testApp.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok" });
    });

    testApp.get("/v1/admin/test", (_req: Request, res: Response) => {
      res.json({ admin: true });
    });

    testApp.get("/v1/events", (_req: Request, res: Response) => {
      res.json({ events: [] });
    });

    testApp.post("/auth/mobile/exchange", (_req: Request, res: Response) => {
      res.json({ exchanged: true });
    });

    it("rejects a request below the minimum app version with HTTP 426 and error shape", async () => {
      const res = await request(testApp)
        .get("/v1/events")
        .set("X-App-Version", "0.8.5")
        .expect(426);

      assert.strictEqual(res.body.error, "APP_VERSION_UNSUPPORTED");
      assert.strictEqual(res.body.minVersion, env.MIN_APP_VERSION);
      assert.ok(res.body.message.includes("update to the latest version"));
    });

    it("rejects a request with missing X-App-Version on mobile/user-facing routes with HTTP 426", async () => {
      const res = await request(testApp)
        .post("/auth/mobile/exchange")
        .expect(426);

      assert.strictEqual(res.body.error, "APP_VERSION_UNSUPPORTED");
      assert.strictEqual(res.body.minVersion, env.MIN_APP_VERSION);
    });

    it("rejects a request with empty or malformed X-App-Version with HTTP 426", async () => {
      const res = await request(testApp)
        .get("/v1/events")
        .set("X-App-Version", "malformed-version")
        .expect(426);

      assert.strictEqual(res.body.error, "APP_VERSION_UNSUPPORTED");
    });

    it("allows a request exactly at the minimum app version to pass through", async () => {
      const res = await request(testApp)
        .get("/v1/events")
        .set("X-App-Version", env.MIN_APP_VERSION)
        .expect(200);

      assert.deepStrictEqual(res.body, { events: [] });
    });

    it("allows a request above the minimum app version to pass through", async () => {
      const res = await request(testApp)
        .get("/v1/events")
        .set("X-App-Version", "2.5.0")
        .expect(200);

      assert.deepStrictEqual(res.body, { events: [] });
    });

    it("bypasses excluded infrastructure routes even without version headers", async () => {
      const res = await request(testApp).get("/health").expect(200);
      assert.deepStrictEqual(res.body, { status: "ok" });
    });

    it("bypasses excluded admin routes even without version headers", async () => {
      const res = await request(testApp).get("/v1/admin/test").expect(200);
      assert.deepStrictEqual(res.body, { admin: true });
    });

    it("bypasses web dashboard clients without version header based on origin", async () => {
      const res = await request(testApp)
        .get("/v1/events")
        .set("Origin", "http://localhost:3000")
        .expect(200);

      assert.deepStrictEqual(res.body, { events: [] });
    });

    it("demonstrates that an unbadged SSR request (no Origin, no Referer, no sec-fetch-mode, no X-App-Version, no X-Client-Platform) is rejected with 426", async () => {
      // Simulates a server-side request (e.g. Node fetch in SSR) before X-Client-Platform header was added.
      // Since it lacks any web signal or version header, it is indistinguishable from a legacy mobile install.
      const res = await request(testApp)
        .get("/v1/events")
        .expect(426);

      assert.strictEqual(res.body.error, "APP_VERSION_UNSUPPORTED");
      assert.strictEqual(res.body.minVersion, env.MIN_APP_VERSION);
    });

    it("allows server-side (SSR) requests from apps/dashboard providing X-Client-Platform: web to pass through normally", async () => {
      // Simulates an SSR request from apps/dashboard/lib/api.ts:
      // Has no browser headers (no Origin, no Referer, no sec-fetch-mode) and no X-App-Version,
      // but explicitly carries X-Client-Platform: web.
      const res = await request(testApp)
        .get("/v1/events")
        .set("X-Client-Platform", "web")
        .expect(200);

      assert.deepStrictEqual(res.body, { events: [] });
    });
  });
});
