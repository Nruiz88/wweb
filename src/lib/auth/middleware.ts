import type { NextRequest } from "next/server";
import { getUserSession } from "..";

const SAFE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".ttf", ".woff2", ".otf", ".mp4", ".webm", ".mp3", ".ogg", ".wav", ".json", ".css", ".js", ".map"]);

function isStaticFile(parsed: any): boolean {
  const pathname = parsed.pathname || "";
  const ext = pathname.includes(".") ? pathname.slice(pathname.lastIndexOf(".")) : "";
  return SAFE_EXTENSIONS.has(ext);
}

function isApiRoute(parsed: any): boolean {
  return parsed.pathname?.startsWith("/api") ?? false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas estáticas y API no requieren sesión
  if (isStaticFile(request.nextUrl) || isApiRoute(request.nextUrl)) {
    return null;
  }

  const session = await getUserSession();

  // El dashboard / (auth) reqiere sesión
  const publicAuthPaths = ["/login", "/register", "/reset-password", "/reset-password/confirm", "/privacidad", "/terminos"];
  if (pathname === "/" || publicAuthPaths.includes(pathname)) {
    if (!session) return null;
    // Usuario autenticado va directo al dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return Response.redirect(url);
  }

  // Rutas protegidas
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const search = request.nextUrl.search;
    if (search) url.search = search;
    return Response.redirect(url);
  }

  return null;
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
