## API Testing (FMP Crypto)

A small Next.js + Tailwind app to exercise Financial Modeling Prep free crypto endpoints via a server-side proxy.

### Setup
1) Install deps (already done if you used the scaffold):
```bash
npm install
```

2) Add your FMP API key:
```
echo "FMP_API_KEY=your_key_here" > .env.local
```

### Run
```bash
npm run dev
```
Visit http://localhost:3000 and choose an endpoint (list, quote, batch, historical, intraday) and symbol (e.g., BTCUSD). The UI calls `/api/fmp`, which proxies to FMP with your server-side key.

### Notes
- Endpoints covered: list, full/short quote, batch quotes, EOD light, intraday (1m/5m/1h).
- Keep your API key server-side; do not expose it in the browser.
- Responses render raw JSON for inspection.
