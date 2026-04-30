import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** CORS middleware for /api/relay — wallet.tempo.xyz iframe sends cross-origin requests */
export function middleware(req: NextRequest) {
  // Only apply CORS to relay endpoint
  if (!req.nextUrl.pathname.startsWith("/api/relay")) {
    return NextResponse.next();
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Add CORS headers to actual response
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/relay",
};
