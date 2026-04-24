import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tempo } from "viem/chains";
import { TxEnvelopeTempo } from "ox/tempo";
import { Secp256k1, Signature } from "ox";

const RELAY_PASSWORD = process.env.RELAY_PASSWORD;
const FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY;

/** CORS headers — Provider's http() transport triggers preflight on cross-origin */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** JSON response with CORS headers */
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

/** Handle CORS preflight requests */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
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
 * Handles three methods used by the Provider's feePayer transport:
 * - eth_signRawTransaction: co-sign and return (sign-only policy)
 * - eth_sendRawTransaction: co-sign and broadcast
 * - eth_fillTransaction: proxy to Tempo RPC for gas estimation
 */
export async function POST(req: NextRequest) {
  if (!FEE_PAYER_PRIVATE_KEY) {
    return json({ error: "Relay not configured" }, 500);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    // eth_signRawTransaction: co-sign only, return fully-signed tx (default policy)
    if (body.method === "eth_signRawTransaction") {
      const params = body.params as string[];
      const fullySigned = cosign(params[0] as `0x${string}`);
      return json({ result: fullySigned });
    }

    // eth_sendRawTransaction: co-sign + broadcast, return hash
    if (body.method === "eth_sendRawTransaction") {
      const params = body.params as string[];
      const fullySigned = cosign(params[0] as `0x${string}`);
      const hash = await broadcast(fullySigned);
      return json({ result: hash });
    }

    // eth_fillTransaction: proxy to Tempo RPC for gas estimation
    if (body.method === "eth_fillTransaction") {
      const rpcUrl = process.env.NEXT_PUBLIC_TEMPO_RPC;
      if (!rpcUrl) {
        return json({ error: "Tempo RPC not configured" }, 500);
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
      return json({ result: rpcData.result });
    }

    return json({ error: "Unsupported method" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Relay error";
    return json({ error: message }, 500);
  }
}

/** GET: check relay health and fee payer address */
export async function GET(req: NextRequest) {
  // GET requires Bearer auth — not called by Provider transport
  const auth = req.headers.get("authorization") ?? "";
  if (!RELAY_PASSWORD || auth !== `Bearer ${RELAY_PASSWORD}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!FEE_PAYER_PRIVATE_KEY) {
    return json({ error: "Relay not configured" }, 500);
  }

  try {
    const account = privateKeyToAccount(
      FEE_PAYER_PRIVATE_KEY as `0x${string}`
    );
    return json({ status: "ok", feePayer: account.address });
  } catch {
    return json({ error: "Invalid key config" }, 500);
  }
}
