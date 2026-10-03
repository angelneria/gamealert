import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { preferencesSchema } from "@/lib/validation";
import { getSessionUserId, unauthorized, badRequest, serverError } from "@/lib/api-auth";

/**
 * PUT /api/auth/preferences — Actualiza preferencias del usuario actual (sesión)
 * El email del body se ignora: la identidad viene de la cookie de sesión.
 */
export async function PUT(req: NextRequest) {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return unauthorized();

    const body = await req.json();

    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Datos no válidos");
    }

    const {
      platforms,
      discordWebhookUrl,
      minMetacritic,
      cooldownHours,
      emailEnabled,
      discordEnabled,
      dealsEnabled,
      maxDealPrice,
      minDiscountPct,
    } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return unauthorized();

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        platforms: platforms ? platforms.join(",") : undefined,
        discordWebhookUrl: discordWebhookUrl !== undefined ? discordWebhookUrl : undefined,
        minMetacritic,
        cooldownHours,
        emailEnabled,
        discordEnabled,
        dealsEnabled,
        maxDealPrice,
        minDiscountPct,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        email: updated.email,
        platforms: updated.platforms,
        discordWebhookUrl: updated.discordWebhookUrl,
        discordEnabled: updated.discordEnabled,
        emailEnabled: updated.emailEnabled,
        minMetacritic: updated.minMetacritic,
        cooldownHours: updated.cooldownHours,
        dealsEnabled: updated.dealsEnabled,
        maxDealPrice: updated.maxDealPrice,
        minDiscountPct: updated.minDiscountPct,
      },
    });
  } catch (error) {
    console.error("[Preferences] Error:", error);
    return serverError();
  }
}
