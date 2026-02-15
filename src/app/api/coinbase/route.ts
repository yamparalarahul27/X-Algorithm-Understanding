import { NextResponse } from "next/server";

const BASE = "https://api.exchange.coinbase.com"; // public market data

const endpointMap: Record<
  string,
  { path: string; needsProduct?: boolean; params?: Record<string, string> }
> = {
  products: { path: "/products" },
  ticker: { path: "/products/{product_id}/ticker", needsProduct: true },
  book: { path: "/products/{product_id}/book", needsProduct: true, params: { level: "2" } },
  trades: { path: "/products/{product_id}/trades", needsProduct: true },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const product = searchParams.get("product") ?? "";

  const entry = endpointMap[type];
  if (!entry) {
    return NextResponse.json(
      { error: `Unknown endpoint type '${type}'` },
      { status: 400 },
    );
  }

  if (entry.needsProduct && !product) {
    return NextResponse.json(
      { error: "product is required for this endpoint (e.g., BTC-USD)" },
      { status: 400 },
    );
  }

  const path = entry.path.replace("{product_id}", product);
  const url = new URL(BASE + path);
  if (entry.params) {
    Object.entries(entry.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

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
