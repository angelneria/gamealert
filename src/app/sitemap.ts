import { MetadataRoute } from "next";
import { config } from "@/config";

/**
 * Dynamic sitemap.xml — only PUBLIC pages.
 * /dashboard/* requires login (registro obligatorio), so crawlers
 * would only see a redirect: keeping them out avoids soft-404s.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = config.app.url;
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
