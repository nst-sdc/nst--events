import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, APP_VERSION } from "../src/infrastructure/api";
import { useAppVersionStore } from "../src/store/app-version-store";
import { ErrorBoundary } from "../src/infrastructure/ErrorBoundary";
import {
  UpdateRequiredPrompt,
  openAppStore,
} from "../src/ui/UpdateRequiredPrompt";
import { Linking } from "react-native";

vi.mock("expo-secure-store", () => ({
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("Mobile: App Version Header & 426 Upgrade Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppVersionStore.getState().dismiss();
  });

  it("1. apiClient attaches X-App-Version header matching APP_VERSION to requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });

    await apiClient("/v1/events");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/events"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-App-Version": APP_VERSION,
        }),
      }),
    );
  });

  it("2. apiClient handles HTTP 426 Upgrade Required by updating store and throwing distinct error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 426,
      json: async () => ({
        error: "APP_VERSION_UNSUPPORTED",
        message:
          "Please update to the latest version of NST Events to continue.",
        minVersion: "1.5.0",
      }),
    });

    expect(useAppVersionStore.getState().isUpdateRequired).toBe(false);

    await expect(apiClient("/v1/events")).rejects.toEqual({
      status: 426,
      code: "APP_VERSION_UNSUPPORTED",
      message: "Please update to the latest version of NST Events to continue.",
      minVersion: "1.5.0",
      body: {
        error: "APP_VERSION_UNSUPPORTED",
        message:
          "Please update to the latest version of NST Events to continue.",
        minVersion: "1.5.0",
      },
    });

    // Zustand store is updated to trigger modal UI
    expect(useAppVersionStore.getState().isUpdateRequired).toBe(true);
    expect(useAppVersionStore.getState().minVersion).toBe("1.5.0");
  });

  it("3. ErrorBoundary detects 426 and renders UpdateRequiredPrompt component", () => {
    const boundary = new ErrorBoundary({ children: null });
    const err: any = new Error("Unsupported");
    err.status = 426;
    err.code = "APP_VERSION_UNSUPPORTED";
    err.minVersion = "2.0.0";

    boundary.state = { hasError: true, error: err };
    const rendered = boundary.render();

    // Verify it renders UpdateRequiredPrompt with minVersion prop
    expect(rendered).toBeDefined();
    expect((rendered as any).type).toBe(UpdateRequiredPrompt);
    expect((rendered as any).props.minVersion).toBe("2.0.0");
  });

  it("4. ErrorBoundary falls through to standard application error view for non-426 errors", () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true, error: new Error("Network timeout") };
    const rendered = boundary.render();

    expect(rendered).toBeDefined();
    expect((rendered as any).type).not.toBe(UpdateRequiredPrompt);
  });

  it("5. openAppStore attempts to launch platform store URL via Linking", async () => {
    const spy = vi.spyOn(Linking, "openURL");
    await openAppStore();
    expect(spy).toHaveBeenCalled();
  });
});
