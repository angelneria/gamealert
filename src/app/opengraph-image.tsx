import { ImageResponse } from "next/og";

/**
 * Tarjeta Open Graph / Twitter (1200×630).
 * Se genera en el servidor sin fuentes externas para no depender
 * de la red en el build. Misma identidad que la web: negro + lima.
 */
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          backgroundColor: "#0a0a09",
          color: "#ece9e2",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              backgroundColor: "#d4ff3f",
            }}
          />
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              letterSpacing: "4px",
            }}
          >
            GAMEALERT
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "130px",
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: "-2px",
          }}
        >
          JUEGOS
          <br />
          GRATIS.
        </div>
        <div
          style={{
            marginTop: "36px",
            fontSize: "34px",
            color: "#d4ff3f",
            fontWeight: 700,
          }}
        >
          Steam · Epic · GOG — aviso en tu Discord
        </div>
      </div>
    ),
    { ...size }
  );
}
