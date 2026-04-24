import { NextResponse } from "next/server";
import { saveRaceResult } from "@/lib/storage";
import type { RaceResult } from "@/types";

/** POST /api/race — saves a completed race result, returns the ID */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RaceResult;

    // Validate required fields
    if (!body.id || !body.chains || body.chains.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: id, chains" },
        { status: 400 }
      );
    }

    await saveRaceResult(body);

    return NextResponse.json({ id: body.id, ok: true });
  } catch {
    // Request body parsing or storage write failed
    return NextResponse.json(
      { error: "Failed to save race result" },
      { status: 500 }
    );
  }
}
