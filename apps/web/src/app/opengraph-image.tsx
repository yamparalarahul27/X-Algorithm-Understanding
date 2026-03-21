import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          height: "100%",
          padding: "48px",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 36,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 16,
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "#e0f2fe",
                borderRadius: 9999,
                color: "#0369a1",
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                padding: "12px 22px",
              }}
            >
              macOS desktop app
            </div>
            <div
              style={{
                alignItems: "center",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 9999,
                color: "#475569",
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                padding: "12px 22px",
              }}
            >
              Alpha 0.1v
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
              maxWidth: 940,
            }}
          >
            <div
              style={{
                fontSize: 76,
                fontWeight: 700,
                lineHeight: 1.05,
              }}
            >
              Localhost Status
            </div>
            <div
              style={{
                color: "#475569",
                fontSize: 34,
                lineHeight: 1.3,
              }}
            >
              See active localhost servers, inspect listening ports, and stop
              processes from a focused Mac app.
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                Yamparala Rahul
              </div>
              <div style={{ color: "#475569", fontSize: 24 }}>
                Design Engineer
              </div>
            </div>

            <div
              style={{
                alignItems: "center",
                background: "#0f172a",
                borderRadius: 9999,
                color: "#ffffff",
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                padding: "14px 22px",
              }}
            >
              localhost.hirahul.xyz
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
