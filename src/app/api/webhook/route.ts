import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/webhook
 * Webhook endpoint for external platforms to report free games
 * Used when platforms push free game data directly
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, games, signature } = body;

    // Validate webhook signature (implement HMAC verification)
    // if (!verifySignature(body, signature)) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }

    const results = [];

    for (const gameData of games) {
      // Validate the game data
      if (!gameData.title || !gameData.platformGameId) {
        continue;
      }

      // Process and filter
      // Game will be picked up by the next scheduled scraper
      // Or could be processed immediately here
      results.push({
        title: gameData.title,
        status: "received",
      });
    }

    return NextResponse.json({ received: results.length, results });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
