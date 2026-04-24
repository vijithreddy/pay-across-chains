import {
  createPublicClient,
  createWalletClient,
  custom,
  parseUnits,
  toHex,
  formatEther,
  formatUnits,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { mainnet, base } from "wagmi/chains";
import { tempo, USDC_ADDRESSES, transports, CHAIN_NAMES } from "./chains";
import { erc20Abi, tip20Abi } from "./abi";

export type TxState = "idle" | "broadcasting" | "pending" | "confirmed" | "error";

export type ChainRaceState = {
  chainId: number;
  name: string;
  state: TxState;
  hash?: Hash;
  receipt?: TransactionReceipt;
  startTime?: number;
  endTime?: number;
  elapsedMs?: number;
  feeDisplay?: string;
  feeToken?: string;
  error?: string;
};

type RaceParams = {
  recipient: `0x${string}`;
  amount: string; // e.g. "1" for 1 USDC
  memo: string;
  onUpdate: (chainId: number, state: Partial<ChainRaceState>) => void;
};

function getWalletClient(chainId: number) {
  const chainMap = {
    [mainnet.id]: mainnet,
    [base.id]: base,
    [tempo.id]: tempo,
  } as const;
  const chain = chainMap[chainId as keyof typeof chainMap];
  if (!chain || !window.ethereum) throw new Error("No wallet");
  return createWalletClient({
    chain,
    transport: custom(window.ethereum),
  });
}

function getPublicClient(chainId: number) {
  const chainMap = {
    [mainnet.id]: mainnet,
    [base.id]: base,
    [tempo.id]: tempo,
  } as const;
  const chain = chainMap[chainId as keyof typeof chainMap];
  if (!chain) throw new Error("Unknown chain");
  return createPublicClient({
    chain,
    transport: transports[chainId as keyof typeof transports],
  });
}

async function sendErc20Transfer(
  chainId: typeof mainnet.id | typeof base.id,
  recipient: `0x${string}`,
  amount: bigint,
  account: `0x${string}`,
  onUpdate: RaceParams["onUpdate"]
): Promise<ChainRaceState> {
  const name = CHAIN_NAMES[chainId];
  const startTime = performance.now();
  onUpdate(chainId, { state: "broadcasting", startTime });

  try {
    const walletClient = getWalletClient(chainId);
    const publicClient = getPublicClient(chainId);

    const hash = await walletClient.writeContract({
      address: USDC_ADDRESSES[chainId],
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, amount],
      account,
    });

    onUpdate(chainId, { state: "pending", hash });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const endTime = performance.now();
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const feeWei = gasUsed * gasPrice;
    const feeDisplay = `${parseFloat(formatEther(feeWei)).toFixed(6)} ETH`;

    const result: ChainRaceState = {
      chainId,
      name,
      state: "confirmed",
      hash,
      receipt,
      startTime,
      endTime,
      elapsedMs: endTime - startTime,
      feeDisplay,
      feeToken: "ETH",
    };
    onUpdate(chainId, result);
    return result;
  } catch (err: unknown) {
    const endTime = performance.now();
    const result: ChainRaceState = {
      chainId,
      name,
      state: "error",
      startTime,
      endTime,
      elapsedMs: endTime - startTime,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    onUpdate(chainId, result);
    return result;
  }
}

async function sendTempoTransfer(
  recipient: `0x${string}`,
  amount: bigint,
  memo: string,
  account: `0x${string}`,
  onUpdate: RaceParams["onUpdate"]
): Promise<ChainRaceState> {
  const chainId = tempo.id;
  const name = CHAIN_NAMES[chainId];
  const startTime = performance.now();
  onUpdate(chainId, { state: "broadcasting", startTime });

  try {
    const walletClient = getWalletClient(chainId);
    const publicClient = getPublicClient(chainId);
    const memoBytes = toHex(memo, { size: 32 });

    const hash = await walletClient.writeContract({
      address: USDC_ADDRESSES[chainId],
      abi: tip20Abi,
      functionName: "transferWithMemo",
      args: [recipient, amount, memoBytes],
      account,
    });

    onUpdate(chainId, { state: "pending", hash });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const endTime = performance.now();
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const feeWei = gasUsed * gasPrice;
    // Tempo fees are in USDC, displayed differently
    const feeDisplay = `${parseFloat(formatUnits(feeWei, 6)).toFixed(6)} USDC`;

    const result: ChainRaceState = {
      chainId,
      name,
      state: "confirmed",
      hash,
      receipt,
      startTime,
      endTime,
      elapsedMs: endTime - startTime,
      feeDisplay,
      feeToken: "USDC",
    };
    onUpdate(chainId, result);
    return result;
  } catch (err: unknown) {
    const endTime = performance.now();
    const result: ChainRaceState = {
      chainId,
      name,
      state: "error",
      startTime,
      endTime,
      elapsedMs: endTime - startTime,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    onUpdate(chainId, result);
    return result;
  }
}

export async function startRace(
  params: RaceParams & { account: `0x${string}` }
): Promise<ChainRaceState[]> {
  const { recipient, amount, memo, account, onUpdate } = params;
  // USDC has 6 decimals on all chains
  const amountParsed = parseUnits(amount, 6);

  const results = await Promise.allSettled([
    sendErc20Transfer(mainnet.id, recipient, amountParsed, account, onUpdate),
    sendErc20Transfer(base.id, recipient, amountParsed, account, onUpdate),
    sendTempoTransfer(recipient, amountParsed, memo, account, onUpdate),
  ]);

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          chainId: 0,
          name: "Unknown",
          state: "error" as TxState,
          error: r.reason?.message ?? "Unknown error",
        }
  );
}
