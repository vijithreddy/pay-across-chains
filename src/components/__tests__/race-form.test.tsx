import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
  }),
}));

// Mock tempo wallet context
vi.mock("@/components/tempo-provider", () => ({
  useTempoWallet: () => ({
    address: "0xTEMPO000000000000000000000000000000000000" as `0x${string}`,
    client: { account: { address: "0xTEMPO" }, chain: { id: 4217 } },
    signIn: vi.fn(),
    signOut: vi.fn(),
    isPending: false,
  }),
}));

// Mock confetti
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

// Mock race engine — controlled by test
let mockStartRace: ReturnType<typeof vi.fn>;
let mockStartDryRace: ReturnType<typeof vi.fn>;

vi.mock("@/lib/race-engine", () => ({
  startRace: (...args: unknown[]) => mockStartRace(...args),
  startDryRace: (...args: unknown[]) => mockStartDryRace(...args),
  type: {} as Record<string, unknown>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Zap: () => React.createElement("span", null, "Z"),
  ArrowLeft: () => React.createElement("span", null, "<"),
}));

describe("RaceForm — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartRace = vi.fn().mockResolvedValue([]);
    mockStartDryRace = vi.fn().mockResolvedValue([]);
  });

  it("shows error banner when startRace throws", async () => {
    mockStartRace.mockRejectedValue(
      new Error("Signing failed on Ethereum: User rejected")
    );

    const { RaceForm } = await import("@/components/race-form");

    render(
      <RaceForm
        allFunded={true}
        tempoAddress={"0xTEMPO000000000000000000000000000000000000" as `0x${string}`}
        enabledChains={new Set([1, 8453, 4217])}
      />
    );

    // Fill recipient
    const recipientInput = screen.getByPlaceholderText("0x...");
    fireEvent.change(recipientInput, {
      target: { value: "0x1234567890123456789012345678901234567890" },
    });

    // Click send
    const sendButton = screen.getByText(/send on all/i);
    fireEvent.click(sendButton);

    // Wait for error banner to appear
    await waitFor(() => {
      expect(screen.getByText("Race failed")).toBeInTheDocument();
    });
  });

  it("does not show blank screen after error — form or error banner visible", async () => {
    mockStartRace.mockRejectedValue(new Error("Network error"));

    const { RaceForm } = await import("@/components/race-form");

    render(
      <RaceForm
        allFunded={true}
        tempoAddress={"0xTEMPO000000000000000000000000000000000000" as `0x${string}`}
        enabledChains={new Set([1, 8453, 4217])}
      />
    );

    const recipientInput = screen.getByPlaceholderText("0x...");
    fireEvent.change(recipientInput, {
      target: { value: "0x1234567890123456789012345678901234567890" },
    });

    fireEvent.click(screen.getByText(/send on all/i));

    await waitFor(() => {
      // Error banner must be visible — not a blank screen
      expect(screen.getByText("Race failed")).toBeInTheDocument();
    });
  });
});
