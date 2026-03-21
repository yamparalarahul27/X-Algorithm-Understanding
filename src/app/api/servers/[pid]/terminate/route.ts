import { NextResponse } from "next/server";
import {
  LocalhostServerError,
  terminateLocalhostServer,
} from "@/lib/localhost-servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ pid: string }> },
) {
  const { pid } = await context.params;
  const parsedPid = Number.parseInt(pid, 10);

  if (!Number.isInteger(parsedPid)) {
    return NextResponse.json(
      { error: "A numeric pid is required." },
      { status: 400 },
    );
  }

  try {
    const result = await terminateLocalhostServer(parsedPid);

    return NextResponse.json(result, {
      status: result.terminated ? 200 : 202,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to terminate the process.";
    const status =
      error instanceof LocalhostServerError ? error.status : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
