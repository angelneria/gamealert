import { NextRequest, NextResponse } from "next/server";
import { runNotifications } from "@/server/notify-runner";

/**
 * GET/POST /api/cron/notify — Endpoint para el cron programado.
 * Vercel Cron envía `Authorization: Bearer ${CRON_SECRET}` automáticamente.
 * Fuera de Vercel se puede llamar igual con el secreto.
 */
async function handle(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET no configurado" },
        { status: 503 }
      );
    }

    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const result = await runNotifications();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[Cron] Error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
