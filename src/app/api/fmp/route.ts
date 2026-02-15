import { NextResponse } from "next/server";

const BASE = "https://financialmodelingprep.com/stable";

const endpointMap: Record<string, { path: string; needsSymbol?: boolean }> = {
  list: { path: "/cryptocurrency-list" },
  quote: { path: "/quote", needsSymbol: true },
  "quote-short": { path: "/quote-short", needsSymbol: true },
  batch: { path: "/batch-crypto-quotes" },
  "eod-light": { path: "/historical-price-eod/light", needsSymbol: true },
  "intraday-1min": { path: "/historical-chart/1min", needsSymbol: true },
  "intraday-5min": { path: "/historical-chart/5min", needsSymbol: true },
  "intraday-1h": { path: "/historical-chart/1hour", needsSymbol: true },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const symbol = searchParams.get("symbol") ?? "";
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "FMP_API_KEY is missing. Set it in .env.local" },
      { status: 500 },
    );
  }

  const entry = endpointMap[type];

  if (!entry) {
    return NextResponse.json(
      { error: `Unknown endpoint type '${type}'` },
      { status: 400 },
    );
  }

  if (entry.needsSymbol && !symbol) {
    return NextResponse.json(
      { error: "Symbol is required for this endpoint" },
      { status: 400 },
    );
  }

  const url = new URL(BASE + entry.path);
  if (entry.needsSymbol) url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `Upstream error ${res.status}: ${res.statusText}`,
          body: text.slice(0, 2000),
        },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
