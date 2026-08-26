import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas publicas (no requieren sesion)
const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_API = ["/api/webhook", "/api/health"];

export async function middleware(request: NextRequest) {
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
      return response;
    }
    if (!user) {
      return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    }
    return response;
  }

  // Pages: authenticated user on public paths -> dashboard
  if (user && PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Pages: unauthenticated user on protected paths -> login
  if (!user && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Proteger pages (excluye _next, favicon, assets estaticos)
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};