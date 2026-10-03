import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { getSessionUserId, badRequest, serverError } from "@/lib/api-auth";

/**
 * POST /api/auth — Registra un nuevo usuario (obligatorio: email + contraseña)
 * GET  /api/auth — Devuelve el usuario de la sesión actual
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Datos no válidos");
    }

    const { email, password, platforms, discordWebhookUrl } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email. Inicia sesión." },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        isEmailVerified: true,
        platforms: platforms.join(","),
        discordWebhookUrl: discordWebhookUrl || "",
        discordEnabled: discordWebhookUrl ? true : false,
        emailEnabled: true,
      },
    });

    for (const platform of platforms) {
      await prisma.subscription.create({
        data: { userId: user.id, platform, isActive: true },
      });
    }

    const res = NextResponse.json(
      {
        message: "¡Registro exitoso!",
        user: { id: user.id, email: user.email, platforms: user.platforms },
      },
      { status: 201 }
    );
    setSessionCookie(res, user.id);
    return res;
  } catch (error) {
    console.error("[Auth] Error de registro:", error);
    return serverError();
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ user: null }, { status: 401 });

    return NextResponse.json({
      user: {
        email: user.email,
        platforms: user.platforms,
        discordWebhookUrl: user.discordWebhookUrl,
        discordEnabled: user.discordEnabled,
        emailEnabled: user.emailEnabled,
        minMetacritic: user.minMetacritic,
        cooldownHours: user.cooldownHours,
        dealsEnabled: user.dealsEnabled,
        maxDealPrice: user.maxDealPrice,
        minDiscountPct: user.minDiscountPct,
      },
    });
  } catch (error) {
    console.error("[Auth] Error:", error);
    return serverError();
  }
}
