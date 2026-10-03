import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDiscordNotification, isValidDiscordWebhook } from "@/server/discord";
import { getSessionUserId, unauthorized, badRequest, serverError } from "@/lib/api-auth";

/**
 * POST /api/notify/test — Envía un mensaje de prueba SOLO al webhook del
 * usuario actual. No toca preferencias ni notifica a otros usuarios.
 * Body: { webhookUrl?: string } — si se omite, usa el guardado en la cuenta.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const webhookUrl: string =
      typeof body.webhookUrl === "string" && body.webhookUrl.trim()
        ? body.webhookUrl.trim()
        : "";

    let target = webhookUrl;
    if (!target) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { discordWebhookUrl: true },
      });
      target = user?.discordWebhookUrl || "";
    }

    if (!target) {
      return badRequest("No hay webhook configurado");
    }
    if (!isValidDiscordWebhook(target)) {
      return badRequest("URL de webhook de Discord no válida");
    }

    const ok = await sendDiscordNotification(
      {
        title: "Mensaje de prueba de GameAlert",
        platform: "steam",
        storeUrl: "https://gamealert.app",
        imageUrl: "",
        description:
          "Tu integración funciona. A partir de ahora recibirás aquí los juegos gratis de calidad que coincidan con tus preferencias.",
        publisher: "GameAlert",
      },
      target
    );

    if (!ok) {
      return NextResponse.json(
        { error: "Discord rechazó el webhook. Verifica la URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: "Mensaje de prueba enviado" });
  } catch (error) {
    console.error("[Notify] Test error:", error);
    return serverError();
  }
}
