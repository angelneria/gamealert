import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, securityHeaders } from "@/lib/security";
import { verifySessionTokenEdge } from "@/lib/session-edge";

/**
 * Middleware (Edge runtime):
 *  1. Rate limiting por IP
 *  2. Cabeceras de seguridad (CSP, HSTS, etc.)
 *  3. Verificación de origen (CSRF) en peticiones mutantes a /api
 *  4. Sesión obligatoria para /dashboard/* (redirige a /login)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limit
  const limited = rateLimit(request);
  if (limited) return limited;

  // 2. CSRF: si viaja un Origin, debe coincidir con el host.
  //    (El cron viaja con Bearer y sin Origin; los navegadores siempre
  //     envían Origin en peticiones mutantes cross-origin.)
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (pathname.startsWith("/api/") && mutating) {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.get("host")) {
          return NextResponse.json(
            { error: "Origen no permitido" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
      }
    }
  }

  // 3. Registro obligatorio para el panel
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("ga_session")?.value;
    const userId = await verifySessionTokenEdge(token);
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // 4. Seguridad
  const response = NextResponse.next();
  return securityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
