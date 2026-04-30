import { describe, it, expect, vi, beforeEach } from "vitest";
import { mainnet, base } from "wagmi/chains";

// Mock @wagmi/core before importing race-engine
const mockSwitchChain = vi.fn().mockResolvedValue(undefined);
const mockWriteContract = vi
  .fn()
  .mockResolvedValue("0xaaaa" as `0x${string}`);

vi.mock("@wagmi/core", () => ({
  switchChain: (...args: unknown[]) => mockSwitchChain(...args),
  writeContract: (...args: unknown[]) => mockWriteContract(...args),
}));

// Mock viem/tempo Actions
const mockTokenTransfer = vi
  .fn()
  .mockResolvedValue("0xbbbb" as `0x${string}`);

vi.mock("viem/tempo", () => ({
  Actions: {
    token: {
      transfer: (...args: unknown[]) => mockTokenTransfer(...args),
    },
  },
  Abis: {
    tip20: [],
  },
}));

// Mock createPublicClient for waitForTransactionReceipt
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: () => ({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
      }),
    }),
  };
});

// Mock wagmi config
vi.mock("@/lib/wagmi", () => ({
  config: { chains: [], state: {} },
}));

const TEMPO_ID = 4217;

describe("race engine — signing flow", () => {
  let startRace: typeof import("@/lib/race-engine").startRace;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    onUpdate = vi.fn();
    const mod = await import("@/lib/race-engine");
    startRace = mod.startRace;
  });

  const baseParams = {
    recipient: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    amount: "1",
    memo: "test",
    account: "0xabc0000000000000000000000000000000000000" as `0x${string}`,
    tempoClient: {
      account: { address: "0xTEMPO" },
      chain: { id: TEMPO_ID },
    } as unknown as Parameters<typeof startRace>[0]["tempoClient"],
    onUpdate: undefined as unknown as (
      chainId: number,
      state: Partial<import("@/lib/race-engine").ChainRaceState>
    ) => void,
    enabledChains: new Set([mainnet.id, base.id, TEMPO_ID]),
  };

  it("calls switchChain BEFORE writeContract for Ethereum", async () => {
    const params = {
      ...baseParams,
      onUpdate,
      enabledChains: new Set([mainnet.id]),
    };
    await startRace(params);

    expect(mockSwitchChain).toHaveBeenCalled();
    expect(mockWriteContract).toHaveBeenCalled();

    // switchChain must be called before writeContract
    const switchOrder = mockSwitchChain.mock.invocationCallOrder[0];
    const writeOrder = mockWriteContract.mock.invocationCallOrder[0];
    expect(switchOrder).toBeLessThan(writeOrder);
  });

  it("calls switchChain BEFORE writeContract for Base", async () => {
    const params = {
      ...baseParams,
      onUpdate,
      enabledChains: new Set([base.id]),
    };
    await startRace(params);

    const switchOrder = mockSwitchChain.mock.invocationCallOrder[0];
    const writeOrder = mockWriteContract.mock.invocationCallOrder[0];
    expect(switchOrder).toBeLessThan(writeOrder);
  });

  it("does NOT call switchChain for Tempo", async () => {
    const params = {
      ...baseParams,
      onUpdate,
      enabledChains: new Set([TEMPO_ID]),
    };
    await startRace(params);

    expect(mockSwitchChain).not.toHaveBeenCalled();
    expect(mockTokenTransfer).toHaveBeenCalled();
  });

  it("skips disabled chains", async () => {
    const params = {
      ...baseParams,
      onUpdate,
      enabledChains: new Set([TEMPO_ID]), // only Tempo enabled
    };
    await startRace(params);

    // writeContract should NOT be called (only EVM chains use it)
    expect(mockWriteContract).not.toHaveBeenCalled();
    // Tempo should still sign
    expect(mockTokenTransfer).toHaveBeenCalled();
  });

  it("throws with chain name when writeContract rejects", async () => {
    mockWriteContract.mockRejectedValueOnce(new Error("User rejected"));

    const params = {
      ...baseParams,
      onUpdate,
      enabledChains: new Set([mainnet.id]),
    };

    await expect(startRace(params)).rejects.toThrow("Signing failed on Ethereum");
  });

  it("sets error state on failed chain and idle on unsigned chains", async () => {
    mockWriteContract.mockRejectedValueOnce(new Error("User rejected"));

    const params = {
      ...baseParams,
      onUpdate,
      enabledChains: new Set([mainnet.id, base.id, TEMPO_ID]),
    };

    await expect(startRace(params)).rejects.toThrow();

    // Ethereum should have error state
    const ethErrorCall = onUpdate.mock.calls.find(
      ([chainId, update]: [number, { state: string }]) =>
        chainId === mainnet.id && update.state === "error"
    );
    expect(ethErrorCall).toBeDefined();

    // Base and Tempo should have idle state (never signed)
    const baseIdleCall = onUpdate.mock.calls.find(
      ([chainId, update]: [number, { state: string }]) =>
        chainId === base.id && update.state === "idle"
    );
    expect(baseIdleCall).toBeDefined();
  });
});
