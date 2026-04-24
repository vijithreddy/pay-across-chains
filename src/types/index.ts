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

export type MigrationCard = {
  title: string;
  description: string;
  evmCode: string;
  tempoCode: string;
  evmHighlight: number[];
  tempoHighlight: number[];
};
