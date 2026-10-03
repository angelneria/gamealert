import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./session-core";
import { verifySessionToken } from "./session";

/**
 * Shared auth helpers for API route handlers (Node runtime).
 */

export function getSessionUserId(req: NextRequest): string | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Inicia sesión para continuar" },
    { status: 401 }
  );
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export function serverError(): NextResponse {
  return NextResponse.json(
    { error: "Error interno del servidor" },
    { status: 500 }
  );
}
