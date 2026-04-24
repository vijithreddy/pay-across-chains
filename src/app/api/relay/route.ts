import { Handler } from "accounts/server";
import { privateKeyToAccount } from "viem/accounts";
import { tempo } from "viem/chains";

/** Relay handler using Tempo's built-in Handler.relay — handles co-signing, CORS, and eth_fillTransaction */
const handler = Handler.relay({
  chains: [tempo],
  feePayer: {
    account: privateKeyToAccount(
      process.env.FEE_PAYER_PRIVATE_KEY as `0x${string}`
    ),
    name: "Pay Across Chains",
  },
});

export const GET = handler.fetch;
export const POST = handler.fetch;
export const OPTIONS = handler.fetch;
