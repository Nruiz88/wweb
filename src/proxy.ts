import { NextResponse, type NextRequest } from "next/server";
import { getUserSession } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/register", "/reset-password", "/reset-password/confirm", "/privacidad", "/terminos"];

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'; " : " ; ");

  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      scriptSrc +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https: wss:; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
  );
  return response;
}

/**
 * Middleware de auth: protege las rutas del dashboard.
 * - Usuario autenticado → permite el acceso
 * - Usuario sin sesión en /login o /register → permite ver el formulario
 * - Usuario sin sesión en el dashboard → redirige a /login
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: rutas públicas están definidas en cada handler (ver PUBLIC_API)
  if (pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.next({ request }));
  }

  // Pages
  const session = await getUserSession();

  // Landing y rutas públicas del auth
  const isLanding = pathname === "/";
  if (isLanding || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (session) {
      // Usuario autenticado en ruta pública → redirige al dashboard
      return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
    return withSecurityHeaders(NextResponse.next({ request }));
  }

  // Dashboard protegido
  if (!session) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  // Si no es admin, el usuario solo puede usar sus instancias asignadas
  if (session.role !== "admin") {
    const { query } = await import("./lib/db");
    const rows = await query(
      "SELECT ui.id FROM user_instances ui JOIN instances i ON ui.instance_id = i.id WHERE ui.user_id = ? LIMIT 1",
      [session.userId]
    );
    // Sin instancias asignadas solo puede navegar el dashboard (evita loop de redirección)
    if (!rows.length && pathname !== "/dashboard") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  return withSecurityHeaders(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
