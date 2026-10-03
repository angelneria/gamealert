import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized, serverError } from "@/lib/api-auth";

/**
 * GET /api/notifications — Historial del usuario actual (sesión obligatoria)
 * Nunca expone el historial de otros usuarios.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      100
    );

    const where = { userId };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
    });

    const total = await prisma.notification.count({ where });

    return NextResponse.json({ notifications, total });
  } catch (error) {
    console.error("[Notifications] Error:", error);
    return serverError();
  }
}
