"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Provider = "fmp" | "coinbase";

type FmpEndpointKey =
  | "list"
  | "quote"
  | "quote-short"
  | "batch"
  | "eod-light"
  | "intraday-1min"
  | "intraday-5min"
  | "intraday-1h";

type CoinbaseEndpointKey = "products" | "ticker" | "book" | "trades";

type ApiResponse = unknown;

const FMP_ENDPOINTS: { key: FmpEndpointKey; label: string; needsSymbol?: boolean }[] = [
  { key: "list", label: "Cryptocurrency List" },
  { key: "quote", label: "Full Quote", needsSymbol: true },
  { key: "quote-short", label: "Quote (Short)", needsSymbol: true },
  { key: "batch", label: "All Crypto Quotes" },
  { key: "eod-light", label: "Historical EOD (Light)", needsSymbol: true },
  { key: "intraday-1min", label: "Intraday 1m", needsSymbol: true },
  { key: "intraday-5min", label: "Intraday 5m", needsSymbol: true },
  { key: "intraday-1h", label: "Intraday 1h", needsSymbol: true },
];

const COINBASE_ENDPOINTS: {
  key: CoinbaseEndpointKey;
  label: string;
  needsSymbol?: boolean;
  hint?: string;
}[] = [
  { key: "products", label: "Products (pairs)" },
  { key: "ticker", label: "Ticker", needsSymbol: true, hint: "e.g., BTC-USD" },
  { key: "book", label: "Order Book L2", needsSymbol: true, hint: "e.g., BTC-USD" },
  { key: "trades", label: "Recent Trades", needsSymbol: true, hint: "e.g., BTC-USD" },
];

export default function Home() {
  const [provider, setProvider] = useState<Provider>("fmp");
  const [fmpEndpoint, setFmpEndpoint] = useState<FmpEndpointKey>("quote");
  const [coinbaseEndpoint, setCoinbaseEndpoint] =
    useState<CoinbaseEndpointKey>("ticker");
  const [fmpSymbol, setFmpSymbol] = useState("BTCUSD");
  const [coinbaseProduct, setCoinbaseProduct] = useState("BTC-USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const endpointKey = provider === "fmp" ? fmpEndpoint : coinbaseEndpoint;
  const endpointList = provider === "fmp" ? FMP_ENDPOINTS : COINBASE_ENDPOINTS;

  const requiresSymbol = useMemo(
    () => endpointList.find((e) => e.key === endpointKey)?.needsSymbol,
    [endpointKey, endpointList],
  );

  useEffect(() => {
    setError(null);
    setData(null);
  }, [provider, endpointKey]);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const params = new URLSearchParams({ type: endpointKey });

      if (provider === "fmp") {
        if (requiresSymbol) {
          params.set("symbol", fmpSymbol.trim());
        }
      } else {
        if (requiresSymbol) {
          params.set("product", coinbaseProduct.trim());
        }
      }

      const res = await fetch(
        `/api/${provider === "fmp" ? "fmp" : "coinbase"}?${params.toString()}`,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error || res.statusText;
        throw new Error(message || "Request failed");
      }

      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        backgroundImage: "url('/background_wallpaper_dot.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 bg-white/85 px-6 py-10 backdrop-blur">
        <header className="flex flex-col gap-3 border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              API Sandbox
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Crypto Data • REST
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              API Testing Console
            </h1>
            <p className="max-w-3xl text-sm text-slate-600 sm:text-base">
              Try free, public crypto endpoints via server-side proxies. FMP calls
              use your server-side key (<code>FMP_API_KEY</code> in <code>.env.local</code>);
              Coinbase market data is public and unauthenticated.
            </p>
          </div>
          <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="h-2 w-2 bg-emerald-500" />
              <div>
                <p className="font-semibold text-slate-900">Server proxy</p>
                <p className="text-slate-500">Keys stay on the server.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="h-2 w-2 bg-sky-500" />
              <div>
                <p className="font-semibold text-slate-900">FMP</p>
                <p className="text-slate-500">list, quotes, intraday.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="h-2 w-2 bg-indigo-500" />
              <div>
                <p className="font-semibold text-slate-900">Coinbase</p>
                <p className="text-slate-500">products, ticker, book, trades.</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:grid-cols-[360px,1fr]">
          <div className="space-y-4">
            <div className="flex gap-2">
              {([
                { id: "fmp", label: "FMP" },
                { id: "coinbase", label: "Coinbase" },
              ] as const).map((item) => (
                <Button
                  key={item.id}
                  variant={provider === item.id ? "default" : "secondary"}
                  onClick={() => setProvider(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-200">
                  Endpoint
                </label>
                <span className="text-xs text-slate-500">{provider === "fmp" ? "FMP" : "Coinbase"}</span>
              </div>
              <select
                value={endpointKey}
                onChange={(e) =>
                  provider === "fmp"
                    ? setFmpEndpoint(e.target.value as FmpEndpointKey)
                    : setCoinbaseEndpoint(e.target.value as CoinbaseEndpointKey)
                }
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-2 ring-transparent transition focus:border-sky-500 focus:ring-sky-200"
              >
                {(provider === "fmp" ? FMP_ENDPOINTS : COINBASE_ENDPOINTS).map((ep) => (
                  <option key={ep.key} value={ep.key}>
                    {ep.label}
                  </option>
                ))}
              </select>
            </div>

            {requiresSymbol && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  {provider === "fmp"
                    ? "Symbol (e.g., BTCUSD)"
                    : "Product (e.g., BTC-USD)"}
                </label>
                <input
                  value={
                    provider === "fmp" ? fmpSymbol : coinbaseProduct
                  }
                  onChange={(e) =>
                    provider === "fmp"
                      ? setFmpSymbol(e.target.value.toUpperCase())
                      : setCoinbaseProduct(e.target.value.toUpperCase())
                  }
                  placeholder={provider === "fmp" ? "BTCUSD" : "BTC-USD"}
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-2 ring-transparent transition focus:border-sky-500 focus:ring-sky-200"
                />
                {provider === "coinbase" && (
                  <p className="text-xs text-slate-500">
                    Use Coinbase product IDs with dash (e.g., BTC-USD, ETH-USD).
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleFetch}
              disabled={
                loading ||
                (requiresSymbol &&
                  (provider === "fmp"
                    ? !fmpSymbol.trim()
                    : !coinbaseProduct.trim()))
              }
              className="w-full"
            >
              {loading ? "Fetching..." : "Send Request"}
            </Button>

            <p className="text-xs text-slate-500">
              These calls hit server routes (<code>/api/fmp</code> or <code>/api/coinbase</code>),
              so keys stay server-side. FMP requires <code>FMP_API_KEY</code> in
              <code>.env.local</code>; Coinbase public endpoints need no key.
            </p>
          </div>

          <div className="min-h-[380px] border border-slate-200 bg-slate-50 p-4 shadow-inner shadow-slate-200/80">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 bg-emerald-500" />
                <span>Response</span>
              </div>
              {loading && <span className="animate-pulse">Loading...</span>}
            </div>
            <div className="h-full overflow-auto bg-white p-4 font-mono text-xs leading-relaxed text-slate-800">
              {error ? (
                <pre className="text-rose-600">{error}</pre>
              ) : data ? (
                <pre>{JSON.stringify(data, null, 2)}</pre>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p>Choose an endpoint and send a request to see JSON here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
