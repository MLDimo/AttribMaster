import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_IMAGE_ALT = "AttribMaster — attribution marketing basée sur des données réelles";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

export function renderOgImage() {
  const logo = readFileSync(join(process.cwd(), "public", "logo-icon.png")).toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #faf5ee 0%, #f3eae0 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image unsupported in ImageResponse */}
          <img
            src={`data:image/png;base64,${logo}`}
            width={96}
            height={96}
            alt=""
            style={{ borderRadius: 22 }}
          />
          <span style={{ fontSize: 68, fontWeight: 700, color: "#3c2e22", letterSpacing: -1 }}>
            AttribMaster
          </span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 34,
            color: "#6b4a32",
            maxWidth: 920,
            lineHeight: 1.4,
          }}
        >
          Devenez maître de votre attribution marketing avec des données réelles, fiables et sans
          approximation.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 52,
            width: 120,
            height: 8,
            borderRadius: 4,
            background: "#c08a3e",
          }}
        />
      </div>
    ),
    { ...OG_IMAGE_SIZE }
  );
}
