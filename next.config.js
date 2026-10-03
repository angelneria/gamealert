/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_URL: process.env.APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_API_URL: process.env.API_URL || "http://localhost:3000",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.steampowered.com" },
      { protocol: "https", hostname: "**.epicgames.com" },
      { protocol: "https", hostname: "**.akamai.steamstatic.com" },
      { protocol: "https", hostname: "**.gog.com" },
      { protocol: "https", hostname: "**.gog-statics.com" },
      { protocol: "https", hostname: "images.igdb.com" },
      { protocol: "https", hostname: "media.rawg.io" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
};

module.exports = nextConfig;
