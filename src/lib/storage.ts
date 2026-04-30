import type { RaceResult } from "@/types";

/**
 * Race result storage — uses Vercel KV when available, falls back to in-memory.
 * In-memory store works for local dev and preview deployments.
 * Provision Vercel KV (Upstash Redis) for production persistence.
 */

const RACE_KEY_PREFIX = "race:";
const RACE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// In-memory fallback when KV is not configured
const memoryStore = new Map<string, RaceResult>();

/** Check if Vercel KV is configured via env vars */
function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Lazy-load @vercel/kv only when configured — avoids import errors */
async function getKv() {
  if (!isKvConfigured()) return null;
  // Dynamic import so it doesn't fail when KV env vars are missing
  const { kv } = await import("@vercel/kv");
  return kv;
}

/** Save a race result — returns the ID */
export async function saveRaceResult(result: RaceResult): Promise<string> {
  const key = `${RACE_KEY_PREFIX}${result.id}`;
  const kvClient = await getKv();

  if (kvClient) {
    await kvClient.set(key, JSON.stringify(result), {
      ex: RACE_TTL_SECONDS,
    });
  } else {
    // Fallback: in-memory (lost on restart, fine for dev/preview)
    memoryStore.set(key, result);
  }

  return result.id;
}

/** Load a race result by ID — returns null if not found */
export async function loadRaceResult(id: string): Promise<RaceResult | null> {
  const key = `${RACE_KEY_PREFIX}${id}`;
  const kvClient = await getKv();

  if (kvClient) {
    const raw = await kvClient.get<string>(key);
    if (!raw) return null;
    return typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as unknown as RaceResult);
  }

  return memoryStore.get(key) ?? null;
}
