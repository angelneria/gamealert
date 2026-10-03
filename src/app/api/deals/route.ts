import { NextRequest, NextResponse } from "next/server";
import { scrapeDeals, calculateImportance } from "@/lib/api-client";
import { passesDealDiscount } from "@/lib/filters";
import { config } from "@/config";
import { dealsQuerySchema } from "@/lib/validation";

/**
 * GET /api/deals — Devuelve juegos rebajados (chollos) en tiempo real
 * Query params: maxPrice (USD), minDiscount (%), platform, minMetacritic
 * Filtros de calidad en vivo: precio ≤ tope, descuento ≥ mínimo, Metacritic.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = dealsQuerySchema.safeParse({
      platform: searchParams.get("platform") || undefined,
      minMetacritic: searchParams.get("minMetacritic") || undefined,
      maxPrice: searchParams.get("maxPrice") || undefined,
      minDiscount: searchParams.get("minDiscount") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Parámetros no válidos" },
        { status: 400 }
      );
    }

    const { platform, minMetacritic, maxPrice, minDiscount } = parsed.data;
    const cap = maxPrice ?? config.deals.defaultMaxPrice;
    const minDisc = minDiscount ?? config.deals.defaultMinDiscount;
    const threshold = minMetacritic ?? config.filtering.minMetacritic;

    // CheapShark: una llamada con tope de precio (sin partidas gratis)
    const deals = await scrapeDeals(cap);

    // Puertas del usuario: descuento, plataforma y calidad
    let filtered = deals.filter((g) => passesDealDiscount(g, minDisc));

    if (platform && platform !== "all") {
      filtered = filtered.filter((g) => g.platform === platform);
    }

    if (threshold > 0) {
      filtered = filtered.filter((g) => (g.metacriticScore || 0) >= threshold);
    }

    const scored = filtered.map((g) => ({
      ...g,
      importanceScore: calculateImportance(g),
    }));

    // Mejor valorados primero; a igual puntuación, más rebajado
    scored.sort(
      (a, b) =>
        (b.metacriticScore || 0) - (a.metacriticScore || 0) ||
        (b.discountPct || 0) - (a.discountPct || 0)
    );

    return NextResponse.json({
      deals: scored,
      total: scored.length,
      totalScraped: deals.length,
      maxPrice: cap,
      minDiscount: minDisc,
      minMetacritic: threshold,
      timestamp: new Date().toISOString(),
      source: "cheapshark",
    });
  } catch (error) {
    console.error("[Deals API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deals", deals: [], total: 0 },
      { status: 500 }
    );
  }
}
