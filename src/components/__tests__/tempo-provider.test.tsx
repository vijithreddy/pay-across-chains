import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// Mock accounts SDK
const mockProviderCreate = vi.fn().mockReturnValue({
  on: vi.fn(),
  removeListener: vi.fn(),
  request: vi.fn().mockResolvedValue([]),
});

vi.mock("accounts", () => ({
  Provider: { create: (...args: unknown[]) => mockProviderCreate(...args) },
  dialog: vi.fn(() => ({})),
  Dialog: {
    popup: vi.fn(() => ({ type: "popup" })),
    iframe: vi.fn(() => ({ type: "iframe" })),
  },
}));

// Mock viem
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createWalletClient: vi.fn(() => ({})),
    custom: vi.fn(() => ({})),
  };
});

describe("TempoProvider — Provider.create safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates Provider WITHOUT feePayer config", async () => {
    const { TempoProvider } = await import("@/components/tempo-provider");

    render(
      <TempoProvider>
        <div data-testid="child">child</div>
      </TempoProvider>
    );

    expect(mockProviderCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockProviderCreate.mock.calls[0][0];
    // feePayer must NOT be present (or must be commented out)
    expect(createArgs).not.toHaveProperty("feePayer");
  });

  it("creates Provider with tempo chain", async () => {
    const { TempoProvider } = await import("@/components/tempo-provider");

    render(
      <TempoProvider>
        <div>child</div>
      </TempoProvider>
    );

    const createArgs = mockProviderCreate.mock.calls[0][0];
    expect(createArgs.chains).toBeDefined();
    expect(createArgs.chains.length).toBe(1);
  });

  it("renders children without crashing", async () => {
    const { TempoProvider } = await import("@/components/tempo-provider");

    const { getByTestId } = render(
      <TempoProvider>
        <div data-testid="child">hello</div>
      </TempoProvider>
    );

    expect(getByTestId("child")).toBeInTheDocument();
  });
});
