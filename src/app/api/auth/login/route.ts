import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { verifyPasswordOrDummy } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { badRequest, serverError } from "@/lib/api-auth";

/**
 * POST /api/auth/login — Inicia sesión con email + contraseña
 * Devuelve una sesión firmada en cookie httpOnly.
 * Mensaje de error genérico para no revelar si la cuenta existe.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Datos no válidos");
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = verifyPasswordOrDummy(password, user?.passwordHash || "");

    if (!user || !valid || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      success: true,
      user: { email: user.email, platforms: user.platforms },
    });
    setSessionCookie(res, user.id);
    return res;
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return serverError();
  }
}
