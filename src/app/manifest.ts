import { MetadataRoute } from "next";
import { config } from "@/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameAlert — Juegos Gratis",
    short_name: "GameAlert",
    description:
      "Alertas instantáneas de juegos gratis de calidad en Steam, Epic Games y GOG.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a09",
    theme_color: "#0a0a09",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
