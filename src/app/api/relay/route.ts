import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tempo } from "viem/chains";
import { TxEnvelopeTempo } from "ox/tempo";
import { Secp256k1, Signature } from "ox";

const RELAY_PASSWORD = process.env.RELAY_PASSWORD;
const FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY;

/** Validates the relay password from the Authorization header */
function authenticate(req: NextRequest): boolean {
  if (!RELAY_PASSWORD) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${RELAY_PASSWORD}`;
}

/** Co-signs a half-signed Tempo tx as fee payer, broadcasts, returns hash */
async function cosignAndBroadcast(
  serializedTx: `0x${string}`
): Promise<`0x${string}`> {
  // Deserialize — sender is auto-recovered from their signature
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
  const fullySigned = TxEnvelopeTempo.serialize(envelope, {
    feePayerSignature: Signature.from(feePayerSig),
  });

  // Broadcast via Tempo RPC
  const client = createPublicClient({
    chain: tempo,
    transport: http(process.env.NEXT_PUBLIC_TEMPO_RPC),
  });

  return client.request({
    method: "eth_sendRawTransaction",
    params: [fullySigned],
  });
}

/**
 * POST: JSON-RPC relay endpoint for sponsored Tempo transactions.
 * Handles eth_sendRawTransaction — co-signs as fee payer then broadcasts.
 * Also accepts direct { serializedTx } format for simple API usage.
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

    // JSON-RPC format — used by withRelay transport
    if (body.method === "eth_sendRawTransaction") {
      const params = body.params as string[];
      const hash = await cosignAndBroadcast(params[0] as `0x${string}`);
      return NextResponse.json({ result: hash });
    }

    // JSON-RPC: eth_fillTransaction — proxy directly to Tempo RPC
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

    // Direct format — { serializedTx: "0x..." }
    if (body.serializedTx) {
      const hash = await cosignAndBroadcast(
        body.serializedTx as `0x${string}`
      );
      return NextResponse.json({ hash });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
