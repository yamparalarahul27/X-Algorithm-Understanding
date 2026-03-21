import { NextResponse } from "next/server";
import {
  LocalhostServerError,
  terminateLocalhostServer,
} from "@/lib/localhost-servers";
import type { TerminationSignal } from "@/lib/localhost-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
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

  let signal: TerminationSignal = "SIGTERM";
  const rawBody = await request.text();

  if (rawBody) {
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "The terminate request body must be valid JSON." },
        { status: 400 },
      );
    }

    if (
      typeof parsedBody !== "object" ||
      parsedBody === null ||
      !("signal" in parsedBody) ||
      (parsedBody.signal !== "SIGTERM" && parsedBody.signal !== "SIGKILL")
    ) {
      return NextResponse.json(
        { error: "The terminate signal must be SIGTERM or SIGKILL." },
        { status: 400 },
      );
    }

    signal = parsedBody.signal;
  }

  try {
    const result = await terminateLocalhostServer(parsedPid, signal);

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
