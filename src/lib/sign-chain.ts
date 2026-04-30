import { type Hash, type WalletClient, type Transport, type Account } from "viem";
import { writeContract, switchChain } from "@wagmi/core";
import { Actions } from "viem/tempo";
import { Hex } from "ox";
import { tempo, USDC_ADDRESSES, CHAIN_NAMES } from "./chains";
import { erc20Abi } from "./abi";
import { config } from "./wagmi";
import type { Chain } from "viem";
import { mainnet, base } from "wagmi/chains";

type SupportedChainId = typeof mainnet.id | typeof base.id | typeof tempo.id;
export type TempoWalletClient = WalletClient<Transport, Chain, Account>;

/* eslint-disable no-console */
const LOG = "[race]";

/** Sign and broadcast one chain — switches chain first for EVM wallets */
export async function signChain(
  chainId: SupportedChainId,
  recipient: `0x${string}`,
  amount: bigint,
  memo: string,
  tempoClient: TempoWalletClient | undefined,
  onUpdate: (chainId: number, state: Record<string, unknown>) => void,
  sponsored?: boolean
): Promise<Hash> {
  const chain = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
  console.log(`${LOG} signChain START chain=${chain} (${chainId}) sponsored=${!!sponsored}`);
  onUpdate(chainId, { state: "signing" });

  if (chainId !== tempo.id) {
    console.log(`${LOG} switchChain → ${chain}`);
    try {
      // wagmi v2 types don't infer extended chain IDs from tempo.extend()
      await (switchChain as (...args: unknown[]) => Promise<unknown>)(config, {
        chainId,
      });
      console.log(`${LOG} switchChain → ${chain} OK`);
    } catch {
      console.log(`${LOG} switchChain → ${chain} skipped (already on chain)`);
    }
  }

  let hash: Hash;

  if (chainId === tempo.id) {
    if (!tempoClient) throw new Error("Tempo Wallet not connected");
    // When sponsored, feePayer: true routes through the relay
    hash = await (
      Actions.token.transfer as (...args: unknown[]) => Promise<Hash>
    )(tempoClient, {
      to: recipient,
      amount,
      memo: Hex.fromString(memo),
      token: USDC_ADDRESSES[tempo.id],
      ...(sponsored ? { feePayer: true } : {}),
    });
  } else {
    // wagmi v2 types don't infer extended chain IDs
    hash = await (writeContract as (...args: unknown[]) => Promise<Hash>)(
      config,
      {
        chainId,
        address: USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES],
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, amount],
      }
    );
  }

  console.log(`${LOG} signChain DONE chain=${chain} hash=${hash.slice(0, 14)}...`);
  onUpdate(chainId, { state: "signed", hash });
  return hash;
}
/* eslint-enable no-console */
