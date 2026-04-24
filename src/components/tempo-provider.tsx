"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Provider, dialog, Dialog } from "accounts";
import { createWalletClient, custom } from "viem";
import { tempo } from "viem/chains";
import type { WalletClient, Transport, Account } from "viem";
import type { TempoCtx } from "@/types";

const TempoContext = createContext<TempoCtx>({
  address: undefined,
  client: undefined,
  signIn: async () => {},
  signOut: () => {},
  isPending: false,
});

/** Hook to access Tempo Wallet state — address, client, signIn, signOut */
export function useTempoWallet() {
  return useContext(TempoContext);
}

/** Manages Tempo Wallet connection via accounts SDK — independent from wagmi/MetaMask */
export function TempoProvider({ children }: { children: ReactNode }) {
  const providerRef = useRef<ReturnType<typeof Provider.create>>(undefined);
  const [address, setAddress] = useState<`0x${string}`>();
  const [client, setClient] =
    useState<WalletClient<Transport, typeof tempo, Account>>();
  const [isPending, setIsPending] = useState(false);

  const buildWalletClient = useCallback(
    (provider: ReturnType<typeof Provider.create>, addr: `0x${string}`) => {
      const wc = createWalletClient({
        account: addr,
        chain: tempo,
        transport: custom(provider),
      });
      return wc as WalletClient<Transport, typeof tempo, Account>;
    },
    []
  );

  useEffect(() => {
    if (providerRef.current) return;
    const isLocalhost =
      typeof window !== "undefined" && window.location.hostname === "localhost";
    providerRef.current = Provider.create({
      adapter: dialog({
        dialog: isLocalhost ? Dialog.popup() : Dialog.iframe(),
      }),
      chains: [tempo],
    });

    const provider = providerRef.current;

    const handleAccountsChanged = (accounts: readonly string[]) => {
      if (accounts.length > 0) {
        const addr = accounts[0] as `0x${string}`;
        setAddress(addr);
        setClient(buildWalletClient(provider, addr));
      } else {
        setAddress(undefined);
        setClient(undefined);
      }
    };

    provider.on("accountsChanged", handleAccountsChanged);

    provider
      .request({ method: "eth_accounts" })
      .then((accounts: readonly string[]) => {
        if (accounts.length > 0) {
          handleAccountsChanged(accounts);
        }
      })
      .catch(() => {}); // Silent — no stored session is normal on first visit

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [buildWalletClient]);

  const signIn = useCallback(async () => {
    if (!providerRef.current) return;
    setIsPending(true);
    try {
      const result = await providerRef.current.request({
        method: "wallet_connect",
      });
      const rawAccounts =
        (result as Record<string, unknown>)?.accounts ?? result;
      const addrList = Array.isArray(rawAccounts)
        ? rawAccounts.map((a: Record<string, unknown>) =>
            typeof a === "string" ? a : a.address
          )
        : [];
      if (addrList.length > 0) {
        const addr = addrList[0] as `0x${string}`;
        setAddress(addr);
        setClient(buildWalletClient(providerRef.current, addr));
      }
    } catch {
      // User cancelled or error
    } finally {
      setIsPending(false);
    }
  }, [buildWalletClient]);

  const signOut = useCallback(() => {
    if (!providerRef.current) return;
    providerRef.current
      .request({ method: "wallet_disconnect" })
      .catch(() => {}); // Best-effort disconnect — UI resets regardless
    setAddress(undefined);
    setClient(undefined);
  }, []);

  return (
    <TempoContext.Provider
      value={{ address, client, signIn, signOut, isPending }}
    >
      {children}
    </TempoContext.Provider>
  );
}
