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
import type { WalletClient, Transport, Chain, Account } from "viem";

type TempoCtx = {
  address: `0x${string}` | undefined;
  client: WalletClient<Transport, typeof tempo, Account> | undefined;
  signIn: () => Promise<void>;
  signOut: () => void;
  isPending: boolean;
};

const TempoContext = createContext<TempoCtx>({
  address: undefined,
  client: undefined,
  signIn: async () => {},
  signOut: () => {},
  isPending: false,
});

export function useTempoWallet() {
  return useContext(TempoContext);
}

export function TempoProvider({ children }: { children: ReactNode }) {
  const providerRef = useRef<ReturnType<typeof Provider.create>>(undefined);
  const [address, setAddress] = useState<`0x${string}`>();
  const [client, setClient] =
    useState<WalletClient<Transport, typeof tempo, Account>>();
  const [isPending, setIsPending] = useState(false);

  // Build a wallet client from the provider + account (can sign transactions)
  const buildWalletClient = useCallback(
    (provider: ReturnType<typeof Provider.create>, addr: `0x${string}`) => {
      // Create wallet client with address as JSON-RPC account.
      // Signing is handled by the provider (Tempo Wallet dialog) — NOT locally.
      // When sendTransaction is called, the provider shows the dialog for approval.
      const wc = createWalletClient({
        account: addr,
        chain: tempo,
        transport: custom(provider),
      });
      console.log("[tempo-provider] WalletClient created with JSON-RPC account:", addr);
      return wc as WalletClient<Transport, typeof tempo, Account>;
    },
    []
  );

  // Create provider once
  useEffect(() => {
    if (providerRef.current) return;
    console.log("[tempo-provider] Creating Provider...");
    // Use popup on localhost (WebAuthn requires valid TLS — iframes fail on http://localhost).
    // Use iframe in production (has HTTPS).
    const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
    providerRef.current = Provider.create({
      adapter: dialog({ dialog: isLocalhost ? Dialog.popup() : Dialog.iframe() }),
      chains: [tempo],
    });
    console.log("[tempo-provider] Provider created:", providerRef.current);

    const provider = providerRef.current;

    // Listen for account changes
    const handleAccountsChanged = (accounts: readonly string[]) => {
      console.log("[tempo-provider] accountsChanged:", accounts);
      if (accounts.length > 0) {
        const addr = accounts[0] as `0x${string}`;
        setAddress(addr);
        const wc = buildWalletClient(provider, addr);
        console.log("[tempo-provider] WalletClient built:", wc);
        console.log("[tempo-provider] WalletClient account:", (wc as any)?.account);
        setClient(wc);
      } else {
        setAddress(undefined);
        setClient(undefined);
      }
    };

    provider.on("accountsChanged", handleAccountsChanged);

    // Check if already connected (from stored session)
    provider
      .request({ method: "eth_accounts" })
      .then((accounts: readonly string[]) => {
        console.log("[tempo-provider] eth_accounts result:", accounts);
        if (accounts.length > 0) {
          handleAccountsChanged(accounts);
        }
      })
      .catch((err) => {
        console.error("[tempo-provider] eth_accounts error:", err);
      });

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [buildWalletClient]);

  const signIn = useCallback(async () => {
    if (!providerRef.current) return;
    setIsPending(true);
    try {
      console.log("[tempo-provider] Calling wallet_connect...");
      const result = await providerRef.current.request({
        method: "wallet_connect",
      });
      console.log("[tempo-provider] wallet_connect result:", result);
      console.log("[tempo-provider] wallet_connect result type:", typeof result);
      console.log("[tempo-provider] wallet_connect result keys:", result ? Object.keys(result as any) : "null");
      // wallet_connect returns { accounts: [...] } with account objects
      const rawAccounts = (result as any)?.accounts ?? result;
      console.log("[tempo-provider] rawAccounts:", rawAccounts);
      const addrList = Array.isArray(rawAccounts)
        ? rawAccounts.map((a: any) =>
            typeof a === "string" ? a : a.address
          )
        : [];
      console.log("[tempo-provider] addrList:", addrList);
      if (addrList.length > 0) {
        const addr = addrList[0] as `0x${string}`;
        console.log("[tempo-provider] Setting address:", addr);
        setAddress(addr);
        const wc = buildWalletClient(providerRef.current, addr);
        console.log("[tempo-provider] WalletClient:", wc);
        console.log("[tempo-provider] WalletClient account:", (wc as any)?.account);
        setClient(wc);
      } else {
        console.warn("[tempo-provider] No addresses found in wallet_connect result");
      }
    } catch (err) {
      console.error("[tempo-provider] wallet_connect error:", err);
    } finally {
      setIsPending(false);
    }
  }, [buildWalletClient]);

  const signOut = useCallback(() => {
    if (!providerRef.current) return;
    providerRef.current
      .request({ method: "wallet_disconnect" })
      .catch(() => {});
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
