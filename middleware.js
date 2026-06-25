import { NextResponse } from "next/server";

// ─── CONFIG: set these as Environment Variables in Vercel (recommended) ───
// Project Settings → Environment Variables → add BASIC_AUTH_USER and BASIC_AUTH_PASS
// If not set, falls back to the defaults below (change these before deploying!)
const USER = process.env.BASIC_AUTH_USER || "nhc";
const PASS = process.env.BASIC_AUTH_PASS || "changeme123";

export function middleware(req) {
  const authHeader = req.headers.get("authorization");

  if (authHeader) {
    const encoded = authHeader.split(" ")[1] || "";
    const decoded = Buffer.from(encoded, "base64").toString();
    const [user, pass] = decoded.split(":");

    if (user === USER && pass === PASS) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="NHC Dashboard"',
    },
  });
}

// Protect everything — pages AND API routes
export const config = {
  matcher: "/:path*",
};
