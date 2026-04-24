import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tempo } from "viem/chains";
import { TxEnvelopeTempo } from "ox/tempo";
import { Secp256k1, Signature } from "ox";

const RELAY_PASSWORD = process.env.RELAY_PASSWORD;
const FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY;

/**
 * Authenticates relay requests. Accepts:
 * - Bearer token (for direct API usage)
 * - Same-origin requests (for Provider-level feePayer transport)
 */
function authenticate(req: NextRequest): boolean {
  // Bearer token auth
  const auth = req.headers.get("authorization") ?? "";
  if (RELAY_PASSWORD && auth === `Bearer ${RELAY_PASSWORD}`) return true;

  // Same-origin: Provider's feePayer transport sends JSON-RPC without auth headers.
  // Next.js API routes from same origin have matching host/origin or no origin header.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) return true; // Same-origin fetch omits Origin header
  if (host && origin.includes(host)) return true;

  return false;
}

/** Co-signs a half-signed Tempo tx as fee payer, returns fully-signed serialized tx */
function cosign(serializedTx: `0x${string}`): `0x${string}` {
  const envelope = TxEnvelopeTempo.from(
    serializedTx as TxEnvelopeTempo.Serialized
  );

  if (!envelope.from) {
    throw new Error("Cannot recover sender from transaction");
  }

  // Compute the fee payer signing payload — binds to this tx + sender
  const feePayerPayload = TxEnvelopeTempo.getFeePayerSignPayload(envelope, {
    sender: envelope.from,
  });

  // Co-sign with the relay's private key
  const feePayerSig = Secp256k1.sign({
    payload: feePayerPayload,
    privateKey: FEE_PAYER_PRIVATE_KEY as `0x${string}`,
  });

  // Re-serialize with both signatures
  return TxEnvelopeTempo.serialize(envelope, {
    feePayerSignature: Signature.from(feePayerSig),
  }) as `0x${string}`;
}

/** Broadcasts a fully-signed tx to Tempo RPC */
async function broadcast(signedTx: `0x${string}`): Promise<`0x${string}`> {
  const client = createPublicClient({
    chain: tempo,
    transport: http(process.env.NEXT_PUBLIC_TEMPO_RPC),
  });
  return client.request({
    method: "eth_sendRawTransaction",
    params: [signedTx],
  });
}

/**
 * POST: JSON-RPC relay for sponsored Tempo transactions.
 * Handles three JSON-RPC methods used by the Provider's feePayer transport:
 * - eth_signRawTransaction: co-sign and return (sign-only policy)
 * - eth_sendRawTransaction: co-sign and broadcast (sign-and-broadcast policy)
 * - eth_fillTransaction: proxy to Tempo RPC for gas estimation
 */
export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FEE_PAYER_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Relay not configured" },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    // eth_signRawTransaction: co-sign only, return fully-signed tx (default policy)
    if (body.method === "eth_signRawTransaction") {
      const params = body.params as string[];
      const fullySigned = cosign(params[0] as `0x${string}`);
      return NextResponse.json({ result: fullySigned });
    }

    // eth_sendRawTransaction: co-sign + broadcast, return hash
    if (body.method === "eth_sendRawTransaction") {
      const params = body.params as string[];
      const fullySigned = cosign(params[0] as `0x${string}`);
      const hash = await broadcast(fullySigned);
      return NextResponse.json({ result: hash });
    }

    // eth_fillTransaction: proxy to Tempo RPC for gas estimation
    if (body.method === "eth_fillTransaction") {
      const rpcUrl = process.env.NEXT_PUBLIC_TEMPO_RPC;
      if (!rpcUrl) {
        return NextResponse.json(
          { error: "Tempo RPC not configured" },
          { status: 500 }
        );
      }
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: body.method,
          params: body.params,
        }),
      });
      const rpcData = (await rpcRes.json()) as Record<string, unknown>;
      return NextResponse.json({ result: rpcData.result });
    }

    return NextResponse.json({ error: "Unsupported method" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Relay error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET: check relay health and fee payer address */
export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FEE_PAYER_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Relay not configured" },
      { status: 500 }
    );
  }

  try {
    const account = privateKeyToAccount(
      FEE_PAYER_PRIVATE_KEY as `0x${string}`
    );
    return NextResponse.json({ status: "ok", feePayer: account.address });
  } catch {
    return NextResponse.json({ error: "Invalid key config" }, { status: 500 });
  }
}
