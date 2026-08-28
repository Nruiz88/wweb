import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas publicas (no requieren sesion)
const PUBLIC_PATHS = ["/login", "/register", "/reset-password", "/agendar"];
const PUBLIC_API = ["/api/webhook", "/api/health", "/api/public", "/api/appointments/slots"];

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Next.js 16 inyecta scripts inline (bootstrap RSC y flight payload) en páginas
  // estáticas. Sin 'unsafe-inline' en script-src, el navegador los bloquea y la
  // app nunca hidrata (React error #412). NO usar 'strict-dynamic' junto con
  // 'unsafe-inline': los browsers CSP3 ignoran 'unsafe-inline' cuando hay
  // 'strict-dynamic'. Se requiere 'unsafe-eval' solo en dev (Fast Refresh).
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'; " : "; ");

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

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: refresh de sesion en cada request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // API routes
  if (pathname.startsWith("/api")) {
    if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
      return withSecurityHeaders(response);
    }
    if (!user) {
      return withSecurityHeaders(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 })
      );
    }
    return withSecurityHeaders(response);
  }

  // Pages: authenticated user on auth public paths -> dashboard
  // (login/register/reset-password). /agendar stays visible to logged-in
  // users so the owner can preview their public agenda link.
  const isAgendar = pathname === "/agendar" || pathname.startsWith("/agendar");
  if (user && !isAgendar && PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  // Pages: unauthenticated user on protected paths -> login
  // Landing page (/) is always public
  const isLandingPage = pathname === "/";
  if (!user && !isLandingPage && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  return withSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};