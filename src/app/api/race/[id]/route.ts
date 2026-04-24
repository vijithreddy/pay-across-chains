import { NextResponse } from "next/server";
import { loadRaceResult } from "@/lib/storage";

/** GET /api/race/[id] — retrieves a stored race result by ID */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await loadRaceResult(id);

    if (!result) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch {
    // Storage read failed
    return NextResponse.json(
      { error: "Failed to load race result" },
      { status: 500 }
    );
  }
}
