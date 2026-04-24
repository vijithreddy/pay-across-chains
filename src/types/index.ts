import type { WalletClient, Transport, Account } from "viem";
import type { tempo } from "viem/chains";

export type Tab = "race" | "migration";

export type TempoCtx = {
  address: `0x${string}` | undefined;
  client: WalletClient<Transport, typeof tempo, Account> | undefined;
  signIn: () => Promise<void>;
  signOut: () => void;
  isPending: boolean;
};

/** Stored race result for persistence and sharing */
export type RaceResult = {
  id: string;
  timestamp: number;
  chains: {
    chainId: number;
    name: string;
    elapsedMs: number;
    feeDisplay: string;
    feeToken: string;
    hash: string;
    state: "confirmed" | "error";
    error?: string;
  }[];
  winner: string;
  recipient: string;
  amount: string;
  memo: string;
};

export type MigrationCard = {
  title: string;
  description: string;
  evmCode: string;
  tempoCode: string;
  evmHighlight: number[];
  tempoHighlight: number[];
};
