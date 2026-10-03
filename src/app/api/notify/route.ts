import { NextRequest, NextResponse } from "next/server";
import { runNotifications } from "@/server/notify-runner";
import { getSessionUserId, unauthorized, serverError } from "@/lib/api-auth";

/**
 * POST /api/notify — Ejecuta el chequeo de notificaciones para TODOS
 * los usuarios registrados. Requiere sesión (el cron usa /api/cron/notify).
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return unauthorized();

    const result = await runNotifications();

    return NextResponse.json({
      success: true,
      message: `Consultados ${result.scraped} juegos. ${result.users} usuarios. ${result.notified} alertas enviadas.`,
      result,
    });
  } catch (error) {
    console.error("[Notify] Error:", error);
    return serverError();
  }
}
