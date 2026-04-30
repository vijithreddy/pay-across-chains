import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Read source directly for pattern checks that complement runtime tests
const wagmiSource = readFileSync(
  join(__dirname, "..", "wagmi.ts"),
  "utf-8"
);

describe("wagmi config — wallet connector safety", () => {
  it("uses phantomWallet from RainbowKit (not raw injected)", () => {
    expect(wagmiSource).toContain("phantomWallet");
    expect(wagmiSource).not.toContain('from "wagmi/connectors"');
    expect(wagmiSource).not.toContain("from 'wagmi/connectors'");
  });

  it("uses metaMaskWallet from RainbowKit", () => {
    expect(wagmiSource).toContain("metaMaskWallet");
  });

  it("does not use injectedWallet (ambiguous catch-all)", () => {
    expect(wagmiSource).not.toContain("injectedWallet");
  });

  it("has multiInjectedProviderDiscovery disabled", () => {
    expect(wagmiSource).toMatch(/multiInjectedProviderDiscovery:\s*false/);
  });

  it("creates config without throwing", async () => {
    // Dynamic import so env vars and mocks are set up first
    vi.useFakeTimers();
    const { config } = await import("@/lib/wagmi");
    // Advance 1s — if there were infinite loops/timers, this would hang or throw
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();

    expect(config).toBeDefined();
    expect(config.chains).toBeDefined();
    expect(config.chains.length).toBeGreaterThanOrEqual(3);
  });
});
