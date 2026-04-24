import { Handler } from "accounts/server";
import { privateKeyToAccount } from "viem/accounts";
import { tempo } from "viem/chains";
import { NextRequest } from "next/server";

/** Lazily created relay handler — avoids crashing at build time if env var is missing */
let handler: ReturnType<typeof Handler.relay> | undefined;

function getHandler() {
  if (handler) return handler;
  const key = process.env.FEE_PAYER_PRIVATE_KEY as `0x${string}`;
  if (!key) throw new Error("FEE_PAYER_PRIVATE_KEY not configured");
  handler = Handler.relay({
    chains: [tempo],
    feePayer: {
      account: privateKeyToAccount(key),
      name: "Pay Across Chains",
    },
  });
  return handler;
}

export async function GET(req: NextRequest) {
  return getHandler().fetch(req);
}

export async function POST(req: NextRequest) {
  return getHandler().fetch(req);
}

export async function OPTIONS(req: NextRequest) {
  return getHandler().fetch(req);
}
