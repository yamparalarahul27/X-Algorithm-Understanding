import { NextResponse } from "next/server";
import {
  LocalhostServerError,
  listLocalhostServers,
} from "@/lib/localhost-servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await listLocalhostServers();

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to inspect localhost servers.";
    const status =
      error instanceof LocalhostServerError ? error.status : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
