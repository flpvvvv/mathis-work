import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Mathis Gallery — Original Artworks by Mathis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#FFF8F0",
          border: "12px solid #1A1A2E",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width="80"
            height="80"
          >
            <rect width="256" height="256" fill="#FFE66D" />
            <rect
              x="16"
              y="16"
              width="224"
              height="224"
              fill="#FF6B6B"
              stroke="black"
              strokeWidth="16"
            />
            <path
              d="M 64 192 V 80 L 128 144 L 192 80 V 192"
              stroke="black"
              strokeWidth="24"
              strokeLinecap="square"
              strokeLinejoin="miter"
              fill="none"
            />
          </svg>
          <span
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#1A1A2E",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Mathis Gallery
          </span>
        </div>
        <span
          style={{
            fontSize: 28,
            color: "#4A4A6A",
            maxWidth: "600px",
            textAlign: "center",
          }}
        >
          Original artworks — illustrations, sketches &amp; mixed-media
        </span>
      </div>
    ),
    { ...size },
  );
}
