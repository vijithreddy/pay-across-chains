import { custom } from "viem";

/**
 * Creates a viem transport that routes JSON-RPC calls to /api/relay
 * with Bearer token auth. Used as the relay leg in withRelay().
 */
export function relayTransport(password: string) {
  return custom({
    // Relay handles eth_sendRawTransaction and eth_fillTransaction
    async request({ method, params }) {
      const res = await fetch("/api/relay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ method, params }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error ??
            `Relay error: ${res.status}`
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      return data.result as never;
    },
  });
}
