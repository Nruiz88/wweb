import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { validateEvolutionUrl } from "@/lib/validation";
import { testEvolutionConnection } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";

// POST: Test an Evolution API URL + key before creating an instance.
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { evolutionApiUrl, evolutionApiKey } = (body ?? {}) as {
    evolutionApiUrl?: string;
    evolutionApiKey?: string;
  };

  if (!evolutionApiUrl || !evolutionApiKey) {
    return NextResponse.json(
      { status: "error", error: "URL and API key are required" },
      { status: 400 },
    );
  }

  const urlCheck = validateEvolutionUrl(evolutionApiUrl);
  if (!urlCheck.valid) {
    return NextResponse.json({ status: "error", error: urlCheck.error }, { status: 400 });
  }

  const result = await testEvolutionConnection(
    urlCheck.normalized || evolutionApiUrl.trim(),
    evolutionApiKey,
  );

  if (result.ok) {
    return NextResponse.json({
      status: "success",
      message: "Conexión exitosa: el servidor respondió correctamente.",
      data: { url: urlCheck.normalized },
    });
  }

  const friendly =
    result.status === 401 || result.status === 403
      ? "API key inválida o sin permisos. Verificá que sea la key global de Evolution."
      : result.status === 404
      ? "Servidor no encontrado. Verificá la URL (ej: https://tu-servidor.up.railway.app)."
      : `No se pudo conectar: ${result.message}`;

  return NextResponse.json({ status: "error", error: friendly }, { status: 502 });
}